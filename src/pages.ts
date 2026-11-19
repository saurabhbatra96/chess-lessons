import { artImage, artUrl } from './art';
import {
  allLessons,
  course,
  deskOf,
  desks,
  esc,
  findLesson,
  hasPuzzles,
  loadPuzzles,
  puzzleIndex,
  PUZZLES_PER_LESSON,
  sectionOf,
  tactics,
  type Desk,
} from './data';
import { drillCount, lessonSource, renderLesson } from './lessons';
import {
  attemptedIds,
  exportProgress,
  fileClippings,
  getProgress,
  hasStarted,
  importProgress,
  markOpened,
  markRead,
  ratingFor,
  recordExam,
  recordResult,
  recordRevision,
  resetLesson,
  returnMisses,
  spike,
  type Clipping,
} from './store';
import { mountPuzzle } from './trainer/player';
import { pickNext } from './trainer/rating';
import { isDue } from './trainer/review';
import type { Lesson, Puzzle } from './types';

const app = document.getElementById('app') as HTMLElement;
const EXAM_PER_LESSON = 2;
const SAMPLE_PUZZLE = { slug: 'forks', id: 'nXyPN' };
const PAPER_WASH = 'rgba(239, 230, 210, 0.66)';
let renderToken = 0;
let readObserver: IntersectionObserver | undefined;

