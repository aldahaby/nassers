import { deflateRawSync } from 'zlib';
import { assessReadability, extractDocxText, inflateRaw, sniffDocumentKind, stripRunningHeaders } from '../../documents';
import { decodeUtf8 } from '../../documents/utf8';
import { makeDocx, makeZip } from './zipHelper';

const bytes = (s: string) => new Uint8Array(Buffer.from(s, 'utf8'));

describe('inflate (RFC 1951)', () => {
  it('matches zlib for stored, fixed and dynamic Huffman blocks', () => {
    const samples = ['a', 'Assignment 3 due October 28, 11:59 PM', 'x'.repeat(70_000), Array.from({ length: 4000 }, (_, i) => `Week ${i % 13}: topic ${(i * 7919) % 101}`).join('\n')];
    for (const s of samples) {
      for (const level of [0, 1, 9]) {
        const packed = new Uint8Array(deflateRawSync(Buffer.from(s), { level }));
        expect(decodeUtf8(inflateRaw(packed, 10_000_000))).toBe(s);
      }
    }
  });

  it('refuses output larger than the budget (zip-bomb guard) and corrupt data', () => {
    const bomb = new Uint8Array(deflateRawSync(Buffer.alloc(5_000_000)));
    expect(() => inflateRaw(bomb, 100_000)).toThrow(/too large/);
    expect(() => inflateRaw(new Uint8Array([0xff, 0xff, 0xff]), 1000)).toThrow();
  });
});

describe('DOCX syllabi', () => {
  it('reads paragraphs, tables (as | cells), entities and page breaks; never reads headers', () => {
    const doc = makeDocx([
      'COMP 202: Foundations of Programming',
      'McGill University · Fall 2026 · Section 001',
      'Q&A sessions: Tuesdays',
      [
        ['Assessment', 'Weight', 'Due'],
        ['Assignment 1', '10%', 'September 25, 11:59 PM'],
      ],
      { pageBreak: true },
      'Midterm exam: October 22',
    ]);
    const r = extractDocxText(doc);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.pages).toHaveLength(2);
    expect(r.pages[0]).toContain('COMP 202: Foundations of Programming');
    expect(r.pages[0]).toContain('Q&A sessions: Tuesdays');
    expect(r.pages[0]).toContain('Assignment 1 | 10% | September 25, 11:59 PM');
    expect(r.pages[1]).toBe('Midterm exam: October 22');
    expect(r.pages.join('')).not.toContain('HEADER TEXT');
    expect(r.pages.join('')).not.toMatch(/\t/); // tab stops in paragraph properties are not text
  });

  it('uses Word’s rendered page breaks for page numbers when there are no explicit breaks', () => {
    const r = extractDocxText(makeDocx(['Page one text', { renderedBreak: 'Page two text' }]));
    expect(r.ok && r.pages).toEqual(['Page one text', 'Page two text']);
  });

  it('refuses encrypted, oversized-ratio, truncated and non-Word archives without throwing', () => {
    const enc = makeZip([{ name: 'word/document.xml', data: '<w:document/>', flags: 1 }]);
    expect(extractDocxText(enc)).toEqual({ ok: false, error: 'encrypted' });
    const bomb = makeZip([{ name: 'word/document.xml', data: '<w:t>' + 'a'.repeat(3_000_000) + '</w:t>' }]);
    expect(extractDocxText(bomb)).toEqual({ ok: false, error: 'tooLarge' });
    const notWord = makeZip([{ name: 'readme.txt', data: 'hello' }]);
    expect(extractDocxText(notWord)).toEqual({ ok: false, error: 'notDocx' });
    const good = makeDocx(['Assignment 1 due Sept 9']);
    expect(extractDocxText(good.subarray(0, good.length - 30))).toEqual({ ok: false, error: 'unreadable' });
    expect(extractDocxText(bytes('not a zip at all'))).toEqual({ ok: false, error: 'unreadable' });
  });

  it('a lying size header can’t inflate past the declared size', () => {
    const lie = makeZip([{ name: 'word/document.xml', data: '<w:t>' + 'b'.repeat(50_000) + '</w:t>', lieSize: 100 }]);
    expect(extractDocxText(lie).ok).toBe(false);
  });
});

describe('file type and text quality', () => {
  it('decides the type from the bytes, not the name', () => {
    expect(sniffDocumentKind(bytes('%PDF-1.7 ...'), 'x.txt')).toBe('pdf');
    expect(sniffDocumentKind(makeDocx(['hi']), 'syllabus.docx')).toBe('docx');
    expect(sniffDocumentKind(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), 'old.doc')).toBe('legacyDoc');
    expect(sniffDocumentKind(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), 'photo.jpg')).toBe('image');
    expect(sniffDocumentKind(bytes('CHEM 101\nQuiz 1: Sept 9'), 'notes.pdf')).toBe('text');
    expect(sniffDocumentKind(new Uint8Array([0, 1, 2, 3, 0, 9]), 'x.bin')).toBe('unknown');
  });

  it('refuses empty or garbled text instead of importing part of it', () => {
    expect(assessReadability('').ok).toBe(false);
    expect(assessReadability('~^~ ¶¶ #@ ~~^^ ¶¶¶ ~~ ^^ ~~ ¶').ok).toBe(false);
    expect(assessReadability('Ω≈ç√∫ ' + '▒▓█'.repeat(80) + ' abc').ok).toBe(false);
    expect(assessReadability('CHEM 101 Foundations of Chemistry. Problem Set 1 due September 15 at 11:59 PM.').ok).toBe(true);
  });

  it('blanks running headers/footers and page numbers but keeps line positions and the first header', () => {
    const page = (n: number, body: string) => `COMP 202 · Fall 2026\n${body}\nPage ${n} of 3`;
    const text = [page(1, 'Assignment 1 due Sept 25'), page(2, 'Assignment 2 due Oct 9'), page(3, 'Final exam: TBA')].join('\f');
    const { text: out, removed } = stripRunningHeaders(text);
    const pages = out.split('\f').map((p) => p.split('\n'));
    expect(pages[0]![0]).toBe('COMP 202 · Fall 2026');
    expect(pages[1]![0]).toBe('');
    expect(pages[1]![1]).toBe('Assignment 2 due Oct 9');
    expect(pages.every((p) => p.length === 3 && p[2] === '')).toBe(true);
    expect(removed).toBe(5);
  });
});
