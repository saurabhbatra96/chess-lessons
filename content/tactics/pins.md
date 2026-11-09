A pin holds a piece in place because something more valuable stands behind it. The law of chess enforces an **absolute pin**, where the piece behind is the king and moving away is illegal. A **relative pin** is enforced only by good sense: the piece may move, at the cost of what it was shielding.

```board
fen: r1bqkbnr/ppp2ppp/2np4/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4
caption: The bishop pins the knight to the black king. Until that changes, the knight on c6 defends nothing.
arrows: b5e8
```

That last idea is the one to remember. A pinned piece looks like a defender, but it is one in appearance only. When you count attackers and defenders of a square, leave absolutely pinned pieces out of the sum.

## Attack What Cannot Run

A pinned piece cannot step away from an attack, so the natural reply is to attack it again, and with the cheapest unit you have. A pawn is ideal.

```board
fen: 4k3/ppp3pp/5p2/4b3/8/5P2/PPP3PP/4R1K1 w - - 0 1
caption: White to move. Taking on e5 with the rook only trades badly. There is a much stronger way to go after the bishop.
best: f3f4
arrows: e1e8 f3f4
```

The bishop is defended, so 1.Rxe5+ gives up a rook for a bishop. But the bishop cannot leave the e-file, and a bishop cannot move along a file at all. After f3-f4 the pawn takes it next move, and Black can only recapture a pawn in exchange for a whole piece.

## Reading the Pin Correctly

Before relying on a pin, check whether it is truly binding. Relative pins can be broken by a strong counter-threat, and many a game has been lost by the player who assumed a pinned knight could not move, only to meet a discovered attack or a mate threat instead. Absolute pins carry no such risk.

```puzzle
id: iIJ6X
prompt: Your queen is attacked. Look at what White's bishop on e2 is unable to do.
```

```puzzle
id: eHFhj
prompt: Bring the king out first, then look down the files.
```
