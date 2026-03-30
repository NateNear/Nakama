import React from 'react';

interface CellProps {
  value: string;
  index: number;
  isMyTurn: boolean;
  disabled: boolean;
  isWinningCell: boolean;
  onClick: (index: number) => void;
}

const Cell: React.FC<CellProps> = ({ value, index, isMyTurn, disabled, isWinningCell, onClick }) => {
  const isEmpty = value === '';
  const canClick = isEmpty && isMyTurn && !disabled;

  const baseClasses =
    'relative flex items-center justify-center text-4xl sm:text-5xl font-bold rounded-xl transition-all duration-200 select-none aspect-square';

  const stateClasses = isWinningCell
    ? 'bg-yellow-100 border-2 border-yellow-400 scale-105'
    : value === 'X'
    ? 'bg-blue-50 border-2 border-blue-200'
    : value === 'O'
    ? 'bg-red-50 border-2 border-red-200'
    : canClick
    ? 'bg-white border-2 border-gray-200 hover:border-indigo-400 hover:bg-indigo-50 cursor-pointer hover:scale-105'
    : 'bg-white border-2 border-gray-200';

  const symbolColor =
    value === 'X' ? 'text-blue-500' : value === 'O' ? 'text-red-500' : '';

  return (
    <button
      className={`${baseClasses} ${stateClasses}`}
      onClick={() => canClick && onClick(index)}
      disabled={!canClick}
      aria-label={`Cell ${index + 1}: ${value || 'empty'}`}
    >
      {value && (
        <span className={`${symbolColor} drop-shadow-sm`}>{value}</span>
      )}
      {!value && isMyTurn && !disabled && (
        <span className="absolute inset-0 flex items-center justify-center text-gray-200 text-4xl opacity-0 hover:opacity-100 transition-opacity">
          ·
        </span>
      )}
    </button>
  );
};

export default Cell;
