King and pawn endings look simple, and they are the most exact positions in chess. A single tempo separates a win from a draw. Fortunately, a few rules cover a great many cases.

## The Rule of the Square

Can a lone king catch a passed pawn? Picture a square with one side running from the pawn to its promotion square. If the king can step into that square, it catches the pawn. If it cannot, the pawn queens.

```board
fen: 8/8/8/8/k6P/8/8/K7 w - - 0 1
caption: White to move. After h5 the square runs from h5 to e8, and the black king on a4 cannot reach it. Count this before you trade off the last pieces.
best: h4h5
arrows: h4h8
```

## The King Is a Fighting Piece

In the endgame the king should march. Its power is roughly that of a minor piece, and every move it spends sitting on the back rank is a move lost. Even a king that seems hopelessly far away can sometimes do two jobs at once, as this celebrated study by Richard Réti shows.

```choice
fen: 7K/8/k1P5/7p/8/8/8/8 w - - 0 1
question: The h-pawn looks unstoppable, and the c-pawn looks doomed. Can White save the game?
answer: h8g7
option: h8g7 | The king heads along the diagonal, moving towards both pawns at the same time. It either catches the h-pawn or supports the c-pawn, and the game is drawn.
option: c6c7 | After ...Kb7 the pawn is lost, and the white king is too far from the h-pawn to catch it.
```

Before you trade your last pieces, count the king and pawn ending all the way to the end. It is the most important calculation in the endgame.

```puzzle
id: RyDMR
```

```puzzle
id: jEqOl
```
