import { readFileSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { Chess } from 'chess.js';

const FILES = 'abcdefgh';
const SHOTS = process.env.SHOT_DIR;

interface Puzzle {
  id: string;
  fen: string;
  moves: string[];
}

const course = JSON.parse(readFileSync('content/course.json', 'utf8'));
const slugs: string[] = course.sections[0].lessons.map((l: { slug: string }) => l.slug);
const puzzlesOf = (slug: string): Puzzle[] => JSON.parse(readFileSync(`public/data/tactics/${slug}.json`, 'utf8'));

const shot = async (page: Page, name: string, project: string) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${project}-${name}.png` });
};

async function noSideScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

const solverOf = (p: Puzzle) => (p.fen.split(' ')[1] === 'w' ? 'b' : 'w');

async function centre(board: Locator, square: string, solver: string) {
  await board.scrollIntoViewIfNeeded();
  const box = (await board.boundingBox())!;
  const f = FILES.indexOf(square[0]);
  const r = +square[1] - 1;
  const col = solver === 'w' ? f : 7 - f;
  const row = solver === 'w' ? 7 - r : r;
  return { x: box.x + ((col + 0.5) * box.width) / 8, y: box.y + ((row + 0.5) * box.height) / 8 };
}

async function tap(page: Page, board: Locator, square: string, solver: string) {
  const { x, y } = await centre(board, square, solver);
  const isPhone = (page.viewportSize()?.width ?? 1280) < 500;
  await (isPhone ? page.touchscreen.tap(x, y) : page.mouse.click(x, y));
}

async function currentPuzzle(page: Page, slug: string): Promise<Puzzle> {
  const id = await page.locator('.puzzle').getAttribute('data-puzzle-id');
  return puzzlesOf(slug).find((p) => p.id === id)!;
}

/** Plays the solver's moves with real pointer input. */
async function solve(page: Page, root: Locator, puzzle: Puzzle) {
  const board = root.locator('.board');
  const solver = solverOf(puzzle);
  for (let i = 1; i < puzzle.moves.length; i += 2) {
    await expect(root.locator('.board--live')).toBeVisible();
    const uci = puzzle.moves[i];
    await tap(page, board, uci.slice(0, 2), solver);
    await tap(page, board, uci.slice(2, 4), solver);
    if (uci[4]) await root.locator('.board__promotion').first().click();
  }
}

function wrongMove(puzzle: Puzzle): { san: string } {
  const game = new Chess(puzzle.fen);
  const first = puzzle.moves[0];
  game.move({ from: first.slice(0, 2), to: first.slice(2, 4), promotion: first[4] });
  const right = puzzle.moves[1].slice(0, 4);
  const move = game.moves({ verbose: true }).find((m) => {
    if (m.lan.startsWith(right)) return false;
    const probe = new Chess(game.fen());
    probe.move(m.san);
    return !probe.isCheckmate();
  })!;
  return { san: move.san };
}

let consoleErrors: string[];

test.beforeEach(async ({ page }) => {
  consoleErrors = [];
  page.on('pageerror', (e) => consoleErrors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
});

test.afterEach(() => {
  expect(consoleErrors).toEqual([]);
});

test('front page and contents show the course', async ({ page }, info) => {
  await page.goto('./');
  await expect(page.locator('.masthead__title')).toContainText('Washington Square Courier');
  await expect(page.locator('.lead h1')).toHaveText('How to Solve');
  const art = page.locator('.lead__art');
  await expect(art).toBeVisible();
  await expect.poll(() => art.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.body.style.backgroundImage)).toContain('paper-texture');
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.check('40px UnifrakturMaguntia'))).toBe(true);
  await page.waitForTimeout(400);
  await noSideScroll(page);
  await shot(page, 'front', info.project.name);

  await page.goto('./#/contents');
  await expect(page.locator('.toc')).toHaveCount(course.sections.length);
  await expect(page.getByText('Lucena and Philidor')).toBeVisible();
  await noSideScroll(page);
});

test('every lesson renders its diagrams and puzzles', async ({ page }, info) => {
  for (const slug of slugs) {
    await page.goto(`./#/lesson/${slug}`);
    await expect(page.locator('.article h1')).toBeVisible();
    await expect(page.locator('.inline-puzzle .puzzle').first()).toBeVisible();
    expect(await page.locator('.diagram .board').count()).toBeGreaterThan(0);
    await expect(page.getByText('could not be loaded')).toHaveCount(0);
    await noSideScroll(page);
  }
  await page.goto('./#/lesson/forks');
  await page.waitForTimeout(1200);
  await shot(page, 'lesson', info.project.name);
});

