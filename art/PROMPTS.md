# Midjourney prompts

The site works without any art. To add a piece, save it to `src/art/` under the exact file name below (`.jpg`, `.png` or `.webp`) and rebuild. It appears automatically.

Avoid any real newspaper's name, logo or masthead lettering. Midjourney often garbles text, so keep words out of the images, except for the masthead, where you may prefer to keep the typeset title.

| File name | Where it appears | Suggested size |
|---|---|---|
| `paper-texture` | Page background, tiled | 1024 x 1024 |
| `front-lead` | Lead story on the front page | 1456 x 816 |
| `section-tactics` | Top of the Tactics section | 1456 x 624 |
| `masthead` | Replaces the typeset title (optional) | 1456 x 256 |

## paper-texture

```
seamless aged newsprint paper texture, warm cream, faint fibres and foxing, very subtle, even tone, no text, no markings, flat lighting --tile --ar 1:1 --style raw
```

Keep this one pale and low in contrast, or the body text becomes harder to read.

## front-lead

```
1920s New York newspaper engraving, two old men playing chess at stone tables in Washington Square Park, autumn trees, the arch in the distance, fine crosshatched black ink on cream newsprint, halftone shading, no text --ar 16:9 --style raw
```

## section-tactics

```
antique woodcut engraving of chess pieces mid-battle, a knight leaping over fallen pawns, dramatic crosshatching, black ink on cream newsprint, vintage newspaper illustration, no text --ar 7:3 --style raw
```

## masthead (optional)

```
ornate 19th century American newspaper masthead ornament, engraved eagle-free central crest made of crossed chess knights and laurel, symmetrical banner flourishes, black ink on cream newsprint, no text --ar 23:4 --style raw
```

The `masthead` file replaces the typeset newspaper name, so include the name in the image or leave this slot empty. Leaving it empty and keeping the typeset title usually looks best.

Chess pieces stay as vector artwork, because Midjourney cannot draw a matching set of twelve pieces that remain legible at small sizes.
