import type { CourseIdentity } from '../models';

/**
 * Normalised course identity for future Course Spaces
 * (University → Term → Course code → optional Section). Pure data only:
 * nothing is published, shared or joined. The key always includes the
 * institution, so "COMP 202" at two universities never matches.
 */
export interface CourseSpaceKey {
  institutionKey: string;
  termKey: string;
  codeKey: string;
  sectionKey: string | null;
  /** Stable string form, e.g. "lakeshore-university/fall-2026/comp-202". */
  key: string;
}

const fold = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(the|of|at)\b/g, ' ')
    .trim()
    .replace(/\s+/g, '-');

export function institutionKeyOf(name: string): string {
  return fold(name.replace(/^the\s+/i, ''));
}

/** Null unless institution, term and course code are all known (never guessed). */
export function courseSpaceKeyOf(identity: CourseIdentity): CourseSpaceKey | null {
  if (!identity.institution || !identity.term || !identity.subject || !identity.number) return null;
  const institutionKey = institutionKeyOf(identity.institution);
  if (!institutionKey) return null;
  const termKey = `${identity.term.season}-${identity.term.year}`;
  const codeKey = `${identity.subject.toLowerCase()}-${identity.number.toLowerCase()}`;
  const sectionKey = identity.section ? fold(identity.section) : null;
  return { institutionKey, termKey, codeKey, sectionKey, key: `${institutionKey}/${termKey}/${codeKey}` };
}
