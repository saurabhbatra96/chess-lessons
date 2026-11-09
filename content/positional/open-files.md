A rook behind a closed file is little more than a spectator. Open files, which have no pawns on them, are the rook's roads into the enemy camp, and the prize at the end is the seventh rank, where the enemy pawns sit and the enemy king is confined.

## Taking the File

- **Get there first.** The first rook on an open file often keeps it.
- **Double your rooks.** Two rooks on a single file are much stronger than two rooks apart.
- **Look for an entry square.** An open file is only useful if it leads somewhere. Ask where your rook can land safely.

```choice
fen: r5k1/1p3ppp/p7/8/8/P4P2/1P4PP/3R2K1 w - - 0 1
question: White has the only rook on the open d-file. What should it do?
answer: d1d7
option: d1d7 | The rook lands on the seventh rank, attacking b7 and restricting the black king.
option: d1e1 | The rook leaves the open file without having used it, and Black can now take it.
option: d1a1 | The rook guards a pawn that nothing is attacking, and it has given up all its activity.
```

## Half-Open Files

A file with only an enemy pawn on it is half-open, and it gives your rook a target. Think of the d-file in the Carlsbad or the c-file in many Sicilians: the rook attacks along it, and every enemy piece needed to defend the pawn is a piece that is not doing something else.

```board
fen: 6k1/1R3ppp/8/8/8/8/5PPP/6K1 b - - 0 1
caption: A rook on the seventh confines the king to the back rank and attacks every pawn that stands there.
```
