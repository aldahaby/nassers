import { DOCUMENT_LIMITS } from '@/config/documents';
import { hasTextLayer, layoutPdfPage, type PdfTextItem } from '@/core/documents/pdfLayout';
import type { ExtractedPage } from './DocumentService';

/** The slice of the PDF.js API Studyling uses (vendor/pdfjs/pdfjs.web.js on web). */
export interface PdfJs {
  getDocument(src: Record<string, unknown>): { promise: Promise<PdfDoc>; destroy?: () => Promise<void> };
  /** Operator codes, to tell a scanned page (an image) from a blank one. */
  OPS?: Record<string, number>;
}
interface PdfDoc {
  numPages: number;
  getPage(n: number): Promise<PdfPage>;
}
interface PdfPage {
  getTextContent(): Promise<{ items: ({ str: string; transform: number[]; width: number; height: number } | { type: string })[] }>;
  getOperatorList?(): Promise<{ fnArray: number[] }>;
  cleanup(): void;
}

const IMAGE_OPS = ['paintImageXObject', 'paintInlineImageXObject', 'paintImageMaskXObject', 'paintImageXObjectRepeat', 'paintInlineImageXObjectGroup', 'paintImageMaskXObjectGroup', 'paintImageMaskXObjectRepeat'];

/** Whether a page without text shows a picture (a scan) rather than nothing at all. Unknown → assume a picture. */
async function pageHasImage(pdfjs: PdfJs, page: PdfPage): Promise<boolean> {
  if (!pdfjs.OPS || !page.getOperatorList) return true;
  try {
    const codes = new Set(IMAGE_OPS.map((k) => pdfjs.OPS![k]).filter((v): v is number => typeof v === 'number'));
    return (await page.getOperatorList()).fnArray.some((fn) => codes.has(fn));
  } catch {
    return true;
  }
}

export type PdfReadErrorCode = 'encrypted' | 'unreadable' | 'tooLarge' | 'scanned';

export class PdfReadError extends Error {
  constructor(readonly code: PdfReadErrorCode) {
    super(code);
    this.name = 'PdfReadError';
  }
}

export interface PdfReadResult {
  pages: ExtractedPage[];
  /** 1-based page numbers that had no text layer (scanned pictures), so were skipped. */
  pagesWithoutText: number[];
}

/**
 * Text of every page, laid out for the syllabus parsers (columns and blank
 * lines kept). Throws PdfReadError for password-protected, damaged, too long,
 * or scanned (no text at all) documents. Nothing leaves the device.
 */
export async function readPdfText(pdfjs: PdfJs, bytes: Uint8Array, onProgress?: (done: number, total: number) => void): Promise<PdfReadResult> {
  let doc: PdfDoc;
  // PDF.js may detach the buffer it is given; hand it a copy.
  const task = pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false, disableFontFace: true, useSystemFonts: false, stopAtErrors: false, verbosity: 0 });
  try {
    doc = await task.promise;
  } catch (e) {
    void task.destroy?.().catch(() => {});
    const name = (e as { name?: string })?.name ?? '';
    throw new PdfReadError(name === 'PasswordException' ? 'encrypted' : 'unreadable');
  }
  try {
    if (doc.numPages > DOCUMENT_LIMITS.maxPdfPages) throw new PdfReadError('tooLarge');
    const pages: ExtractedPage[] = [];
    const pagesWithoutText: number[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      const items: PdfTextItem[] = [];
      for (const it of content.items) {
        if (!('str' in it) || !it.str) continue;
        items.push({ str: it.str, x: it.transform[4] ?? 0, y: it.transform[5] ?? 0, width: it.width, height: it.height || Math.hypot(it.transform[2] ?? 0, it.transform[3] ?? 0) });
      }
      const text = layoutPdfPage(items);
      if (hasTextLayer(text)) pages.push({ index: n - 1, text, method: 'embeddedText' });
      else {
        // A picture of a page (scan) is reported; a blank page is simply empty.
        if (await pageHasImage(pdfjs, page)) pagesWithoutText.push(n);
        // Keep the page slot so page numbers in provenance stay true.
        pages.push({ index: n - 1, text: '', method: 'embeddedText' });
      }
      page.cleanup();
      onProgress?.(n, doc.numPages);
    }
    if (pagesWithoutText.length && pages.every((p) => !p.text)) throw new PdfReadError('scanned');
    return { pages, pagesWithoutText };
  } catch (e) {
    if (e instanceof PdfReadError) throw e;
    throw new PdfReadError('unreadable');
  } finally {
    void task.destroy?.().catch(() => {});
  }
}