test('solving a puzzle updates the rating and survives a reload', async ({ page }, info) => {
  await page.goto('./#/train/forks');
  await expect(page.locator('.puzzle')).toBeVisible();
  const puzzle = await currentPuzzle(page, 'forks');
  await expect(page.locator('.board--live')).toBeVisible();
  await noSideScroll(page);
  if (info.project.name === 'desktop') await expect(page.locator('.puzzle__actions button').first()).toBeInViewport();
  await shot(page, 'trainer', info.project.name);
  await solve(page, page.locator('.puzzle'), puzzle);
  await expect(page.locator('.puzzle__status')).toHaveText('Solved at the first attempt.');
  await expect(page.locator('#rating')).not.toHaveText('1400');

  await page.reload();
  await page.goto('./#/progress');
  const row = page.locator('.box tbody tr', { hasText: 'The Fork' });
  await expect(row.locator('td').nth(0)).toHaveText('1');
  await expect(row.locator('td').nth(1)).toHaveText('1');
  await noSideScroll(page);
  await shot(page, 'box-score', info.project.name);
});

test('next puzzle serves a different position', async ({ page }) => {
  await page.goto('./#/train/pins');
  await expect(page.locator('.board--live')).toBeVisible();
  const first = await currentPuzzle(page, 'pins');
  await solve(page, page.locator('.puzzle'), first);
  await page.getByRole('button', { name: 'Next puzzle' }).click();
  await expect(page.locator('.board--live')).toBeVisible();
  expect((await currentPuzzle(page, 'pins')).id).not.toBe(first.id);
});

test('the status names the side to move and shows its cue', async ({ page }) => {
  await page.goto('./#/train/forks');
  await expect(page.locator('.board--live')).toBeVisible();
  const puzzle = await currentPuzzle(page, 'forks');
  const solver = solverOf(puzzle);
  await expect(page.locator('.puzzle__status')).toHaveText(`${solver === 'w' ? 'White' : 'Black'} to move.`);
  await expect(page.locator('.puzzle')).toHaveAttribute('data-side', solver);

  await page.goto('./#/lesson/forks');
  const inline = page.locator('[data-puzzle-id="fIbXc"]');
  await expect(inline.locator('.puzzle__status')).toHaveText('Black to move.');
  await expect(inline.locator('.puzzle__hint')).toContainText('White has just taken on g7');
  await expect(page.locator('.puzzle__hint', { hasText: 'Your move' })).toHaveCount(0);
});

test('articles are set in a single column', async ({ page }) => {
  await page.goto('./#/lesson/forks');
  const columns = await page.locator('.prose').first().evaluate((el) => getComputedStyle(el).columnCount);
  expect(columns).toBe('auto');
});

test('right-click draws arrows and circles', async ({ page }, info) => {
  test.skip(info.project.name === 'phone', 'Right-click is desktop input.');
  await page.goto('./#/train/forks');
  await expect(page.locator('.board--live')).toBeVisible();
  const puzzle = await currentPuzzle(page, 'forks');
  const solver = solverOf(puzzle);
  const board = page.locator('.puzzle .board');
  const shapes = page.locator('.puzzle [data-shape]');
  const a = await centre(board, 'c3', solver);
  const b = await centre(board, 'e5', solver);

  const rightDrag = async () => {
    await page.mouse.move(a.x, a.y);
    await page.mouse.down({ button: 'right' });
    await page.mouse.move(b.x, b.y, { steps: 4 });
    await page.mouse.up({ button: 'right' });
  };

  await rightDrag();
  await expect(page.locator('.puzzle [data-shape="c3e5"]')).toHaveAttribute('data-color', 'green');

  await page.keyboard.down('Shift');
  await rightDrag();
  await page.keyboard.up('Shift');
  await expect(page.locator('.puzzle [data-shape="c3e5"]')).toHaveAttribute('data-color', 'red');
  await expect(shapes).toHaveCount(1);

  await page.mouse.click(b.x, b.y, { button: 'right' });
  await expect(page.locator('.puzzle circle[data-shape="e5"]')).toBeVisible();
  await expect(shapes).toHaveCount(2);
  await page.mouse.click(b.x, b.y, { button: 'right' });
  await expect(shapes).toHaveCount(1);

  // Drawing is not a move: the puzzle is still waiting and nothing was recorded.
  await expect(page.locator('.board--live')).toBeVisible();
  await expect(page.locator('.puzzle__status')).toContainText('to move.');

  const emptyFor = puzzle.moves[1].slice(0, 2) === 'a1' ? 'h8' : 'a1';
  await tap(page, board, emptyFor, solver);
  await expect(shapes).toHaveCount(0);

  await page.goto('./#/lesson/forks');
  const diagram = page.locator('.diagram .board').first();
  const d1 = await centre(diagram, 'a1', 'w');
  const d2 = await centre(diagram, 'a4', 'w');
  await page.mouse.move(d1.x, d1.y);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(d2.x, d2.y, { steps: 3 });
  await page.mouse.up({ button: 'right' });
  await expect(page.locator('.diagram [data-shape="a1a4"]')).toHaveCount(1);
});

