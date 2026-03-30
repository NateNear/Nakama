import React, { useState, useCallback } from 'react';
import { useNakama } from './hooks/useNakama';
import { Screen } from './types';
import Lobby from './components/Lobby';
import Game from './components/Game';
import Leaderboard from './components/Leaderboard';

// ─── Auth Screen ──────────────────────────────────────────────────────────────
const AuthScreen: React.FC<{
  onLogin: (username: string) => Promise<void>;
  error: string | null;
}> = ({ onLogin, error }) => {
  const [username, setUsername] = useState(localStorage.getItem('nakama_username') || '');
  const [loading, setLoading] = useState(false);
  const [localErr, setLocalErr] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = username.trim();
    if (!trimmed) { setLocalErr('Username is required'); return; }
    if (trimmed.length < 2) { setLocalErr('Minimum 2 characters'); return; }
    setLocalErr(null);
    setLoading(true);
    try {
      await onLogin(trimmed);
    } catch (_e) {
      // Error shown via prop
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-xs space-y-6">
        <div className="text-center">
          <div className="text-6xl mb-3">✕ ○</div>
          <h1 className="text-3xl font-bold text-gray-800">Tic-Tac-Toe</h1>
          <p className="text-gray-500 text-sm mt-1">Real-time multiplayer</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Display Name
            </label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Enter your name..."
              maxLength={24}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 text-gray-800"
              autoFocus
            />
          </div>

          {(localErr || error) && (
            <p className="text-sm text-red-500 bg-red-50 rounded-lg p-2 border border-red-100">
              {localErr || error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Connecting...
              </>
            ) : 'Play Now →'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400">
          Your progress is saved automatically
        </p>
      </div>
    </div>
  );
};

// ─── App ──────────────────────────────────────────────────────────────────────
const App: React.FC = () => {
  const nakama = useNakama();
  const [screen, setScreen] = useState<Screen>('auth');

  const handleLogin = useCallback(async (username: string) => {
    await nakama.login(username);
    setScreen('lobby');
  }, [nakama]);

  const handleLogout = useCallback(() => {
    nakama.logout();
    setScreen('auth');
  }, [nakama]);

  const handleCreateMatch = useCallback(async (timerMode: boolean) => {
    const id = await nakama.createMatch(timerMode);
    setScreen('game');
    return id;
  }, [nakama]);

  const handleJoinById = useCallback(async (matchId: string) => {
    await nakama.joinMatchById(matchId);
    setScreen('game');
  }, [nakama]);

  const handleQuickMatch = useCallback(async (timerMode: boolean) => {
    await nakama.findOrCreateMatch(timerMode);
    setScreen('game');
  }, [nakama]);

  const handleLeaveMatch = useCallback(async () => {
    await nakama.leaveMatch();
    await nakama.refreshMyStats();
    setScreen('lobby');
  }, [nakama]);

  const handlePlayAgain = useCallback(() => {
    nakama.leaveMatch();
    setScreen('lobby');
  }, [nakama]);

  const userId = (nakama.session as any)?.user_id ?? '';

  switch (screen) {
    case 'auth':
      return <AuthScreen onLogin={handleLogin} error={nakama.error} />;

    case 'lobby':
      return (
        <Lobby
          username={(nakama.session as any)?.username ?? 'Player'}
          myStats={nakama.myStats}
          matchId={nakama.matchId}
          onCreateMatch={handleCreateMatch}
          onJoinById={handleJoinById}
          onQuickMatch={handleQuickMatch}
          onLeaderboard={() => setScreen('leaderboard')}
          onLogout={handleLogout}
          error={nakama.error}
        />
      );

    case 'game':
      return (
        <Game
          gameState={nakama.gameState}
          gameOver={nakama.gameOver}
          waitingMessage={nakama.waitingMessage}
          matchId={nakama.matchId}
          timeLeft={nakama.timeLeft}
          myUserId={userId}
          myStats={nakama.myStats}
          onMove={nakama.sendMove}
          onLeave={handleLeaveMatch}
          onPlayAgain={handlePlayAgain}
        />
      );

    case 'leaderboard':
      return (
        <Leaderboard
          myUserId={userId}
          getLeaderboard={nakama.getLeaderboard}
          onBack={() => setScreen('lobby')}
        />
      );

    default:
      return null;
  }
};

export default App;
