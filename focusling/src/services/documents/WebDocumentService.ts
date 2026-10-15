import * as DocumentPicker from 'expo-document-picker';
import { SYLLABUS_MIME_TYPES, type DocumentService, type PickedDocument } from './DocumentService';
import { readDocument } from './readDocument';

/**
 * Web preview: text and DOCX files are read in the browser's memory. PDF and
 * photo reading need the iOS app (no PDF/OCR engine is bundled for web), so
 * they return "unsupported" and the UI suggests pasting the text instead.
 */
export class WebDocumentService implements DocumentService {
  readonly kind = 'web' as const;
  readonly canReadPdf = false;

  async pick(): Promise<PickedDocument | null> {
    const r = await DocumentPicker.getDocumentAsync({ type: [...SYLLABUS_MIME_TYPES], multiple: false });
    if (r.canceled || !r.assets?.[0]) return null;
    const a = r.assets[0];
    return { uri: a.uri, name: a.name, mimeType: a.mimeType ?? null, file: a.file };
  }

  async extract(doc: PickedDocument) {
    try {
      const buf = doc.file ? await doc.file.arrayBuffer() : await (await fetch(doc.uri)).arrayBuffer();
      return readDocument(new Uint8Array(buf), doc.name, doc.uri, { pdf: null, image: null });
    } catch {
      return { ok: false as const, error: 'unreadable' as const };
    }
  }
}
