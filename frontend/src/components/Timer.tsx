import React from 'react';

interface TimerProps {
  timeLeft: number;
  isMyTurn: boolean;
  totalTime?: number;
}

const Timer: React.FC<TimerProps> = ({ timeLeft, isMyTurn, totalTime = 30 }) => {
  const percentage = Math.max(0, (timeLeft / totalTime) * 100);
  const isUrgent = timeLeft <= 10;
  const isCritical = timeLeft <= 5;

  const barColor = isCritical
    ? 'bg-red-500'
    : isUrgent
    ? 'bg-orange-400'
    : 'bg-green-400';

  const textColor = isCritical
    ? 'text-red-600'
    : isUrgent
    ? 'text-orange-500'
    : 'text-gray-600';

  return (
    <div className="w-full max-w-xs mx-auto">
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-gray-500 font-medium">
          {isMyTurn ? 'Your turn' : "Opponent's turn"}
        </span>
        <span className={`text-sm font-bold tabular-nums ${textColor} ${isCritical ? 'animate-pulse' : ''}`}>
          {timeLeft}s
        </span>
      </div>
      <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ease-linear ${barColor}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

export default Timer;
