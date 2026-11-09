import { marked, type Token, type TokensList } from 'marked';
import { Board } from './board/board';
import { loadPuzzles } from './data';
import { mountPuzzle } from './trainer/player';
import { recordResult } from './store';

const sources = import.meta.glob('../content/tactics/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

export const lessonSource = (slug: string): string | undefined => sources[`../content/tactics/${slug}.md`];

function fields(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const at = line.indexOf(':');
    if (at > 0) out[line.slice(0, at).trim()] = line.slice(at + 1).trim();
  }
  return out;
}

function diagram(block: Record<string, string>): HTMLElement {
  const figure = document.createElement('figure');
  figure.className = 'diagram';
  const board = new Board();
  const side = block.fen.split(' ')[1] as 'w' | 'b';
  board.setOrientation((block.orientation as 'w' | 'b') || side);
  const arrows = (block.arrows ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .map((uci) => ({ from: uci.slice(0, 2), to: uci.slice(2, 4) }));
  board.setPosition(block.fen, null, arrows);
  const caption = document.createElement('figcaption');
  caption.textContent = block.caption ?? '';
  figure.append(board.el, caption);
  return figure;
}

function inlinePuzzle(block: Record<string, string>, slug: string): HTMLElement {
  const holder = document.createElement('div');
  holder.className = 'inline-puzzle';
  loadPuzzles(slug)
    .then((puzzles) => {
      const puzzle = puzzles.find((p) => p.id === block.id);
      if (!puzzle) throw new Error(`Puzzle ${block.id} not found`);
      mountPuzzle(holder, puzzle, {
        prompt: block.prompt,
        onResult: (solved) => recordResult(puzzle, slug, solved),
      });
    })
    .catch(() => {
      holder.textContent = 'This puzzle could not be loaded.';
    });
  return holder;
}

/** Renders a lesson: prose runs become newspaper columns, split by full-width diagrams. */
export function renderLesson(host: HTMLElement, slug: string, source: string): void {
  const tokens = marked.lexer(source);
  let prose: Token[] = [];

  const flush = () => {
    if (!prose.length) return;
    const list = Object.assign(prose, { links: tokens.links }) as TokensList;
    const block = document.createElement('div');
    block.className = 'columns';
    block.innerHTML = marked.parser(list);
    host.append(block);
    prose = [];
  };

  for (const token of tokens) {
    if (token.type === 'code' && (token.lang === 'board' || token.lang === 'puzzle')) {
      flush();
      const block = fields(token.text);
      host.append(token.lang === 'board' ? diagram(block) : inlinePuzzle(block, slug));
    } else if (token.type === 'heading') {
      flush();
      const heading = document.createElement('h2');
      heading.className = 'subhead';
      heading.textContent = token.text;
      host.append(heading);
    } else {
      prose.push(token);
    }
  }
  flush();
}
