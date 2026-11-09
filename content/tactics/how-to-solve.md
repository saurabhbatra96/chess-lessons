Most missed tactics are not too deep to calculate. They are simply never looked at. A player returning to the game after some time away usually finds that the understanding has survived and the habits have not, and the habit that fades first is the plain, boring inventory of what is possible on the board.

Before you choose a move, go through the forcing moves in order: **checks, captures, threats**. List every check, even the absurd ones. Then every capture. Then every move that threatens something large. It takes seconds, and it is the difference between finding a combination and admiring it afterwards in the post-mortem.

```board
fen: r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4
caption: White to move. The first check on the list is also a capture, and it ends the game.
best: h5f7
arrows: h5f7
```

A position like this is why the list begins with checks. Black developed a knight and attacked the queen, and overlooked that f7 was guarded only by the king.

## The Question Most Players Skip

The inventory finds your chances. A second inventory protects you from your own good ideas. Having chosen a move, picture the board after it, and run the same list **for your opponent**: what checks, captures and threats do they now have?

```board
fen: 4r1k1/pQ3ppp/8/4q3/8/8/5PPP/3R2K1 w - - 0 1
caption: White to move. The a-pawn is free for the taking. Run the list for Black first.
avoid: b7a7
best: h2h3 g2g3
```

Taking on a7 looks like simple profit. But Black answers with ...Qe1+, and after Rxe1 Rxe1 the white king is mated behind its own pawns. One quiet pawn move removes the whole problem. The free pawn was never free.

## How to Use the Puzzles

Treat each puzzle as a real game position. Do not move until you have seen the line through to the end, including your opponent's best reply. Only your first attempt counts toward your rating, and anything you miss returns on the review desk after one, three and seven days.

```puzzle
id: cgozN
prompt: Begin with the checks.
```

```puzzle
id: jOx16
prompt: What can no longer escape?
```
