Many positions contain a target that would fall at once, if only one enemy piece were not guarding it. In these positions the guard is the real target. There are two ways to deal with it: capture it, or give it a more urgent job elsewhere.

## Capturing the Guard

Simple exchanges are rarely neutral. If the piece you trade off happens to be the only defender of something else, the exchange wins material.

```board
fen: 6k1/5ppp/5n2/3b2B1/8/8/5PPP/3R2K1 w - - 0 1
caption: White to move. The rook attacks the bishop, but the knight defends it. So deal with the knight.
best: g5f6
avoid: d1d5
arrows: g5f6 d1d5
```

Taking the bishop at once loses the rook to the knight. Taking the knight first changes everything: if Black recaptures with the g-pawn, the bishop on d5 no longer has a defender and the rook collects it. If the bishop runs instead, White is simply a knight ahead.

## Deflection

Sometimes the guard cannot be captured, but it can be forced to move. This is deflection: a check, a threat or an offer that drags the defender off its post. Look especially for pieces doing **two jobs at once**. A queen that guards both a rook and a mating square is overloaded, and asking it to do one job means abandoning the other.

Make this a routine question in any sharp position: for each enemy piece, what exactly is it defending? Whenever the answer is "more than one thing", you may have found your combination.

```puzzle
id: rVomM
prompt: What is holding Black's position together?
```

```puzzle
id: degWM
prompt: Black's last move looks like a simple trade.
```
