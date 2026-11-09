Your opponent captures a piece. Your hand is already moving to recapture. This reflex costs more games at club level than any opening inaccuracy.

An in-between move, or *zwischenzug*, is a move played before the expected reply, one that creates a threat your opponent must answer. Having answered, they find that the original recapture is still available to you, and that the position has changed in your favour.

```board
fen: 3q1rk1/2r2pp1/p3pn1p/Q6b/4P3/P2P1N1P/1P2BPP1/2R1R1K1 b - - 0 22
caption: Black to move. White's queen has just captured a knight on a5, and only the rook on c7 stands between the two queens. Black seems simply to have lost a piece.
best: c7c1
arrows: c7c1
```

The rook is attacked, so the obvious reaction is to move or defend it. Instead Black plays ...Rxc1!, capturing with the attacked piece and unmasking the queen on d8 against its opposite number. If White recaptures with Rxc1, then ...Qxa5 wins the queen. So White must take on d8 at once, and after ...Rxe1+ Nxe1 Rxd8 the dust settles. Add up every capture and Black has won a rook for a knight, in a position where White seemed to have won a clean piece.

## When to Look

Three moments should set off the alarm:

- When a capture is expected. Before recapturing, ask whether a check or a larger threat comes first.
- When your opponent seems to have won something. Long variations often end one move too early, in their calculation or yours.
- When calculating your own combination. At every step of the line, ask what forcing move your opponent could insert. Your beautiful variation may contain a hole exactly one move wide.

The same reasoning applies in reverse. When a trade sequence looks forced, it is only forced if neither side has anything better to do.

```puzzle
id: XkgHV
prompt: Your opponent has just captured on d4. The reply may not be the obvious one.
```

```puzzle
id: eOwWA
prompt: White has taken a knight. Is there something better than regret?
```
