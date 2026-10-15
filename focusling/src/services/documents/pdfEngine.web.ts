import type { PdfJs } from './pdfReader';

/** Web: Mozilla PDF.js, pre-bundled for Metro (tools/vendor-pdfjs.mjs). Loaded on first use. */
let engine: PdfJs | null = null;
export function loadPdfEngine(): PdfJs {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  engine ??= require('../../../vendor/pdfjs/pdfjs.web.js') as PdfJs;
  return engine;
}
