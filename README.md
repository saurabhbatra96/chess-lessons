# The Washington Square Courier

A chess course in newspaper form: short articles and graded puzzles for players rated roughly 1000 to 1500. It is a static site with no server or accounts, and it is built for GitHub Pages.

The pilot contains the Tactics section: 12 lessons and 840 puzzles. Other sections appear in the contents as forthcoming.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Runs the site locally |
| `npm test` | Unit tests for solving, rating and review |
| `npm run validate` | Checks every lesson, and tests the move claims in diagrams with Stockfish |
| `npm run test:e2e` | Browser tests against a production build served from a sub-path |
| `npm run build` | Builds to `dist/` |
| `npm run puzzles` | Rebuilds the puzzle set from the Lichess database |

The puzzle files in `public/data/` are committed, so a normal build does not need the database. To rebuild them, download [`lichess_db_puzzle.csv.zst`](https://database.lichess.org/#puzzles) to `.cache/`.

## Deploying

Push to `main`, and set the repository's Pages source to **GitHub Actions** under Settings > Pages. `.github/workflows/pages.yml` tests, builds and publishes the site. Paths are relative, so any repository name works.

## Writing lessons

Lessons are Markdown files in `content/tactics/`, listed in `content/course.json`. Two fenced blocks add chess content.

````markdown
```board
fen: 6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1
caption: White to move and mate at once.
best: d1d8
arrows: d1d8
```

```puzzle
id: uRxw7
prompt: Look for the open file.
```
````

In a `board` block, `best` lists moves the engine must agree with, `avoid` lists moves it must find losing, and `mate: yes` asserts checkmate. A `puzzle` id must exist in that lesson's puzzle file. `npm run validate` enforces all of this.

To add art, see `art/PROMPTS.md`.

## Credits

- Puzzles: [Lichess puzzle database](https://database.lichess.org/#puzzles), CC0.
- Chess pieces: Colin M. L. Burnett, CC BY-SA 3.0 and GPLv2+, recoloured. The recoloured set in `public/pieces/` is shared under the same terms.
- Rules: [chess.js](https://github.com/jhlywa/chess.js), BSD. Stockfish (GPLv3) is a development-only checking tool and is not part of the published site.
