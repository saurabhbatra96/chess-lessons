import type { Puzzle } from '../types';

export const START_RATING = 1400;
const K = 24;

export const expectedScore = (rating: number, opponent: number): number =>
  1 / (1 + 10 ** ((opponent - rating) / 400));

export const updateRating = (rating: number, puzzleRating: number, solved: boolean): number =>
  Math.round(rating + K * (Number(solved) - expectedScore(rating, puzzleRating)));

/** Picks the unattempted puzzle closest to the player's rating, or null when none remain. */
export function pickNext(puzzles: Puzzle[], rating: number, attempted: ReadonlySet<string>): Puzzle | null {
  let best: Puzzle | null = null;
  let bestGap = Infinity;
  for (const puzzle of puzzles) {
    if (attempted.has(puzzle.id)) continue;
    const gap = Math.abs(puzzle.rating - rating);
    if (gap < bestGap) {
      best = puzzle;
      bestGap = gap;
    }
  }
  return best;
}
