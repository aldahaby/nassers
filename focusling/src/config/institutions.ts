import type { Institution } from '@/core/models';

/**
 * SAMPLE institution directory for tests and development. NOT authoritative
 * and NOT complete: the real approved directory lives on the server, which is
 * the only place eligibility is decided. An academic-looking suffix (.edu,
 * .ac.uk, …) alone never makes a domain "recognized".
 */
export const SAMPLE_INSTITUTIONS: readonly Institution[] = [
  { id: 'mcgill', name: 'McGill University', country: 'CA', domains: ['mcgill.ca', 'mail.mcgill.ca'] },
  { id: 'ox', name: 'University of Oxford', country: 'GB', domains: ['ox.ac.uk'] },
  { id: 'unimelb', name: 'University of Melbourne', country: 'AU', domains: ['unimelb.edu.au', 'student.unimelb.edu.au'] },
  { id: 'auckland', name: 'University of Auckland', country: 'NZ', domains: ['auckland.ac.nz', 'aucklanduni.ac.nz'] },
  { id: 'ju', name: 'University of Jordan', country: 'JO', domains: ['ju.edu.jo'] },
  { id: 'example-state', name: 'Example State University (fixture)', country: 'US', domains: ['example.edu'] },
];

/** Suffixes that often belong to academic institutions. Used only to suggest the review route. */
export const ACADEMIC_SUFFIXES: readonly string[] = ['edu', 'ac.uk', 'edu.au', 'ac.nz', 'edu.jo', 'ac.jp', 'edu.cn', 'ac.in', 'edu.sg', 'ac.za', 'edu.mx', 'edu.br'];
