import { Chess, type Color } from 'chess.js';
import { Board } from '../board/board';

export interface WalkerOptions {
  start?: string;
  moves: string[];
  /** The side the reader plays when tested. */
  side: Color;
  /** Notes keyed by ply index, 0 being the first move. */
  notes: Map<number, string>;
  /** Ply at which testing begins. */
  testFrom: number;
  /** Wrong tries allowed per move before it is shown. */
  attempts: number;
  testLabel: string;
  revealPrefix: string;
  spoilerFree: boolean;
}

const STEP_DELAY = 450;
const colorName = (c: Color) => (c === 'w' ? 'White' : 'Black');

/** Steps through a line or game, and can test the reader on one side's moves. */
export function mountWalker(host: HTMLElement, options: WalkerOptions): void {
  const game = new Chess(options.start);
  const fens = [game.fen()];
  const ucis: string[] = [];
  const sans: string[] = [];
  for (const san of options.moves) {
    const move = game.move(san);
    fens.push(game.fen());
    ucis.push(move.lan);
    sans.push(move.san);
  }
  const last = sans.length;
  const startFull = +fens[0].split(' ')[5];
  const startsBlack = fens[0].split(' ')[1] === 'b';

  const root = document.createElement('div');
  root.className = 'walker puzzle';
  root.tabIndex = 0;
  const board = new Board();
  board.setOrientation(options.side);
  const status = document.createElement('p');
  status.className = 'puzzle__status';
  status.setAttribute('role', 'status');
  const note = document.createElement('p');
  note.className = 'walker__note';
  const list = document.createElement('p');
  list.className = 'walker__moves';
  const steps = document.createElement('div');
  steps.className = 'walker__steps';
  const actions = document.createElement('div');
  actions.className = 'puzzle__actions';
  const test = document.createElement('button');
  test.type = 'button';
  test.textContent = options.testLabel;
  const stop = document.createElement('button');
  stop.type = 'button';
  stop.textContent = 'Back to reading';
  stop.hidden = true;
  actions.append(test, stop);
  root.append(board.el, status, note, steps, list, actions);
  host.replaceChildren(root);

  let ply = 0;
  let testing = false;
  let score = 0;
  let asked = 0;
  let tries = 0;
  // Guess-the-move keeps the game's later moves out of sight until the guessing is done.
  let revealed = !options.spoilerFree;
  // Bumped whenever a test starts or stops, so pending timers can tell they are stale.
  let run = 0;

  const label = (index: number) => {
    const offset = index + (startsBlack ? 1 : 0);
    const number = startFull + Math.floor(offset / 2);
    return offset % 2 === 0 ? `${number}.` : `${number}...`;
  };

  const showNote = (moveIndex: number) => {
    note.textContent = options.notes.get(moveIndex) ?? '';
  };

  const renderList = () => {
    const shown = testing || !revealed ? ply : last;
    list.replaceChildren(
      ...sans.slice(0, shown).map((san, i) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = `walker__move${i === ply - 1 ? ' walker__move--current' : ''}`;
        item.textContent = `${i % 2 === (startsBlack ? 1 : 0) || i === 0 ? label(i) : ''}${san}`;
        item.disabled = testing;
        item.addEventListener('click', () => show(i + 1));
        return item;
      }),
    );
  };

  const place = (target: number) => {
    ply = target;
    board.setPosition(fens[ply], ply > 0 ? ucis[ply - 1] : null);
    renderList();
  };

  const show = (target: number) => {
    place(Math.max(0, Math.min(last, target)));
    showNote(ply - 1);
    status.textContent = ply === 0 ? 'Starting position.' : `${label(ply - 1)}${sans[ply - 1]}`;
  };

  const navButton = (text: string, name: string, go: () => number) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = text;
    button.setAttribute('aria-label', name);
    button.addEventListener('click', () => show(go()));
    return button;
  };
  steps.append(
    navButton('«', 'First move', () => 0),
    navButton('‹', 'Previous move', () => ply - 1),
    navButton('›', 'Next move', () => ply + 1),
    navButton('»', 'Last move', () => last),
  );

  root.addEventListener('keydown', (e) => {
    if (testing) return;
    if (e.key === 'ArrowRight') show(ply + 1);
    else if (e.key === 'ArrowLeft') show(ply - 1);
    else return;
    e.preventDefault();
  });

  const setMode = (active: boolean) => {
    run++;
    testing = active;
    steps.hidden = active;
    test.hidden = active;
    stop.hidden = !active;
    board.setInteractive(null);
    if (!active) delete root.dataset.side;
  };

  const later = (fn: () => void, delay = STEP_DELAY) => {
    const token = run;
    window.setTimeout(() => {
      if (token === run && host.isConnected) fn();
    }, delay);
  };

  const finish = () => {
    setMode(false);
    revealed = true;
    test.textContent = 'Try again';
    status.textContent = `You found ${score} of ${asked} at the first attempt.`;
    note.textContent = '';
    renderList();
  };

  const advance = (uci: string) => {
    const moveIndex = ply;
    const token = run;
    void board.animate(uci, fens[moveIndex + 1]).then(() => {
      if (token !== run || !host.isConnected) return;
      ply = moveIndex + 1;
      renderList();
      showNote(moveIndex);
      nextStep();
    });
  };

  function nextStep(): void {
    if (ply >= last) return finish();
    if (fens[ply].split(' ')[1] !== options.side) {
      status.textContent = `${colorName(options.side)} waits.`;
      later(() => advance(ucis[ply]));
      return;
    }
    tries = 0;
    asked++;
    status.textContent = `${colorName(options.side)} to move.`;
    board.setInteractive(new Chess(fens[ply]));
  }

  board.onMove = (uci) => {
    board.setInteractive(null);
    if (uci === ucis[ply]) {
      if (tries === 0) score++;
      status.textContent = 'Correct.';
      advance(uci);
      return;
    }
    tries++;
    if (tries < options.attempts) {
      status.textContent = 'Not that move. Look again.';
      board.setInteractive(new Chess(fens[ply]));
      return;
    }
    status.textContent = `${options.revealPrefix} ${sans[ply]}.`;
    later(() => advance(ucis[ply]), 900);
  };

  test.addEventListener('click', () => {
    setMode(true);
    score = 0;
    asked = 0;
    root.dataset.side = options.side;
    place(options.testFrom);
    note.textContent = '';
    nextStep();
  });

  stop.addEventListener('click', () => {
    setMode(false);
    show(0);
  });

  show(0);
}
