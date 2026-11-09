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
  PUZZLES_PER_LESSON,
  sectionOf,
  tactics,
  type Desk,
} from './data';
import { drillCount, lessonSource, renderLesson } from './lessons';
import {
  attemptedIds,
  exportProgress,
  getProgress,
  hasStarted,
  importProgress,
  markOpened,
  markRead,
  ratingFor,
  recordExam,
  recordResult,
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
        <a href="#/review">Review${due ? ` (${due})` : ''}</a>
        <a href="#/progress">Progress</a>
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
      <p>Welcome back. Next up: <a href="${lessonLink(lesson)}">${esc(lesson.title)}</a>${due ? `, with ${plural(due, 'review')} due` : ''}.</p>
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

function lessonFacts(l: Lesson): string {
  const drills = drillCount(l.slug);
  const facts = [hasPuzzles(l) ? `${PUZZLES_PER_LESSON} puzzles` : '', drills ? plural(drills, 'drill') : ''].filter(Boolean);
  return facts.length ? `<span class="toc__facts">${facts.join(' &middot; ')}</span>` : '';
}

function deskRow(desk: Desk): string {
  const { read } = getProgress();
  const done = desk.lessons.filter((l) => read[l.slug]).length;
  const next = desk.lessons.find((l) => !read[l.slug]);
  return `
    <li class="desk-row">
      <h3><a href="#/section/${desk.id}">${esc(desk.title)}</a></h3>
      <span class="desk-row__done">${done} of ${desk.lessons.length} read</span>
      <span>${next ? `Next: <a href="${lessonLink(next)}">${esc(next.title)}</a>` : 'All read'}</span>
    </li>`;
}

const FILTERS = [
  ['all', 'All'],
  ['unread', 'Unread'],
  ['puzzles', 'With puzzles'],
  ['drills', 'With drills'],
];

function contents(page: HTMLElement): void {
  const { read } = getProgress();
  const started = hasStarted();
  const resume = resumeLesson();
  const due = dueReviews().length;
  const item = (l: Lesson) => `
    <li data-unread="${!read[l.slug]}" data-puzzles="${hasPuzzles(l)}" data-drills="${drillCount(l.slug) > 0}">
      <span class="dot${read[l.slug] ? ' dot--read' : ''}" role="img" aria-label="${read[l.slug] ? 'Read' : 'Unread'}"></span>
      <a href="${lessonLink(l)}">${esc(l.title)}</a>
      ${lessonFacts(l)}
    </li>`;
  page.innerHTML = `
    <h1 class="section-title">${started ? 'My Course' : 'All Lessons'}</h1>
    ${
      started
        ? `<div class="resume">
            <div>
              <p class="kicker">Pick up where you left off</p>
              <h2><a href="${lessonLink(resume)}">${esc(resume.title)}</a></h2>
              <p class="resume__dek">${esc(resume.dek)}</p>
            </div>
            <p class="cta">
              <a class="button" href="${lessonLink(resume)}">Continue reading</a>
              ${due ? `<a class="button button--plain" href="#/review">${plural(due, 'review')} due</a>` : ''}
            </p>
          </div>
          <ul class="desk-rows">${desks.map(deskRow).join('')}</ul>
          <h2 class="band-head">All Lessons</h2>`
        : ''
    }
    <div class="filters" role="group" aria-label="Filter lessons">
      ${FILTERS.map(([id, label]) => `<button type="button" data-filter="${id}" aria-pressed="${id === 'all'}">${label}</button>`).join('')}
    </div>
    ${desks
      .map(
        (desk) => `<section class="toc-desk">
          <h2 class="toc-desk__head"><a href="#/section/${desk.id}">${esc(desk.title)}</a></h2>
          ${desk.parts
            .map(
              (s) => `<section class="toc">
                ${desk.parts.length > 1 ? `<h3>${esc(s.title)}</h3>` : ''}
                <ul>${s.lessons.map(item).join('')}</ul>
              </section>`,
            )
            .join('')}
        </section>`,
      )
      .join('')}`;

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
    <div id="board-host" class="trainer__board"></div>`;
  const host = document.getElementById('board-host') as HTMLElement;
  const band = document.getElementById('band') as HTMLSelectElement;
  const ratingEl = document.getElementById('rating') as HTMLElement;

  const nextPuzzle = () => {
    ratingEl.textContent = String(ratingFor(slug));
    const pool = band.value ? puzzles.filter((p) => p.band === band.value) : puzzles;
    const puzzle = pickNext(pool, ratingFor(slug), attemptedIds());
    if (!puzzle) {
      host.innerHTML = `<p class="note">You have worked every puzzle at this level. Try another difficulty, or the <a href="#/review">review desk</a>.</p>`;
      return;
    }
    mountPuzzle(host, puzzle, {
      onResult: (solved) => {
        recordResult(puzzle, slug, solved);
        ratingEl.textContent = String(ratingFor(slug));
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
      onResult: (solved) => {
        score += Number(solved);
        recordResult(item.puzzle, item.slug, solved);
      },
      onNext: step,
      nextLabel: index === queue.length ? 'See the result' : 'Next puzzle',
    });
  };
  step();
}

async function reviewPage(page: HTMLElement, token: number): Promise<void> {
  const due = dueReviews();
  page.innerHTML = `<h1 class="section-title">The Review Desk</h1><div id="review-host" class="trainer__board"></div>`;
  const host = document.getElementById('review-host') as HTMLElement;
  if (!due.length) {
    const waiting = Object.keys(getProgress().reviews).length;
    host.innerHTML = `<p class="note">${
      waiting ? `Nothing due today. ${waiting} puzzle${waiting === 1 ? '' : 's'} scheduled for later.` : 'Nothing on the desk. Puzzles you miss will come back here after 1, 3 and 7 days.'
    }</p>`;
    return;
  }
  const queue: { puzzle: Puzzle; slug: string }[] = [];
  for (const [id, entry] of due) {
    const puzzles = await loadPuzzles(entry.slug);
    const puzzle = puzzles.find((p) => p.id === id);
    if (puzzle) queue.push({ puzzle, slug: entry.slug });
  }
  if (token !== renderToken) return;
  runQueue(host, queue, (score) => {
    host.innerHTML = `<p class="note">Review complete: ${score} of ${queue.length} at the first attempt.</p>`;
  });
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
      <p class="cta"><a class="button" href="#/progress">See the box score</a></p>`;
  });
}

