import { DOCUMENT_LIMITS } from '@/config/documents';

/**
 * Rebuilds readable text from a PDF page's positioned text fragments (what
 * PDF.js `getTextContent` returns). Pure; no PDF library here.
 *
 * - Fragments on the same baseline become one line, left to right.
 * - Horizontal gaps keep their width in spaces, so table columns stay aligned
 *   (the syllabus parsers rely on columns, e.g. "3-Sep  Thurs  Lect.1  Topic").
 * - A larger vertical gap becomes a blank line (paragraphs, table rows).
 * - Two-column prose is read column by column instead of across both columns;
 *   tables (columns that are mostly empty on one side) are left alone.
 */

export interface PdfTextItem {
  str: string;
  /** Left edge, PDF units (origin bottom-left). */
  x: number;
  /** Baseline, PDF units (larger is higher on the page). */
  y: number;
  width: number;
  height: number;
}

interface Placed extends PdfTextItem {
  end: number;
}

interface Row {
  y: number;
  height: number;
  items: Placed[];
}

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
};

function rowsOf(items: PdfTextItem[]): Row[] {
  const placed = items
    .filter((i) => i.str.trim().length > 0 && Number.isFinite(i.x) && Number.isFinite(i.y))
    .map((i) => ({ ...i, height: i.height > 0 ? i.height : 10, end: i.x + Math.max(0, i.width) }))
    .sort((a, b) => b.y - a.y || a.x - b.x);
  const rows: Row[] = [];
  for (const it of placed) {
    const row = rows.find((r) => Math.abs(r.y - it.y) <= Math.max(1.5, Math.min(r.height, it.height) * 0.45));
    if (row) {
      row.items.push(it);
      row.height = Math.max(row.height, it.height);
    } else rows.push({ y: it.y, height: it.height, items: [it] });
  }
  for (const r of rows) r.items.sort((a, b) => a.x - b.x);
  return rows.sort((a, b) => b.y - a.y);
}

/** Average character width on the page (from fragments with real widths). */
function charWidthOf(items: Placed[]): number {
  const widths = items.filter((i) => i.str.length >= 2 && i.width > 0).map((i) => i.width / i.str.length);
  return median(widths) || median(items.map((i) => i.height)) * 0.5 || 5;
}

/** One row as text; `origin` is the page's left text edge. */
function rowText(items: Placed[], origin: number, cw: number): string {
  let out = '';
  let prevEnd: number | null = null;
  // Justified prose stretches word gaps; only a real column gap (wide) keeps its width.
  const gaps = items.slice(1).map((it, i) => it.x - items[i]!.end);
  const columnGap = gaps.some((g) => g > cw * 4) ? cw * 1.8 : Infinity;
  for (const it of items) {
    const target = Math.max(0, Math.round((it.x - origin) / cw));
    if (prevEnd === null) out = ' '.repeat(target);
    else {
      const gap = it.x - prevEnd;
      const endsSpace = /\s$/.test(out);
      const startsSpace = /^\s/.test(it.str);
      if (gap > columnGap) out += ' '.repeat(Math.max(2, target - out.length)); // a column jump keeps its width
      else if (gap > cw * 0.2 && !endsSpace && !startsSpace) out += ' ';
    }
    out += it.str;
    prevEnd = it.end;
  }
  return out.replace(/\s+$/, '');
}

const crosses = (r: Row, x: number) => r.items.some((i) => i.x < x - 2 && i.end > x + 2);

/**
 * Two-column prose: a vertical gutter near the middle that almost no line
 * crosses, with full-width lines on BOTH sides and similar line counts. A table
 * (one wide column, sparse notes in another) or a short label/value list fails
 * these tests and keeps its row order.
 */