const dateline = new Date().toLocaleDateString('en-US', {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

function shell(compact: boolean): HTMLElement {
  const due = dueReviews().length;
  const mine = hasStarted()
    ? `<span class="nav__mine">
        <a href="#/contents">My Course</a>
        <a href="#/review">Review Misses${due ? ` (${due})` : ''}</a>
      </span>`
    : '';
  app.innerHTML = `
    <header class="masthead${compact ? ' masthead--compact' : ''}">
      <a class="masthead__title" href="#/">${
        artImage('masthead', 'The Madras Mate', 'masthead__art') || 'The Madras Mate'
      }</a>
      <p class="dateline">New York Edition &middot; ${esc(dateline)}</p>
      <nav class="nav" aria-label="Sections">
        <a href="#/">Front Page</a>
        ${desks.map((d) => `<a href="#/section/${d.id}">${esc(d.title)}</a>`).join('')}
        ${mine}
      </nav>
    </header>
    <main id="page" class="page"></main>
    <footer class="colophon-bar"><a href="#/colophon">Colophon &amp; credits</a></footer>`;
  return document.getElementById('page') as HTMLElement;
}

const lessonLink = (l: Lesson) => `#/lesson/${l.slug}`;
const trainLink = (l: Lesson) => `#/train/${l.slug}`;

function dueReviews(now = Date.now()) {
  return Object.entries(getProgress().reviews).filter(([, entry]) => isDue(entry, now));
}

function nextLesson(): Lesson {
  const { read } = getProgress();
  return allLessons.find((l) => !read[l.slug]) ?? allLessons[0];
}

/** The lesson a returning reader most likely wants: the one left unfinished, or the next in that section. */
function resumeLesson(): Lesson {
  const { read, lastLesson } = getProgress();
  const last = lastLesson ? findLesson(lastLesson) : undefined;
  if (last && !read[last.slug]) return last;
  return (last && deskOf(last.slug)?.lessons.find((l) => !read[l.slug])) ?? nextLesson();
}

const plural = (n: number, word: string) => `${n.toLocaleString('en-US')} ${word}${n === 1 ? '' : 's'}`;

const puzzleCount = (lessons: Lesson[]) => lessons.filter(hasPuzzles).length * PUZZLES_PER_LESSON;

const num = (n: number) => n.toLocaleString('en-US');
const missCount = (n: number) => `${num(n)} ${n === 1 ? 'miss' : 'misses'}`;

interface Tally {
  clean: number;
  missed: number;
  total: number;
}

function tallyOf(lessons: Lesson[]): Tally {
  const { counts } = getProgress();
  const tally = { clean: 0, missed: 0, total: puzzleCount(lessons) };
  for (const l of lessons.filter(hasPuzzles)) {
    const c = counts[l.slug];
    if (!c) continue;
    tally.clean += c.solved;
    tally.missed += c.tried - c.solved;
  }
  return tally;
}

const pct = (n: number, total: number) => (total ? (100 * n) / total : 0);

const tallyLabel = (t: Tally) =>
  `${t.clean} solved clean, ${t.missed} missed, ${t.total - t.clean - t.missed} still to work, of ${t.total}`;

/** A column-inch bar: solid ink for clean solves, red hatching for misses, bare paper for the rest. */
const tallyBar = (t: Tally, extra = '') => `
  <span class="tally-bar${extra}" role="img" aria-label="${tallyLabel(t)}">
    <span class="tally-bar__clean" style="width:${pct(t.clean, t.total)}%"></span><span class="tally-bar__missed" style="width:${pct(t.missed, t.total)}%"></span>
  </span>`;

/** One square of type per puzzle, set two lines deep, filled in the order the bar reads. */
function typeStrip(t: Tally): string {
  const cells = Array.from({ length: t.total }, (_, i) =>
    i < t.clean ? '<i class="strip__clean"></i>' : i < t.clean + t.missed ? '<i class="strip__missed"></i>' : '<i></i>',
  );
  return `<span class="strip" role="img" aria-label="${tallyLabel(t)}">${cells.join('')}</span>`;
}

const LEGEND = `<p class="legend" aria-hidden="true">
  <span><i class="strip__clean"></i>Solved clean</span>
  <span><i class="strip__missed"></i>Missed or stumbled</span>
  <span><i></i>Still to work</span>
</p>`;

function engraving(desk: Desk): string {
  return (
    artImage(`section-${desk.id}`, esc(desk.artAlt), 'engraving') ||
    `<img class="engraving engraving--piece" src="${import.meta.env.BASE_URL}pieces/${desk.piece}.svg" alt="">`
  );
}

function deskCard(desk: Desk): string {
  const puzzles = puzzleCount(desk.lessons);
  return `
    <article class="desk-card">
      ${engraving(desk)}
      <h3><a href="#/section/${desk.id}">${esc(desk.title)}</a></h3>
      <p class="desk-card__count">${plural(desk.lessons.length, 'lesson')}${puzzles ? ` &middot; ${plural(puzzles, 'puzzle')}` : ''}</p>
      <p>${esc(desk.dek)}</p>
    </article>`;
}

function welcomeBack(): string {
  const lesson = resumeLesson();
  const due = dueReviews().length;
  return `
    <aside class="welcome-back">
      <p>Welcome back. Next up: <a href="${lessonLink(lesson)}">${esc(lesson.title)}</a>${due ? `, with <a href="#/review">${missCount(due)} due for review</a>` : ''}.</p>
      <a class="button" href="${lessonLink(lesson)}">Continue</a>
    </aside>`;
}

function mountSamplePuzzle(token: number): void {
  const host = document.getElementById('sample-puzzle') as HTMLElement;
  const after = document.getElementById('sample-after') as HTMLElement;
  loadPuzzles(SAMPLE_PUZZLE.slug)
    .then((puzzles) => {
      if (token !== renderToken) return;
      const puzzle = puzzles.find((p) => p.id === SAMPLE_PUZZLE.id);
      if (!puzzle) throw new Error('Sample puzzle not found');
      // A visitor trying the sample has not started the course, so nothing is recorded.
      mountPuzzle(host, puzzle, {
        prompt: 'Find the move that wins a piece.',
        onResult: () => {
          after.hidden = false;
        },
      });
    })
    .catch(() => {
      host.textContent = 'This puzzle could not be loaded.';
    });
}

function frontPage(page: HTMLElement, token: number): void {
  const first = allLessons[0];
  page.innerHTML = `
    ${hasStarted() ? welcomeBack() : ''}
    <section class="hero">
      <div class="lead">
        <h1>Back at the Board? Start Here.</h1>
        <p class="dek">A free chess course for players rated 1000&ndash;1500.</p>
        <p class="facts">${allLessons.length} lessons &middot; ${puzzleCount(allLessons).toLocaleString('en-US')} graded puzzles &middot; no account</p>
        <p class="cta"><a class="button" href="${lessonLink(first)}">Start lesson one</a></p>
      </div>
      ${artImage('front-lead', 'Two men, one in a turban and long buttoned coat, study a carved Indian chess set at a stone table in Washington Square Park', 'lead__art')}
    </section>
    <h2 class="band-head">The Chess Column</h2>
    <section class="sample">
      <div id="sample-puzzle" class="inline-puzzle"></div>
      <p id="sample-after" class="sample__after" hidden>That was a fork. <a href="${lessonLink(findLesson(SAMPLE_PUZZLE.slug) as Lesson)}">Learn the idea</a>.</p>
    </section>
    <h2 class="band-head">Inside the Paper</h2>
    <div class="desks">${desks.map(deskCard).join('')}</div>`;
  mountSamplePuzzle(token);
}

function lessonFacts(l: Lesson, withPuzzles = true): string {
  const drills = drillCount(l.slug);
  const facts = [withPuzzles && hasPuzzles(l) ? `${PUZZLES_PER_LESSON} puzzles` : '', drills ? plural(drills, 'drill') : ''].filter(Boolean);
  return facts.length ? `<span class="toc__facts">${facts.join(' &middot; ')}</span>` : '';
}

/** One row per section: lessons read, puzzles worked, and the next lesson to read. */
function deskTable(): string {
  const { read } = getProgress();
  return `
    <table class="box desk-table">
      <thead><tr><th scope="col">Section</th><th scope="col">Read</th><th scope="col">Puzzles</th><th scope="col">Next up</th></tr></thead>
      <tbody>${desks
        .map((desk) => {
          const done = desk.lessons.filter((l) => read[l.slug]).length;
          const next = desk.lessons.find((l) => !read[l.slug]);
          const t = tallyOf(desk.lessons);
          return `<tr>
            <th scope="row"><a href="#/section/${desk.id}">${esc(desk.title)}</a></th>
            <td>${done}/${desk.lessons.length}</td>
            <td class="desk-table__puzzles">${
              t.total ? `${tallyBar(t, ' tally-bar--thin')}<span>${num(t.clean + t.missed)}/${num(t.total)}</span>` : '&ndash;'
            }</td>
            <td>${next ? `<a href="${lessonLink(next)}">${esc(next.title)}</a>` : 'All read'}</td>
          </tr>`;
        })
        .join('')}</tbody>
    </table>`;
}

function theTally(): string {
  const t = tallyOf(allLessons);
  const worked = t.clean + t.missed;
  return `
    <section class="tally" aria-label="Puzzles">
      <div class="tally__figures">
        <p><strong>${num(t.clean)}</strong> solved clean</p>
        <p class="tally__missed"><strong>${num(t.missed)}</strong> missed</p>
        <p class="tally__left"><strong>${num(t.total - worked)}</strong> to work</p>
      </div>
      ${tallyBar(t, ' tally-bar--lead')}
      <p class="tally__caption">${Math.floor(pct(worked, t.total))}% of ${num(t.total)} worked</p>
    </section>`;
}

const FILTERS = [
  ['all', 'All'],
  ['unread', 'Unread'],
  ['puzzles', 'With puzzles'],
  ['drills', 'With drills'],
];

/** A lesson in the contents. Once the course is started, a puzzle lesson also shows its strip and score. */
function lessonItem(l: Lesson, started: boolean): string {
  const { read, counts } = getProgress();
  const c = counts[l.slug] ?? { tried: 0, solved: 0 };
  const ledger = started && hasPuzzles(l);
  return `
    <li data-unread="${!read[l.slug]}" data-puzzles="${hasPuzzles(l)}" data-drills="${drillCount(l.slug) > 0}"${
      hasPuzzles(l) ? ` data-tried="${c.tried}" data-solved="${c.solved}"` : ''
    }>
      <span class="toc__title">
        <span class="dot${read[l.slug] ? ' dot--read' : ''}" role="img" aria-label="${read[l.slug] ? 'Read' : 'Unread'}"></span>
        <a href="${lessonLink(l)}">${esc(l.title)}</a>
        ${lessonFacts(l, !ledger)}
      </span>
      ${
        ledger
          ? `${typeStrip({ clean: c.solved, missed: c.tried - c.solved, total: PUZZLES_PER_LESSON })}
            <a class="toc__nums" href="${trainLink(l)}"><strong>${c.tried}</strong>/${PUZZLES_PER_LESSON}${
              c.tried ? `<span class="toc__rating">${ratingFor(l.slug)}</span>` : ''
            }</a>`
          : ''
      }
    </li>`;
}

const CARRY = `
  <p class="carry">
    <span class="note">Progress is kept in this browser only.</span>
    <button class="button button--small button--plain" id="export" type="button">Save a copy</button>
    <label class="button button--small button--plain">Load a copy<input id="import" type="file" accept="application/json" hidden></label>
    <span class="note" id="import-note" role="status"></span>
  </p>`;

function wireRecordTools(): void {
  document.getElementById('export')?.addEventListener('click', () => {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([exportProgress()], { type: 'application/json' }));
    link.download = 'chess-course-progress.json';
    link.click();
    URL.revokeObjectURL(link.href);
  });
  document.getElementById('import')?.addEventListener('change', async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (importProgress(await file.text())) {
      void render();
    } else {
      (document.getElementById('import-note') as HTMLElement).textContent = 'Not a progress file. Nothing changed.';
    }
  });
}

