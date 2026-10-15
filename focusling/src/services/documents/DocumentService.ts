/**
 * Choosing a syllabus file and extracting its text ON THE DEVICE. Nothing is
 * uploaded anywhere.
 * - Plain text and DOCX: read in JavaScript on every platform (core/documents).
 * - PDF: iOS PDFKit text first, Vision OCR for pages without text
 *   (modules/studyling-native). Not available on web.
 * - Photos (JPEG/PNG/HEIC): iOS Vision OCR. Not available on web.
 */
export interface PickedDocument {
  uri: string;
  name: string;
  mimeType: string | null;
  /** Web only: the picked file, read in memory. */
  file?: Blob;
}

export interface ExtractedPage {
  index: number;
  text: string;
  method: 'embeddedText' | 'ocr' | 'docx';
}

export interface ExtractionResult {
  pages: ExtractedPage[];
  method: 'embeddedText' | 'ocr' | 'mixed' | 'pastedText' | 'docx';
}

/**
 * - unsupported: this platform can't read this kind of file (e.g. PDF on web, old .doc);
 * - unreadable: damaged, or the text is mostly garbled (a poor scan);
 * - empty: no text at all;
 * - tooLarge: over the size limit (or a suspicious archive);
 * - encrypted: password-protected.
 */
export type ExtractionError = 'cancelled' | 'unsupported' | 'unreadable' | 'empty' | 'tooLarge' | 'encrypted';

/** File types offered in the picker. */
export const SYLLABUS_MIME_TYPES = ['application/pdf', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'] as const;
export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/heic'] as const;

export interface DocumentService {
  readonly kind: 'native' | 'web';
  /** Whether PDF text extraction works on this platform. */
  readonly canReadPdf: boolean;
  pick(): Promise<PickedDocument | null>;
  extract(doc: PickedDocument, onProgress?: (done: number, total: number) => void): Promise<{ ok: true; value: ExtractionResult } | { ok: false; error: ExtractionError }>;
}

export function joinPages(result: ExtractionResult): string {
  return result.pages.map((p) => p.text).join('\f');
}

export function methodOf(pages: ExtractedPage[]): ExtractionResult['method'] {
  if (pages.length && pages.every((p) => p.method === 'docx')) return 'docx';
  const ocr = pages.filter((p) => p.method === 'ocr').length;
  return ocr === 0 ? 'embeddedText' : ocr === pages.length ? 'ocr' : 'mixed';
}
