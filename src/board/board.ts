import type { Chess, Color, Square } from 'chess.js';

const NS = 'http://www.w3.org/2000/svg';
const CELL = 100;
const FILES = 'abcdefgh';
const PROMOTIONS = ['q', 'r', 'b', 'n'] as const;

const svgEl = <K extends keyof SVGElementTagNameMap>(name: K, attrs: Record<string, string | number> = {}) => {
  const el = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value));
  return el;
};

const pieceUrl = (code: string) => `${import.meta.env.BASE_URL}pieces/${code}.svg`;

/** Maps occupied squares to piece codes such as "wN". */
function parsePlacement(fen: string): Map<string, string> {
  const pieces = new Map<string, string>();
  fen.split(' ')[0].split('/').forEach((row, r) => {
    let f = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) {
        f += +ch;
        continue;
      }
      const color = ch === ch.toUpperCase() ? 'w' : 'b';
      pieces.set(`${FILES[f]}${8 - r}`, color + ch.toUpperCase());
      f++;
    }
  });
  return pieces;
}

export interface Arrow {
  from: string;
  to: string;
}

let boardCount = 0;

export class Board {
  readonly el = document.createElement('div');
  onMove: ((uci: string) => void) | null = null;

  private readonly svg = svgEl('svg', { viewBox: `0 0 ${CELL * 8} ${CELL * 8}`, role: 'img' });
  private readonly squares = svgEl('g');
  private readonly marks = svgEl('g');
  private readonly pieces = svgEl('g');
  private readonly overlay = svgEl('g');
  private readonly hatchId = `hatch-${++boardCount}`;
  private readonly arrowId = `arrowhead-${boardCount}`;
  private orientation: Color = 'w';
  private fen = '';
  private lastMove: string | null = null;
  private arrows: Arrow[] = [];
  private game: Chess | null = null;
  private selected: Square | null = null;
  private dragging: SVGImageElement | null = null;

  constructor() {
    this.el.className = 'board';
    this.svg.append(this.defs(), this.squares, this.marks, this.pieces, this.overlay);
    this.el.append(this.svg);
    this.svg.addEventListener('pointerdown', (e) => this.pointerDown(e));
    this.svg.addEventListener('pointermove', (e) => this.pointerMove(e));
    this.svg.addEventListener('pointerup', (e) => this.pointerUp(e));
    this.svg.addEventListener('pointercancel', () => this.cancelDrag());
  }

  setOrientation(color: Color): void {
    this.orientation = color;
    this.drawSquares();
    this.redraw();
  }

  setPosition(fen: string, lastMove: string | null = null, arrows: Arrow[] = []): void {
    this.fen = fen;
    this.lastMove = lastMove;
    this.arrows = arrows;
    this.selected = null;
    this.redraw();
  }

  /** Allows moves for the side to play in `game`, or locks the board when null. */
  setInteractive(game: Chess | null): void {
    this.game = game;
    this.selected = null;
    this.el.classList.toggle('board--live', game !== null);
    this.drawMarks();
  }

