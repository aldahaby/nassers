import { DOCUMENT_LIMITS } from '@/config/documents';
import { inflateRaw } from './inflate';
import { decodeUtf8 } from './utf8';

/**
 * Minimal ZIP reader for Office documents: reads the central directory and
 * extracts named entries (stored or deflated). Encrypted, multi-disk and
 * oversized archives are refused. Nothing is executed.
 */
export class ZipError extends Error {}

export interface ZipEntry {
  name: string;
  method: number;
  compressedSize: number;
  size: number;
  offset: number;
  encrypted: boolean;
}

const u16 = (b: Uint8Array, i: number) => b[i]! | (b[i + 1]! << 8);
const u32 = (b: Uint8Array, i: number) => (b[i]! | (b[i + 1]! << 8) | (b[i + 2]! << 16) | (b[i + 3]! << 24)) >>> 0;

export function isZip(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

const utf8 = decodeUtf8;

export function readZipEntries(bytes: Uint8Array): ZipEntry[] {
  // End of central directory: last 22 bytes + up to 64KB comment.
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i--) {
    if (u32(bytes, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new ZipError('not a zip archive');
  const count = u16(bytes, eocd + 10);
  const cdOffset = u32(bytes, eocd + 16);
  if (count > DOCUMENT_LIMITS.maxZipEntries) throw new ZipError('too many entries');
  const entries: ZipEntry[] = [];
  let p = cdOffset;
  for (let n = 0; n < count; n++) {
    if (p + 46 > bytes.length || u32(bytes, p) !== 0x02014b50) throw new ZipError('bad central directory');
    const flags = u16(bytes, p + 8);
    const method = u16(bytes, p + 10);
    const compressedSize = u32(bytes, p + 20);
    const size = u32(bytes, p + 24);
    const nameLen = u16(bytes, p + 28);
    const extraLen = u16(bytes, p + 30);
    const commentLen = u16(bytes, p + 32);
    const offset = u32(bytes, p + 42);
    const name = utf8(bytes.subarray(p + 46, p + 46 + nameLen));
    entries.push({ name, method, compressedSize, size, offset, encrypted: (flags & 1) === 1 });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

/** Extract one entry's bytes, with size and ratio limits. */
export function readZipEntry(bytes: Uint8Array, entry: ZipEntry, budget: { remaining: number }): Uint8Array {
  if (entry.encrypted) throw new ZipError('encrypted');
  if (entry.offset + 30 > bytes.length || u32(bytes, entry.offset) !== 0x04034b50) throw new ZipError('bad local header');
  const nameLen = u16(bytes, entry.offset + 26);
  const extraLen = u16(bytes, entry.offset + 28);
  const start = entry.offset + 30 + nameLen + extraLen;
  const data = bytes.subarray(start, start + entry.compressedSize);
  if (data.length < entry.compressedSize) throw new ZipError('truncated');
  if (entry.size > budget.remaining) throw new ZipError('too large');
  if (entry.compressedSize > 0 && entry.size / entry.compressedSize > DOCUMENT_LIMITS.maxCompressionRatio) throw new ZipError('suspicious compression');
  let out: Uint8Array;
  if (entry.method === 0) out = data;
  else if (entry.method === 8) out = inflateRaw(data, Math.min(budget.remaining, Math.max(entry.size, 1)));
  else throw new ZipError('unsupported compression');
  budget.remaining -= out.length;
  return out;
}
