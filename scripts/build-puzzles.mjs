// Builds public/data/tactics/*.json from the Lichess puzzle database (CC0).
// Columns: PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags,DailyDate
import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { open } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { Readable } from 'node:stream';
import { createZstdDecompress } from 'node:zlib';
import { Chess } from 'chess.js';

const SOURCE = '.cache/lichess_db_puzzle.csv.zst';
const OUT = 'public/data/tactics';
const PER_BAND = 14;

// Loose limits admit candidates; strict ones rank first, so relaxed puzzles only fill gaps.
const LOOSE = { popularity: 75, plays: 150, deviation: 100 };
const STRICT = { popularity: 88, plays: 500, deviation: 80 };

if (!existsSync(SOURCE)) {
  console.error(`Missing ${SOURCE}. Download https://database.lichess.org/lichess_db_puzzle.csv.zst there first.`);
  process.exit(1);
}

const course = JSON.parse(readFileSync('content/course.json', 'utf8'));
const { bands } = course;
const lessons = course.sections.find((s) => s.id === 'tactics').lessons;

const bandFor = (rating) => bands.find((b) => rating >= b.min && rating < b.max);
const buckets = new Map();
const key = (lesson, band) => `${lesson}:${band}`;
const CAP = 400;

const isStrict = (p) =>
  p.popularity >= STRICT.popularity && p.plays >= STRICT.plays && p.deviation <= STRICT.deviation;
const rank = (a, b) =>
  Number(isStrict(b)) - Number(isStrict(a)) || b.popularity - a.popularity || b.plays - a.plays;

// The file is pzstd output: each zstd frame follows a 12-byte skippable frame holding
// that frame's compressed size. Node's decoder rejects those, so yield only the zstd data.
async function* zstdFrames(path) {
  const handle = await open(path);
  const { size } = await handle.stat();
  try {
    let offset = 0;
    const header = Buffer.alloc(12);
    while (offset < size) {
      await handle.read(header, 0, 12, offset);
      const isSkippable = (header.readUInt32LE(0) & 0xfffffff0) === 0x184d2a50;
      if (!isSkippable || header.readUInt32LE(4) !== 4) {
        throw new Error(`Expected a pzstd size header at byte ${offset}`);
      }
      const frameSize = header.readUInt32LE(8);
      offset += 12;
      for await (const chunk of createReadStream(path, { start: offset, end: offset + frameSize - 1 })) {
        yield chunk;
      }
      offset += frameSize;
    }
  } finally {
    await handle.close();
  }
}

const fail = (err) => {
  console.error(`Could not read ${SOURCE}: ${err.message}`);
  process.exit(1);
};
const decompressed = Readable.from(zstdFrames(SOURCE)).on('error', fail).pipe(createZstdDecompress()).on('error', fail);
const lines = createInterface({ input: decompressed });
let total = 0;
let header = true;
for await (const line of lines) {
  if (header) {
    header = false;
    continue;
  }
  total++;
  const [id, fen, moves, ratingS, deviationS, popularityS, playsS, themesS, gameUrl, openingTags] = line.split(',');
  const rating = +ratingS;
  const band = bandFor(rating);
  if (!band) continue;
  const deviation = +deviationS;
  const popularity = +popularityS;
  const plays = +playsS;
  if (popularity < LOOSE.popularity || plays < LOOSE.plays || deviation > LOOSE.deviation) continue;
  const themes = themesS.split(' ');
  for (const lesson of lessons) {
    if (!lesson.themes.some((t) => themes.includes(t))) continue;
    const k = key(lesson.slug, band.id);
    const bucket = buckets.get(k) ?? [];
    bucket.push({ id, fen, moves, rating, deviation, popularity, plays, themes, gameUrl, openingTags, band: band.id });
    if (bucket.length > CAP * 4) {
      bucket.sort(rank);
      bucket.length = CAP;
    }
    buckets.set(k, bucket);
  }
}

// Guards against a truncated read writing a thin or empty puzzle set.
const MIN_ROWS = 4_000_000;
if (total < MIN_ROWS) fail(new Error(`only ${total} rows read, expected at least ${MIN_ROWS}`));

// Game URLs look like https://lichess.org/game/<gameId>/black#45; the /game segment is optional.
const gameOf = (p) => {
  const match = p.gameUrl.match(/lichess\.org\/(?:game\/)?([A-Za-z0-9]{8})/);
  if (!match) throw new Error(`Unrecognised game URL for puzzle ${p.id}: ${p.gameUrl}`);
  return match[1];
};

// Replays the puzzle: the first listed move is the opponent's, then the solver's line follows.
function isLegalLine(p) {
  try {
    const game = new Chess(p.fen);
    for (const uci of p.moves.split(' ')) {
      game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    }
    return true;
  } catch {
    return false;
  }
}

// Narrowest lessons pick first so rare motifs are not consumed by broad ones.
const scarcity = (lesson) =>
  bands.reduce((sum, b) => sum + (buckets.get(key(lesson.slug, b.id))?.length ?? 0), 0);
const order = [...lessons].sort((a, b) => scarcity(a) - scarcity(b));

const usedPuzzles = new Set();
const usedGames = new Set();
const report = [];
mkdirSync(OUT, { recursive: true });

for (const lesson of order) {
  const chosen = [];
  let relaxed = 0;
  const counts = {};
  for (const band of bands) {
    const pool = (buckets.get(key(lesson.slug, band.id)) ?? []).sort(rank);
    let picked = 0;
    // Spread multi-theme lessons evenly so one motif cannot fill the whole band.
    const perTheme = lesson.themes.length > 1 ? Math.ceil(PER_BAND / Math.min(lesson.themes.length, 3)) : PER_BAND;
    const themeCounts = {};
    for (const pass of [true, false]) {
      for (const p of pool) {
        if (picked >= PER_BAND) break;
        if (usedPuzzles.has(p.id) || usedGames.has(gameOf(p))) continue;
        const theme = lesson.themes.find((t) => p.themes.includes(t));
        if (pass && (themeCounts[theme] ?? 0) >= perTheme) continue;
        if (!isLegalLine(p)) continue;
        usedPuzzles.add(p.id);
        usedGames.add(gameOf(p));
        themeCounts[theme] = (themeCounts[theme] ?? 0) + 1;
        if (!isStrict(p)) relaxed++;
        chosen.push(p);
        picked++;
      }
    }
    counts[band.id] = picked;
  }
  chosen.sort((a, b) => a.rating - b.rating);
  const out = chosen.map((p) => ({
    id: p.id,
    fen: p.fen,
    moves: p.moves.split(' '),
    rating: p.rating,
    band: p.band,
    themes: p.themes.filter((t) => lesson.themes.includes(t)),
  }));
  writeFileSync(`${OUT}/${lesson.slug}.json`, JSON.stringify(out));
  report.push({ lesson: lesson.slug, total: out.length, relaxed, ...counts });
}

report.sort((a, b) => lessons.findIndex((l) => l.slug === a.lesson) - lessons.findIndex((l) => l.slug === b.lesson));
writeFileSync(`${OUT}/index.json`, JSON.stringify(Object.fromEntries(report.map((r) => [r.lesson, r.total]))));
console.log(`Scanned ${total} puzzles.`);
console.table(report);
console.log('Total selected:', report.reduce((n, r) => n + r.total, 0));

const MIN_PER_LESSON = 40;
const thin = report.filter((r) => r.total < MIN_PER_LESSON);
if (thin.length) {
  console.error(`Too few puzzles (under ${MIN_PER_LESSON}): ${thin.map((r) => r.lesson).join(', ')}`);
  process.exit(1);
}
