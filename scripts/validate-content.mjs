// Checks every lesson: FENs, arrows, puzzle ids, and engine-tests the move claims in diagrams.
// Diagram fields: best (moves that must hold up), avoid (moves that must lose), mate (position is checkmate).
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { Chess } from 'chess.js';

const DEPTH = 16;
const BEST_MARGIN = 60; // centipawns a "best" move may trail the engine's own choice
const AVOID_MARGIN = 250; // centipawns an "avoid" move must lose
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
async function evaluate(fen, move) {
  let score = null;
  send(`position fen ${fen}`);
  send(`go depth ${DEPTH}${move ? ` searchmoves ${move}` : ''}`);
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
const lessons = course.sections.find((s) => s.id === 'tactics').lessons;
const problems = [];
let diagrams = 0;
let claims = 0;
let inline = 0;

send('uci');
await until((line) => line === 'uciok');
send('isready');
await until((line) => line === 'readyok');

function parseBlock(text) {
  return Object.fromEntries(
    text
      .split('\n')
      .filter((line) => line.includes(':'))
      .map((line) => {
        const at = line.indexOf(':');
        return [line.slice(0, at).trim(), line.slice(at + 1).trim()];
      }),
  );
}

const isLegal = (fen, uci) => {
  try {
    new Chess(fen).move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    return true;
  } catch {
    return false;
  }
};

for (const lesson of lessons) {
  const path = `content/tactics/${lesson.slug}.md`;
  if (!existsSync(path)) {
    problems.push(`${lesson.slug}: lesson file missing`);
    continue;
  }
  const puzzles = JSON.parse(readFileSync(`public/data/tactics/${lesson.slug}.json`, 'utf8'));
  const source = readFileSync(path, 'utf8');
  const report = (msg) => problems.push(`${lesson.slug}: ${msg}`);
  let lessonInline = 0;

  for (const [, lang, body] of source.matchAll(/```(board|puzzle)\n([\s\S]*?)```/g)) {
    const block = parseBlock(body);
    if (lang === 'puzzle') {
      inline++;
      lessonInline++;
      if (!puzzles.some((p) => p.id === block.id)) report(`puzzle ${block.id} is not in this lesson's set`);
      continue;
    }
    diagrams++;
    let game;
    try {
      game = new Chess(block.fen);
    } catch (err) {
      report(`bad FEN ${block.fen}: ${err.message}`);
      continue;
    }
    if (!block.caption) report(`diagram without caption: ${block.fen}`);
    if ('mate' in block && !game.isCheckmate()) report(`not checkmate: ${block.fen}`);
    const best = (block.best ?? '').split(/\s+/).filter(Boolean);
    const avoid = (block.avoid ?? '').split(/\s+/).filter(Boolean);
    for (const uci of [...best, ...avoid]) {
      if (!isLegal(block.fen, uci)) report(`illegal claimed move ${uci} in ${block.fen}`);
    }
    if (!best.length && !avoid.length) continue;
    const root = await evaluate(block.fen);
    for (const uci of best) {
      claims++;
      const score = await evaluate(block.fen, uci);
      if (score < root - BEST_MARGIN) report(`"best" ${uci} scores ${score}, engine has ${root}: ${block.fen}`);
    }
    for (const uci of avoid) {
      claims++;
      const score = await evaluate(block.fen, uci);
      if (score > root - AVOID_MARGIN) report(`"avoid" ${uci} scores ${score}, engine has ${root}: ${block.fen}`);
    }
  }
  if (lessonInline < 2) report(`only ${lessonInline} in-line puzzles`);
}

console.log(`${lessons.length} lessons, ${diagrams} diagrams, ${inline} in-line puzzles, ${claims} engine-tested move claims.`);
if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log('All content checks passed.');
process.exit(0);
