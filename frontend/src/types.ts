// Shared type definitions for the Tic-Tac-Toe frontend

export interface PlayerInfo {
  userId: string;
  username: string;
  symbol: 'X' | 'O';
}

export interface GameState {
  board: string[];           // 9 cells: '' | 'X' | 'O'
  players: { [userId: string]: PlayerInfo };
  playerOrder: string[];     // [xUserId, oUserId]
  currentTurnUserId: string | null;
  timerMode: boolean;
  timeLeft: number;
  gameStarted: boolean;
}

export interface GameOverData {
  winner: string | null;     // userId or null
  winnerUsername?: string;
  isDraw: boolean;
  reason: 'win' | 'draw' | 'timeout' | 'opponent_disconnected';
  board: string[];
  players: { [userId: string]: PlayerInfo };
}

export interface PlayerStats {
  wins: number;
  losses: number;
  draws: number;
  currentStreak: number;
  maxStreak: number;
}

export interface LeaderboardEntry {
  rank: number;
  username: string;
  wins: number;
  maxStreak: number;
  ownerId: string;
}

export type Screen = 'auth' | 'lobby' | 'game' | 'leaderboard';

export type GameMode = 'classic' | 'timed';

export const OpCode = {
  MOVE: 1,
  GAME_STATE: 2,
  GAME_OVER: 3,
  PLAYER_JOINED: 4,
  TIMER_UPDATE: 5,
  ERROR: 6,
} as const;
