import { Chess } from 'chess.js';
import { Board } from '../board/board';

export interface ChoiceOption {
  uci: string;
  text: string;
}

/** A position with a few candidate moves; picking one explains it. */
export function mountChoice(host: HTMLElement, fen: string, question: string, answer: string, options: ChoiceOption[]): void {
  const side = fen.split(' ')[1] as 'w' | 'b';
  const root = document.createElement('div');
  root.className = 'choice puzzle';
  root.dataset.side = side;
  const board = new Board();
  board.setOrientation(side);
  board.setPosition(fen);

  const status = document.createElement('p');
  status.className = 'puzzle__status';
  status.setAttribute('role', 'status');
  status.textContent = `${side === 'w' ? 'White' : 'Black'} to move.`;
  const prompt = document.createElement('p');
  prompt.className = 'puzzle__hint';
  prompt.textContent = question;
  const list = document.createElement('div');
  list.className = 'choice__options';
  const feedback = document.createElement('p');
  feedback.className = 'choice__feedback';

  const buttons = options.map((option) => {
    const san = new Chess(fen).move({
      from: option.uci.slice(0, 2),
      to: option.uci.slice(2, 4),
      promotion: option.uci[4],
    }).san;
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = san;
    button.addEventListener('click', () => {
      const right = option.uci === answer;
      for (const b of buttons) b.classList.remove('choice__option--picked');
      button.classList.add('choice__option--picked');
      button.dataset.result = right ? 'right' : 'wrong';
      board.setPosition(fen, null, [{ from: option.uci.slice(0, 2), to: option.uci.slice(2, 4) }]);
      status.textContent = right ? `${san} is the move.` : `${san} is not the best.`;
      status.dataset.tone = right ? 'right' : 'wrong';
      feedback.textContent = option.text;
    });
    return button;
  });
  list.append(...buttons);
  root.append(board.el, status, prompt, list, feedback);
  host.replaceChildren(root);
}