  /** Slides a piece across the board, then shows the resulting position. */
  animate(uci: string, nextFen: string): Promise<void> {
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const image = this.pieces.querySelector<SVGImageElement>(`[data-square="${from}"]`);
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!image || still) {
      this.setPosition(nextFen, uci);
      return Promise.resolve();
    }
    const [x0, y0] = this.xy(from);
    const [x1, y1] = this.xy(to);
    image.style.transition = 'transform 180ms ease-out';
    image.style.transform = `translate(${x1 - x0}px, ${y1 - y0}px)`;
    return new Promise((resolve) => {
      window.setTimeout(() => {
        this.setPosition(nextFen, uci);
        resolve();
      }, 190);
    });
  }

  private defs(): SVGDefsElement {
    const defs = svgEl('defs');
    const pattern = svgEl('pattern', {
      id: this.hatchId,
      width: 7,
      height: 7,
      patternUnits: 'userSpaceOnUse',
      patternTransform: 'rotate(45)',
    });
    pattern.append(
      svgEl('rect', { width: 7, height: 7, fill: '#c9b892' }),
      svgEl('line', { x1: 0, y1: 0, x2: 0, y2: 7, stroke: '#6f5f43', 'stroke-width': 2.2 }),
    );
    const marker = svgEl('marker', {
      id: this.arrowId,
      viewBox: '0 0 10 10',
      refX: 7,
      refY: 5,
      markerWidth: 3.4,
      markerHeight: 3.4,
      orient: 'auto',
    });
    marker.append(svgEl('path', { d: 'M0 0 L10 5 L0 10 z', fill: '#8a1c14' }));
    defs.append(pattern, marker);
    this.drawSquares();
    return defs;
  }

  private xy(square: string): [number, number] {
    const f = FILES.indexOf(square[0]);
    const r = +square[1] - 1;
    return this.orientation === 'w' ? [f * CELL, (7 - r) * CELL] : [(7 - f) * CELL, r * CELL];
  }

  private drawSquares(): void {
    this.squares.replaceChildren();
    for (let f = 0; f < 8; f++) {
      for (let r = 1; r <= 8; r++) {
        const square = `${FILES[f]}${r}`;
        const [x, y] = this.xy(square);
        const isDark = (f + r) % 2 === 1;
        this.squares.append(
          svgEl('rect', { x, y, width: CELL, height: CELL, fill: isDark ? `url(#${this.hatchId})` : '#f1e7d0' }),
        );
      }
    }
  }

  private redraw(): void {
    this.drawMarks();
    this.pieces.replaceChildren();
    const placement = parsePlacement(this.fen);
    for (const [square, code] of placement) {
      const [x, y] = this.xy(square);
      const image = svgEl('image', { x, y, width: CELL, height: CELL, href: pieceUrl(code), 'data-square': square });
      this.pieces.append(image);
    }
    this.svg.setAttribute('aria-label', `Chess position: ${this.fen.split(' ')[0]}`);
  }

  private tint(square: string, fill: string): void {
    const [x, y] = this.xy(square);
    this.marks.append(svgEl('rect', { x, y, width: CELL, height: CELL, fill, opacity: 0.45 }));
  }

  private drawMarks(): void {
    this.marks.replaceChildren();
    if (this.lastMove) {
      this.tint(this.lastMove.slice(0, 2), '#c79a3a');
      this.tint(this.lastMove.slice(2, 4), '#c79a3a');
    }
    if (this.selected) this.tint(this.selected, '#8a1c14');
    for (const target of this.selected ? this.targets(this.selected) : []) {
      const [x, y] = this.xy(target);
      this.marks.append(svgEl('circle', { cx: x + CELL / 2, cy: y + CELL / 2, r: 14, fill: '#8a1c14', opacity: 0.75 }));
    }
    for (const { from, to } of this.arrows) {
      const [x1, y1] = this.xy(from);
      const [x2, y2] = this.xy(to);
      this.marks.append(
        svgEl('line', {
          x1: x1 + CELL / 2,
          y1: y1 + CELL / 2,
          x2: x2 + CELL / 2,
          y2: y2 + CELL / 2,
          stroke: '#8a1c14',
          'stroke-width': 12,
          'stroke-linecap': 'round',
          'marker-end': `url(#${this.arrowId})`,
          opacity: 0.85,
        }),
      );
    }
  }

  private targets(square: Square): Square[] {
    return this.game ? this.game.moves({ square, verbose: true }).map((m) => m.to) : [];
  }

  private squareAt(e: PointerEvent): Square | null {
    const rect = this.svg.getBoundingClientRect();
    const col = Math.floor(((e.clientX - rect.left) / rect.width) * 8);
    const row = Math.floor(((e.clientY - rect.top) / rect.height) * 8);
    if (col < 0 || col > 7 || row < 0 || row > 7) return null;
    const f = this.orientation === 'w' ? col : 7 - col;
    const r = this.orientation === 'w' ? 8 - row : row + 1;
    return `${FILES[f]}${r}` as Square;
  }

  private svgPoint(e: PointerEvent): [number, number] {
    const rect = this.svg.getBoundingClientRect();
    const scale = (CELL * 8) / rect.width;
    return [(e.clientX - rect.left) * scale, (e.clientY - rect.top) * scale];
  }

  private pointerDown(e: PointerEvent): void {
    if (!this.game) return;
    const square = this.squareAt(e);
    if (!square) return;
    e.preventDefault();

    if (this.selected && this.targets(this.selected).includes(square)) {
      this.complete(this.selected, square);
      return;
    }
    const piece = this.game.get(square);
    if (!piece || piece.color !== this.game.turn()) {
      this.selected = null;
      this.drawMarks();
      return;
    }
    this.selected = square;
    this.drawMarks();
    this.dragging = this.pieces.querySelector<SVGImageElement>(`[data-square="${square}"]`);
    this.dragging?.parentNode?.appendChild(this.dragging);
    this.svg.setPointerCapture(e.pointerId);
  }

  private pointerMove(e: PointerEvent): void {
    if (!this.dragging || !this.selected) return;
    const [x, y] = this.svgPoint(e);
    const [x0, y0] = this.xy(this.selected);
    this.dragging.style.transform = `translate(${x - x0 - CELL / 2}px, ${y - y0 - CELL / 2}px)`;
  }

  private pointerUp(e: PointerEvent): void {
    if (!this.dragging || !this.selected) return;
    const target = this.squareAt(e);
    const from = this.selected;
    this.dragging.style.transform = '';
    this.dragging = null;
    if (!target || target === from) return;
    if (this.targets(from).includes(target)) {
      this.complete(from, target);
    } else {
      this.selected = null;
      this.drawMarks();
    }
  }

  private cancelDrag(): void {
    if (this.dragging) this.dragging.style.transform = '';
    this.dragging = null;
  }

  private complete(from: Square, to: Square): void {
    const isPromotion = this.game?.moves({ square: from, verbose: true }).some((m) => m.to === to && m.promotion);
    this.selected = null;
    this.drawMarks();
    if (isPromotion) {
      this.choosePromotion(from, to);
    } else {
      this.onMove?.(from + to);
    }
  }

  private choosePromotion(from: Square, to: Square): void {
    const color = this.game?.turn() ?? 'w';
    const [x, y] = this.xy(to);
    const step = y === 0 ? CELL : -CELL;
    PROMOTIONS.forEach((piece, i) => {
      const py = y + step * i;
      const backing = svgEl('rect', { x, y: py, width: CELL, height: CELL, fill: '#f1e7d0', stroke: '#1b1916', 'stroke-width': 3 });
      const image = svgEl('image', { x, y: py, width: CELL, height: CELL, href: pieceUrl(color + piece.toUpperCase()) });
      const choice = svgEl('g', { class: 'board__promotion' });
      choice.append(backing, image);
      choice.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        this.overlay.replaceChildren();
        this.onMove?.(from + to + piece);
      });
      this.overlay.append(choice);
    });
  }
}
