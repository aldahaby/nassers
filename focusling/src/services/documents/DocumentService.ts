/**
 * Choosing a syllabus file and extracting its text ON THE DEVICE.
 * iOS: PDFKit text first; Vision OCR for pages without embedded text
 * (modules/studyling-native). Nothing is uploaded anywhere.
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
  method: 'embeddedText' | 'ocr';
}

export interface ExtractionResult {
  pages: ExtractedPage[];
  method: 'embeddedText' | 'ocr' | 'mixed' | 'pastedText';
}

export type ExtractionError = 'cancelled' | 'unsupported' | 'unreadable' | 'empty';

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
  const ocr = pages.filter((p) => p.method === 'ocr').length;
  return ocr === 0 ? 'embeddedText' : ocr === pages.length ? 'ocr' : 'mixed';
}
