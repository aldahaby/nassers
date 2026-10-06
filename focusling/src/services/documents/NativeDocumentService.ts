import * as DocumentPicker from 'expo-document-picker';
import { StudylingNative } from '../native/studylingNative';
import { methodOf, type DocumentService, type PickedDocument } from './DocumentService';

/**
 * iOS: the system document picker, then the StudylingNative module
 * (PDFKit embedded text, Vision OCR fallback per page, off the main thread).
 * Plain-text files are read directly. UNTESTED on device.
 */
export class NativeDocumentService implements DocumentService {
  readonly kind = 'native' as const;
  get canReadPdf() {
    return Boolean(StudylingNative);
  }

  async pick(): Promise<PickedDocument | null> {
    const r = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'text/plain'], copyToCacheDirectory: true, multiple: false });
    if (r.canceled || !r.assets?.[0]) return null;
    const a = r.assets[0];
    return { uri: a.uri, name: a.name, mimeType: a.mimeType ?? null };
  }

  async extract(doc: PickedDocument, onProgress?: (done: number, total: number) => void) {
    try {
      if (doc.mimeType === 'text/plain' || doc.name.toLowerCase().endsWith('.txt')) {
        const text = await (await fetch(doc.uri)).text();
        return text.trim() ? { ok: true as const, value: { pages: [{ index: 0, text, method: 'embeddedText' as const }], method: 'pastedText' as const } } : { ok: false as const, error: 'empty' as const };
      }
      if (!StudylingNative) return { ok: false as const, error: 'unsupported' as const };
      const sub = onProgress ? StudylingNative.addListener('onExtractionProgress', (e: { done: number; total: number }) => onProgress(e.done, e.total)) : null;
      const pages = await StudylingNative.extractPdfText(doc.uri);
      sub?.remove();
      if (!pages.length || pages.every((p) => !p.text.trim())) return { ok: false as const, error: 'empty' as const };
      return { ok: true as const, value: { pages, method: methodOf(pages) } };
    } catch {
      return { ok: false as const, error: 'unreadable' as const };
    }
  }
}
