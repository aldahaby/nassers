/** Epoch milliseconds. All persisted timestamps use this so saves stay JSON-serialisable. */
export type Timestamp = number;

/** Local calendar day in `YYYY-MM-DD` form. Used for streaks and daily stats. */
export type DateKey = string;

/** Opaque string identifier. */
export type Id = string;
