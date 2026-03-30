import React, { useEffect, useState } from 'react';
import { LeaderboardEntry } from '../types';

interface LeaderboardProps {
  myUserId: string;
  getLeaderboard: () => Promise<LeaderboardEntry[]>;
  onBack: () => void;
}

const Leaderboard: React.FC<LeaderboardProps> = ({ myUserId, getLeaderboard, onBack }) => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getLeaderboard()
      .then(setEntries)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [getLeaderboard]);

  const rankEmoji = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-sm space-y-4">

        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-gray-400 hover:text-gray-600 transition-colors">
            ← Back
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">🏆 Leaderboard</h1>
            <p className="text-xs text-gray-400">Top players by wins</p>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="py-8 text-center text-red-500 text-sm">{error}</div>
          ) : entries.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-gray-400">No records yet.</p>
              <p className="text-sm text-gray-300 mt-1">Play some games to appear here!</p>
            </div>
          ) : (
            <>
              {/* Column headers */}
              <div className="grid grid-cols-4 px-4 py-2 border-b border-gray-100 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                <span>Rank</span>
                <span className="col-span-2">Player</span>
                <span className="text-right">Wins</span>
              </div>
              {entries.map((entry) => {
                const isMe = entry.ownerId === myUserId;
                return (
                  <div
                    key={entry.ownerId}
                    className={`grid grid-cols-4 px-4 py-3 items-center border-b border-gray-50 last:border-0 ${
                      isMe ? 'bg-indigo-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <span className="text-lg font-bold text-gray-600">
                      {rankEmoji(entry.rank)}
                    </span>
                    <div className="col-span-2 min-w-0">
                      <p className={`font-semibold text-sm truncate ${isMe ? 'text-indigo-700' : 'text-gray-800'}`}>
                        {entry.username}
                        {isMe && <span className="ml-1 text-xs font-normal text-indigo-400">(you)</span>}
                      </p>
                      {entry.maxStreak > 1 && (
                        <p className="text-xs text-orange-400">🔥 Best: {entry.maxStreak}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-bold text-green-600">{entry.wins}</span>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Refresh */}
        <button
          onClick={() => {
            setLoading(true);
            getLeaderboard().then(setEntries).finally(() => setLoading(false));
          }}
          className="w-full text-gray-400 hover:text-indigo-600 text-sm font-medium py-2 transition-colors"
        >
          ↻ Refresh
        </button>
      </div>
    </div>
  );
};

export default Leaderboard;
