import { useState, useEffect, useRef, useCallback } from 'react';
import { Client, Session, Socket } from '@heroiclabs/nakama-js';
import { GameState, GameOverData, PlayerStats, LeaderboardEntry, OpCode } from '../types';

const NAKAMA_HOST = process.env.REACT_APP_NAKAMA_HOST || 'localhost';
const NAKAMA_PORT = process.env.REACT_APP_NAKAMA_PORT || '7350';
const NAKAMA_USE_SSL = process.env.REACT_APP_NAKAMA_SSL === 'true';
const SERVER_KEY = process.env.REACT_APP_SERVER_KEY || 'defaultkey';

export interface NakamaHook {
  client: Client | null;
  session: Session | null;
  socket: Socket | null;
  isConnected: boolean;
  isInMatch: boolean;
  matchId: string | null;
  gameState: GameState | null;
  gameOver: GameOverData | null;
  waitingMessage: string | null;
  timeLeft: number;
  myStats: PlayerStats | null;
  error: string | null;

  login: (username: string) => Promise<void>;
  logout: () => void;
  createMatch: (timerMode: boolean) => Promise<string>;
  joinMatchById: (matchId: string) => Promise<void>;
  findOrCreateMatch: (timerMode: boolean) => Promise<void>;
  sendMove: (position: number) => void;
  leaveMatch: () => Promise<void>;
  getLeaderboard: () => Promise<LeaderboardEntry[]>;
  refreshMyStats: () => Promise<void>;
}

