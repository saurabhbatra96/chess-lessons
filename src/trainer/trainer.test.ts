import { describe, expect, it } from 'vitest';
import type { Puzzle } from '../types';
import { pickNext, updateRating } from './rating';
import { isDue, nextReview } from './review';
import { PuzzleSession } from './session';

// Real database puzzle: Black plays Ke3, White forks with Nf5+, Black moves, White takes the rook.
const fork: Puzzle = {
  id: '4pI19',
  fen: '8/1p6/p2p4/3Pn3/P1p2k1r/6NP/1P4K1/7R b - - 3 39',
  moves: ['f4e3', 'g3f5', 'e3e4', 'f5h4'],
  rating: 947,
  band: 'warmup',
  themes: ['fork'],
};

// Either rook mates on the back rank; only Re8 is the listed line.
const twoMates: Puzzle = {
  id: 'mate',
  fen: '7k/1p4pp/8/8/8/8/8/R3R1K1 b - - 0 1',
  moves: ['b7b6', 'e1e8'],
  rating: 1000,
  band: 'warmup',
  themes: ['mateIn1'],
};

describe('PuzzleSession', () => {
  it('plays the opponent move first and solves from the other side', () => {
    const session = new PuzzleSession(fork);
    expect(session.solver).toBe('w');
    expect(session.fen.split(' ')[1]).toBe('w');
  });

  it('walks the full line to solved', () => {
    const session = new PuzzleSession(fork);
    expect(session.attempt('g3f5')).toEqual({ status: 'continue', reply: 'e3e4' });
    expect(session.attempt('f5h4')).toEqual({ status: 'solved' });
    expect(session.done).toBe(true);
  });

  it('rejects a legal wrong move without changing the position', () => {
    const session = new PuzzleSession(fork);
    const before = session.fen;
    expect(session.attempt('h1h2')).toEqual({ status: 'wrong' });
    expect(session.fen).toBe(before);
  });

  it('rejects an illegal move without throwing', () => {
    const session = new PuzzleSession(fork);
    expect(session.attempt('a4a8')).toEqual({ status: 'wrong' });
  });

  it('accepts a different mating move', () => {
    const session = new PuzzleSession(twoMates);
    expect(session.attempt('a1a8')).toEqual({ status: 'solved' });
  });
});

describe('rating', () => {
  it('rises on a solve and falls on a miss', () => {
    expect(updateRating(1400, 1400, true)).toBe(1412);
    expect(updateRating(1400, 1400, false)).toBe(1388);
  });

  it('picks the closest unattempted puzzle', () => {
    const at = (id: string, rating: number) => ({ ...fork, id, rating });
    const pool = [at('a', 1000), at('b', 1390), at('c', 1700)];
    expect(pickNext(pool, 1400, new Set())?.id).toBe('b');
    expect(pickNext(pool, 1400, new Set(['b']))?.id).toBe('c');
    expect(pickNext(pool, 1400, new Set(['a', 'b', 'c']))).toBeNull();
  });
});

describe('review schedule', () => {
  const DAY = 86_400_000;

  it('schedules a miss for tomorrow', () => {
    expect(nextReview(undefined, false, 0)).toEqual({ stage: 0, due: DAY });
  });

  it('steps through 3 and 7 days, then retires the puzzle', () => {
    const first = nextReview({ stage: 0, due: 0 }, true, 0);
    expect(first).toEqual({ stage: 1, due: 3 * DAY });
    const second = nextReview(first!, true, 0);
    expect(second).toEqual({ stage: 2, due: 7 * DAY });
    expect(nextReview(second!, true, 0)).toBeNull();
  });

  it('restarts after a miss during review', () => {
    expect(nextReview({ stage: 2, due: 0 }, false, 0)).toEqual({ stage: 0, due: DAY });
  });

  it('does not create a review for a first-time solve', () => {
    expect(nextReview(undefined, true, 0)).toBeNull();
  });

  it('reports due entries', () => {
    expect(isDue({ stage: 0, due: 5 }, 5)).toBe(true);
    expect(isDue({ stage: 0, due: 6 }, 5)).toBe(false);
  });
});
