/**
 * Raw DEFLATE decoder (RFC 1951), dependency-free so DOCX files can be read
 * the same way on web, iOS and in tests. Only decompresses bytes: nothing in a
 * document is ever executed. `maxOutput` bounds memory (zip-bomb guard).
 */

export class InflateError extends Error {}

interface Huffman {
  counts: Uint16Array;
  symbols: Uint16Array;
}

function build(lengths: Uint8Array, offset: number, n: number): Huffman {
  const counts = new Uint16Array(16);
  const symbols = new Uint16Array(n);
  for (let i = 0; i < n; i++) counts[lengths[offset + i]!]!++;
  counts[0] = 0;
  const offs = new Uint16Array(16);
  for (let i = 1; i < 16; i++) offs[i] = offs[i - 1]! + counts[i - 1]!;
  for (let i = 0; i < n; i++) {
    const len = lengths[offset + i]!;
    if (len) symbols[offs[len]!++] = i;
  }
  return { counts, symbols };
}

const LEN_BASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
const LEN_EXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
const DIST_BASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
const DIST_EXTRA = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
const CL_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

let fixedLit: Huffman | null = null;
let fixedDist: Huffman | null = null;
function fixed(): [Huffman, Huffman] {
  if (!fixedLit || !fixedDist) {
    const l = new Uint8Array(288 + 30);
    for (let i = 0; i < 144; i++) l[i] = 8;
    for (let i = 144; i < 256; i++) l[i] = 9;
    for (let i = 256; i < 280; i++) l[i] = 7;
    for (let i = 280; i < 288; i++) l[i] = 8;
    for (let i = 288; i < 318; i++) l[i] = 5;
    fixedLit = build(l, 0, 288);
    fixedDist = build(l, 288, 30);
  }
  return [fixedLit, fixedDist];
}

export function inflateRaw(input: Uint8Array, maxOutput: number): Uint8Array {
  let pos = 0;
  let bitBuf = 0;
  let bitCnt = 0;
  let out = new Uint8Array(Math.min(Math.max(1024, input.length * 4), maxOutput));
  let outLen = 0;

  const need = (n: number) => {
    while (bitCnt < n) {
      if (pos >= input.length) throw new InflateError('unexpected end of data');
      bitBuf |= input[pos++]! << bitCnt;
      bitCnt += 8;
    }
  };
  const bits = (n: number) => {
    if (n === 0) return 0;
    need(n);
    const v = bitBuf & ((1 << n) - 1);
    bitBuf >>>= n;
    bitCnt -= n;
    return v;
  };
  const ensure = (extra: number) => {
    if (outLen + extra > maxOutput) throw new InflateError('output too large');
    if (outLen + extra <= out.length) return;
    let size = out.length * 2;
    while (size < outLen + extra) size *= 2;
    const grown = new Uint8Array(Math.min(size, maxOutput));
    grown.set(out.subarray(0, outLen));
    out = grown;
  };
  const decode = (h: Huffman) => {
    let code = 0;
    let first = 0;
    let index = 0;
    for (let len = 1; len < 16; len++) {
      code |= bits(1);
      const count = h.counts[len]!;
      if (code - count < first) return h.symbols[index + (code - first)]!;
      index += count;
      first += count;
      first <<= 1;
      code <<= 1;
    }
    throw new InflateError('bad huffman code');
  };

  let last = 0;
  while (!last) {
    last = bits(1);
    const type = bits(2);
    if (type === 0) {
      bitBuf = 0;
      bitCnt = 0;
      if (pos + 4 > input.length) throw new InflateError('bad stored block');
      const len = input[pos]! | (input[pos + 1]! << 8);
      const nlen = input[pos + 2]! | (input[pos + 3]! << 8);
      pos += 4;
      if ((len ^ 0xffff) !== nlen) throw new InflateError('bad stored length');
      if (pos + len > input.length) throw new InflateError('unexpected end of data');
      ensure(len);
      out.set(input.subarray(pos, pos + len), outLen);
      outLen += len;
      pos += len;
      continue;
    }
    let lit: Huffman;
    let dist: Huffman;
    if (type === 1) [lit, dist] = fixed();
    else if (type === 2) {
      const hlit = bits(5) + 257;
      const hdist = bits(5) + 1;
      const hclen = bits(4) + 4;
      const lengths = new Uint8Array(320);
      for (let i = 0; i < hclen; i++) lengths[CL_ORDER[i]!] = bits(3);
      const cl = build(lengths, 0, 19);
      const all = new Uint8Array(hlit + hdist);
      for (let i = 0; i < hlit + hdist; ) {
        const sym = decode(cl);
        if (sym < 16) all[i++] = sym;
        else {
          let rep = 0;
          let val = 0;
          if (sym === 16) {
            if (i === 0) throw new InflateError('bad repeat');
            val = all[i - 1]!;
            rep = 3 + bits(2);
          } else if (sym === 17) rep = 3 + bits(3);
          else rep = 11 + bits(7);
          if (i + rep > hlit + hdist) throw new InflateError('bad lengths');
          while (rep--) all[i++] = val;
        }
      }
      lit = build(all, 0, hlit);
      dist = build(all, hlit, hdist);
    } else throw new InflateError('bad block type');

    for (;;) {
      const sym = decode(lit);
      if (sym < 256) {
        ensure(1);
        out[outLen++] = sym;
      } else if (sym === 256) break;
      else {
        const li = sym - 257;
        if (li >= 29) throw new InflateError('bad length');
        const len = LEN_BASE[li]! + bits(LEN_EXTRA[li]!);
        const di = decode(dist);
        if (di >= 30) throw new InflateError('bad distance');
        const d = DIST_BASE[di]! + bits(DIST_EXTRA[di]!);
        if (d > outLen) throw new InflateError('distance too far');
        ensure(len);
        for (let k = 0; k < len; k++) out[outLen + k] = out[outLen - d + k]!;
        outLen += len;
      }
    }
  }
  return out.subarray(0, outLen);
}
