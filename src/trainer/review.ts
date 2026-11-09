export interface ReviewEntry {
  stage: number;
  due: number;
}

const DAY = 86_400_000;
const INTERVALS = [1, 3, 7];

/** Returns the puzzle's next review state, or null once it has been retired. */
export function nextReview(entry: ReviewEntry | undefined, solved: boolean, now: number): ReviewEntry | null {
  if (!solved) return { stage: 0, due: now + INTERVALS[0] * DAY };
  if (!entry) return null;
  const stage = entry.stage + 1;
  if (stage >= INTERVALS.length) return null;
  return { stage, due: now + INTERVALS[stage] * DAY };
}

export const isDue = (entry: ReviewEntry, now: number): boolean => entry.due <= now;
