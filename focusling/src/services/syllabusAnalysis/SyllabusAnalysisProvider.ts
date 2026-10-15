import { extractInsights, parseSyllabus, stripRunningHeaders, type ParseResult, type SyllabusInsights } from '@/core';

/**
 * Where syllabus understanding happens (docs/SYLLABUS_INTELLIGENCE.md §AI).
 *
 * - Local (shipped): deterministic rules on the device. Nothing leaves it.
 * - Remote model (NOT built): would need a Studyling backend that holds the
 *   model API key (never the app), an explicit per-import consent screen that
 *   says what is sent and to whom, no retention by default, and results that
 *   go through the same student review. Until then it reports "unavailable";
 *   no mock AI results are ever presented as real.
 */
export interface AnalysisContext {
  timezone: string;
  referenceAt: number;
}

export type AnalysisResult = { ok: true; parsed: ParseResult; insights: SyllabusInsights; source: 'local' | 'remote' } | { ok: false; error: 'unavailable' | 'consentRequired' };

export interface SyllabusAnalysisProvider {
  readonly kind: 'local' | 'remote';
  /** True when using it would send the document off the device. */
  readonly sendsDocument: boolean;
  analyze(text: string, ctx: AnalysisContext, opts?: { consented?: boolean }): Promise<AnalysisResult>;
}

export class LocalSyllabusAnalysisProvider implements SyllabusAnalysisProvider {
  readonly kind = 'local' as const;
  readonly sendsDocument = false;
  async analyze(text: string, ctx: AnalysisContext): Promise<AnalysisResult> {
    const cleaned = stripRunningHeaders(text).text;
    return { ok: true, parsed: parseSyllabus({ text: cleaned, timezone: ctx.timezone, referenceAt: ctx.referenceAt }), insights: extractInsights(cleaned), source: 'local' };
  }
}

/** Placeholder for a future backend model. Refuses without consent, and is unavailable until a backend exists. */
export class UnavailableRemoteSyllabusAnalysisProvider implements SyllabusAnalysisProvider {
  readonly kind = 'remote' as const;
  readonly sendsDocument = true;
  async analyze(_text: string, _ctx: AnalysisContext, opts: { consented?: boolean } = {}): Promise<AnalysisResult> {
    if (!opts.consented) return { ok: false, error: 'consentRequired' };
    return { ok: false, error: 'unavailable' };
  }
}
