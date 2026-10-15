import { deflateRawSync } from 'zlib';

/** Builds a minimal ZIP (stored or deflated entries) for tests. */
export function makeZip(files: { name: string; data: string | Uint8Array; store?: boolean; flags?: number; lieSize?: number }[]): Uint8Array {
  const chunks: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const f of files) {
    const raw = typeof f.data === 'string' ? Buffer.from(f.data, 'utf8') : Buffer.from(f.data);
    const body = f.store ? raw : deflateRawSync(raw);
    const name = Buffer.from(f.name, 'utf8');
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(f.flags ?? 0, 6);
    local.writeUInt16LE(f.store ? 0 : 8, 8);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(f.lieSize ?? raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    chunks.push(local, name, body);
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(f.flags ?? 0, 8);
    cd.writeUInt16LE(f.store ? 0 : 8, 10);
    cd.writeUInt32LE(body.length, 20);
    cd.writeUInt32LE(f.lieSize ?? raw.length, 24);
    cd.writeUInt16LE(name.length, 28);
    cd.writeUInt32LE(offset, 42);
    central.push(cd, name);
    offset += 30 + name.length + body.length;
  }
  const cdBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cdBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...chunks, cdBuf, end]));
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** A WordprocessingML body from paragraphs, tables and page breaks. */
export function docxXml(blocks: (string | string[][] | { pageBreak: true } | { renderedBreak: string })[]): string {
  const p = (t: string) => `<w:p><w:pPr><w:tabs><w:tab w:val="left" w:pos="720"/></w:tabs></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${esc(t)}</w:t></w:r></w:p>`;
  const body = blocks
    .map((b) => {
      if (typeof b === 'string') return p(b);
      if ('pageBreak' in b) return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
      if ('renderedBreak' in b) return `<w:p><w:r><w:lastRenderedPageBreak/><w:t>${esc(b.renderedBreak)}</w:t></w:r></w:p>`;
      return `<w:tbl><w:tblPr/>${b.map((row) => `<w:tr>${row.map((c) => `<w:tc><w:tcPr/>${p(c)}</w:tc>`).join('')}</w:tr>`).join('')}</w:tbl>`;
    })
    .join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr/></w:body></w:document>`;
}

export function makeDocx(blocks: Parameters<typeof docxXml>[0], extra: { name: string; data: string }[] = []): Uint8Array {
  return makeZip([
    { name: '[Content_Types].xml', data: '<Types/>' },
    { name: 'word/document.xml', data: docxXml(blocks) },
    { name: 'word/header1.xml', data: '<w:hdr><w:p><w:r><w:t>HEADER TEXT NEVER READ</w:t></w:r></w:p></w:hdr>' },
    ...extra,
  ]);
}