/** My Course: where to pick up, how far through the puzzles, and every lesson with its own score. */
function contents(page: HTMLElement): void {
  const { counts } = getProgress();
  const started = hasStarted();
  const resume = resumeLesson();
  const weakest = allLessons
    .filter((l) => hasPuzzles(l) && (counts[l.slug]?.tried ?? 0) >= 5)
    .sort((a, b) => ratingFor(a.slug) - ratingFor(b.slug))
    .slice(0, 3);
  page.innerHTML = `
    <h1 class="section-title">${started ? 'My Course' : 'All Lessons'}</h1>
    ${
      started
        ? `<div class="resume">
            <div>
              <p class="kicker">Continue</p>
              <h2><a href="${lessonLink(resume)}">${esc(resume.title)}</a></h2>
              <p class="resume__dek">${esc(resume.dek)}</p>
            </div>
            <a class="button" href="${lessonLink(resume)}">Continue reading</a>
          </div>
          ${theTally()}
          ${
            weakest.length
              ? `<p class="weakest"><span class="kicker">Weakest</span> ${weakest
                  .map((l) => `<a href="${trainLink(l)}">${esc(l.title)}</a>`)
                  .join(' &middot; ')}</p>`
              : ''
          }
          ${deskTable()}
          <h2 class="band-head">All Lessons</h2>`
        : ''
    }
    <div class="toc-tools">
      <div class="filters" role="group" aria-label="Filter lessons">
        ${FILTERS.map(([id, label]) => `<button type="button" data-filter="${id}" aria-pressed="${id === 'all'}">${label}</button>`).join('')}
      </div>
      ${started ? LEGEND : ''}
    </div>
    ${desks
      .map(
        (desk) => `<section class="toc-desk">
          <h2 class="toc-desk__head"><a href="#/section/${desk.id}">${esc(desk.title)}</a></h2>
          ${desk.parts
            .map(
              (s) => `<section class="toc${started ? ' toc--ledger' : ''}">
                ${desk.parts.length > 1 ? `<h3>${esc(s.title)}</h3>` : ''}
                <ul>${s.lessons.map((l) => lessonItem(l, started)).join('')}</ul>
              </section>`,
            )
            .join('')}
        </section>`,
      )
      .join('')}
    ${CARRY}`;

  const buttons = [...page.querySelectorAll<HTMLButtonElement>('[data-filter]')];
  for (const button of buttons) {
    button.addEventListener('click', () => {
      const filter = button.dataset.filter as string;
      for (const b of buttons) b.setAttribute('aria-pressed', String(b === button));
      for (const li of page.querySelectorAll<HTMLElement>('.toc li')) {
        li.hidden = filter !== 'all' && li.dataset[filter] !== 'true';
      }
      for (const group of page.querySelectorAll<HTMLElement>('.toc, .toc-desk')) {
        group.hidden = !group.querySelector('li:not([hidden])');
      }
    });
  }
  wireRecordTools();
}

