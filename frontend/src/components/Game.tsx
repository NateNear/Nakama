import React, { useCallback } from 'react';
import Board from './Board';
import Timer from './Timer';
import { GameState, GameOverData, PlayerStats } from '../types';

interface GameProps {
  gameState: GameState | null;
  gameOver: GameOverData | null;
  waitingMessage: string | null;
  matchId: string | null;
  timeLeft: number;
  myUserId: string;
  myStats: PlayerStats | null;
  onMove: (position: number) => void;
  onLeave: () => void;
  onPlayAgain: () => void;
}

const Game: React.FC<GameProps> = ({
  gameState,
  gameOver,
  waitingMessage,
  matchId,
  timeLeft,
  myUserId,
  myStats,
  onMove,
  onLeave,
  onPlayAgain,
}) => {
  const mySymbol = gameState?.players[myUserId]?.symbol;
  const isMyTurn = gameState?.currentTurnUserId === myUserId;
  const opponent = gameState
    ? Object.values(gameState.players).find(p => p.userId !== myUserId)
    : null;

  const getStatusMessage = useCallback(() => {
    if (gameOver) {
      if (gameOver.isDraw) return "It's a draw!";
      if (gameOver.winner === myUserId) return 'You win!';
      const reason = gameOver.reason === 'timeout' ? ' (timeout)' :
                     gameOver.reason === 'opponent_disconnected' ? ' (opponent left)' : '';
      return `${gameOver.winnerUsername ?? 'Opponent'} wins${reason}`;
    }
    if (waitingMessage) return waitingMessage;
    if (!gameState?.gameStarted) return 'Connecting...';
    return isMyTurn ? 'Your turn' : `${opponent?.username ?? 'Opponent'}'s turn`;
  }, [gameOver, waitingMessage, gameState, isMyTurn, opponent, myUserId]);

  const statusMsg = getStatusMessage();
  const isWinner = gameOver?.winner === myUserId;
  const isLoser = gameOver && !gameOver.isDraw && gameOver.winner !== myUserId && gameOver.winner !== null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex flex-col items-center justify-center px-4 py-6">
      <div className="w-full max-w-sm space-y-4">

        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800">Tic-Tac-Toe</h1>
          {matchId && (
            <div className="mt-1 flex items-center justify-center gap-2">
              <span className="text-xs text-gray-400">Room:</span>
              <code className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-600 truncate max-w-[180px]">
                {matchId.slice(0, 8)}...
              </code>
              <button
                onClick={() => navigator.clipboard?.writeText(matchId)}
                className="text-xs text-indigo-500 hover:underline"
                title="Copy full ID"
              >
                Copy
              </button>
            </div>
          )}
        </div>

        {/* Player Cards */}
        {gameState?.gameStarted && (
          <div className="flex gap-2">
            {gameState.playerOrder.map((uid) => {
              const player = gameState.players[uid];
              const isMe = uid === myUserId;
              const isActive = gameState.currentTurnUserId === uid && !gameOver;
              return (
                <div
                  key={uid}
                  className={`flex-1 rounded-xl p-3 border-2 transition-all duration-200 ${
                    isActive
                      ? 'border-indigo-400 bg-indigo-50 shadow-md'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`text-2xl font-bold ${player.symbol === 'X' ? 'text-blue-500' : 'text-red-500'}`}>
                      {player.symbol}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">
                        {isMe ? 'You' : player.username}
                      </p>
                      <p className="text-xs text-gray-400 truncate">{player.username}</p>
                    </div>
                  </div>
                  {isActive && <div className="mt-1 h-1 bg-indigo-400 rounded-full animate-pulse" />}
                </div>
              );
            })}
          </div>
        )}

        {/* Timer */}
        {gameState?.timerMode && gameState.gameStarted && !gameOver && (
          <Timer timeLeft={timeLeft} isMyTurn={!!isMyTurn} />
        )}

        {/* Status Banner */}
        <div className={`rounded-xl py-3 px-4 text-center font-semibold text-sm transition-all ${
          isWinner
            ? 'bg-green-100 text-green-700 border border-green-300'
            : isLoser
            ? 'bg-red-50 text-red-600 border border-red-200'
            : gameOver?.isDraw
            ? 'bg-yellow-50 text-yellow-700 border border-yellow-200'
            : isMyTurn
            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
            : 'bg-gray-50 text-gray-600 border border-gray-200'
        }`}>
          {isWinner && '🎉 '}
          {isLoser && '😞 '}
          {gameOver?.isDraw && '🤝 '}
          {statusMsg}
        </div>

        {/* Game Board */}
        {(gameState?.gameStarted || gameOver) && (
          <Board
            board={gameOver?.board ?? gameState?.board ?? Array(9).fill('')}
            isMyTurn={!!isMyTurn && !gameOver}
            gameOver={!!gameOver}
            onMove={onMove}
          />
        )}

        {/* Waiting spinner */}
        {waitingMessage && !gameState?.gameStarted && (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="w-10 h-10 border-4 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
            <p className="text-gray-500 text-sm">{waitingMessage}</p>
          </div>
        )}

        {/* Post-game stats */}
        {gameOver && myStats && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Your Stats</h3>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-xl font-bold text-green-600">{myStats.wins}</p>
                <p className="text-xs text-gray-500">Wins</p>
              </div>
              <div>
                <p className="text-xl font-bold text-red-500">{myStats.losses}</p>
                <p className="text-xs text-gray-500">Losses</p>
              </div>
              <div>
                <p className="text-xl font-bold text-yellow-500">{myStats.draws}</p>
                <p className="text-xs text-gray-500">Draws</p>
              </div>
            </div>
            {myStats.currentStreak > 1 && (
              <p className="text-center text-xs text-orange-500 font-semibold mt-2">
                🔥 {myStats.currentStreak}-game win streak!
              </p>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          {gameOver && (
            <button
              onClick={onPlayAgain}
              className="flex-1 bg-indigo-600 text-white font-semibold py-3 rounded-xl hover:bg-indigo-700 active:scale-95 transition-all"
            >
              Play Again
            </button>
          )}
          <button
            onClick={onLeave}
            className={`${gameOver ? 'flex-1' : 'w-full'} bg-white text-gray-600 font-semibold py-3 rounded-xl border border-gray-300 hover:bg-gray-50 active:scale-95 transition-all`}
          >
            {gameOver ? 'Back to Lobby' : 'Leave Match'}
          </button>
        </div>

      </div>
    </div>
  );
};

export default Game;
