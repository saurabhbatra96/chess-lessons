export interface Puzzle {
  id: string;
  fen: string;
  /** UCI moves. The first is the opponent's; the solver answers from the second on. */
  moves: string[];
  rating: number;
  band: string;
  themes: string[];
}

export interface Band {
  id: string;
  name: string;
  min: number;
  max: number;
}

export interface Lesson {
  slug: string;
  title: string;
  dek: string;
  themes?: string[];
  openings?: string[];
  solver?: string;
}

export interface Section {
  id: string;
  title: string;
  status: 'published' | 'forthcoming';
  dek: string;
  lessons?: Lesson[];
  planned?: string[];
}

/** One of the five top-level sections a reader sees, grouping the content folders. */
export interface DeskSpec {
  id: string;
  title: string;
  dek: string;
  sections: string[];
  /** The piece drawn when the section has no engraving yet. */
  piece: string;
  artAlt: string;
}

export interface RepertoireGroup {
  title: string;
  rows: { they: string; you: string; lesson: string }[];
}

export interface Course {
  bands: Band[];
  desks: DeskSpec[];
  repertoire: RepertoireGroup[];
  sections: Section[];
}
