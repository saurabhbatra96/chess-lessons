import { START_RATING, updateRating } from './trainer/rating';
import { nextReview, type ReviewEntry } from './trainer/review';
import type { Puzzle } from './types';

const KEY = 'wsc-progress-v1';
const VERSION = 1;

export interface StoredReview extends ReviewEntry {
  slug: string;
}

export interface Progress {
  version: number;
  ratings: Record<string, number>;
  attempted: Record<string, boolean>;
  counts: Record<string, { tried: number; solved: number }>;
  reviews: Record<string, StoredReview>;
  read: Record<string, boolean>;
  bestExam: number | null;
}

const empty = (): Progress => ({
  version: VERSION,
  ratings: {},
  attempted: {},
  counts: {},
  reviews: {},
  read: {},
  bestExam: null,
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Rejects files that are not a progress export, so an import cannot corrupt saved work. */
function parseProgress(value: unknown): Progress | null {
  if (!isRecord(value) || value.version !== VERSION) return null;
  const maps = [value.ratings, value.attempted, value.counts, value.reviews, value.read];
  if (!maps.every(isRecord)) return null;
  return { ...empty(), ...(value as Partial<Progress>) };
}

function load(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    return (raw && parseProgress(JSON.parse(raw))) || empty();
  } catch {
    return empty();
  }
}

let progress = load();

function save(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(progress));
  } catch {
    // Private windows may refuse storage; progress then lasts for this visit only.
  }
}

export const getProgress = (): Progress => progress;
export const ratingFor = (slug: string): number => progress.ratings[slug] ?? START_RATING;
export const attemptedIds = (): Set<string> => new Set(Object.keys(progress.attempted));

/** Records the first-try result. Only a puzzle's first appearance moves the rating. */
export function recordResult(puzzle: Puzzle, slug: string, solved: boolean, now = Date.now()): void {
  if (!(puzzle.id in progress.attempted)) {
    progress.ratings[slug] = updateRating(ratingFor(slug), puzzle.rating, solved);
    const counts = progress.counts[slug] ?? { tried: 0, solved: 0 };
    progress.counts[slug] = { tried: counts.tried + 1, solved: counts.solved + Number(solved) };
    progress.attempted[puzzle.id] = solved;
  }
  const next = nextReview(progress.reviews[puzzle.id], solved, now);
  if (next) {
    progress.reviews[puzzle.id] = { ...next, slug };
  } else {
    delete progress.reviews[puzzle.id];
  }
  save();
}

export function markRead(slug: string): void {
  progress.read[slug] = true;
  save();
}

export function recordExam(score: number): void {
  progress.bestExam = Math.max(progress.bestExam ?? 0, score);
  save();
}

export const exportProgress = (): string => JSON.stringify(progress, null, 2);

export function importProgress(text: string): boolean {
  let parsed: Progress | null;
  try {
    parsed = parseProgress(JSON.parse(text));
  } catch {
    return false;
  }
  if (!parsed) return false;
  progress = parsed;
  save();
  return true;
}
