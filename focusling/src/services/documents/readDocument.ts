import { DOCUMENT_LIMITS } from '@/config/documents';
import { assessReadability, extractDocxText, sniffDocumentKind } from '@/core';
import { decodeUtf8 } from '@/core/documents/utf8';
import type { ExtractedPage, ExtractionError, ExtractionResult } from './DocumentService';

export interface ReadDeps {
  /** PDF reader for this platform: iOS PDFKit (by uri) or PDF.js on web (by bytes). */
  pdf: ((uri: string, bytes: Uint8Array) => Promise<ExtractedPage[] | { pages: ExtractedPage[]; pagesWithoutText: number[] }>) | null;
  /** Photo OCR for this platform, or null (web). */
  image: ((uri: string) => Promise<ExtractedPage[]>) | null;
}

type Out = { ok: true; value: ExtractionResult } | { ok: false; error: ExtractionError };

/**
 * One path for every platform: check size, decide the type from the bytes,
 * extract text, then refuse empty or garbled results rather than importing a
 * fragment of the syllabus.
 */
export async function readDocument(bytes: Uint8Array, name: string, uri: string, deps: ReadDeps): Promise<Out> {
  if (bytes.length > DOCUMENT_LIMITS.maxFileBytes) return { ok: false, error: 'tooLarge' };
  if (!bytes.length) return { ok: false, error: 'empty' };
  const kind = sniffDocumentKind(bytes, name);
  let pages: ExtractedPage[];
  let pagesWithoutText: number[] = [];
  try {
    switch (kind) {
      case 'text': {
        const text = decodeUtf8(bytes).slice(0, DOCUMENT_LIMITS.maxTextChars);
        pages = text.split('\f').map((t, i) => ({ index: i, text: t, method: 'embeddedText' as const }));
        break;
      }
      case 'docx': {
        const r = extractDocxText(bytes);
        if (!r.ok) return { ok: false, error: r.error === 'notDocx' ? 'unsupported' : r.error };
        pages = r.pages.map((t, i) => ({ index: i, text: t, method: 'docx' as const }));
        break;
      }
      case 'pdf': {
        if (!deps.pdf) return { ok: false, error: 'unsupported' };
        const r = await deps.pdf(uri, bytes);
        pages = Array.isArray(r) ? r : r.pages;
        pagesWithoutText = Array.isArray(r) ? [] : r.pagesWithoutText;
        break;
      }
      case 'image':
        if (!deps.image) return { ok: false, error: 'unsupported' };
        pages = await deps.image(uri);
        break;
      default:
        return { ok: false, error: 'unsupported' };
    }
  } catch (e) {
    // PdfReadError carries why: password, damage, too long, or a scan with no text layer.
    const code = (e as { code?: string })?.code;
    if (code === 'encrypted' || code === 'tooLarge' || code === 'scanned') return { ok: false, error: code };
    return { ok: false, error: 'unreadable' };
  }
  const all = pages.map((p) => p.text).join('\n');
  const quality = assessReadability(all);
  if (!quality.ok) return { ok: false, error: quality.reason };
  const method: ExtractionResult['method'] = kind === 'text' ? 'pastedText' : kind === 'docx' ? 'docx' : pages.every((p) => p.method === 'ocr') ? 'ocr' : pages.some((p) => p.method === 'ocr') ? 'mixed' : 'embeddedText';
  return { ok: true, value: { pages, method, ...(pagesWithoutText.length ? { pagesWithoutText } : {}) } };
}
