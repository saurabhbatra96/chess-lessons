import { Board } from '../board/board';
import type { Puzzle } from '../types';
import { PuzzleSession } from './session';

export interface PlayerOptions {
  prompt?: string;
  /** Called once per puzzle, with whether it was solved on the first try. */
  onResult?: (solved: boolean) => void;
  onNext?: () => void;
  nextLabel?: string;
}

const REPLY_DELAY = 350;
const SETUP_DELAY = 600;
const colorName = (c: 'w' | 'b') => (c === 'w' ? 'White' : 'Black');

/** Mounts an interactive puzzle in `host`. */
export function mountPuzzle(host: HTMLElement, puzzle: Puzzle, options: PlayerOptions = {}): void {
  const session = new PuzzleSession(puzzle);
  const board = new Board();
  let cleanRun = true;
  let reported = false;
  // True during animations and until the opponent's opening move has been shown.
  let busy = true;

  const figure = document.createElement('div');
  figure.className = 'puzzle';
  figure.dataset.puzzleId = puzzle.id;
  const status = document.createElement('p');
  status.className = 'puzzle__status';
  status.setAttribute('role', 'status');
  const typed = document.createElement('form');
  typed.className = 'puzzle__typed';
  typed.innerHTML = `<label>Or write your move <input name="move" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Nf5"></label>`;
  const actions = document.createElement('div');
  actions.className = 'puzzle__actions';
  const reveal = document.createElement('button');
  reveal.type = 'button';
  reveal.textContent = 'Show the solution';
  const next = document.createElement('button');
  next.type = 'button';
  next.textContent = options.nextLabel ?? 'Next puzzle';
  next.hidden = true;
  actions.append(reveal, next);

  const meta = document.createElement('p');
  meta.className = 'puzzle__meta';
  const link = document.createElement('a');
  link.href = `https://lichess.org/training/${encodeURIComponent(puzzle.id)}`;
  link.target = '_blank';
  link.rel = 'noopener';
  link.textContent = `Rated ${puzzle.rating} · No. ${puzzle.id}`;
  meta.append(link);

  figure.append(board.el, status, typed, actions, meta);
  host.replaceChildren(figure);

  const say = (text: string, tone = '') => {
    status.textContent = text;
    status.dataset.tone = tone;
  };

  const report = (solved: boolean) => {
    if (reported) return;
    reported = true;
    options.onResult?.(solved);
  };

  const finish = (text: string, tone: string) => {
    board.setInteractive(null);
    typed.hidden = true;
    reveal.hidden = true;
    next.hidden = !options.onNext;
    say(text, tone);
  };

  const pause = () => new Promise((resolve) => window.setTimeout(resolve, REPLY_DELAY));

  const unlock = () => {
    busy = false;
    board.setInteractive(session.game);
  };

  const play = async (uci: string) => {
    if (busy) return;
    busy = true;
    board.setInteractive(null);
    const result = session.attempt(uci);
    if (result.status === 'wrong') {
      cleanRun = false;
      say('Not that move. Look again.', 'wrong');
      unlock();
      return;
    }
    await board.animate(uci, session.fenBeforeReply);
    if (result.status === 'solved') {
      report(cleanRun);
      finish(cleanRun ? 'Solved at the first attempt.' : 'Solved, with a stumble.', cleanRun ? 'right' : '');
      return;
    }
    say('Correct. Keep going.', 'right');
    await pause();
    if (!host.isConnected) return;
    await board.animate(result.reply, session.fen);
    unlock();
  };

  const showSolution = async () => {
    if (busy) return;
    busy = true;
    cleanRun = false;
    report(false);
    board.setInteractive(null);
    reveal.hidden = true;
    typed.hidden = true;
    say('The solution:');
    while (!session.done && host.isConnected) {
      const uci = session.expected;
      const result = session.attempt(uci);
      await board.animate(uci, session.fenBeforeReply);
      await pause();
      if (result.status === 'continue') {
        await board.animate(result.reply, session.fen);
        await pause();
      }
    }
    finish('Filed for review: it will return tomorrow.', '');
  };

  board.onMove = (uci) => void play(uci);
  reveal.addEventListener('click', () => void showSolution());
  next.addEventListener('click', () => options.onNext?.());
  typed.addEventListener('submit', (e) => {
    e.preventDefault();
    if (busy) return;
    const input = typed.elements.namedItem('move') as HTMLInputElement;
    const text = input.value.trim().replace(/[+#!?]/g, '');
    const move = session.game.moves({ verbose: true }).find((m) => m.san.replace(/[+#]/g, '') === text || m.lan === text);
    input.value = '';
    if (!move) {
      say(`"${text}" is not a legal move here.`, 'wrong');
      return;
    }
    void play(move.lan);
  });

  board.setOrientation(session.solver);
  board.setPosition(puzzle.fen);
  say(options.prompt ?? `${colorName(session.solver)} to play.`);

  window.setTimeout(async () => {
    if (!host.isConnected) return;
    await board.animate(session.setupMove, session.fen);
    unlock();
  }, SETUP_DELAY);
}
