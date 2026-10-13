import type { DomainClass, Institution } from '../models';

/** Normalise an email for domain checks. Returns null when it isn't a plausible address. */
export function normalizeEmail(raw: string): { email: string; domain: string } | null {
  const email = raw.trim().toLowerCase();
  const at = email.lastIndexOf('@');
  if (at <= 0 || at !== email.indexOf('@')) return null;
  const domain = email.slice(at + 1).replace(/\.$/, '');
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain) || domain.split('.').some((l) => !l || l.startsWith('-') || l.endsWith('-'))) return null;
  if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(email.slice(0, at))) return null;
  return { email, domain };
}

const matches = (domain: string, approved: string) => domain === approved || domain.endsWith(`.${approved}`);

/**
 * Classify a domain against an approved directory. Only a directory match is
 * "recognized"; an academic-looking suffix is just a hint to offer review.
 * (Display only: the server repeats this check and is the authority.)
 */
export function classifyDomain(domain: string, directory: readonly Institution[], academicSuffixes: readonly string[]): DomainClass {
  const d = domain.toLowerCase();
  const hit = directory.find((i) => i.domains.some((a) => matches(d, a.toLowerCase())));
  if (hit) return { kind: 'recognized', institutionId: hit.id };
  if (academicSuffixes.some((s) => d.endsWith(`.${s}`))) return { kind: 'academicUnlisted' };
  return { kind: 'unrecognized' };
}
