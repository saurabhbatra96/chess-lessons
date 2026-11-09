import { Chess, type Color } from 'chess.js';
import type { Puzzle } from '../types';

export type AttemptResult =
  | { status: 'wrong' }
  | { status: 'continue'; reply: string }
  | { status: 'solved' };

const toMove = (uci: string) => ({
  from: uci.slice(0, 2),
  to: uci.slice(2, 4),
  promotion: uci[4],
});

/** Plays one puzzle: applies the opponent's first move, then checks the solver's answers. */
export class PuzzleSession {
  readonly game: Chess;
  readonly setupMove: string;
  readonly solver: Color;
  /** The position just after the solver's latest move, before any reply. */
  fenBeforeReply = '';
  private ply = 1;

  constructor(private readonly puzzle: Puzzle) {
    this.game = new Chess(puzzle.fen);
    this.setupMove = puzzle.moves[0];
    this.game.move(toMove(this.setupMove));
    this.solver = this.game.turn();
  }

  get fen(): string {
    return this.game.fen();
  }

  get done(): boolean {
    return this.ply >= this.puzzle.moves.length;
  }

  /** The move the solver is expected to play next. */
  get expected(): string {
    return this.puzzle.moves[this.ply];
  }

  attempt(uci: string): AttemptResult {
    const expected = this.expected;
    const probe = new Chess(this.game.fen());
    try {
      probe.move(toMove(uci));
    } catch {
      return { status: 'wrong' };
    }
    // Any mating move finishes the puzzle, even if the database line mates differently.
    if (uci !== expected && !probe.isCheckmate()) return { status: 'wrong' };

    this.game.move(toMove(uci));
    this.fenBeforeReply = this.game.fen();
    if (probe.isCheckmate()) {
      this.ply = this.puzzle.moves.length;
      return { status: 'solved' };
    }
    this.ply++;
    if (this.done) return { status: 'solved' };

    const reply = this.puzzle.moves[this.ply];
    this.game.move(toMove(reply));
    this.ply++;
    return { status: 'continue', reply };
  }
}