function repertoire(): string {
  const { read } = getProgress();
  return `
    <h2 class="band-head">The Repertoire: What to Play Against What</h2>
    ${course.repertoire
      .map(
        (group) => `<table class="box rep">
          <caption>${esc(group.title)}</caption>
          <thead><tr><th scope="col">If they play</th><th scope="col">You play</th><th scope="col">Lesson</th></tr></thead>
          <tbody>${group.rows
            .map((row) => {
              const lesson = findLesson(row.lesson) as Lesson;
              return `<tr>
                <th scope="row">${esc(row.they)}</th>
                <td>${esc(row.you)}</td>
                <td><a href="${lessonLink(lesson)}">${esc(lesson.title)}</a>${read[lesson.slug] ? ' <span class="read">Read</span>' : ''}</td>
              </tr>`;
            })
            .join('')}</tbody>
        </table>`,
      )
      .join('')}`;
}

function sectionPage(page: HTMLElement, id: string): void {
  const desk = desks.find((d) => d.id === id) ?? desks.find((d) => d.sections.includes(id));
  if (!desk) return notFound(page);
  const { read, counts, bestExam } = getProgress();
  const done = desk.lessons.filter((l) => read[l.slug]).length;
  page.innerHTML = `
    <header class="desk-head">
      <div>
        <h1 class="section-title">${esc(desk.title)}</h1>
        <p class="dek">${esc(desk.dek)}</p>
        <p class="desk-head__count">${done} of ${plural(desk.lessons.length, 'lesson')} read</p>
      </div>
      ${engraving(desk)}
    </header>
    ${desk.id === 'openings' ? repertoire() : ''}
    ${desk.parts
      .map(
        (part) => `<section id="part-${part.id}">
          ${desk.parts.length > 1 ? `<h2 class="part-head">${esc(part.title)}</h2><p class="part-dek">${esc(part.dek)}</p>` : ''}
          <ol class="lesson-list">
            ${part.lessons
              .map((l, i) => {
                const tried = counts[l.slug]?.tried ?? 0;
                return `<li class="lesson-row">
                  <span class="lesson-row__num">${i + 1}</span>
                  <div>
                    <h2><a href="${lessonLink(l)}">${esc(l.title)}</a>${read[l.slug] ? ' <span class="read">Read</span>' : ''}</h2>
                    <p>${esc(l.dek)}</p>
                  </div>
                  ${hasPuzzles(l) ? `<a class="lesson-row__train" href="${trainLink(l)}">Puzzles${tried ? ` (${tried}/${PUZZLES_PER_LESSON})` : ''}</a>` : ''}
                </li>`;
              })
              .join('')}
          </ol>
        </section>`,
      )
      .join('')}
    ${
      desk.id === tactics.id
        ? `<p class="cta"><a class="button" href="#/exam">Sit the final examination</a>${
            bestExam !== null ? ` <span class="note">Best score: ${bestExam} of ${EXAM_PER_LESSON * tactics.lessons.length}</span>` : ''
          }</p>`
        : ''
    }`;
  // Older links name a content folder, so land on that part of the section.
  if (id !== desk.id) document.getElementById(`part-${id}`)?.scrollIntoView();
}

