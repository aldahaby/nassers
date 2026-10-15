import { hasTextLayer, layoutPdfPage, type PdfTextItem } from '../../documents/pdfLayout';

/** A word at a column (6pt per character) on a baseline. */
const at = (str: string, col: number, y: number, size = 10): PdfTextItem => ({ str, x: 50 + col * 6, y, width: str.length * 6, height: size });

describe('PDF page layout', () => {
  it('joins fragments on one baseline, left to right, with word spaces', () => {
    expect(layoutPdfPage([at('Organic', 0, 700), at('Chemistry', 8, 700), at('I', 18, 700)])).toBe('Organic Chemistry I');
  });

  it('keeps table columns aligned', () => {
    const text = layoutPdfPage([at('Midterm 1', 0, 700), at('15%', 20, 700), at('October 7', 30, 700), at('Final exam', 0, 686), at('25%', 20, 686), at('TBA', 30, 686)]);
    expect(text.split('\n')).toEqual(['Midterm 1           15%       October 7', 'Final exam          25%       TBA']);
  });

  it('a larger vertical gap becomes a blank line (paragraphs, table rows)', () => {
    expect(layoutPdfPage([at('Row one', 0, 700), at('still row one', 0, 688), at('Row two', 0, 650)])).toBe('Row one\nstill row one\n\nRow two');
  });

  it('slightly uneven baselines (superscripts, mixed fonts) stay on one line', () => {
    expect(layoutPdfPage([at('Due', 0, 700), at('Sept 11', 4, 701.5), at('at 5 PM', 12, 699.2)])).toBe('Due Sept 11 at 5 PM');
  });

  it('two-column prose is read one column at a time', () => {
    const items: PdfTextItem[] = [];
    const left = ['Late work loses ten percent per', 'day, up to three days in total.', 'After that it gets no credit at all.', 'Lab reports cannot be late ever.', 'They are discussed in the lab.', 'Ask early if you need more time.'];
    const right = ['Integrity matters in this course.', 'Copying answers is an offence.', 'Cite every source you rely on.', 'AI tools must be acknowledged.', 'Describe how you used them.', 'Ask if you are ever unsure.'];
    left.forEach((t, i) => items.push(at(t, 0, 700 - i * 12)));
    right.forEach((t, i) => items.push(at(t, 40, 700 - i * 12)));
    const lines = layoutPdfPage(items).split('\n').filter(Boolean);
    expect(lines.slice(0, 6)).toEqual(left);
    expect(lines.slice(6).map((l) => l.trim())).toEqual(right);
  });

  it('a table with a sparse notes column is NOT split like two-column prose', () => {
    const items: PdfTextItem[] = [];
    for (let i = 0; i < 10; i++) items.push(at(`${i + 1}-Sep  Tues  Lect.${i}  Topic number ${i}`, 0, 700 - i * 12));
    items.push(at('Deadline for LitB', 48, 700 - 3 * 12));
    const text = layoutPdfPage(items);
    expect(text.split('\n')[3]).toMatch(/Lect\.3\s+Topic number 3\s+Deadline for LitB$/);
  });

  it('justified prose keeps single spaces (only real column gaps keep their width)', () => {
    expect(layoutPdfPage([at('biology', 0, 700), at('of', 9, 700), at('behaviour,', 13, 700), at('then', 25, 700)])).toBe('biology of behaviour, then');
  });

  it('an empty page and a page of stray marks have no text layer', () => {
    expect(layoutPdfPage([])).toBe('');
    expect(hasTextLayer(layoutPdfPage([at('.', 0, 700), at('3', 10, 680)]))).toBe(false);
    expect(hasTextLayer('Problem Set 1 due Friday')).toBe(true);
  });
});
