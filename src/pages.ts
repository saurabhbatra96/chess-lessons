import { artImage, artUrl } from './art';
import { Board } from './board/board';
import { allLessons, course, esc, findLesson, hasPuzzles, loadPuzzles, sectionOf, sections, tactics, type PublishedSection } from './data';
import { lessonSource, renderLesson } from './lessons';
import {
  attemptedIds,
  exportProgress,
  getProgress,
  importProgress,
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
const ARCHIVE_FEN = 'rnb1kb1r/pp3ppp/2p5/4q3/4n3/3Q4/PPPB1PPP/2KR1BNR w kq - 0 9';
const PAPER_WASH = 'rgba(239, 230, 210, 0.66)';
let renderToken = 0;

const dateline = new Date().toLocaleDateString('en-US', {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

function shell(compact: boolean): HTMLElement {
  const due = dueReviews().length;
  app.innerHTML = `
    <header class="masthead${compact ? ' masthead--compact' : ''}">
      <div class="masthead__ears">
        <span class="ear">Checks, Captures<br>&amp; Threats</span>
        <a class="masthead__title" href="#/">${
          artImage('masthead', 'The Washington Square Courier', 'masthead__art') ||
          'The Washington Square Courier'
        }</a>
        <span class="ear ear--right">Late City Edition<br>Price: One Tempo</span>
      </div>
      <div class="dateline">
        <span>Vol. I, No. 1</span>
        <span>New York, ${esc(dateline)}</span>
        <span>Rated 1000&ndash;1500</span>
      </div>
      <nav class="nav" aria-label="Sections">
        <a href="#/">Front Page</a>
        <a href="#/contents">Contents</a>
        <a href="#/review">Review${due ? ` (${due})` : ''}</a>
        <a href="#/progress">Box Score</a>
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

function sectionBrief(section: PublishedSection): string {
  return `
    <article class="brief">
      <p class="kicker">${esc(section.kicker)}</p>
      <h3><a href="#/section/${section.id}">${esc(section.title)}</a></h3>
      <p>${esc(section.dek)}</p>
    </article>`;
}

function frontPage(page: HTMLElement): void {
  const lead = nextLesson();
  const section = sectionOf(lead.slug) as PublishedSection;
  const index = section.lessons.indexOf(lead) + 1;
  const { read } = getProgress();
  const started = Object.keys(read).length > 0;
  const others = section.lessons.filter((l) => l !== lead).slice(0, 4);
  page.innerHTML = `
    <div class="front">
      <article class="lead">
        <p class="kicker">${esc(section.title)} &middot; Lesson ${index} of ${section.lessons.length}</p>
        <h1><a href="${lessonLink(lead)}">${esc(lead.title)}</a></h1>
        <p class="dek">${esc(lead.dek)}</p>
        ${artImage('front-lead', 'Two men bent over a chessboard at a stone table in Washington Square Park', 'lead__art')}
        <p class="lead__body">${
          started
            ? 'Your place is held. Read the lesson, then work through its exercises.'
            : 'Back at the board after some time away? Begin here. Each lesson is a short article, and most are followed by seventy puzzles that climb from warm-up to stretch.'
        }</p>
        <p class="cta">
          <a class="button" href="${lessonLink(lead)}">Read the lesson</a>
          ${hasPuzzles(lead) ? `<a class="button button--plain" href="${trainLink(lead)}">Go to the puzzles</a>` : ''}
        </p>
        <div id="lead-diagram"></div>
      </article>
      <aside class="rail">
        <h2 class="rail__head">Also in ${esc(section.title)}</h2>
        ${others
          .map(
            (l) => `<article class="brief">
              <h3><a href="${lessonLink(l)}">${esc(l.title)}</a></h3>
              <p>${esc(l.dek)}</p>
            </article>`,
          )
          .join('')}
        <a class="more" href="#/section/${section.id}">All ${section.lessons.length} lessons</a>
      </aside>
    </div>
    <h2 class="band-head">Inside This Edition</h2>
    <div class="briefs">${sections.map(sectionBrief).join('')}</div>`;

  if (!artUrl('front-lead')) {
    const figure = document.createElement('figure');
    figure.className = 'lead__diagram';
    const board = new Board();
    board.setPosition(ARCHIVE_FEN);
    const caption = document.createElement('figcaption');
    caption.textContent = 'From the archives: Réti v. Tartakower, Vienna 1910. White to move and mate in three.';
    figure.append(board.el, caption);
    (document.getElementById('lead-diagram') as HTMLElement).append(figure);
  }
}

function contents(page: HTMLElement): void {
  page.innerHTML = `
    <h1 class="section-title">Contents</h1>
    ${sections
      .map(
        (s) => `<section class="toc">
          <p class="kicker">${esc(s.kicker)}</p>
          <h2><a href="#/section/${s.id}">${esc(s.title)}</a></h2>
          <p class="dek">${esc(s.dek)}</p>
          <ol>${s.lessons.map((l) => `<li><a href="${lessonLink(l)}">${esc(l.title)}</a></li>`).join('')}</ol>
        </section>`,
      )
      .join('')}`;
}

function sectionPage(page: HTMLElement, id: string): void {
  const section = sections.find((s) => s.id === id);
  if (!section) return notFound(page);
  const { read, counts, bestExam } = getProgress();
  page.innerHTML = `
    ${artImage(`section-${section.id}`, `An engraving for the ${esc(section.title)} section`, 'section__art')}
    <p class="kicker">${esc(section.kicker)}</p>
    <h1 class="section-title">${esc(section.title)}</h1>
    <p class="dek">${esc(section.dek)}</p>
    <ol class="lesson-list">
      ${section.lessons
        .map((l, i) => {
          const tried = counts[l.slug]?.tried ?? 0;
          return `<li class="lesson-row">
            <span class="lesson-row__num">${i + 1}</span>
            <div>
              <h2><a href="${lessonLink(l)}">${esc(l.title)}</a>${read[l.slug] ? ' <span class="read">Read</span>' : ''}</h2>
              <p>${esc(l.dek)}</p>
            </div>
            ${hasPuzzles(l) ? `<a class="lesson-row__train" href="${trainLink(l)}">Puzzles${tried ? ` (${tried}/70)` : ''}</a>` : ''}
          </li>`;
        })
        .join('')}
    </ol>
    ${
      section === tactics
        ? `<p class="cta"><a class="button" href="#/exam">Sit the final examination</a>${
            bestExam !== null ? ` <span class="note">Best score: ${bestExam} of ${EXAM_PER_LESSON * tactics.lessons.length}</span>` : ''
          }</p>`
        : ''
    }`;
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
  markRead(slug);
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
    link.download = 'courier-progress.json';
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
      <p><strong>Move rules</strong> are by <a href="https://github.com/jhlywa/chess.js">chess.js</a>, BSD licence.</p>
      <p>The <em>Courier</em> is an invented newspaper and has no connection with any real publication.</p>
    </div>`;
}

function notFound(page: HTMLElement): void {
  page.innerHTML = `<h1 class="section-title">Page Not Found</h1><p><a href="#/">Return to the front page</a></p>`;
}

export async function render(): Promise<void> {
  const token = ++renderToken;
  const [, route, arg] = location.hash.replace(/^#/, '').split('/');
  const page = shell(Boolean(route));
  const paper = artUrl('paper-texture');
  // The wash keeps the grain but stops folds banding and specks reading as punctuation.
  if (paper) document.body.style.backgroundImage = `linear-gradient(${PAPER_WASH}, ${PAPER_WASH}), url("${paper}")`;
  window.scrollTo(0, 0);

  try {
    switch (route ?? '') {
      case '':
        return frontPage(page);
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
