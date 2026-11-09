import { Chess } from 'chess.js';
import { marked, type Token, type TokensList } from 'marked';
import { Board } from './board/board';
import { loadPuzzles, sectionOf } from './data';
import { recordResult } from './store';
import { mountChoice } from './trainer/choice';
import { mountPuzzle } from './trainer/player';
import { mountWalker } from './trainer/walker';

const sources = import.meta.glob('../content/*/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

export const lessonSource = (slug: string): string | undefined =>
  sources[`../content/${sectionOf(slug)?.id}/${slug}.md`];

const parseMoves = (text: string): string[] =>
  text
    .replace(/\d+\.+/g, ' ')
    .split(/\s+/)
    .filter((t) => t && !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(t));

interface Block {
  fields: Record<string, string>;
  notes: [string, string][];
  options: { uci: string; text: string }[];
}

function parseBlock(text: string): Block {
  const block: Block = { fields: {}, notes: [], options: [] };
  for (const line of text.split('\n')) {
    const at = line.indexOf(':');
    if (at <= 0) continue;
    const key = line.slice(0, at).trim();
    const value = line.slice(at + 1).trim();
    const split = value.indexOf('|');
    if (key === 'note') block.notes.push([value.slice(0, split).trim(), value.slice(split + 1).trim()]);
    else if (key === 'option') block.options.push({ uci: value.slice(0, split).trim(), text: value.slice(split + 1).trim() });
    else block.fields[key] = value;
  }
  // `after` names a position by the moves that reach it, instead of a typed FEN.
  if (block.fields.after) {
    const game = new Chess();
    for (const san of parseMoves(block.fields.after)) game.move(san);
    block.fields.fen = game.fen();
  }
  return block;
}

/** Converts a note label such as "3...d5" to a ply index, counting from the block's first move. */
function plyOf(label: string, start: string | undefined): number {
  const match = label.match(/^(\d+)(\.+)/) as RegExpMatchArray;
  const parts = start?.split(' ');
  const startFull = parts ? +parts[5] : 1;
  const startsBlack = parts?.[1] === 'b';
  return (+match[1] - startFull) * 2 + (match[2].length > 1 ? 1 : 0) - (startsBlack ? 1 : 0);
}

function diagram({ fields }: Block): HTMLElement {
  const figure = document.createElement('figure');
  figure.className = 'diagram';
  const board = new Board();
  const side = fields.fen.split(' ')[1] as 'w' | 'b';
  board.setOrientation((fields.orientation as 'w' | 'b') || side);
  const arrows = (fields.arrows ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .map((uci) => ({ from: uci.slice(0, 2), to: uci.slice(2, 4) }));
  board.setPosition(fields.fen, null, arrows);
  const caption = document.createElement('figcaption');
  caption.textContent = fields.caption ?? '';
  figure.append(board.el, caption);
  return figure;
}

function inlinePuzzle({ fields }: Block, slug: string): HTMLElement {
  const holder = document.createElement('div');
  holder.className = 'inline-puzzle';
  loadPuzzles(slug)
    .then((puzzles) => {
      const puzzle = puzzles.find((p) => p.id === fields.id);
      if (!puzzle) throw new Error(`Puzzle ${fields.id} not found`);
      mountPuzzle(holder, puzzle, {
        prompt: fields.prompt,
        onResult: (solved) => recordResult(puzzle, slug, solved),
      });
    })
    .catch(() => {
      holder.textContent = 'This puzzle could not be loaded.';
    });
  return holder;
}

function walkerBlock(block: Block, kind: 'line' | 'game'): HTMLElement {
  const { fields, notes } = block;
  const figure = document.createElement('figure');
  figure.className = 'inline-puzzle';
  const heading = document.createElement('figcaption');
  heading.className = 'walker__title';
  heading.textContent = fields.caption ?? '';
  const host = document.createElement('div');
  figure.append(heading, host);
  const side = fields.side as 'w' | 'b';
  const isGame = kind === 'game';
  mountWalker(host, {
    start: fields.start,
    moves: parseMoves(fields.moves),
    side,
    notes: new Map(notes.map(([label, text]) => [plyOf(label, fields.start), text])),
    testFrom: isGame ? (+fields.from - 1) * 2 + (side === 'b' ? 1 : 0) : 0,
    attempts: isGame ? 1 : 2,
    testLabel: isGame ? 'Guess the moves' : 'Test yourself',
    revealPrefix: isGame ? 'The game continued' : 'The line is',
    spoilerFree: isGame,
  });
  return figure;
}

function choiceBlock({ fields, options }: Block): HTMLElement {
  const holder = document.createElement('div');
  holder.className = 'inline-puzzle';
  mountChoice(holder, fields.fen, fields.question, fields.answer, options);
  return holder;
}

const BLOCKS = new Set(['board', 'puzzle', 'line', 'game', 'choice']);

/** Renders a lesson: a single column of prose, broken up by diagrams and exercises. */
export function renderLesson(host: HTMLElement, slug: string, source: string): void {
  const tokens = marked.lexer(source);
  let prose: Token[] = [];

  const flush = () => {
    if (!prose.length) return;
    const list = Object.assign(prose, { links: tokens.links }) as TokensList;
    const block = document.createElement('div');
    block.className = 'prose';
    block.innerHTML = marked.parser(list);
    host.append(block);
    prose = [];
  };

  for (const token of tokens) {
    if (token.type === 'code' && BLOCKS.has(token.lang ?? '')) {
      flush();
      const block = parseBlock(token.text);
      if (token.lang === 'board') host.append(diagram(block));
      else if (token.lang === 'puzzle') host.append(inlinePuzzle(block, slug));
      else if (token.lang === 'choice') host.append(choiceBlock(block));
      else host.append(walkerBlock(block, token.lang as 'line' | 'game'));
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
