import { DOCUMENT_LIMITS } from '@/config/documents';
import { isZip } from './zip';

/**
 * File-type checks and text-quality checks for syllabus documents. Types are
 * decided from the bytes (not only the file name), and text that is mostly
 * unreadable is refused rather than turned into a partial import.
 */
export type DocumentKind = 'pdf' | 'docx' | 'text' | 'image' | 'legacyDoc' | 'unknown';

export function sniffDocumentKind(bytes: Uint8Array, name = ''): DocumentKind {
  const b = bytes;
  const lower = name.toLowerCase();
  if (b.length >= 5 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2d) return 'pdf';
  if (isZip(b)) return lower.endsWith('.zip') ? 'unknown' : 'docx'; // confirmed by extractDocxText (word/document.xml)
  if (b.length >= 8 && b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0) return 'legacyDoc';
  if (b.length >= 4 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image';
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image';
  if (b.length >= 12 && String.fromCharCode(b[4]!, b[5]!, b[6]!, b[7]!) === 'ftyp' && /heic|heix|mif1|avif/.test(String.fromCharCode(b[8]!, b[9]!, b[10]!, b[11]!))) return 'image';
  // Text: no NUL bytes and mostly printable in the first few KB.
  const head = b.subarray(0, Math.min(b.length, 4096));
  if (head.length && !head.includes(0)) {
    let printable = 0;
    for (const c of head) if (c === 9 || c === 10 || c === 12 || c === 13 || c >= 32) printable++;
    if (printable / head.length > 0.95) return 'text';
  }
  return 'unknown';
}

export type Readability = { ok: true; letters: number; ratio: number } | { ok: false; reason: 'empty' | 'unreadable'; letters: number; ratio: number };

/** Is there enough real text to work with? */
export function assessReadability(text: string): Readability {
  const visible = text.replace(/\s+/g, '');
  const letters = (text.match(/\p{L}/gu) ?? []).length;
  const readable = (visible.match(/[\p{L}\p{N}.,:;%()/\-'"&@#|]/gu) ?? []).length;
  const ratio = visible.length ? readable / visible.length : 0;
  if (letters < DOCUMENT_LIMITS.minLetters) return { ok: false, reason: visible.length === 0 ? 'empty' : 'unreadable', letters, ratio };
  if (ratio < DOCUMENT_LIMITS.minReadableRatio) return { ok: false, reason: 'unreadable', letters, ratio };
  return { ok: true, letters, ratio };
}

const shape = (line: string) =>
  line
    .toLowerCase()
    .replace(/\d+/g, '#')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Running headers/footers ("COMP 202 · Fall 2026 · Page 3 of 9") repeat on
 * most pages. Their repeats (and bare page numbers) are blanked so they don't
 * look like syllabus content; the first occurrence stays, and blank lines keep
 * every other line's page/line reference unchanged.
 */
export function stripRunningHeaders(text: string): { text: string; removed: number } {
  const pages = text.split('\f');
  let removed = 0;
  const pageNumber = /^(page\s*)?#(\s*(of|\/)\s*#)?$|^-\s*#\s*-$/;
  const counts = new Map<string, number>();
  if (pages.length >= 2) {
    for (const page of pages) {
      const seen = new Set<string>();
      for (const l of page.split('\n')) {
        const s = shape(l);
        if (s.length >= 4 && !seen.has(s)) {
          seen.add(s);
          counts.set(s, (counts.get(s) ?? 0) + 1);
        }
      }
    }
  }
  const threshold = Math.max(2, Math.ceil(pages.length * 0.5));
  const firstSeen = new Set<string>();
  const out = pages.map((page) =>
    page
      .split('\n')
      .map((l) => {
        const s = shape(l);
        if (!s) return l;
        if (pageNumber.test(s)) {
          removed++;
          return '';
        }
        if (pages.length >= 2 && (counts.get(s) ?? 0) >= threshold) {
          if (!firstSeen.has(s)) {
            firstSeen.add(s);
            return l;
          }
          removed++;
          return '';
        }
        return l;
      })
      .join('\n'),
  );
  return { text: out.join('\f'), removed };
}
