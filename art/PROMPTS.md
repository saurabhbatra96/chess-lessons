# Midjourney prompts

The site works without any art. Save originals in this folder under the exact file names below. Photographs and the paper go into `src/art/` after compression. Engravings also have their paper removed first, so that only the ink lands on the page.

Avoid any real newspaper's name, logo or masthead lettering, and avoid naming real people. Midjourney often garbles text, so keep words out of the images.

| File name | Where it appears | Suggested size |
|---|---|---|
| `paper-texture` | Page background, tiled | 1024 x 1024 |
| `front-lead` | Beside the headline on the home page | 1456 x 816 |
| `section-tactics`, `section-middlegame`, `section-openings`, `section-endgames`, `section-classics` | Home page and the top of each section; until one exists, a chess piece stands in | 1456 x 624 |

## paper-texture

```
seamless aged newsprint paper texture, warm cream, faint fibres and foxing, very subtle, even tone, no text, no markings, flat lighting --tile --ar 1:1 --style raw
```

Keep this one pale and low in contrast, or the body text becomes harder to read.

## front-lead

The scene stays in Washington Square and the references become Indian: the players, and a carved Indian set in which the rooks are elephants and the bishops are camels, as in the Hindi names *haathi* and *oont*.

```
1920s New York press photograph reproduced in coarse black halftone on cream newsprint, two dignified Indian men in their fifties deep in thought over a chess game at a round stone table in Washington Square Park, one in a long buttoned achkan coat and a neatly wrapped turban, the other in a tweed jacket and round cap, carved wooden Indian chess set with small elephant and camel pieces, the marble arch soft in the distance, bare autumn trees, natural candid documentary moment, no text --ar 16:9 --style raw
```

If the set turns to mush at that distance, this closer version keeps the pieces readable:

```
1920s New York press photograph reproduced in coarse black halftone on cream newsprint, close view across a round stone table in Washington Square Park, an Indian man in a buttoned achkan coat reaching to move a carved elephant chess piece, ornate wooden Indian chess set with elephants, camels, horses and foot soldiers, a second player's hands in the foreground, the marble arch blurred behind, candid documentary moment, no text --ar 16:9 --style raw
```

## Engravings

Keep the background plain and pale, with the subject well clear of the edges. That lets the paper be removed cleanly.

### section-tactics

```
antique woodcut engraving of chess pieces mid-battle, a knight leaping over fallen pawns, dramatic crosshatching, black ink on plain cream paper, vintage newspaper illustration, no text --ar 7:3 --style raw
```

### section-middlegame

```
antique woodcut engraving of a surveyor with a tripod and rolled plans standing on a giant chessboard laid out like a city street grid, a few large chess pieces standing like buildings, fine crosshatching, black ink on plain cream paper, vintage newspaper illustration, no text --ar 7:3 --style raw
```

### section-openings

```
antique woodcut engraving of the Brooklyn Bridge under construction, stone towers and cables strung across the river before the roadway exists, workers small on the catwalk, fine crosshatching, black ink on plain cream paper, vintage newspaper illustration, no text --ar 7:3 --style raw
```

### section-endgames

```
antique woodcut engraving of a lamplighter on an empty cobbled New York street at dusk, one lit gas lamp, a single large chess king standing alone in its glow, long shadows, fine crosshatching, black ink on plain cream paper, vintage newspaper illustration, no text --ar 7:3 --style raw
```

### section-classics

```
antique woodcut engraving of an empty wooden chair pulled up to a small table with a chess game in progress, a single hanging lamp lighting the board, dark room around it, fine crosshatching, black ink on plain cream paper, vintage newspaper illustration, no text --ar 7:3 --style raw
```

Chess pieces on the board stay as vector artwork, because Midjourney cannot draw a matching set of twelve pieces that remain legible at small sizes.
