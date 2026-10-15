import { readDocument } from '@/services/documents/readDocument';
import { makeDocx } from './zipHelper';

const text = (s: string) => new Uint8Array(Buffer.from(s, 'utf8'));
const none = { pdf: null, image: null };

describe('reading a syllabus file', () => {
  it('reads text and DOCX on any platform', async () => {
    const t = await readDocument(text('CHEM 101 Foundations of Chemistry\nProblem Set 1 due September 15 at 11:59 PM'), 'chem.txt', 'u', none);
    expect(t.ok && t.value.method).toBe('pastedText');
    const d = await readDocument(makeDocx(['HIST 150 World History', 'Paper 1 due October 12', { pageBreak: true }, 'Final exam: to be announced']), 'hist.docx', 'u', none);
    expect(d.ok && d.value.method).toBe('docx');
    expect(d.ok && d.value.pages.length).toBe(2);
  });

  it('says PDFs and photos are unsupported where there is no reader (web), instead of guessing', async () => {
    expect(await readDocument(text('%PDF-1.7 fake'), 'a.pdf', 'u', none)).toEqual({ ok: false, error: 'unsupported' });
    expect(await readDocument(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2]), 'a.jpg', 'u', none)).toEqual({ ok: false, error: 'unsupported' });
    expect(await readDocument(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), 'old.doc', 'u', none)).toEqual({ ok: false, error: 'unsupported' });
  });

  it('refuses a scan whose OCR text is mostly garbage rather than importing part of it', async () => {
    const pdf = async () => [{ index: 0, text: '~~ ^^ ¶¶ ## ~~ ^^ ¶¶ ## @@ ~~ ¶¶ ^^ ## ~~ ¶ ^ #', method: 'ocr' as const }];
    expect(await readDocument(text('%PDF-1.4'), 'scan.pdf', 'u', { pdf, image: null })).toEqual({ ok: false, error: 'unreadable' });
  });

  it('a readable scan is labelled as OCR', async () => {
    const pdf = async () => [{ index: 0, text: 'PSYC 210 Research Methods, Fall 2026\nLab report 1 due Sept 22 at 5 PM\nLab report 2 due Oct 20 at 5 PM', method: 'ocr' as const }];
    const r = await readDocument(text('%PDF-1.4'), 'scan.pdf', 'u', { pdf, image: null });
    expect(r.ok && r.value.method).toBe('ocr');
  });

  it('errors from the native reader become "unreadable", empty files "empty", huge files "tooLarge"', async () => {
    const pdf = async () => {
      throw new Error('boom');
    };
    expect(await readDocument(text('%PDF-1.4'), 'x.pdf', 'u', { pdf, image: null })).toEqual({ ok: false, error: 'unreadable' });
    expect(await readDocument(new Uint8Array(0), 'x.txt', 'u', none)).toEqual({ ok: false, error: 'empty' });
    expect(await readDocument(new Uint8Array(16 * 1024 * 1024), 'x.txt', 'u', none)).toEqual({ ok: false, error: 'tooLarge' });
  });
});
