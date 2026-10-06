import type { Id, Timestamp } from './common';

/** Student-made retrieval practice (no AI-generated questions). */
export type RetrievalItemType = 'freeRecall' | 'questionAnswer' | 'concept';

export type RetrievalResult = 'got' | 'partly' | 'missed';

export interface RetrievalAttempt {
  at: Timestamp;
  result: RetrievalResult;
  sessionId?: Id;
}

export interface RetrievalItem {
  id: Id;
  type: RetrievalItemType;
  prompt: string;
  answer?: string;
  courseId?: Id;
  assignmentId?: Id;
  sourceSessionId?: Id;
  createdAt: Timestamp;
  lastResult?: RetrievalResult;
  lastAttemptAt?: Timestamp;
  /**
   * When to look at it again. V1 uses a fixed, documented interval per result
   * (config/planner.ts); a spaced-repetition scheduler can replace it later.
   */
  nextDueAt?: Timestamp;
  attemptCount: number;
  attempts: RetrievalAttempt[];
}
