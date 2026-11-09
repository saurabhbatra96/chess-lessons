When two kings face each other with one empty square between them, the player who does *not* have to move holds the opposition. The other king must give way. That is the core of king and pawn play, and it is the first case of a more general idea, zugzwang, in which any move you make worsens your position.

```board
fen: 4k3/8/4K3/4P3/8/8/8/8 b - - 0 1
caption: With Black to move, White wins, since the black king must step aside. If it were White's move, the game would be drawn.
```

## Winning with King and Pawn

The defender's king tries to stand in front of the pawn. The attacker's king must get in front of its own pawn and win the opposition, since a pawn pushed too soon leads only to stalemate. Step through this example, then test yourself as White.

```line
side: w
start: 8/8/8/4k3/8/4K3/4P3/8 b - - 0 1
caption: White has the opposition, and keeps making progress with it
moves: 1...Kd5 2.Kf4 Ke6 3.Ke4 Kd6 4.Kf5 Ke7 5.Ke5 Kf7 6.Kd6 Kf6 7.e4 Kf7 8.e5 Ke8 9.Ke6 Kd8 10.Kf7 Kd7 11.e6+ Kd8 12.e7+ Kd7 13.e8=Q+
note: 2.Kf4 | The king goes around. It does not push the pawn.
note: 5.Ke5 | The king stands in front of its pawn.
note: 7.e4 | Only now does the pawn move, because the king has already cleared the way.
note: 10.Kf7 | The king shoulders Black out of the way, and the pawn has a clear run.
```

## Rook Pawns

There is one great exception to all this. A rook pawn cannot normally be won if the defending king reaches the corner, because White's king runs out of room and the result is stalemate.

```puzzle
id: pRO2s
```

```puzzle
id: x3PfB
```
