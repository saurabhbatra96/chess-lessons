// Checks every lesson: FENs, arrows, puzzle ids, lines and games, and engine-tests move claims.
// board: best (moves that must hold up), avoid (moves that must lose), mate (position is checkmate).
// choice: answer must outscore every other option.
// line: every move by `side` must be sound, and the final position playable for that side.
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { Chess } from 'chess.js';

const DEPTH = 16;
const LINE_DEPTH = 13;
const BEST_MARGIN = 60; // centipawns a "best" move may trail the engine's own choice
const AVOID_MARGIN = 250; // centipawns an "avoid" move must lose
const LINE_MARGIN = 110; // centipawns a repertoire move may trail, to allow for gambits
const LINE_FLOOR = -110; // the worst final evaluation accepted for the repertoire side
const CHOICE_LEAD = 20; // centipawns the answer must lead the other options by
const CHOICE_BEST_MARGIN = 70; // centipawns the answer may trail the engine's own choice
const DECISIVE = 800; // centipawns treated as clearly winning
const MATE = 30000;

// This single-threaded build ignores stdin commands when run as a script, so load it as a module.
const ENGINE_DIR = resolve('node_modules/stockfish/src');
const loadEngine = createRequire(import.meta.url)(`${ENGINE_DIR}/stockfish-nnue-16-single.js`);
const engine = await loadEngine()({
  locateFile: (file) => `${ENGINE_DIR}/${file.endsWith('.wasm') ? 'stockfish-nnue-16-single.wasm' : file}`,
});

let waiter = null;
engine.addMessageListener((line) => waiter?.(line.trim()));

const send = (cmd) => engine.onCustomMessage(cmd);
const until = (done, onLine = () => {}) =>
  new Promise((resolve) => {
    waiter = (line) => {
      onLine(line);
      if (done(line)) {
        waiter = null;
        resolve();
      }
    };
  });

/** Evaluates `fen` for the side to move, optionally restricted to one root move. */
async function evaluate(fen, move, depth = DEPTH) {
  let score = null;
  send(`position fen ${fen}`);
  send(`go depth ${depth}${move ? ` searchmoves ${move}` : ''}`);
  await until(
    (line) => line.startsWith('bestmove'),
    (line) => {
      const match = line.match(/ score (cp|mate) (-?\d+)/);
      if (match && !line.includes('bound')) {
        const n = +match[2];
        score = match[1] === 'cp' ? n : Math.sign(n || -1) * (MATE - Math.abs(n));
      }
    },
  );
  return score;
}

const course = JSON.parse(readFileSync('content/course.json', 'utf8'));
const problems = [];
const tally = { lessons: 0, diagrams: 0, inline: 0, claims: 0, lines: 0, games: 0, choices: 0 };

send('uci');
await until((line) => line === 'uciok');
send('isready');
await until((line) => line === 'readyok');

const parseMoves = (text) =>
  text
    .replace(/\d+\.+/g, ' ')
    .split(/\s+/)
    .filter((t) => t && !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(t));

function parseBlock(text) {
  const block = { fields: {}, notes: [], options: [] };
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
  if (block.fields.after) {
    const game = new Chess();
    for (const san of parseMoves(block.fields.after)) game.move(san);
    block.fields.fen = game.fen();
  }
  return block;
}

const isLegal = (fen, uci) => {
  try {
    new Chess(fen).move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    return true;
  } catch {
    return false;
  }
};