test('dragging a piece plays the move', async ({ page }, info) => {
  test.skip(info.project.name === 'phone', 'Mouse drag is desktop input; tapping is covered above.');
  await page.goto('./#/train/skewers');
  await expect(page.locator('.board--live')).toBeVisible();
  const puzzle = await currentPuzzle(page, 'skewers');
  const board = page.locator('.puzzle .board');
  const solver = solverOf(puzzle);
  const uci = puzzle.moves[1];
  const from = await centre(board, uci.slice(0, 2), solver);
  const to = await centre(board, uci.slice(2, 4), solver);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 6 });
  await page.mouse.up();
  await expect(page.locator('.puzzle__status')).toHaveText(/Correct|Solved/);
});

test('a wrong move can be retried, and a missed puzzle reaches the review desk', async ({ page }) => {
  await page.goto('./#/train/attraction');
  await expect(page.locator('.board--live')).toBeVisible();
  const puzzle = await currentPuzzle(page, 'attraction');
  await page.locator('.puzzle__typed input').fill(wrongMove(puzzle).san);
  await page.locator('.puzzle__typed input').press('Enter');
  await expect(page.locator('.puzzle__status')).toHaveText('Not that move. Look again.');
  await expect(page.locator('.board--live')).toBeVisible();

  await page.getByRole('button', { name: 'Show the solution' }).click();
  await expect(page.locator('.puzzle__status')).toContainText('Filed for review', { timeout: 20_000 });

  await page.goto('./#/review');
  await expect(page.locator('.note')).toContainText('scheduled for later');

  // Move the due date into the past to stand in for the following day.
  await page.evaluate(() => {
    const key = 'wsc-progress-v1';
    const state = JSON.parse(localStorage.getItem(key)!);
    for (const entry of Object.values<{ due: number }>(state.reviews)) entry.due = 0;
    localStorage.setItem(key, JSON.stringify(state));
  });
  await page.reload();
  await expect(page.locator('.nav')).toContainText('Review (1)');
  await expect(page.locator(`[data-puzzle-id="${puzzle.id}"]`)).toBeVisible();
});

test('a promotion can be chosen on the board', async ({ page }) => {
  await page.goto('./#/lesson/defending');
  const root = page.locator('[data-puzzle-id="JdrK6"]');
  await expect(root).toBeVisible();
  await solve(page, root, puzzlesOf('defending').find((p) => p.id === 'JdrK6')!);
  await expect(root.locator('.puzzle__status')).toHaveText('Solved at the first attempt.');
});

test('progress exports and imports, and bad files are refused', async ({ page }) => {
  await page.goto('./#/train/forks');
  await expect(page.locator('.board--live')).toBeVisible();
  await solve(page, page.locator('.puzzle'), await currentPuzzle(page, 'forks'));
  await expect(page.locator('.puzzle__status')).toContainText('Solved');

  await page.goto('./#/progress');
  const download = page.waitForEvent('download');
  await page.locator('#export').click();
  const saved = readFileSync(await (await download).path(), 'utf8');

  await page.evaluate(() => localStorage.clear());
  await page.reload();
  const tried = page.locator('.box tbody tr', { hasText: 'The Fork' }).locator('td').nth(0);
  await expect(tried).toHaveText('0');

  const input = page.locator('#import');
  await input.setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"nope":1}') });
  await expect(page.locator('#import-note')).toContainText('nothing was changed');
  await expect(tried).toHaveText('0');

  await input.setInputFiles({ name: 'good.json', mimeType: 'application/json', buffer: Buffer.from(saved) });
  await expect(tried).toHaveText('1');
});

test('unknown pages explain themselves', async ({ page }) => {
  await page.goto('./#/lesson/not-a-lesson');
  await expect(page.locator('.section-title')).toHaveText('Page Not Found');
});
