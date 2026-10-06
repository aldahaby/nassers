import * as DocumentPicker from 'expo-document-picker';
import type { DocumentService, PickedDocument } from './DocumentService';

/**
 * Web preview: text files are read in the browser's memory. PDF reading is an
 * iOS feature in this build (no PDF engine is bundled for web), so a PDF on
 * web returns "unsupported" and the UI suggests pasting the text instead.
 */
export class WebDocumentService implements DocumentService {
  readonly kind = 'web' as const;
  readonly canReadPdf = false;

  async pick(): Promise<PickedDocument | null> {
    const r = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'text/plain'], multiple: false });
    if (r.canceled || !r.assets?.[0]) return null;
    const a = r.assets[0];
    return { uri: a.uri, name: a.name, mimeType: a.mimeType ?? null, file: a.file };
  }

  async extract(doc: PickedDocument) {
    const isText = doc.mimeType === 'text/plain' || doc.name.toLowerCase().endsWith('.txt');
    if (!isText) return { ok: false as const, error: 'unsupported' as const };
    try {
      const text = doc.file ? await doc.file.text() : await (await fetch(doc.uri)).text();
      if (!text.trim()) return { ok: false as const, error: 'empty' as const };
      return { ok: true as const, value: { pages: text.split('\f').map((t, i) => ({ index: i, text: t, method: 'embeddedText' as const })), method: 'pastedText' as const } };
    } catch {
      return { ok: false as const, error: 'unreadable' as const };
    }
  }
}