/** Replays a block's moves, reporting problems, and returns each position and move. */
function replay(block, report) {
  const { start, moves } = block.fields;
  const game = new Chess(start);
  const steps = [];
  for (const san of parseMoves(moves ?? '')) {
    const before = game.fen();
    try {
      const move = game.move(san);
      steps.push({ before, san: move.san, uci: move.lan, turn: move.color });
    } catch {
      report(`illegal move ${san} after "${steps.map((s) => s.san).join(' ')}"`);
      return null;
    }
  }
  const parts = (start ?? game.fen().replace(/.*/, 'x w - - 0 1')).split(' ');
  const startFull = start ? +parts[5] : 1;
  const startsBlack = parts[1] === 'b';
  for (const [label, text] of block.notes) {
    const match = label.match(/^(\d+)(\.+)(.+)$/);
    if (!match || !text) {
      report(`bad note "${label}"`);
      continue;
    }
    const ply = (+match[1] - startFull) * 2 + (match[2].length > 1 ? 1 : 0) - (startsBlack ? 1 : 0);
    if (steps[ply]?.san.replace(/[+#]/g, '') !== match[3].replace(/[+#]/g, '')) {
      report(`note "${label}" does not match the move played (${steps[ply]?.san})`);
    }
  }
  return { steps, final: game.fen(), side: block.fields.side };
}

async function checkBoard({ fields }, report) {
  tally.diagrams++;
  let game;
  try {
    game = new Chess(fields.fen);
  } catch (err) {
    report(`bad FEN ${fields.fen}: ${err.message}`);
    return;
  }
  if (!fields.caption) report(`diagram without caption: ${fields.fen}`);
  if ('mate' in fields && !game.isCheckmate()) report(`not checkmate: ${fields.fen}`);
  const best = (fields.best ?? '').split(/\s+/).filter(Boolean);
  const avoid = (fields.avoid ?? '').split(/\s+/).filter(Boolean);
  for (const uci of [...best, ...avoid]) {
    if (!isLegal(fields.fen, uci)) {
      report(`illegal claimed move ${uci} in ${fields.fen}`);
      return;
    }
  }
  if (!best.length && !avoid.length) return;
  const root = await evaluate(fields.fen);
  for (const uci of best) {
    tally.claims++;
    const score = await evaluate(fields.fen, uci);
    if (score < root - BEST_MARGIN) report(`"best" ${uci} scores ${score}, engine has ${root}: ${fields.fen}`);
  }
  for (const uci of avoid) {
    tally.claims++;
    const score = await evaluate(fields.fen, uci);
    if (score > root - AVOID_MARGIN) report(`"avoid" ${uci} scores ${score}, engine has ${root}: ${fields.fen}`);
  }
}

async function checkChoice({ fields, options }, report) {
  tally.choices++;
  if (options.length < 2 || !options.some((o) => o.uci === fields.answer)) {
    report(`choice needs options including its answer: ${fields.fen}`);
    return;
  }
  for (const option of options) {
    if (!isLegal(fields.fen, option.uci)) {
      report(`illegal option ${option.uci} in ${fields.fen}`);
      return;
    }
    if (!option.text) report(`option ${option.uci} has no explanation`);
  }
  const root = await evaluate(fields.fen);
  const answer = await evaluate(fields.fen, fields.answer);
  tally.claims++;
  if (answer < root - CHOICE_BEST_MARGIN) report(`answer ${fields.answer} scores ${answer}, engine has ${root}: ${fields.fen}`);
  for (const option of options) {
    if (option.uci === fields.answer) continue;
    tally.claims++;
    const score = await evaluate(fields.fen, option.uci);
    if (score > answer - CHOICE_LEAD) report(`option ${option.uci} scores ${score}, answer ${fields.answer} has ${answer}: ${fields.fen}`);
  }
}

async function checkLine(block, report) {
  tally.lines++;
  const played = replay(block, report);
  if (!played) return;
  const { steps, final, side } = played;
  if (side !== 'w' && side !== 'b') report('line needs side: w or b');
  // Long technical endings can need a deeper search than opening lines.
  const depth = +block.fields.depth || LINE_DEPTH;
  for (const step of steps) {
    if (step.turn !== side) continue;
    tally.claims++;
    const root = await evaluate(step.before, undefined, depth);
    const score = await evaluate(step.before, step.uci, depth);
    // A move that stays decisively winning is sound, however much faster another might win.
    if (score < DECISIVE && score < root - LINE_MARGIN) report(`line move ${step.san} scores ${score}, engine has ${root}: ${step.before}`);
  }
  const game = new Chess(final);
  if (!game.isGameOver()) {
    const end = await evaluate(final, undefined, depth);
    const forSide = game.turn() === side ? end : -end;
    if (forSide < LINE_FLOOR) report(`line ends at ${forSide} for ${side}: ${final}`);
  }
}

for (const section of course.sections) {
  for (const lesson of section.lessons) {
    if (process.env.ONLY && process.env.ONLY !== lesson.slug) continue;
    tally.lessons++;
    const path = `content/${section.id}/${lesson.slug}.md`;
    const report = (msg) => problems.push(`${lesson.slug}: ${msg}`);
    if (!existsSync(path)) {
      report('lesson file missing');
      continue;
    }
    const hasSet = Boolean(lesson.themes || lesson.openings);
    const puzzles = hasSet ? JSON.parse(readFileSync(`public/data/${section.id}/${lesson.slug}.json`, 'utf8')) : [];
    const source = readFileSync(path, 'utf8');
    let exercises = 0;

    for (const [, lang, body] of source.matchAll(/```(board|puzzle|line|game|choice)\n([\s\S]*?)```/g)) {
      const block = parseBlock(body);
      if (lang === 'puzzle') {
        tally.inline++;
        exercises++;
        if (!puzzles.some((p) => p.id === block.fields.id)) report(`puzzle ${block.fields.id} is not in this lesson's set`);
      } else if (lang === 'board') {
        await checkBoard(block, report);
      } else if (lang === 'choice') {
        exercises++;
        await checkChoice(block, report);
      } else if (lang === 'line') {
        exercises++;
        await checkLine(block, report);
      } else {
        exercises++;
        tally.games++;
        if (replay(block, report) && !block.fields.from) report('game needs from: <move number>');
      }
    }
    if (exercises < 1) report('no exercises');
  }
}

console.log(
  `${tally.lessons} lessons, ${tally.diagrams} diagrams, ${tally.inline} in-line puzzles, ${tally.lines} lines, ` +
    `${tally.games} games, ${tally.choices} choices, ${tally.claims} engine-tested move claims.`,
);
if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log('All content checks passed.');
process.exit(0);
