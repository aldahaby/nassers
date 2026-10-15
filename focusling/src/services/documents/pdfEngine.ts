import type { PdfJs } from './pdfReader';

/** Native builds read PDFs with PDFKit (modules/studyling-native); PDF.js isn't bundled there. */
export function loadPdfEngine(): PdfJs | null {
  return null;
}
