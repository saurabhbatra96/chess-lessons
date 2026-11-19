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

/** Maps every puzzle id in the course to its lesson. Loads all puzzle files, so call it only when needed. */
export async function puzzleIndex(): Promise<Map<string, string>> {
  const lessons = allLessons.filter(hasPuzzles);
  const sets = await Promise.all(lessons.map((l) => loadPuzzles(l.slug)));
  const index = new Map<string, string>();
  lessons.forEach((l, i) => {
    for (const p of sets[i]) index.set(p.id, l.slug);
  });
  return index;
}

export const esc =(text: string): string =>
  text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
