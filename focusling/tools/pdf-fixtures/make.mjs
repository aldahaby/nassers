// Generates the PDF regression fixtures in src/core/__tests__/fixtures/pdf/ with Chromium
// (Playwright) + pypdf (encryption). Synthetic content, fictional people (example.edu).
//   node tools/pdf-fixtures/make.mjs [--real path/to/private.txt]
// The real-syllabus PDF (--real) goes to src/core/planner/fixtures/private/ (git-ignored).
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(root, 'src/core/__tests__/fixtures/pdf');
mkdirSync(OUT, { recursive: true });
const exe = process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: exe });
const page = await browser.newPage();
const pdf = async (html, file) => {
  await page.setContent(html, { waitUntil: 'load' });
  writeFileSync(join(OUT, file), await page.pdf({ format: 'Letter', margin: { top: '0.6in', bottom: '0.6in', left: '0.6in', right: '0.6in' } }));
};
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const mono = (text) => `<style>body{margin:0} pre{font:7.6pt/1.25 'Courier New',monospace;white-space:pre;margin:0} .pb{page-break-after:always}</style>` + text.split('\f').map((p) => `<pre class="pb">${esc(p)}</pre>`).join('');

// 1. Proportional fonts, real HTML tables, three pages, a two-column policy section.
const tables = `<style>
body{font:10.5pt/1.35 Helvetica,Arial,sans-serif;color:#111} h1{font-size:17pt;margin:0 0 4pt} h2{font-size:12.5pt;margin:14pt 0 4pt}
table{border-collapse:collapse;width:100%;margin:4pt 0} td,th{border:1px solid #999;padding:3pt 5pt;text-align:left;vertical-align:top}
.cols{column-count:2;column-gap:28pt;text-align:justify} .pb{page-break-before:always}
</style>
<h1>CHEM 2410: Organic Chemistry I</h1>
<p>Riverbend University · Department of Chemistry · Fall 2026 · 3 credits</p>
<p><b>Instructor:</b> Dr. Priya Raman (praman@example.edu)<br><b>Teaching Assistant:</b> Jonah Ellery<br>
<b>Lectures:</b> Monday, Wednesday and Friday, 9:30–10:20 AM, Ellis Hall 210<br><b>Office hours:</b> Tuesdays 1:00–2:30 PM, Ellis Hall 314</p>
<h2>Grading</h2>
<table><tr><th>Assessment</th><th>Weight</th><th>Date</th></tr>
<tr><td>Problem sets (5)</td><td>20%</td><td>See schedule</td></tr>
<tr><td>Lab reports</td><td>25%</td><td>See schedule</td></tr>
<tr><td>Midterm 1</td><td>15%</td><td>October 7, 2026</td></tr>
<tr><td>Midterm 2</td><td>15%</td><td>November 11, 2026</td></tr>
<tr><td>Final exam</td><td>25%</td><td>Final exam period, December 10–18</td></tr></table>
<h2>Assignments</h2>
<p>Problem Set 1 due Friday, September 11, 2026 at 11:59 PM.<br>Problem Set 2 due Friday, September 25, 2026 at 11:59 PM.<br>
Lab Report 1 due Thursday, October 1, 2026 at 5:00 PM. Submit on Canvas as a PDF.</p>
<div class="pb"></div>
<h2>Weekly schedule</h2>
<table><tr><th>Week</th><th>Dates</th><th>Topic</th><th>Reading</th></tr>
<tr><td>1</td><td>Aug 31</td><td>Bonding and molecular structure</td><td>Ch. 1</td></tr>
<tr><td>2</td><td>Sep 7</td><td>Acids and bases</td><td>Ch. 2</td></tr>
<tr><td>3</td><td>Sep 14</td><td>Alkanes and conformations</td><td>Ch. 3</td></tr>
<tr><td>4</td><td>Sep 21</td><td>Stereochemistry</td><td>Ch. 4</td></tr>
<tr><td>5</td><td>Sep 28</td><td>Reactions and mechanisms</td><td>Ch. 5</td></tr></table>
<p>Midterm 1 covers Weeks 1–5.</p>
<div class="pb"></div>
<h2>Course policies</h2>
<div class="cols">
<p><b>Late work.</b> Problem sets submitted late lose 10% per day, up to three days. After three days they receive no credit unless you have an approved accommodation. Lab reports cannot be submitted late because they are discussed in the following lab section.</p>
<p><b>Generative AI.</b> You may use AI tools to check your understanding of a mechanism, but every answer you submit must be your own work. If you use an AI tool, add a short note saying how you used it.</p>
<p><b>Academic integrity.</b> Riverbend University expects every student to submit their own work. Copying answers from another student or from an online solutions site is an academic offence and will be reported.</p>
<p><b>Accessibility.</b> If you need accommodations, contact Student Accessibility Services early in the term so arrangements can be made before the first midterm.</p>
</div>`;
await pdf(tables, 'chem2410-tables.pdf');

