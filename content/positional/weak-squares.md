Pawns can only move forward, so every pawn move gives up control of some squares forever. A square that no enemy pawn can ever attack is a permanent weakness, and when one of your pieces settles on it, the piece is called an outpost.

Knights make the best tenants. A knight on a protected central outpost cannot be chased away by pawns and has to be exchanged at some cost. Look at the pawn structure before you decide where your knights belong.

```board
fen: 2r2rk1/pp2bppp/3p4/3Np3/4P3/5P2/PPP3PP/2KR3R b - - 0 1
caption: With the pawns on d6 and e5, Black can never guard d5 with a pawn. White's knight sits there for the rest of the game.
```

## Creating and Using Them

Your own pawn moves create weaknesses as well, so think before pushing any pawn in front of your king or in your centre. Every ...e5 or ...h6 is a commitment.

```choice
fen: 2r2rk1/pp2bp1p/3p2p1/4p3/4P3/4NP2/PPP3PP/2KR3R w - - 0 1
question: Black's pawns on d6 and e5 have left a hole on d5. Where does the knight belong?
answer: e3d5
option: e3d5 | The knight takes up its outpost. No black pawn can ever attack this square, so Black will have to give up a piece to remove it.
option: e3f5 | This square is not an outpost, because a pawn guards it. Black simply takes with the g-pawn and wins the knight.
option: e3g4 | The knight leaves the centre for a square where ...h5 or ...f5 will chase it away at once.
```

When you have an outpost, ask whether a knight or some other piece should occupy it. The best occupant is usually the piece that otherwise has least to do.
