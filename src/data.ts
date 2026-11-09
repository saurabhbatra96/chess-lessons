import courseJson from '../content/course.json';
import type { Course, Lesson, Puzzle, Section } from './types';

export const course = courseJson as Course;

export type PublishedSection = Section & { lessons: Lesson[] };

export const sections = course.sections as PublishedSection[];
export const allLessons = sections.flatMap((s) => s.lessons);
export const tactics = sections.find((s) => s.id === 'tactics') as PublishedSection;

export const findLesson = (slug: string): Lesson | undefined => allLessons.find((l) => l.slug === slug);
export const sectionOf = (slug: string): PublishedSection | undefined =>
  sections.find((s) => s.lessons.some((l) => l.slug === slug));
export const hasPuzzles = (lesson: Lesson): boolean => Boolean(lesson.themes || lesson.openings);

const cache = new Map<string, Promise<Puzzle[]>>();

export function loadPuzzles(slug: string): Promise<Puzzle[]> {
  let pending = cache.get(slug);
  if (!pending) {
    pending = fetch(`${import.meta.env.BASE_URL}data/${sectionOf(slug)?.id}/${slug}.json`).then((res) => {
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