// 2. A whole syllabus set in two columns (reading order must follow each column).
const twoCol = `<style>body{font:10pt/1.4 Georgia,serif} h1{font-size:16pt;margin:0 0 6pt} .cols{column-count:2;column-gap:30pt;text-align:justify} p{margin:0 0 7pt}</style>
<h1>PSYC 1010: Introduction to Psychology</h1>
<p>Lakeview College · Winter 2027 · Section 002 · Instructor: Prof. Marta Okafor (mokafor@example.edu)</p>
<div class="cols">
<p>This course introduces the scientific study of behaviour and mental processes. We begin with research methods and the biology of behaviour, then move through sensation, perception, learning, memory, development, personality and social psychology. Each week combines lectures with short in-class activities.</p>
<p>Lectures meet Tuesdays and Thursdays from 11:30 AM to 12:50 PM in Harbour Hall 105. Bring the weekly reading to class; activities build directly on it.</p>
<p>Reading Response 1 is due Friday, January 22, 2027 at 11:59 PM. It asks you to summarise one research study from Chapter 2 in about 400 words.</p>
<p>Reading Response 2 is due Friday, February 12, 2027 at 11:59 PM. Choose a study from Chapters 5 or 6 and explain its method and main finding.</p>
<p>The Midterm Exam is on Thursday, February 25, 2027 during class. It covers Chapters 1 to 6 and has multiple-choice and short-answer questions.</p>
<p>The Research Proposal is due Friday, March 26, 2027 at 11:59 PM. Work in pairs; one partner submits the proposal on the course site with both names on the title page.</p>
<p>The Final Exam takes place during the April examination period. The date will be published by the Registrar.</p>
<p>Grading: Reading responses 20%, Midterm Exam 25%, Research Proposal 20%, Final Exam 35%.</p>
</div>`;
await pdf(twoCol, 'psyc1010-two-column.pdf');

// 3. The BIOL 115 layout fixture (own wording, real layout) as a monospace PDF.
const fixturesSrc = readFileSync(join(root, 'src/core/planner/fixtures/courseOutlines.ts'), 'utf8');
const m = /export const BIOL115_LAYOUT[\s\S]*?text: \[([\s\S]*?)\]\.join\('\\f'\)/.exec(fixturesSrc);
const layoutText = [...m[1].matchAll(/`([\s\S]*?)`/g)].map((x) => x[1]).join('\f');
await pdf(mono(layoutText), 'biol115-layout.pdf');

// 4. A scan: pictures of pages, no text layer. 5. Mixed: one text page + one scanned page.
await page.setContent(tables, { waitUntil: 'load' });
await page.setViewportSize({ width: 816, height: 1056 });
const shot = (await page.screenshot({ fullPage: false })).toString('base64');
await pdf(`<style>body{margin:0}img{width:100%}</style><img src="data:image/png;base64,${shot}">`, 'scanned.pdf');
await pdf(`<style>img{width:100%}.pb{page-break-before:always}</style><h1 style="font:16pt Helvetica">CHEM 2410 · Fall 2026 · Riverbend University</h1><p style="font:11pt Helvetica">Problem Set 1 due Friday, September 11, 2026 at 11:59 PM. Problem Set 2 due Friday, September 25, 2026 at 11:59 PM. Midterm 1 is on October 7, 2026.</p><div class="pb"></div><img src="data:image/png;base64,${shot}">`, 'mixed-scan.pdf');

// 5b. A text page followed by a blank page (a blank page is not a scan).
await pdf(`<style>.pb{page-break-before:always}</style><h1 style="font:16pt Helvetica">CHEM 2410 · Fall 2026 · Riverbend University</h1><p style="font:11pt Helvetica">Problem Set 1 due Friday, September 11, 2026 at 11:59 PM. Midterm 1 is on October 7, 2026.</p><div class="pb"></div><p>&nbsp;</p>`, 'blank-page.pdf');

// 6. Encrypted (password "studyling"). 7. Corrupt: a truncated PDF.
const py = `import sys; sys.path.insert(0, sys.argv[1]); import pypdf
r = pypdf.PdfReader(sys.argv[2]); w = pypdf.PdfWriter()
for p in r.pages: w.add_page(p)
w.encrypt("studyling", algorithm="RC4-128"); w.write(sys.argv[3])`;
execFileSync('python3', ['-S', '-c', py, process.env.PYLIB ?? '', join(OUT, 'chem2410-tables.pdf'), join(OUT, 'encrypted.pdf')]);
const good = readFileSync(join(OUT, 'chem2410-tables.pdf'));
writeFileSync(join(OUT, 'corrupt.pdf'), good.subarray(0, Math.floor(good.length * 0.35)));

// Optional: the real syllabus text as a PDF (private, never committed).
const real = process.argv.indexOf('--real');
if (real > 0) {
  const priv = join(root, 'src/core/planner/fixtures/private');
  mkdirSync(priv, { recursive: true });
  await page.setContent(mono(readFileSync(process.argv[real + 1], 'utf8')), { waitUntil: 'load' });
  writeFileSync(join(priv, 'biol115-real.pdf'), await page.pdf({ format: 'Letter', margin: { top: '0.5in', bottom: '0.5in', left: '0.5in', right: '0.5in' } }));
}
await browser.close();
console.log('PDF fixtures written to', OUT);
