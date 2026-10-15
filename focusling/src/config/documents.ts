/** Limits for reading syllabus files on the device (docs/SYLLABUS_INTELLIGENCE.md). */
export const DOCUMENT_LIMITS = {
  /** Largest file accepted, in bytes. Syllabi are small; this blocks accidental huge files. */
  maxFileBytes: 15 * 1024 * 1024,
  /** Largest total uncompressed size read out of a DOCX (zip-bomb guard). */
  maxUncompressedBytes: 40 * 1024 * 1024,
  /** Most entries a DOCX zip may have. */
  maxZipEntries: 2000,
  /** Largest compression ratio allowed for one zip entry (zip-bomb guard). */
  maxCompressionRatio: 200,
  /** Most characters of text kept from one document. */
  maxTextChars: 400_000,
  /**
   * A document whose text is mostly not letters/digits (e.g. a failed scan)
   * is refused instead of producing a partial, misleading import.
   */
  minReadableRatio: 0.55,
  /** Fewer readable letters than this means there is nothing to work with. */
  minLetters: 40,
} as const;
