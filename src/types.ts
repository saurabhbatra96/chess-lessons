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
  kicker: string;
  status: 'published' | 'forthcoming';
  dek: string;
  lessons?: Lesson[];
  planned?: string[];
}

export interface Course {
  bands: Band[];
  sections: Section[];
}