function gutterOf(rows: Row[], left: number, right: number): number | null {
  if (rows.length < 6) return null;
  const width = right - left;
  if (width <= 0) return null;
  let best: { x: number; score: number } | null = null;
  for (let f = 0.3; f <= 0.7; f += 0.01) {
    const x = left + width * f;
    const open = rows.filter((r) => !crosses(r, x));
    if (open.length < rows.length * 0.9) continue;
    let lRows = 0;
    let lFull = 0;
    let rRows = 0;
    let rFull = 0;
    for (const r of open) {
      const l = r.items.filter((i) => i.end <= x + 2);
      const rr = r.items.filter((i) => i.x >= x - 2);
      if (l.length) {
        lRows++;
        if (Math.max(...l.map((i) => i.end)) - left >= 0.8 * (x - left)) lFull++;
      }
      if (rr.length) {
        rRows++;
        if (Math.max(...rr.map((i) => i.end)) - x >= 0.8 * (right - x)) rFull++;
      }
    }
    const balanced = lRows >= 3 && rRows >= 3 && lRows >= open.length * 0.4 && rRows >= open.length * 0.4;
    if (!balanced || lFull < lRows * 0.55 || rFull < rRows * 0.55) continue;
    const score = lFull + rFull;
    if (!best || score > best.score) best = { x, score };
  }
  if (!best) return null;
  // Centre the gutter in the empty band between the columns.
  const open = rows.filter((r) => !crosses(r, best!.x));
  const leftEnd = Math.max(...open.flatMap((r) => r.items.filter((i) => i.end <= best!.x + 2).map((i) => i.end)));
  const rightStart = Math.min(...open.flatMap((r) => r.items.filter((i) => i.x >= best!.x - 2).map((i) => i.x)));
  return leftEnd < rightStart ? (leftEnd + rightStart) / 2 : best.x;
}

export function layoutPdfPage(items: PdfTextItem[]): string {
  const rows = rowsOf(items);
  if (!rows.length) return '';
  const all = rows.flatMap((r) => r.items);
  const cw = charWidthOf(all);
  const origin = Math.min(...all.map((i) => i.x));
  const right = Math.max(...all.map((i) => i.end));
  const lineHeight = median(rows.map((r) => r.height)) || 10;
  const gaps = rows.slice(1).map((r, i) => rows[i]!.y - r.y);
  // Ordinary line spacing: a low percentile, so a few paragraph gaps don't count as "normal".
  const positive = gaps.filter((g) => g > 0).sort((a, b) => a - b);
  const normalGap = positive[Math.floor((positive.length - 1) * 0.3)] ?? lineHeight * 1.2;

  const emit = (rs: Row[], from: number): string[] => {
    const lines: string[] = [];
    rs.forEach((r, i) => {
      const prev = rs[i - 1];
      if (prev && prev.y - r.y > Math.max(normalGap * 1.6, lineHeight * 1.9)) lines.push('');
      lines.push(rowText(r.items, from, cw));
    });
    return lines;
  };

  // Split two-column runs; everything else in reading order.
  const out: string[] = [];
  const gutter = gutterOf(rows, origin, right);
  if (gutter === null) return emit(rows, origin).join('\n');
  let i = 0;
  while (i < rows.length) {
    if (crosses(rows[i]!, gutter)) {
      out.push(...emit([rows[i]!], origin));
      i++;
      continue;
    }
    let j = i;
    while (j < rows.length && !crosses(rows[j]!, gutter)) j++;
    const run = rows.slice(i, j);
    if (run.length >= 4) {
      const leftRows = run.map((r) => ({ ...r, items: r.items.filter((it) => it.end <= gutter + 2) })).filter((r) => r.items.length);
      const rightRows = run.map((r) => ({ ...r, items: r.items.filter((it) => it.x >= gutter - 2) })).filter((r) => r.items.length);
      const rightOrigin = Math.min(...rightRows.flatMap((r) => r.items.map((it) => it.x)));
      if (out.length && out[out.length - 1] !== '') out.push('');
      out.push(...emit(leftRows, origin), '', ...emit(rightRows, rightOrigin));
    } else out.push(...emit(run, origin));
    i = j;
  }
  return out.join('\n');
}

/** Whether a page has a real text layer (a scan or a picture has none). */
export function hasTextLayer(text: string, minLetters = DOCUMENT_LIMITS.minPageLetters): boolean {
  return (text.match(/\p{L}/gu) ?? []).length >= minLetters;
}
