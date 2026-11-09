Move one piece out of the way and the piece behind it begins to attack. That is a discovered attack, and it is among the most powerful ideas in chess, for a simple reason: two pieces make threats, but only one of them spent a move doing it. The piece that moves is free to do anything it likes, and it may go anywhere with a threat of its own.

When the unmasked piece gives check, the piece that moved can attack whatever it pleases, since your opponent has no time to respond to it.

```board
fen: 4k3/2q2ppp/8/8/8/4N3/5PPP/4R1K1 w - - 0 1
caption: White to play. Any knight move uncovers check from the rook. Only one of them also hits the queen.
best: e3d5
arrows: e1e8 e3d5 d5c7
```

Blocking the check on the e-file only loses the queen in a different way, so the queen falls either way.

## Double Check

If the moved piece also gives check, that is double check, and it is the most forcing move in the game. Neither attacker can be captured or blocked in one move, so the king must walk. That is why double check can justify astonishing sacrifices.

```board
fen: rnb1kb1r/pp3ppp/2p5/4q3/4n3/3Q4/PPPB1PPP/2KR1BNR w kq - 0 9
caption: Réti v. Tartakower, Vienna 1910. White to play and mate in three, beginning with a queen sacrifice.
best: d3d8
arrows: d3d8
```

Réti played 9.Qd8+!! Kxd8 10.Bg5+, a double check from bishop and rook. After 10...Kc7 11.Bd8 is mate, and after 10...Ke8 11.Rd8 is mate. The white bishop had been waiting in front of the rook the whole time, loaded like a spring.

## Spotting Them

Whenever one of your pieces stands directly between another of your long-range pieces and something valuable, stop and look. Your own piece is the safety catch. Then ask where it would most like to go.

```puzzle
id: 668Xn
prompt: Your move. Which piece is standing in front of another?
```

```puzzle
id: c93hf
prompt: Your move. Two checks at once leave only one kind of reply.
```
