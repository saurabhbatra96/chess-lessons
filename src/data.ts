import courseJson from '../content/course.json';
import type { Course, Lesson, Puzzle, Section } from './types';

export const course = courseJson as Course;

export const tactics = course.sections.find((s) => s.id === 'tactics') as Section & { lessons: Lesson[] };

export const findLesson = (slug: string): Lesson | undefined => tactics.lessons.find((l) => l.slug === slug);

const cache = new Map<string, Promise<Puzzle[]>>();

export function loadPuzzles(slug: string): Promise<Puzzle[]> {
  let pending = cache.get(slug);
  if (!pending) {
    pending = fetch(`${import.meta.env.BASE_URL}data/tactics/${slug}.json`).then((res) => {
      if (!res.ok) throw new Error(`Could not load puzzles for ${slug}`);
      return res.json() as Promise<Puzzle[]>;
    });
    pending.catch(() => cache.delete(slug));
    cache.set(slug, pending);
  }
  return pending;
}

export const esc = (text: string): string =>
  text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