function progressPage(page: HTMLElement): void {
  const { counts } = getProgress();
  const rows = allLessons.filter(hasPuzzles).map((l) => ({
    lesson: l,
    section: sectionOf(l.slug)?.title ?? '',
    tried: counts[l.slug]?.tried ?? 0,
    solved: counts[l.slug]?.solved ?? 0,
    rating: ratingFor(l.slug),
  }));
  const weakest = rows.filter((r) => r.tried >= 5).sort((a, b) => a.rating - b.rating).slice(0, 3);
  page.innerHTML = `
    <h1 class="section-title">The Box Score</h1>
    ${
      weakest.length
        ? `<p class="dek">Most in need of work: ${weakest.map((r) => `<a href="${trainLink(r.lesson)}">${esc(r.lesson.title)}</a>`).join(', ')}.</p>`
        : `<p class="dek">Solve five puzzles in a motif and your weakest will be named here.</p>`
    }
    <table class="box">
      <thead><tr><th scope="col">Motif</th><th scope="col">Tried</th><th scope="col">Solved</th><th scope="col">Rating</th></tr></thead>
      <tbody>${rows
        .map(
          (r, i) => `${r.section !== rows[i - 1]?.section ? `<tr class="box__section"><th colspan="4" scope="colgroup">${esc(r.section)}</th></tr>` : ''}
            <tr><th scope="row"><a href="${trainLink(r.lesson)}">${esc(r.lesson.title)}</a></th>
            <td>${r.tried}</td><td>${r.solved}</td><td>${r.tried ? r.rating : '&ndash;'}</td></tr>`,
        )
        .join('')}</tbody>
    </table>
    <h2 class="band-head">Carry Your Record</h2>
    <p>Progress lives in this browser only. Save a copy to move it to another device.</p>
    <p class="cta">
      <button class="button" id="export" type="button">Save my progress</button>
      <label class="button button--plain">Load a saved file<input id="import" type="file" accept="application/json" hidden></label>
    </p>
    <p class="note" id="import-note" role="status"></p>`;

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
      (document.getElementById('import-note') as HTMLElement).textContent =
        'That file is not a saved progress file, so nothing was changed.';
    }
  });
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
        return contents(page);
      case 'section':
        return sectionPage(page, arg);
      case 'lesson':
        return lessonPage(page, arg);
      case 'train':
        return await trainPage(page, arg, token);
      case 'review':
        return await reviewPage(page, token);
      case 'exam':
        return await examPage(page, token);
      case 'progress':
        return progressPage(page);
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
