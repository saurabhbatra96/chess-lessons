The point values you learned as a beginner are averages. A knight planted on a protected square deep in enemy territory can be worth more than a rook that is stuck behind its own pawns. What a piece is worth depends on how many useful squares it can reach.

```board
fen: 6k1/5ppp/8/4N3/n7/8/5PPP/6K1 w - - 0 1
caption: The same piece, two very different jobs. The white knight reaches eight squares. The black knight on the rim reaches only four.
```

So before you make any quiet move, compare the pieces on each side, and ask which ones are doing the least. Then try to improve them. Knights want central outposts, bishops want open diagonals, and rooks want open files.

## Active Rooks

The same applies with very few pieces left. In the ending below White could defend passively, but the rook is far more useful on the seventh rank, where it ties Black down and attacks the pawns.

```choice
fen: r5k1/5ppp/p7/8/8/P7/5PPP/3R2K1 w - - 0 1
question: Each side has a rook and the same pawns. Which rook move makes the most of White's position?
answer: d1d7
option: d1d7 | The rook takes the seventh rank, restricting the king and attacking the pawns from the side. Activity counts for a great deal in rook endings.
option: d1a1 | The rook goes to defend a pawn that is not attacked. It gives up the open file and becomes passive.
option: d1e1 | The rook leaves the d-file for no reason, and the black rook is allowed to take it.
```

Remember the rule of thumb. If a piece is doing nothing, move it. If it is doing something, ask whether another square would let it do more.
