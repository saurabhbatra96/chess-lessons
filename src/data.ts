import courseJson from '../content/course.json';
import type { Course, DeskSpec, Lesson, Puzzle, Section } from './types';

export const course = courseJson as Course;

export type PublishedSection = Section & { lessons: Lesson[] };
export type Desk = DeskSpec & { parts: PublishedSection[]; lessons: Lesson[] };

export const PUZZLES_PER_LESSON = 70;

export const sections = course.sections as PublishedSection[];
export const allLessons = sections.flatMap((s) => s.lessons);
export const tactics = sections.find((s) => s.id === 'tactics') as PublishedSection;

export const desks: Desk[] = course.desks.map((desk) => {
  const parts = desk.sections.map((id) => sections.find((s) => s.id === id) as PublishedSection);
  return { ...desk, parts, lessons: parts.flatMap((p) => p.lessons) };
});

export const deskOf = (slug: string): Desk | undefined => desks.find((d) => d.lessons.some((l) => l.slug === slug));

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
