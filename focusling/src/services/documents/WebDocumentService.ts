import * as DocumentPicker from 'expo-document-picker';
import { SYLLABUS_MIME_TYPES, type DocumentService, type PickedDocument } from './DocumentService';
import { loadPdfEngine } from './pdfEngine';
import { readPdfText } from './pdfReader';
import { readDocument } from './readDocument';

/**
 * Web (including iPhone Safari): files are read in the browser's memory and
 * never uploaded. Text and DOCX in JavaScript; PDFs with Mozilla PDF.js (the
 * text layer only: there is no OCR on web, so a scanned PDF says so). Photos
 * need the iPhone app.
 */
export class WebDocumentService implements DocumentService {
  readonly kind = 'web' as const;
  readonly canReadPdf = true;

  async pick(): Promise<PickedDocument | null> {
    const r = await DocumentPicker.getDocumentAsync({ type: [...SYLLABUS_MIME_TYPES], multiple: false });
    if (r.canceled || !r.assets?.[0]) return null;
    const a = r.assets[0];
    return { uri: a.uri, name: a.name, mimeType: a.mimeType ?? null, file: a.file };
  }

  async extract(doc: PickedDocument, onProgress?: (done: number, total: number) => void) {
    try {
      const buf = doc.file ? await doc.file.arrayBuffer() : await (await fetch(doc.uri)).arrayBuffer();
      const engine = loadPdfEngine();
      return await readDocument(new Uint8Array(buf), doc.name, doc.uri, { pdf: engine ? (_uri, bytes) => readPdfText(engine, bytes, onProgress) : null, image: null });
    } catch {
      return { ok: false as const, error: 'unreadable' as const };
    }
  }
}
