import { DOCUMENT_LIMITS } from '@/config/documents';
import { decodeUtf8 } from './utf8';
import { readZipEntries, readZipEntry, ZipError } from './zip';

/**
 * DOCX → plain text for the syllabus parser. Reads only word/document.xml:
 * paragraphs become lines, table rows become " | "-separated cells (the
 * parser's table format), and Word's page breaks become form feeds so page
 * references survive. Headers, footers, comments, macros and embedded objects
 * are never read or run.
 */
export type DocxResult = { ok: true; pages: string[]; usedRenderedBreaks: boolean } | { ok: false; error: 'unreadable' | 'encrypted' | 'tooLarge' | 'notDocx' };

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decodeEntities = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : '';
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });

export function docxXmlToPages(xml: string): { pages: string[]; usedRenderedBreaks: boolean } {
  const pages: string[] = [];
  let lines: string[] = [];
  let para = '';
  let cell = '';
  let cells: string[] = [];
  let tableDepth = 0;
  let inText = false;
  let inProps = 0;
  let usedRenderedBreaks = false;
  let explicitBreaks = false;

  const pushLine = (text: string) => {
    if (lines.join('').length + text.length < DOCUMENT_LIMITS.maxTextChars) lines.push(text);
  };
  const pageBreak = () => {
    if (tableDepth > 0) return; // a break inside a table row is applied after the row
    if (para.trim()) {
      pushLine(para);
      para = '';
    }
    pages.push(lines.join('\n'));
    lines = [];
  };

  for (const m of xml.matchAll(/<[^>]+>|[^<]+/g)) {
    const tok = m[0];
    if (tok[0] !== '<') {
      if (inText) para += decodeEntities(tok);
      continue;
    }
    const tag = /^<\/?\s*([a-zA-Z0-9:]+)/.exec(tok)?.[1] ?? '';
    const closing = tok[1] === '/';
    const selfClosing = tok.endsWith('/>');
    switch (tag) {
      case 'w:t':
        inText = !closing && !selfClosing;
        break;
      case 'w:pPr':
      case 'w:rPr':
        if (!selfClosing) inProps += closing ? -1 : 1;
        break;
      case 'w:tab':
        if (inProps <= 0) para += '\t';
        break;
      case 'w:br':
      case 'w:cr':
        if (/w:type="page"/.test(tok)) {
          explicitBreaks = true;
          pageBreak();
        } else para += '\n';
        break;
      case 'w:lastRenderedPageBreak':
        // Where Word last laid out a page break: the closest thing to real page numbers.
        if (!explicitBreaks) {
          usedRenderedBreaks = true;
          pageBreak();
        }
        break;
      case 'w:p':
        if (closing || selfClosing) {
          if (tableDepth > 0) cell += (cell ? ' ' : '') + para.trim();
          else if (para.trim()) pushLine(para);
          para = '';
        }
        break;
      case 'w:tbl':
        tableDepth += closing ? -1 : selfClosing ? 0 : 1;
        if (tableDepth < 0) tableDepth = 0;
        break;
      case 'w:tc':
        if (closing && tableDepth === 1) {
          cells.push(cell.replace(/\s+/g, ' ').trim());
          cell = '';
        }
        break;
      case 'w:tr':
        if (closing && tableDepth === 1) {
          const row = cells.filter(Boolean);
          if (row.length) pushLine(row.join(' | '));
          cells = [];
        }
        break;
      default:
        break;
    }
  }
  if (para.trim()) pushLine(para);
  pages.push(lines.join('\n'));
  // Drop empty pages created by leading/trailing breaks, keeping order.
  const kept = pages.map((p) => p.replace(/[ \t]+\n/g, '\n').trim());
  while (kept.length > 1 && !kept[kept.length - 1]) kept.pop();
  return { pages: kept.length ? kept : [''], usedRenderedBreaks };
}

export function extractDocxText(bytes: Uint8Array): DocxResult {
  if (bytes.length > DOCUMENT_LIMITS.maxFileBytes) return { ok: false, error: 'tooLarge' };
  try {
    const entries = readZipEntries(bytes);
    const doc = entries.find((e) => e.name === 'word/document.xml');
    if (!doc) return { ok: false, error: 'notDocx' };
    const xml = decodeUtf8(readZipEntry(bytes, doc, { remaining: DOCUMENT_LIMITS.maxUncompressedBytes }));
    return { ok: true, ...docxXmlToPages(xml) };
  } catch (e) {
    if (e instanceof ZipError && e.message === 'encrypted') return { ok: false, error: 'encrypted' };
    if (e instanceof ZipError && /too large|suspicious|too many/.test(e.message)) return { ok: false, error: 'tooLarge' };
    return { ok: false, error: 'unreadable' };
  }
}
