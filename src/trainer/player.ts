import { Board } from '../board/board';
import type { Outcome } from '../store';
import type { Puzzle } from '../types';
import { PuzzleSession } from './session';

export interface PlayerOptions {
  prompt?: string;
  /** Called once per puzzle, with whether it was solved on the first try and how it went. */
  onResult?: (solved: boolean, outcome: Outcome) => void;
  onNext?: () => void;
  nextLabel?: string;
  /** Shown once a revealed solution has played out. */
  revealedText?: string;
}

const REPLY_DELAY = 350;
const SETUP_DELAY = 600;
const colorName = (c: 'w' | 'b') => (c === 'w' ? 'White' : 'Black');
const PIECE_NAMES: Record<string, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };

/** Mounts an interactive puzzle in `host`. */
export function mountPuzzle(host: HTMLElement, puzzle: Puzzle, options: PlayerOptions = {}): void {
  let session = new PuzzleSession(puzzle);
  const board = new Board();
  let cleanRun = true;
  let reported = false;
  // True during animations and until the opponent's opening move has been shown.
  let busy = true;
  // How much of the current move the hint has given away: 0 nothing, 1 the piece, 2 the move.
  let hinted = 0;
  // Bumped on every restart, so timers left over from an earlier run do nothing.
  let run = 0;

  const figure = document.createElement('div');
  figure.className = 'puzzle';
  figure.dataset.puzzleId = puzzle.id;
  const status = document.createElement('p');
  status.className = 'puzzle__status';
  status.setAttribute('role', 'status');
  const hint = document.createElement('p');
  hint.className = 'puzzle__hint';
  hint.textContent = options.prompt ?? '';
  hint.hidden = !options.prompt;
  const typed = document.createElement('form');
  typed.className = 'puzzle__typed';
  typed.innerHTML = `<label>Or write your move <input name="move" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Nf5"></label>`;
  const actions = document.createElement('div');
  actions.className = 'puzzle__actions';
  const button = (label: string) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    return b;
  };
  const hintButton = button('Hint');
  const reveal = button('Show the solution');
  const restart = button('Restart');
  restart.title = 'Back to the starting position';
  const next = button(options.nextLabel ?? 'Next puzzle');
  next.className = 'puzzle__next';
  next.hidden = true;
  actions.append(hintButton, reveal, restart, next);

  const meta = document.createElement('p');
  meta.className = 'puzzle__meta';
  const link = document.createElement('a');
  link.href = `https://lichess.org/training/${encodeURIComponent(puzzle.id)}`;
  link.target = '_blank';
  link.rel = 'noopener';
  link.textContent = `Rated ${puzzle.rating} · No. ${puzzle.id}`;
  const tip = document.createElement('span');
  tip.className = 'puzzle__tip';
  tip.textContent = ' · Right-click and drag to draw arrows';
  meta.append(link, tip);

  const sideToMove = `${colorName(session.solver)} to move.`;
  figure.dataset.side = session.solver;
  figure.append(board.el, status, hint, typed, actions, meta);
  host.replaceChildren(figure);

  const say = (text: string, tone = '') => {
    status.textContent = text;
    status.dataset.tone = tone;
  };

  const report = (outcome: Outcome) => {
    if (reported) return;
    reported = true;
    options.onResult?.(outcome === 'clean', outcome);
  };

  const finish = (text: string, tone: string) => {
    board.setInteractive(null);
    delete figure.dataset.side;
    hint.hidden = true;
    typed.hidden = true;
    hintButton.hidden = true;
    reveal.hidden = true;
    next.hidden = !options.onNext;
    say(text, tone);
  };

  const pause = () => new Promise((resolve) => window.setTimeout(resolve, REPLY_DELAY));

  const unlock = () => {
    busy = false;
    hinted = 0;
    hintButton.textContent = 'Hint';
    board.setInteractive(session.game);
  };

  /** First press names the piece to move, the second shows the move itself. */
  const giveHint = () => {
    if (busy || session.done) return;
    const uci = session.expected;
    const move = session.game.moves({ verbose: true }).find((m) => m.lan === uci);
    if (!move) return;
    cleanRun = false;
    hinted = Math.min(hinted + 1, 2);
    if (hinted === 1) {
      board.showArrows([{ from: move.from, to: move.from }]);
      say(`Hint: move the ${PIECE_NAMES[move.piece]} on ${move.from}.`);
      hintButton.textContent = 'Show the move';
    } else {
      board.showArrows([{ from: move.from, to: move.to }]);
      say(`Hint: ${move.san}.`);
    }
  };

  const play = async (uci: string) => {
    if (busy) return;
    busy = true;
    board.setInteractive(null);
    const result = session.attempt(uci);
    if (result.status === 'wrong') {
      cleanRun = false;
      say('Not that move. Look again.', 'wrong');
      busy = false;
      board.setInteractive(session.game);
      return;
    }
    const thisRun = run;
    await board.animate(uci, session.fenBeforeReply);
    if (result.status === 'solved') {
      const first = !reported;
      report(cleanRun ? 'clean' : 'stumble');
      busy = false;
      finish(
        !first ? 'Solved.' : cleanRun ? 'Solved at the first attempt.' : 'Solved, with a stumble.',
        cleanRun || !first ? 'right' : '',
      );
      return;
    }
    say(`Correct. ${sideToMove}`, 'right');
    await pause();
    if (!host.isConnected || thisRun !== run) return;
    await board.animate(result.reply, session.fen);
    unlock();
  };

  const showSolution = async () => {
    if (busy) return;
    busy = true;
    cleanRun = false;
    report('revealed');
    board.setInteractive(null);
    hintButton.hidden = true;
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
    busy = false;
    finish(`${options.revealedText ?? 'Filed under Review Misses. Due tomorrow.'} Restart to try it yourself.`, '');
  };

  /** Shows the opponent's opening move, then hands the board to the solver. */
  const setUp = () => {
    const thisRun = run;
    window.setTimeout(async () => {
      if (!host.isConnected || thisRun !== run) return;
      await board.animate(session.setupMove, session.fen);
      if (thisRun === run) unlock();
    }, SETUP_DELAY);
  };

  /** Back to the starting position. A result already recorded stands. */
  const startOver = () => {
    if (busy) return;
    run++;
    busy = true;
    session = new PuzzleSession(puzzle);
    board.setInteractive(null);
    board.setPosition(puzzle.fen);
    figure.dataset.side = session.solver;
    typed.hidden = false;
    hintButton.hidden = false;
    reveal.hidden = false;
    next.hidden = !(reported && options.onNext);
    say(reported ? `From the start. ${sideToMove}` : sideToMove);
    setUp();
  };

  board.onMove = (uci) => void play(uci);
  hintButton.addEventListener('click', giveHint);
  restart.addEventListener('click', startOver);
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
  say(sideToMove);
  setUp();
}
