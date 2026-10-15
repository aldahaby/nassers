/** UTF-8 → string without relying on TextDecoder (not available on every JS engine). */
export function decodeUtf8(b: Uint8Array): string {
  let out = '';
  let chunk: number[] = [];
  const flush = () => {
    out += String.fromCharCode(...chunk);
    chunk = [];
  };
  for (let i = 0; i < b.length; ) {
    const c = b[i]!;
    let cp: number;
    if (c < 0x80) {
      cp = c;
      i += 1;
    } else if (c >> 5 === 0x6 && i + 1 < b.length) {
      cp = ((c & 0x1f) << 6) | (b[i + 1]! & 0x3f);
      i += 2;
    } else if (c >> 4 === 0xe && i + 2 < b.length) {
      cp = ((c & 0x0f) << 12) | ((b[i + 1]! & 0x3f) << 6) | (b[i + 2]! & 0x3f);
      i += 3;
    } else if (c >> 3 === 0x1e && i + 3 < b.length) {
      cp = ((c & 0x07) << 18) | ((b[i + 1]! & 0x3f) << 12) | ((b[i + 2]! & 0x3f) << 6) | (b[i + 3]! & 0x3f);
      i += 4;
    } else {
      cp = 0xfffd;
      i += 1;
    }
    if (cp > 0xffff) {
      cp -= 0x10000;
      chunk.push(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
    } else chunk.push(cp);
    if (chunk.length > 8000) flush();
  }
  flush();
  return out;
}