function lessonPage(page: HTMLElement, slug: string): void {
  const lesson = findLesson(slug);
  const section = sectionOf(slug);
  const source = lessonSource(slug);
  if (!lesson || !section || !source) return notFound(page);
  const i = section.lessons.indexOf(lesson);
  const next = allLessons[allLessons.indexOf(lesson) + 1];
  page.innerHTML = `
    <article class="article">
      <p class="kicker"><a href="#/section/${section.id}">${esc(section.title)}</a> &middot; Lesson ${i + 1} of ${section.lessons.length}</p>
      <h1>${esc(lesson.title)}</h1>
      <p class="dek">${esc(lesson.dek)}</p>
      <div class="article__body" id="body"></div>
      <div class="article__end">
        ${hasPuzzles(lesson) ? `<a class="button" id="to-puzzles" href="${trainLink(lesson)}">Work the graded puzzles</a>` : ''}
        ${next ? `<a class="button button--plain" href="${lessonLink(next)}">Next: ${esc(next.title)}</a>` : ''}
      </div>
    </article>`;
  renderLesson(document.getElementById('body') as HTMLElement, slug, source);
  markOpened(slug);
  // A lesson counts as read once the reader reaches its end, not when it is opened.
  readObserver = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    markRead(slug);
    readObserver?.disconnect();
  });
  readObserver.observe(page.querySelector('.article__end') as HTMLElement);
}

async function trainPage(page: HTMLElement, slug: string, token: number): Promise<void> {
  const lesson = findLesson(slug);
  if (!lesson || !hasPuzzles(lesson)) return notFound(page);
  page.innerHTML = `<p class="note">Setting type&hellip;</p>`;
  const puzzles = await loadPuzzles(slug);
  if (token !== renderToken) return;

  page.innerHTML = `
    <p class="kicker"><a href="${lessonLink(lesson)}">Back to the lesson</a></p>
    <h1 class="section-title">${esc(lesson.title)}: Puzzles</h1>
    <div class="trainer">
      <label class="trainer__band">Difficulty
        <select id="band">
          <option value="">Matched to my rating</option>
          ${course.bands.map((b) => `<option value="${b.id}">${b.name} (${b.min}&ndash;${b.max})</option>`).join('')}
        </select>
      </label>
      <p class="trainer__rating">Motif rating: <strong id="rating"></strong></p>
    </div>
    <div id="board-host" class="trainer__board"></div>
    <section class="lesson-tally" id="lesson-tally" aria-label="This lesson's puzzles"></section>`;
  const host = document.getElementById('board-host') as HTMLElement;
  const band = document.getElementById('band') as HTMLSelectElement;
  const ratingEl = document.getElementById('rating') as HTMLElement;
  const tallyEl = document.getElementById('lesson-tally') as HTMLElement;

  const showTally = () => {
    const { attempted, clippings } = getProgress();
    const clean = puzzles.filter((p) => attempted[p.id] === true).length;
    const missed = puzzles.filter((p) => attempted[p.id] === false).length;
    const clipped = Object.values(clippings).filter((c) => c.slug === slug).length;
    const left = puzzles.length - clean - missed;
    tallyEl.innerHTML = `
      ${typeStrip({ clean, missed, total: puzzles.length })}
      <p class="lesson-tally__text"><strong>${clean + missed} of ${puzzles.length}</strong> worked: ${clean} clean, ${missed} missed. <strong>${left}</strong> to go.${
        clipped ? ` <a href="#/review/${slug}">${missCount(clipped)} to review</a>.` : ''
      }</p>
      <p class="lesson-tally__tools">
        ${missed ? `<button type="button" class="button button--small button--plain" id="return-misses">Return ${missed === 1 ? 'the miss' : `${missed} misses`} to the pile</button>` : ''}
        ${clean + missed ? `<button type="button" class="button button--small button--plain" id="start-afresh">Start this lesson afresh</button>` : ''}
      </p>`;
    document.getElementById('return-misses')?.addEventListener('click', () => {
      returnMisses(puzzles.map((p) => ({ id: p.id, slug })));
      nextPuzzle();
    });
    document.getElementById('start-afresh')?.addEventListener('click', () => {
      if (!confirm(`Clear your record and rating for ${lesson.title}? Your clippings are kept.`)) return;
      resetLesson(slug, puzzles.map((p) => p.id));
      nextPuzzle();
    });
  };

  const nextPuzzle = () => {
    ratingEl.textContent = String(ratingFor(slug));
    showTally();
    const pool = band.value ? puzzles.filter((p) => p.band === band.value) : puzzles;
    const puzzle = pickNext(pool, ratingFor(slug), attemptedIds());
    if (!puzzle) {
      host.innerHTML = `<p class="note">You have worked every puzzle at this level. Try another difficulty, return your misses to the pile below, or <a href="#/review/${slug}">review your misses</a>.</p>`;
      return;
    }
    mountPuzzle(host, puzzle, {
      onResult: (_, outcome) => {
        recordResult(puzzle, slug, outcome);
        ratingEl.textContent = String(ratingFor(slug));
        showTally();
      },
      onNext: nextPuzzle,
    });
  };
  band.addEventListener('change', nextPuzzle);
  nextPuzzle();
}

