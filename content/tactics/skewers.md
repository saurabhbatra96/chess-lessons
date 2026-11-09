A skewer is a pin turned inside out. The more valuable piece stands in front, it is forced to move, and the piece behind it is lost. Because the front piece is usually the king, a skewer often arrives with check and leaves no time for anything else.

```board
fen: 8/1q6/8/3k4/8/8/7P/5BK1 w - - 0 1
caption: White to move. King and queen share a diagonal, and the bishop can step onto it with check.
best: f1g2
arrows: f1g2 g2d5
```

Long-range pieces do this work, so train yourself to notice when two enemy pieces share a line, even if a square or two lie between them. Lines are invisible until you look for them.

## The Endgame Skewer

One skewer deserves memorising outright, because it decides rook endings. A white rook stands in front of its own pawn on the seventh rank, and the black rook waits behind to capture the pawn if the rook ever leaves.

```board
fen: R7/P4k2/8/8/8/8/r7/6K1 w - - 0 1
caption: White to move. The rook seems tied to the pawn. Moving it along the back rank sets a trap.
best: a8h8
arrows: a8h8
```

If Black takes the pawn, the rook checks from h7 and skewers king to rook. If Black declines, the pawn promotes. Note that this works only with the king on the right square: with the black king on g7 the rook on h7 could simply be captured.

## X-Rays

An x-ray is an attack or defence that passes through another piece. The classic case is two heavy pieces lined up on a file with an enemy piece between them. Trades on that file can leave the piece at the back suddenly delivering the decisive blow. When exchanges are in the air, always ask who is standing behind whom.

```puzzle
id: m8OJw
prompt: Win something bigger than the pawn.
```

```puzzle
id: hbrlp
prompt: Count the attackers on the back rank, including the hidden one.
```
