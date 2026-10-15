import * as DocumentPicker from 'expo-document-picker';
import { StudylingNative } from '../native/studylingNative';
import { IMAGE_MIME_TYPES, SYLLABUS_MIME_TYPES, type DocumentService, type PickedDocument } from './DocumentService';
import { readDocument } from './readDocument';

/**
 * iOS: the system document picker. Text and DOCX are read in JavaScript; PDFs
 * and photos go to the StudylingNative module (PDFKit text, Vision OCR, off the
 * main thread). The native parts are UNTESTED on a device.
 */
export class NativeDocumentService implements DocumentService {
  readonly kind = 'native' as const;
  get canReadPdf() {
    return Boolean(StudylingNative);
  }

  async pick(): Promise<PickedDocument | null> {
    const types = StudylingNative?.extractImageText ? [...SYLLABUS_MIME_TYPES, ...IMAGE_MIME_TYPES] : [...SYLLABUS_MIME_TYPES];
    const r = await DocumentPicker.getDocumentAsync({ type: types, copyToCacheDirectory: true, multiple: false });
    if (r.canceled || !r.assets?.[0]) return null;
    const a = r.assets[0];
    return { uri: a.uri, name: a.name, mimeType: a.mimeType ?? null };
  }

  async extract(doc: PickedDocument, onProgress?: (done: number, total: number) => void) {
    try {
      const bytes = new Uint8Array(await (await fetch(doc.uri)).arrayBuffer());
      const native = StudylingNative;
      const sub = native && onProgress ? native.addListener('onExtractionProgress', (e: { done: number; total: number }) => onProgress(e.done, e.total)) : null;
      try {
        return await readDocument(bytes, doc.name, doc.uri, {
          pdf: native ? (uri) => native.extractPdfText(uri) : null,
          image: native?.extractImageText ? (uri) => native.extractImageText!(uri) : null,
        });
      } finally {
        sub?.remove();
      }
    } catch {
      return { ok: false as const, error: 'unreadable' as const };
    }
  }
}