function runQueue(host: HTMLElement, queue: { puzzle: Puzzle; slug: string }[], onDone: (score: number) => void): void {
  let index = 0;
  let score = 0;
  const step = () => {
    const item = queue[index];
    if (!item) return onDone(score);
    index++;
    mountPuzzle(host, item.puzzle, {
      prompt: `Puzzle ${index} of ${queue.length}.`,
      onResult: (solved, outcome) => {
        score += Number(solved);
        recordResult(item.puzzle, item.slug, outcome);
      },
      onNext: step,
      nextLabel: index === queue.length ? 'See the result' : 'Next puzzle',
    });
  };
  step();
}

const shuffled = <T,>(items: T[]): T[] => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

async function examPage(page: HTMLElement, token: number): Promise<void> {
  page.innerHTML = `<h1 class="section-title">The Final Examination</h1>
    <p class="dek">Two puzzles from every lesson, in random order, with nothing to tell you the motif.</p>
    <div id="exam-host" class="trainer__board"></div>`;
  const sets = await Promise.all(tactics.lessons.map((l) => loadPuzzles(l.slug)));
  if (token !== renderToken) return;
  const queue = shuffled(
    tactics.lessons.flatMap((l, i) =>
      shuffled(sets[i].filter((p) => p.band === 'solid' || p.band === 'strong'))
        .slice(0, EXAM_PER_LESSON)
        .map((puzzle) => ({ puzzle, slug: l.slug })),
    ),
  );
  const host = document.getElementById('exam-host') as HTMLElement;
  runQueue(host, queue, (score) => {
    recordExam(score);
    host.innerHTML = `<p class="note">Final score: ${score} of ${queue.length}.</p>
      <p class="cta"><a class="button" href="#/contents">See my course</a></p>`;
  });
}

/** Clean solves in a row after which a missed puzzle is called mastered. */
const MASTERED = 3;

type Filed = [string, Clipping & { slug: string }];

const filedMisses = (): Filed[] =>
  Object.entries(getProgress().clippings).filter(
    (entry): entry is Filed => entry[1].slug !== null && Boolean(findLesson(entry[1].slug)),
  );

/**
 * Review Misses: every puzzle missed or stumbled on. Those due on the 1, 3 and 7 day schedule are dealt
 * first; after that the rest come round in shuffled rounds for as long as the reader likes.
 */
