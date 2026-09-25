/** Outcome of a game action that can fail for a user-facing reason. */
export type Result<T, E extends string = string> = { ok: true; value: T } | { ok: false; error: E };

export const ok = <T>(value: T): { ok: true; value: T } => ({ ok: true, value });
export const fail = <E extends string>(error: E): { ok: false; error: E } => ({ ok: false, error });