export function useNakama(): NakamaHook {
  const clientRef = useRef<Client | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const matchIdRef = useRef<string | null>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [isInMatch, setIsInMatch] = useState(false);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [gameOver, setGameOver] = useState<GameOverData | null>(null);
  const [waitingMessage, setWaitingMessage] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(30);
  const [myStats, setMyStats] = useState<PlayerStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Initialize Nakama client
  useEffect(() => {
    clientRef.current = new Client(SERVER_KEY, NAKAMA_HOST, NAKAMA_PORT, NAKAMA_USE_SSL);
    return () => {
      socketRef.current?.disconnect(false);
    };
  }, []);

  const setupSocket = useCallback((session: Session): Socket => {
    const socket = clientRef.current!.createSocket(NAKAMA_USE_SSL, false);

    socket.ondisconnect = () => {
      setIsConnected(false);
      setIsInMatch(false);
      setError('Disconnected from server. Please refresh.');
    };

    socket.onerror = (evt) => {
      console.error('Socket error:', evt);
      setError('Connection error occurred.');
    };

    socket.onmatchdata = (matchData) => {
      const opCode = matchData.op_code;
      let data: any = {};
      try {
        if (matchData.data) {
          const raw = matchData.data instanceof Uint8Array
            ? new TextDecoder().decode(matchData.data)
            : String(matchData.data);
          data = JSON.parse(raw);
        }
      } catch (e) {
        console.error('Failed to parse match data:', e);
        return;
      }

      switch (opCode) {
        case OpCode.GAME_STATE:
          setGameState(data as GameState);
          setWaitingMessage(null);
          if (data.timerMode) setTimeLeft(data.timeLeft ?? 30);
          break;

        case OpCode.GAME_OVER:
          setGameOver(data as GameOverData);
          setIsInMatch(false);
          break;

        case OpCode.PLAYER_JOINED:
          setWaitingMessage(data.message || 'Waiting for opponent...');
          break;

        case OpCode.TIMER_UPDATE:
          setTimeLeft(data.timeLeft ?? 30);
          break;

        case OpCode.ERROR:
          setError(data.message || 'An error occurred');
          setTimeout(() => setError(null), 3000);
          break;

        default:
          console.warn('Unknown opcode:', opCode);
      }
    };

    socket.onmatchpresence = (presence) => {
      console.log('Match presence update:', presence);
    };

    return socket;
  }, []);

  const login = useCallback(async (username: string) => {
    setError(null);
    try {
      const client = clientRef.current!;

      // Use device ID stored in localStorage for persistence
      let deviceId = localStorage.getItem('nakama_device_id');
      if (!deviceId) {
        deviceId = `device-${Math.random().toString(36).substring(2)}`;
        localStorage.setItem('nakama_device_id', deviceId);
      }

      // Authenticate with device ID and set display name
      const session = await client.authenticateDevice(deviceId, true, username);
      sessionRef.current = session;

      // Update display name via account update
      await client.updateAccount(session, { displayName: username });

      // Connect socket
      const socket = setupSocket(session);
      await socket.connect(session, true);
      socketRef.current = socket;

      setIsConnected(true);
      localStorage.setItem('nakama_username', username);

      // Load stats
      await refreshMyStatsInternal(client, session);
    } catch (e: any) {
      setError(e.message || 'Login failed');
      throw e;
    }
  }, [setupSocket]);

  const logout = useCallback(() => {
    socketRef.current?.disconnect(false);
    sessionRef.current = null;
    socketRef.current = null;
    matchIdRef.current = null;
    setIsConnected(false);
    setIsInMatch(false);
    setMatchId(null);
    setGameState(null);
    setGameOver(null);
  }, []);

  const refreshMyStatsInternal = async (client: Client, session: Session) => {
    try {
      const result = await client.rpcGet(session, 'get_my_stats', '');
      const stats = JSON.parse(result.payload || '{}');
      setMyStats(stats);
    } catch (e) {
      console.error('Failed to load stats:', e);
    }
  };

  const refreshMyStats = useCallback(async () => {
    if (!clientRef.current || !sessionRef.current) return;
    await refreshMyStatsInternal(clientRef.current, sessionRef.current);
  }, []);

  const joinMatchById = useCallback(async (id: string) => {
    if (!socketRef.current) throw new Error('Not connected');
    setError(null);
    setGameOver(null);
    setGameState(null);
    setWaitingMessage(null);

    try {
      await socketRef.current.joinMatch(id);
      matchIdRef.current = id;
      setMatchId(id);
      setIsInMatch(true);
    } catch (e: any) {
      setError(e.message || 'Failed to join match');
      throw e;
    }
  }, []);

  const createMatch = useCallback(async (timerMode: boolean): Promise<string> => {
    if (!clientRef.current || !sessionRef.current) throw new Error('Not connected');
    setError(null);

    const result = await clientRef.current.rpcGet(
      sessionRef.current,
      'create_match',
      JSON.stringify({ timerMode })
    );
    const { matchId: newMatchId } = JSON.parse(result.payload || '{}');
    if (!newMatchId) throw new Error('Failed to create match');

    await joinMatchById(newMatchId);
    return newMatchId;
  }, [joinMatchById]);

  const findOrCreateMatch = useCallback(async (timerMode: boolean) => {
    if (!clientRef.current || !sessionRef.current) throw new Error('Not connected');
    setError(null);

    const result = await clientRef.current.rpcGet(
      sessionRef.current,
      'find_or_create_match',
      JSON.stringify({ timerMode })
    );
    const { matchId: newMatchId } = JSON.parse(result.payload || '{}');
    if (!newMatchId) throw new Error('Matchmaking failed');

    await joinMatchById(newMatchId);
  }, [joinMatchById]);

  const sendMove = useCallback((position: number) => {
    if (!socketRef.current || !matchIdRef.current) return;
    socketRef.current.sendMatchState(
      matchIdRef.current,
      OpCode.MOVE,
      JSON.stringify({ position })
    );
  }, []);

  const leaveMatch = useCallback(async () => {
    if (!socketRef.current || !matchIdRef.current) return;
    try {
      await socketRef.current.leaveMatch(matchIdRef.current);
    } catch (_e) {}
    matchIdRef.current = null;
    setMatchId(null);
    setIsInMatch(false);
    setGameState(null);
    setGameOver(null);
    setWaitingMessage(null);
    await refreshMyStats();
  }, [refreshMyStats]);

  const getLeaderboard = useCallback(async (): Promise<LeaderboardEntry[]> => {
    if (!clientRef.current || !sessionRef.current) return [];
    try {
      const result = await clientRef.current.rpcGet(sessionRef.current, 'get_leaderboard', '');
      const { records } = JSON.parse(result.payload || '{"records":[]}');
      return records || [];
    } catch (e) {
      console.error('getLeaderboard error:', e);
      return [];
    }
  }, []);

  return {
    client: clientRef.current,
    session: sessionRef.current,
    socket: socketRef.current,
    isConnected,
    isInMatch,
    matchId,
    gameState,
    gameOver,
    waitingMessage,
    timeLeft,
    myStats,
    error,
    login,
    logout,
    createMatch,
    joinMatchById,
    findOrCreateMatch,
    sendMove,
    leaveMatch,
    getLeaderboard,
    refreshMyStats,
  };
}