async function reviewPage(page: HTMLElement, only: string | undefined, token: number): Promise<void> {
  page.innerHTML = `
    <h1 class="section-title">Review Misses</h1>
    <p class="dek">Every puzzle missed or stumbled on, kept on file until spiked.</p>
    <div id="review-body"><p class="note">Fetching your misses&hellip;</p></div>`;
  const body = document.getElementById('review-body') as HTMLElement;
  // Misses recorded before lessons were kept with them do not say which lesson they came from.
  if (Object.values(getProgress().clippings).some((c) => c.slug === null)) {
    fileClippings(await puzzleIndex());
    if (token !== renderToken) return;
  }
  if (!filedMisses().length) {
    body.innerHTML = `<p class="note">Nothing on file.</p>`;
    return;
  }

  body.innerHTML = `
    <div class="trainer">
      <label class="trainer__band">Review <select id="review-filter"></select></label>
      <p class="trainer__rating" id="sitting"></p>
    </div>
    <div id="review-host" class="trainer__board"></div>
    <div id="review-tools" class="clip-tools" hidden></div>
    <h2 class="band-head">Your Misses</h2>
    <div id="review-file"></div>`;
  const filter = document.getElementById('review-filter') as HTMLSelectElement;
  const host = document.getElementById('review-host') as HTMLElement;
  const tools = document.getElementById('review-tools') as HTMLElement;
  const sitting = document.getElementById('sitting') as HTMLElement;
  const file = document.getElementById('review-file') as HTMLElement;
  const isDueNow = (id: string) => {
    const entry = getProgress().reviews[id];
    return Boolean(entry && isDue(entry, Date.now()));
  };

  const fillFilter = () => {
    const filed = filedMisses();
    const per = new Map<string, number>();
    for (const [, c] of filed) per.set(c.slug, (per.get(c.slug) ?? 0) + 1);
    const chosen = filter.value || only || '';
    filter.innerHTML = `<option value="">All misses (${filed.length})</option>${allLessons
      .filter((l) => per.has(l.slug))
      .map((l) => `<option value="${l.slug}">${esc(l.title)} (${per.get(l.slug)})</option>`)
      .join('')}`;
    filter.value = per.has(chosen) ? chosen : '';
  };

  const renderFile = () => {
    const filed = filedMisses();
    const due = dueReviews().length;
    const nav = document.querySelector<HTMLElement>('.nav a[href="#/review"]');
    if (nav) nav.textContent = `Review Misses${due ? ` (${due})` : ''}`;
    const rows = allLessons
      .map((l) => ({ lesson: l, misses: filed.filter(([, c]) => c.slug === l.slug) }))
      .filter((r) => r.misses.length);
    const mastered = filed.filter(([, c]) => c.streak >= MASTERED);
    file.innerHTML = `
      <table class="box review-file">
        <thead><tr><th scope="col">Lesson</th><th scope="col">Misses</th><th scope="col">Due</th><th scope="col">Stumbled</th><th scope="col">Shown</th><th scope="col">Mastered</th></tr></thead>
        <tbody>${rows
          .map(
            ({ lesson, misses }) => `<tr>
              <th scope="row"><a href="#/review/${lesson.slug}">${esc(lesson.title)}</a></th>
              <td>${misses.length}</td>
              <td>${misses.filter(([id]) => isDueNow(id)).length}</td>
              <td>${misses.filter(([, c]) => c.outcome === 'stumble').length}</td>
              <td>${misses.filter(([, c]) => c.outcome === 'revealed').length}</td>
              <td>${misses.filter(([, c]) => c.streak >= MASTERED).length}</td>
            </tr>`,
          )
          .join('')}</tbody>
      </table>
      ${
        mastered.length
          ? `<p class="cta"><button class="button" id="spike-mastered" type="button">Spike ${plural(mastered.length, 'mastered puzzle')}</button></p>`
          : ''
      }`;
    document.getElementById('spike-mastered')?.addEventListener('click', () => {
      for (const [id] of mastered) spike(id);
      fillFilter();
      renderFile();
    });
  };

  let queue: string[] = [];
  let lastId = '';
  let worked = 0;
  let clean = 0;

  const showSitting = () => {
    const due = dueReviews().length;
    sitting.textContent = worked
      ? `This sitting: ${clean}/${worked} clean${due ? ` · ${due} due` : ''}`
      : due
        ? `${due} due today`
        : 'None due today';
  };

  const showTools = (id: string) => {
    const clip = getProgress().clippings[id];
    const lesson = clip?.slug ? findLesson(clip.slug) : undefined;
    if (!clip || !lesson) return;
    tools.hidden = false;
    tools.innerHTML = `
      <p><a href="${lessonLink(lesson)}">${esc(lesson.title)}</a> &middot; Reviewed ${clip.revised} &middot; Streak ${clip.streak}${
        clip.streak >= MASTERED ? ' &middot; <strong>Mastered</strong>' : ''
      }</p>
      <button class="button button--small${clip.streak >= MASTERED ? '' : ' button--plain'}" id="spike" type="button">Spike it</button>`;
    document.getElementById('spike')?.addEventListener('click', () => {
      spike(id);
      tools.innerHTML = `<p>Spiked.</p>`;
      fillFilter();
      renderFile();
    });
  };

  const next = async (): Promise<void> => {
    tools.hidden = true;
    const ids = filedMisses()
      .filter(([, c]) => !filter.value || c.slug === filter.value)
      .map(([id]) => id);
    if (!ids.length) {
      host.innerHTML = `<p class="note">${filter.value ? 'None left in this lesson.' : 'File empty.'}</p>`;
      return;
    }
    queue = queue.filter((id) => ids.includes(id));
    if (!queue.length) {
      const due = ids.filter(isDueNow);
      queue = [...shuffled(due), ...shuffled(ids.filter((id) => !due.includes(id)))];
      // Never deal the same puzzle twice running across a new round.
      if (queue.length > 1 && queue[0] === lastId) queue.push(queue.shift() as string);
    }
    const id = queue.shift() as string;
    lastId = id;
    const slug = getProgress().clippings[id].slug as string;
    const puzzle = (await loadPuzzles(slug)).find((p) => p.id === id);
    if (token !== renderToken) return;
    if (!puzzle) {
      // The puzzle set was rebuilt without it, so it can no longer be shown.
      spike(id);
      return next();
    }
    mountPuzzle(host, puzzle, {
      prompt: isDueNow(id) ? 'Due today.' : undefined,
      revealedText: 'The solution. Due again tomorrow.',
      onResult: (solved, outcome) => {
        recordRevision(id, outcome);
        worked++;
        clean += Number(solved);
        showSitting();
        showTools(id);
        renderFile();
      },
      onNext: () => void next(),
    });
  };

  fillFilter();
  renderFile();
  showSitting();
  filter.addEventListener('change', () => {
    queue = [];
    void next();
  });
  await next();
}

