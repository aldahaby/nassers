/**
 * @jest-environment node
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { createImportDraft, draftAttention } from '@/core/planner/syllabusImport';
import { createPlannerState } from '@/core/planner/plannerState';
import { extractInsights } from '@/core/planner/syllabusInsights';
import { readPdfText, type PdfJs } from '../documents/pdfReader';
import { readDocument } from '../documents/readDocument';

function sameRealmClone(v: unknown): unknown {
  if (v === null || typeof v !== 'object') return v;
  if (ArrayBuffer.isView(v)) return (v as unknown as { slice(): unknown }).slice();
  if (v instanceof ArrayBuffer) return v.slice(0);
  if (Array.isArray(v)) return v.map(sameRealmClone);
  if (v instanceof Map) return new Map([...v].map(([k, x]) => [k, sameRealmClone(x)]));
  if (v instanceof Set) return new Set([...v].map(sameRealmClone));
  const out: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(v)) out[k] = sameRealmClone(x);
  return out;
}
(globalThis as { structuredClone: unknown }).structuredClone = (v: unknown) => sameRealmClone(v);
jest.spyOn(console, 'warn').mockImplementation(() => {});
jest.spyOn(console, 'log').mockImplementation(() => {});
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfjs = require('../../../vendor/pdfjs/pdfjs.web.js') as PdfJs;
const FX = join(__dirname, '../../core/__tests__/fixtures/pdf');
const bytesOf = (f: string) => new Uint8Array(readFileSync(join(FX, f)));
const read = (f: string) => readDocument(bytesOf(f), f, f, { pdf: (_u, b) => readPdfText(pdfjs, b), image: null });

const NOW = Date.UTC(2026, 7, 25, 13, 0);
const TZ = 'America/Toronto';
async function draftOf(f: string, now = NOW) {
  const r = await read(f);
  if (!r.ok) throw new Error(`could not read ${f}: ${r.error}`);
  const text = r.value.pages.map((p) => p.text).join('\f');
  return { r: r.value, text, draft: createImportDraft(createPlannerState(now, TZ), { text, sourceType: 'pdf', timezone: TZ, now, pagesWithoutText: r.value.pagesWithoutText }) };
}
const item = (d: Awaited<ReturnType<typeof draftOf>>['draft'], title: string) => d.items.find((i) => i.title === title);

describe('PDF on the web (PDF.js, text layer)', () => {
  it('multipage course outline with tables: course, people, times, grading and every dated item', async () => {
    const { r, draft, text } = await draftOf('chem2410-tables.pdf');
    expect(r.pages).toHaveLength(3);
    expect(r.method).toBe('embeddedText');
    // Table rows keep their columns.
    expect(text).toMatch(/Midterm 1\s{3,}15%\s{3,}October 7, 2026/);
    const ins = extractInsights(text);
    expect(ins.identity).toMatchObject({ code: 'CHEM 2410', title: 'Organic Chemistry I', institution: 'Riverbend University', credits: 3, term: { season: 'fall', year: 2026 } });
    expect(ins.people.map((p) => p.name)).toEqual(['Dr. Priya Raman', 'Jonah Ellery']);
    expect(ins.meetings.map((m) => [m.weekday, m.startMinute, m.endMinute, m.location])).toEqual([
      [1, 570, 620, 'Ellis Hall 210'],
      [3, 570, 620, 'Ellis Hall 210'],
      [5, 570, 620, 'Ellis Hall 210'],
    ]);
    expect(ins.grading).toMatchObject({ totalPercent: 100, addsUp: true });
    expect(item(draft, 'Problem Set 1')).toMatchObject({ dueDayKey: '2026-09-11', dueTime: '23:59' });
    expect(item(draft, 'Problem Set 2')).toMatchObject({ dueDayKey: '2026-09-25', dueTime: '23:59' });
    expect(item(draft, 'Lab Report 1')).toMatchObject({ dueDayKey: '2026-10-01', dueTime: '17:00' });
    expect(item(draft, 'Midterm 1')).toMatchObject({ dueDayKey: '2026-10-07', weightPercent: 15 });
    expect(item(draft, 'Midterm 2')).toMatchObject({ dueDayKey: '2026-11-11', weightPercent: 15 });
    expect(item(draft, 'Final Exam')).toMatchObject({ dueDayKey: null, window: { from: '2026-12-10', to: '2026-12-18' }, weightPercent: 25 });
  });

  it('two-column pages are read column by column (policies keep their own text)', async () => {
    const { text } = await draftOf('chem2410-tables.pdf');
    const policies = text.split('\f')[2]!;
    expect(policies.indexOf('Late work.')).toBeLessThan(policies.indexOf('Generative AI.'));
    expect(policies.indexOf('Generative AI.')).toBeLessThan(policies.indexOf('Academic integrity.'));
    expect(policies).toMatch(/Problem sets submitted late lose 10%\nper day/);
    expect(extractInsights(text).policies.map((p) => [p.kind, p.title])).toEqual([
      ['late', 'Late work'],
      ['ai', 'Generative AI'],
      ['integrity', 'Academic integrity'],
      ['accommodation', 'Accessibility'],
    ]);
  });

  it('a syllabus set entirely in two columns: reading order, items and inline grading', async () => {
    const { draft } = await draftOf('psyc1010-two-column.pdf', Date.UTC(2026, 11, 20));
    expect(draft.courses[0]).toMatchObject({ code: 'PSYC 1010', name: 'Introduction to Psychology' });
    expect(draft.insights.identity.institution).toBe('Lakeview College');
    expect(draft.insights.people.map((p) => p.name)).toEqual(['Prof. Marta Okafor']);
    expect(draft.insights.meetings.map((m) => [m.weekday, m.startMinute, m.endMinute, m.location])).toEqual([
      [2, 690, 770, 'Harbour Hall 105'],
      [4, 690, 770, 'Harbour Hall 105'],
    ]);
    expect(draft.items.map((i) => [i.title, i.dueDayKey, i.dueTime, i.weightPercent])).toEqual([
      ['Reading Response 1', '2027-01-22', '23:59', null],
      ['Reading Response 2', '2027-02-12', '23:59', null],
      ['Midterm Exam', '2027-02-25', null, 25],
      ['Research Proposal', '2027-03-26', '23:59', 20],
      ['Final Exam', null, null, 35],
    ]);
    expect(draft.insights.grading).toMatchObject({ totalPercent: 100, addsUp: true });
  });

  it('BIOL 115 layout as a PDF reads the same as the text: lectures, conditional deadlines, year question', async () => {
    const { draft } = await draftOf('biol115-layout.pdf');
    expect(draft.courses[0]).toMatchObject({ code: 'BIOL 115', name: 'Essential Biology' });
    expect(draft.insights.lectures?.length).toBe(8);
    expect(draft.years).toMatchObject({ options: [2025, 2026], conflict: true, suggested: 2026 });
    const keys = draft.items.map((i) => i.catalogKey).sort();
    expect(keys).toEqual(['assignment1', 'assignment2', 'assignment3', 'assignment4', 'final', 'midterm']);
    expect(draft.items.find((i) => i.catalogKey === 'assignment1')?.conditional).toMatchObject({ offsetDays: 5, direction: 'after' });
  });

  it('password-protected → "encrypted"; damaged → "unreadable"; never an empty syllabus', async () => {
    expect(await read('encrypted.pdf')).toEqual({ ok: false, error: 'encrypted' });
    expect(await read('corrupt.pdf')).toEqual({ ok: false, error: 'unreadable' });
  });

  it('a scanned PDF (pictures of pages) is reported as scanned, not as an empty syllabus', async () => {
    expect(await read('scanned.pdf')).toEqual({ ok: false, error: 'scanned' });
  });

  it('a partly scanned PDF imports the text pages and tells the student which pages were skipped', async () => {
    const { r, draft } = await draftOf('mixed-scan.pdf');
    expect(r.pagesWithoutText).toEqual([2]);
    expect(r.pages.map((p) => p.index)).toEqual([0, 1]);
    expect(draftAttention(draft)[0]).toEqual({ kind: 'skippedPages', pages: [2] });
    expect(item(draft, 'Problem Set 1')).toMatchObject({ dueDayKey: '2026-09-11' });
  });

  it('a blank page is not mistaken for a scanned one', async () => {
    const r = await read('blank-page.pdf');
    expect(r.ok && r.value.pages.length).toBe(2);
    expect(r.ok ? r.value.pagesWithoutText : 'error').toBeUndefined();
  });

  it('too many pages is refused before reading them all (phone memory)', async () => {
    const fake: PdfJs = { getDocument: () => ({ promise: Promise.resolve({ numPages: 500, getPage: () => Promise.reject(new Error('not reached')) }), destroy: () => Promise.resolve() }) };
    await expect(readDocument(bytesOf('chem2410-tables.pdf'), 'big.pdf', 'big.pdf', { pdf: (_u, b) => readPdfText(fake, b), image: null })).resolves.toEqual({ ok: false, error: 'tooLarge' });
  });

  it('a file named .pdf that isn’t one is not run through the PDF reader', async () => {
    const r = await readDocument(new TextEncoder().encode('just some words, not a pdf at all'.repeat(3)), 'fake.pdf', 'fake.pdf', { pdf: () => Promise.reject(new Error('should not be called')), image: null });
    expect(r.ok ? r.value.method : r.error).toBe('pastedText');
  });

  const REAL = join(__dirname, '../../core/planner/fixtures/private/biol115-real.pdf');
  (existsSync(REAL) ? it : it.skip)('REAL BIOL 115 syllabus as a PDF (local only): course, 22 lectures, six assessments', async () => {
    const r = await readDocument(new Uint8Array(readFileSync(REAL)), 'BIOL115.pdf', 'x', { pdf: (_u, b) => readPdfText(pdfjs, b), image: null });
    if (!r.ok) throw new Error(r.error);
    const text = r.value.pages.map((p) => p.text).join('\f');
    const draft = createImportDraft(createPlannerState(NOW, TZ), { text, sourceType: 'pdf', timezone: TZ, now: NOW });
    expect(draft.courses[0]).toMatchObject({ code: 'BIOL 115', name: 'Essential Biology' });
    expect(draft.insights.identity.institution).toBe('McGill University');
    expect(draft.insights.people.filter((p) => p.role === 'instructor').map((p) => p.name)).toEqual(['Dr. Gemma de Martino', 'Dr. Sarah Woolley']);
    expect(draft.insights.lectures?.length).toBe(22);
    expect(draft.items.map((i) => i.catalogKey).sort()).toEqual(['assignment1', 'assignment2', 'assignment3', 'assignment4', 'final', 'midterm']);
    expect(draft.years).toMatchObject({ options: [2025, 2026], suggested: 2026 });
    expect(r.value.pagesWithoutText).toBeUndefined(); // its blank last page isn't a "scan"
  });
});
