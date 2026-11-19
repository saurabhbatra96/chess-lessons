import { START_RATING, updateRating } from './trainer/rating';
import { nextReview, type ReviewEntry } from './trainer/review';
import type { Puzzle } from './types';

const KEY = 'wsc-progress-v1';
const VERSION = 1;

export interface StoredReview extends ReviewEntry {
  slug: string;
}

/** How a puzzle went: solved straight off, solved after a wrong move, or given up and shown. */
export type Outcome = 'clean' | 'stumble' | 'revealed';

/** A puzzle kept for revision because it was once missed. */
export interface Clipping {
  /** The lesson it belongs to; null for misses recorded before clippings existed, until looked up. */
  slug: string | null;
  /** How it last went wrong. 'missed' marks old records that did not say which. */
  outcome: 'stumble' | 'revealed' | 'missed';
  clipped: number;
  /** Times worked in revision, and clean solves in a row there. */
  revised: number;
  streak: number;
}

export interface Progress {
  version: number;
  ratings: Record<string, number>;
  attempted: Record<string, boolean>;
  counts: Record<string, { tried: number; solved: number }>;
  reviews: Record<string, StoredReview>;
  clippings: Record<string, Clipping>;
  read: Record<string, boolean>;
  bestExam: number | null;
  lastLesson: string | null;
}

const empty = (): Progress => ({
  version: VERSION,
  ratings: {},
  attempted: {},
  counts: {},
  reviews: {},
  clippings: {},
  read: {},
  bestExam: null,
  lastLesson: null,
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Clips every recorded miss, for progress saved before the clippings file existed. */
function seedClippings(p: Progress): Record<string, Clipping> {
  const clippings: Record<string, Clipping> = {};
  for (const [id, solved] of Object.entries(p.attempted)) {
    if (solved) continue;
    clippings[id] = { slug: p.reviews[id]?.slug ?? null, outcome: 'missed', clipped: 0, revised: 0, streak: 0 };
  }
  return clippings;
}

/** Rejects files that are not a progress export, so an import cannot corrupt saved work. */
function parseProgress(value: unknown): Progress | null {
  if (!isRecord(value) || value.version !== VERSION) return null;
  const maps = [value.ratings, value.attempted, value.counts, value.reviews, value.read];
  if (!maps.every(isRecord)) return null;
  const parsed = { ...empty(), ...(value as Partial<Progress>) };
  if (!isRecord(value.clippings)) parsed.clippings = seedClippings(parsed);
  return parsed;
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

/** Records a result. Only a puzzle's first appearance moves the rating; any miss is clipped for revision. */
export function recordResult(puzzle: Puzzle, slug: string, outcome: Outcome, now = Date.now()): void {
  const solved = outcome === 'clean';
  if (!solved) {
    const clip = progress.clippings[puzzle.id];
    progress.clippings[puzzle.id] = clip
      ? { ...clip, slug, outcome, streak: 0 }
      : { slug, outcome, clipped: now, revised: 0, streak: 0 };
  }
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

/** Records a review of a missed puzzle: moves its streak and its spaced schedule, but never the rating. */
export function recordRevision(id: string, outcome: Outcome, now = Date.now()): void {
  const clip = progress.clippings[id];
  if (!clip) return;
  clip.revised++;
  if (outcome === 'clean') {
    clip.streak++;
  } else {
    clip.streak = 0;
    clip.outcome = outcome;
  }
  const next = nextReview(progress.reviews[id], outcome === 'clean', now);
  if (next && clip.slug) {
    progress.reviews[id] = { ...next, slug: clip.slug };
  } else {
    delete progress.reviews[id];
  }
  save();
}

/** Removes a clipping from the file once it no longer needs revising. */
export function spike(id: string): void {
  delete progress.clippings[id];
  delete progress.reviews[id];
  save();
}

/** Fills in the lesson of clippings kept before lessons were recorded, from an id-to-lesson index. */
export function fileClippings(slugOf: ReadonlyMap<string, string>): void {
  let changed = false;
  for (const [id, clip] of Object.entries(progress.clippings)) {
    const slug = slugOf.get(id);
    if (clip.slug === null && slug) {
      clip.slug = slug;
      changed = true;
    }
  }
  if (changed) save();
}

/**
 * Puts missed puzzles back in their lesson's unworked pile, so the trainer serves them again.
 * Clean solves stay worked, and the clippings file is untouched. Returns how many went back.
 */
export function returnMisses(puzzles: { id: string; slug: string }[]): number {
  let returned = 0;
  for (const { id, slug } of puzzles) {
    if (progress.attempted[id] !== false) continue;
    delete progress.attempted[id];
    const counts = progress.counts[slug];
    if (counts) counts.tried = Math.max(counts.solved, counts.tried - 1);
    returned++;
  }
  if (returned) save();
  return returned;
}

/** Clears a lesson's puzzle record and rating so it can be worked from the start. Clippings stay. */
export function resetLesson(slug: string, ids: string[]): void {
  for (const id of ids) delete progress.attempted[id];
  delete progress.counts[slug];
  delete progress.ratings[slug];
  for (const [id, entry] of Object.entries(progress.reviews)) {
    if (entry.slug === slug) delete progress.reviews[id];
  }
  save();
}

export function markRead(slug: string): void {
  progress.read[slug] = true;
  save();
}

export function markOpened(slug: string): void {
  progress.lastLesson = slug;
  save();
}

export const hasStarted = (): boolean =>
  progress.lastLesson !== null || Object.keys(progress.read).length > 0 || Object.keys(progress.attempted).length > 0;

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