function colophon(page: HTMLElement): void {
  page.innerHTML = `
    <h1 class="section-title">Colophon</h1>
    <div class="prose">
      <p><strong>Puzzles</strong> come from the <a href="https://database.lichess.org/#puzzles">Lichess puzzle database</a>, released under CC0. Their ratings are set by the players who solved them. Each puzzle links to its Lichess page.</p>
      <p><strong>Chess pieces</strong> are by <a href="https://commons.wikimedia.org/wiki/Category:SVG_chess_pieces">Colin M. L. Burnett</a>, licensed <a href="https://creativecommons.org/licenses/by-sa/3.0/">CC BY-SA 3.0</a> and GPLv2+, recoloured here in ink and newsprint tones; the recoloured set is shared under the same terms.</p>
      <p><strong>Classic games</strong> are taken from the player collections at <a href="https://www.pgnmentor.com/files.html">PGN Mentor</a>. Opening names follow the open <a href="https://github.com/lichess-org/chess-openings">Lichess opening list</a>.</p>
      <p><strong>Illustrations</strong> were generated with Midjourney. The photographs are invented scenes, not records of real people or events.</p>
      <p><strong>Move rules</strong> are by <a href="https://github.com/jhlywa/chess.js">chess.js</a>, BSD licence.</p>
      <p><strong>The name</strong> plays on <em>The Madras Mail</em>, an evening daily founded in 1868 that closed in the early 1980s. Madras, now Chennai, has become India's chess capital. This site is an independent tribute with no connection to that paper.</p>
    </div>`;
}

function notFound(page: HTMLElement): void {
  page.innerHTML = `<h1 class="section-title">Page Not Found</h1><p><a href="#/">Return to the front page</a></p>`;
}

export async function render(): Promise<void> {
  const token = ++renderToken;
  const [, route, arg] = location.hash.replace(/^#/, '').split('/');
  readObserver?.disconnect();
  const page = shell(Boolean(route));
  const paper = artUrl('paper-texture');
  // The wash keeps the grain but stops folds banding and specks reading as punctuation.
  if (paper) document.body.style.backgroundImage = `linear-gradient(${PAPER_WASH}, ${PAPER_WASH}), url("${paper}")`;
  window.scrollTo(0, 0);

  try {
    switch (route ?? '') {
      case '':
        return frontPage(page, token);
      case 'contents':
      case 'progress': // The box score now lives on My Course.
        return contents(page);
      case 'section':
        return sectionPage(page, arg);
      case 'lesson':
        return lessonPage(page, arg);
      case 'train':
        return await trainPage(page, arg, token);
      case 'review':
      case 'clippings':
        return await reviewPage(page, arg, token);
      case 'exam':
        return await examPage(page, token);
      case 'colophon':
        return colophon(page);
      default:
        return notFound(page);
    }
  } catch {
    if (token === renderToken) {
      page.innerHTML = `<h1 class="section-title">Stop the Presses</h1><p>This page could not be loaded. Check your connection and try again.</p>`;
    }
  }
}
