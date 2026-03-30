import React, { useMemo } from 'react';
import Cell from './Cell';

interface BoardProps {
  board: string[];
  isMyTurn: boolean;
  gameOver: boolean;
  onMove: (position: number) => void;
}

const WINNING_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

const Board: React.FC<BoardProps> = ({ board, isMyTurn, gameOver, onMove }) => {
  const winningCells = useMemo(() => {
    for (const [a, b, c] of WINNING_LINES) {
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return new Set([a, b, c]);
      }
    }
    return new Set<number>();
  }, [board]);

  return (
    <div className="grid grid-cols-3 gap-3 w-full max-w-xs sm:max-w-sm mx-auto">
      {board.map((cell, index) => (
        <Cell
          key={index}
          value={cell}
          index={index}
          isMyTurn={isMyTurn}
          disabled={gameOver}
          isWinningCell={winningCells.has(index)}
          onClick={onMove}
        />
      ))}
    </div>
  );
};

export default Board;
