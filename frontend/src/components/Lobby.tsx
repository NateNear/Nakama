import React, { useState } from 'react';
import { GameMode, PlayerStats } from '../types';

interface LobbyProps {
  username: string;
  myStats: PlayerStats | null;
  matchId: string | null;
  onCreateMatch: (timerMode: boolean) => Promise<string>;
  onJoinById: (matchId: string) => Promise<void>;
  onQuickMatch: (timerMode: boolean) => Promise<void>;
  onLeaderboard: () => void;
  onLogout: () => void;
  error: string | null;
}

const Lobby: React.FC<LobbyProps> = ({
  username,
  myStats,
  matchId,
  onCreateMatch,
  onJoinById,
  onQuickMatch,
  onLeaderboard,
  onLogout,
  error,
}) => {
  const [gameMode, setGameMode] = useState<GameMode>('classic');
  const [joinInput, setJoinInput] = useState('');
  const [loading, setLoading] = useState<string | null>(null);
  const [createdMatchId, setCreatedMatchId] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const timerMode = gameMode === 'timed';

  const handle = async (label: string, fn: () => Promise<any>) => {
    setLoading(label);
    setLocalError(null);
    setCreatedMatchId(null);
    try {
      await fn();
    } catch (e: any) {
      setLocalError(e.message || 'Something went wrong');
    } finally {
      setLoading(null);
    }
  };

  const handleCreate = () =>
    handle('create', async () => {
      const id = await onCreateMatch(timerMode);
      setCreatedMatchId(id);
    });

  const handleJoin = () => {
    const id = joinInput.trim();
    if (!id) { setLocalError('Please enter a match ID'); return; }
    handle('join', () => onJoinById(id));
  };

  const handleQuick = () => handle('quick', () => onQuickMatch(timerMode));

  const displayError = localError || error;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm space-y-5">

        {/* Header */}
        <div className="text-center">
          <div className="text-5xl mb-2">✕ ○</div>
          <h1 className="text-3xl font-bold text-gray-800">Tic-Tac-Toe</h1>
          <p className="text-sm text-gray-500 mt-1">Multiplayer · Real-time</p>
        </div>

        {/* Player info */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold text-lg">
                {username[0]?.toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-gray-800">{username}</p>
                {myStats && (
                  <p className="text-xs text-gray-500">
                    {myStats.wins}W · {myStats.losses}L · {myStats.draws}D
                    {myStats.currentStreak > 1 && ` · 🔥${myStats.currentStreak}`}
                  </p>
                )}
              </div>
            </div>
            <button onClick={onLogout} className="text-xs text-gray-400 hover:text-red-500 transition-colors">
              Sign out
            </button>
          </div>
        </div>

        {/* Game Mode Toggle */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Game Mode</p>
          <div className="flex rounded-xl overflow-hidden border border-gray-200">
            {(['classic', 'timed'] as GameMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setGameMode(mode)}
                className={`flex-1 py-2.5 text-sm font-semibold transition-all ${
                  gameMode === mode
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {mode === 'classic' ? '♟ Classic' : '⏱ Timed (30s)'}
              </button>
            ))}
          </div>
          {gameMode === 'timed' && (
            <p className="text-xs text-gray-400 mt-2 text-center">
              Auto-forfeit if no move in 30 seconds
            </p>
          )}
        </div>

        {/* Quick Match */}
        <button
          onClick={handleQuick}
          disabled={!!loading}
          className="w-full bg-indigo-600 text-white font-bold py-4 rounded-2xl shadow-lg hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2 text-lg"
        >
          {loading === 'quick' ? (
            <span className="flex items-center gap-2">
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Finding match...
            </span>
          ) : '⚡ Quick Match'}
        </button>

        {/* Create Room */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Create Private Room</p>
          <button
            onClick={handleCreate}
            disabled={!!loading}
            className="w-full bg-white text-indigo-600 font-semibold py-3 rounded-xl border-2 border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50 active:scale-95 transition-all disabled:opacity-60"
          >
            {loading === 'create' ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                Creating...
              </span>
            ) : '+ Create Room'}
          </button>

          {createdMatchId && (
            <div className="bg-indigo-50 rounded-xl p-3 space-y-2">
              <p className="text-xs font-semibold text-indigo-700">Room created! Share this ID:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-white rounded-lg px-3 py-2 border border-indigo-200 text-indigo-800 font-mono truncate">
                  {createdMatchId}
                </code>
                <button
                  onClick={() => navigator.clipboard?.writeText(createdMatchId)}
                  className="text-xs text-indigo-500 hover:text-indigo-700 font-medium whitespace-nowrap"
                >
                  Copy
                </button>
              </div>
              <p className="text-xs text-indigo-400">Waiting for opponent in match...</p>
            </div>
          )}
        </div>

        {/* Join by ID */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Join by Room ID</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={joinInput}
              onChange={e => setJoinInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
              placeholder="Paste match ID..."
              className="flex-1 px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200"
            />
            <button
              onClick={handleJoin}
              disabled={!!loading}
              className="px-4 py-2.5 bg-gray-800 text-white text-sm font-semibold rounded-xl hover:bg-gray-700 active:scale-95 transition-all disabled:opacity-60"
            >
              {loading === 'join' ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
              ) : 'Join'}
            </button>
          </div>
        </div>

        {/* Error */}
        {displayError && (
          <div className="bg-red-50 text-red-600 text-sm rounded-xl p-3 border border-red-200 text-center">
            {displayError}
          </div>
        )}

        {/* Leaderboard */}
        <button
          onClick={onLeaderboard}
          className="w-full text-gray-500 font-medium py-2 text-sm hover:text-indigo-600 transition-colors"
        >
          🏆 View Leaderboard
        </button>
      </div>
    </div>
  );
};

export default Lobby;
