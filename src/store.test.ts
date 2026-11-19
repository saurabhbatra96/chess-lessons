import { beforeEach, describe, expect, it } from 'vitest';
import {
  getProgress,
  importProgress,
  recordResult,
  recordRevision,
  resetLesson,
  returnMisses,
  spike,
  fileClippings,
} from './store';
import type { Puzzle } from './types';

const puzzle = (id: string): Puzzle => ({ id, fen: '', moves: [], rating: 1400, band: 'solid', themes: [] });

const blank = { version: 1, ratings: {}, attempted: {}, counts: {}, reviews: {}, read: {}, bestExam: null, lastLesson: null };

beforeEach(() => {
  importProgress(JSON.stringify({ ...blank, clippings: {} }));
});

describe('clippings', () => {
  it('clips stumbles and revealed solutions, but not clean solves', () => {
    recordResult(puzzle('a'), 'forks', 'clean', 5);
    recordResult(puzzle('b'), 'forks', 'stumble', 5);
    recordResult(puzzle('c'), 'pins', 'revealed', 5);
    const { clippings, counts } = getProgress();
    expect(Object.keys(clippings).sort()).toEqual(['b', 'c']);
    expect(clippings.b).toEqual({ slug: 'forks', outcome: 'stumble', clipped: 5, revised: 0, streak: 0 });
    expect(counts.forks).toEqual({ tried: 2, solved: 1 });
  });

  it('counts revision streaks, resets them on a slip, and leaves the rating alone', () => {
    recordResult(puzzle('b'), 'forks', 'stumble');
    const rating = getProgress().ratings.forks;
    recordRevision('b', 'clean');
    recordRevision('b', 'clean');
    expect(getProgress().clippings.b).toMatchObject({ revised: 2, streak: 2 });
    recordRevision('b', 'revealed');
    expect(getProgress().clippings.b).toMatchObject({ revised: 3, streak: 0, outcome: 'revealed' });
    expect(getProgress().ratings.forks).toBe(rating);
  });

  it('spikes a clipping out of the file', () => {
    recordResult(puzzle('b'), 'forks', 'stumble');
    spike('b');
    expect(getProgress().clippings).toEqual({});
  });

  it('clips the misses in progress saved before clippings existed, and files them by lesson later', () => {
    importProgress(
      JSON.stringify({
        ...blank,
        attempted: { a: true, b: false, c: false },
        reviews: { b: { stage: 0, due: 0, slug: 'pins' } },
      }),
    );
    expect(getProgress().clippings).toEqual({
      b: { slug: 'pins', outcome: 'missed', clipped: 0, revised: 0, streak: 0 },
      c: { slug: null, outcome: 'missed', clipped: 0, revised: 0, streak: 0 },
    });
    fileClippings(new Map([['c', 'forks']]));
    expect(getProgress().clippings.c.slug).toBe('forks');
  });
});

describe('resets', () => {
  it('returns only misses to the pile and keeps their clippings', () => {
    recordResult(puzzle('a'), 'forks', 'clean');
    recordResult(puzzle('b'), 'forks', 'stumble');
    recordResult(puzzle('c'), 'forks', 'revealed');
    const ids = ['a', 'b', 'c', 'd'].map((id) => ({ id, slug: 'forks' }));
    expect(returnMisses(ids)).toBe(2);
    const { attempted, counts, clippings } = getProgress();
    expect(attempted).toEqual({ a: true });
    expect(counts.forks).toEqual({ tried: 1, solved: 1 });
    expect(Object.keys(clippings).sort()).toEqual(['b', 'c']);
  });

  it('a returned miss is counted afresh when worked again', () => {
    recordResult(puzzle('b'), 'forks', 'stumble');
    returnMisses([{ id: 'b', slug: 'forks' }]);
    recordResult(puzzle('b'), 'forks', 'clean');
    expect(getProgress().counts.forks).toEqual({ tried: 1, solved: 1 });
    expect(getProgress().attempted.b).toBe(true);
  });

  it('starts one lesson afresh without touching another', () => {
    recordResult(puzzle('a'), 'forks', 'clean');
    recordResult(puzzle('b'), 'forks', 'revealed');
    recordResult(puzzle('p'), 'pins', 'revealed');
    resetLesson('forks', ['a', 'b']);
    const { attempted, counts, ratings, reviews, clippings } = getProgress();
    expect(attempted).toEqual({ p: false });
    expect(counts.forks).toBeUndefined();
    expect(ratings.forks).toBeUndefined();
    expect(Object.keys(reviews)).toEqual(['p']);
    expect(Object.keys(clippings).sort()).toEqual(['b', 'p']);
    expect(counts.pins).toEqual({ tried: 1, solved: 0 });
  });
});
