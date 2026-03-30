// Nakama Server-Side TypeScript Module for Multiplayer Tic-Tac-Toe
// Server-authoritative game logic with matchmaking, leaderboard, and timer support

const LEADERBOARD_ID = 'tictactoe_wins';
const STORAGE_COLLECTION = 'player_stats';
const TIMER_DURATION_SECS = 30;
const TICK_RATE = 5; // ticks/second
const MATCH_MODULE = 'tictactoe';

// ─── Op-codes (client ↔ server) ──────────────────────────────────────────────
const OpCode = {
  MOVE: 1,          // Client → Server
  GAME_STATE: 2,    // Server → Client (full board state)
  GAME_OVER: 3,     // Server → Client
  PLAYER_JOINED: 4, // Server → Client (lobby update)
  TIMER_UPDATE: 5,  // Server → Client (every second, timer mode only)
  ERROR: 6,         // Server → Client
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface PlayerInfo {
  userId: string;
  username: string;
  symbol: string; // 'X' | 'O'
}

interface MatchState {
  board: string[];           // 9 elements: '' | 'X' | 'O'
  players: { [userId: string]: PlayerInfo };
  playerOrder: string[];     // [userId_X, userId_O]
  currentTurnIndex: number;  // 0 or 1 → index into playerOrder
  winner: string | null;     // userId | 'draw' | null
  gameStarted: boolean;
  timerMode: boolean;
  timeLeft: number;          // seconds
  lastTickMs: number;        // ms timestamp of last tick
  ticksSinceGameOver: number;
  label: string;
}

interface MoveMessage {
  position: number; // 0–8
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const WINNING_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
  [0, 4, 8], [2, 4, 6],             // diagonals
];

function checkResult(board: string[]): 'X' | 'O' | 'draw' | null {
  for (const [a, b, c] of WINNING_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a] as 'X' | 'O';
    }
  }
  if (board.every(cell => cell !== '')) return 'draw';
  return null;
}

function buildGameStateMsg(s: MatchState) {
  return JSON.stringify({
    board: s.board,
    players: s.players,
    playerOrder: s.playerOrder,
    currentTurnUserId: s.playerOrder[s.currentTurnIndex] ?? null,
    timerMode: s.timerMode,
    timeLeft: Math.ceil(s.timeLeft),
    gameStarted: s.gameStarted,
  });
}

function buildMatchLabel(s: MatchState): string {
  return JSON.stringify({
    timerMode: s.timerMode,
    label: s.label,
    players: s.playerOrder.length,
    started: s.gameStarted,
  });
}

function updatePlayerStats(
  nk: nkruntime.Nakama,
  logger: nkruntime.Logger,
  players: { [id: string]: PlayerInfo },
  playerOrder: string[],
  winnerId: string | null
) {
  for (const userId of playerOrder) {
    const isWinner = winnerId === userId;
    const isDraw = winnerId === null;

    // Update wins leaderboard (score = wins)
    if (isWinner) {
      try {
        nk.leaderboardRecordWrite(LEADERBOARD_ID, userId, players[userId].username, 1, 0, {});
      } catch (e) {
        logger.error('leaderboardRecordWrite error: %s', e);
      }
    }

    // Update detailed stats in storage
    try {
      const existing = nk.storageRead([{
        collection: STORAGE_COLLECTION,
        key: 'stats',
        userId,
      }]);

      let stats = { wins: 0, losses: 0, draws: 0, currentStreak: 0, maxStreak: 0 };
      if (existing.length > 0) {
        stats = JSON.parse((existing[0] as any).value || '{}');
      }

      if (isWinner) {
        stats.wins++;
        stats.currentStreak++;
        if (stats.currentStreak > stats.maxStreak) stats.maxStreak = stats.currentStreak;
      } else if (isDraw) {
        stats.draws++;
        stats.currentStreak = 0;
      } else {
        stats.losses++;
        stats.currentStreak = 0;
      }

      nk.storageWrite([{
        collection: STORAGE_COLLECTION,
        key: 'stats',
        userId,
        value: stats,
        permissionRead: 2,  // public read
        permissionWrite: 1, // owner write
      }]);

      // Update subscore on leaderboard to reflect max streak
      if (stats.wins > 0) {
        nk.leaderboardRecordWrite(LEADERBOARD_ID, userId, players[userId].username, 0, stats.maxStreak, {});
      }
    } catch (e) {
      logger.error('stats update error for %s: %s', userId, e);
    }
  }
}

// ─── Match lifecycle ──────────────────────────────────────────────────────────
const matchInit: nkruntime.MatchInitFunction = (_ctx, _logger, _nk, params) => {
  const timerMode = (params && params['timerMode'] === 'true');
  const label = (params && params['label']) ? params['label'] : 'classic';

  const state: MatchState = {
    board: ['', '', '', '', '', '', '', '', ''],
    players: {},
    playerOrder: [],
    currentTurnIndex: 0,
    winner: null,
    gameStarted: false,
    timerMode,
    timeLeft: TIMER_DURATION_SECS,
    lastTickMs: Date.now(),
    ticksSinceGameOver: 0,
    label,
  };

  return {
    state,
    tickRate: TICK_RATE,
    label: buildMatchLabel(state),
  };
};

const matchJoinAttempt: nkruntime.MatchJoinAttemptFunction = (
  _ctx, _logger, _nk, _dispatcher, _tick, state, _presence, _metadata
) => {
  const s = state as MatchState;
  if (s.gameStarted) {
    return { state: s, accept: false, rejectMessage: 'Game already in progress' };
  }
  if (s.playerOrder.length >= 2) {
    return { state: s, accept: false, rejectMessage: 'Match is full' };
  }
  return { state: s, accept: true };
};

const matchJoin: nkruntime.MatchJoinFunction = (
  _ctx, logger, _nk, dispatcher, _tick, state, presences
) => {
  const s = state as MatchState;

  for (const p of presences) {
    if (s.players[p.userId]) continue; // reconnect guard
    const symbol = s.playerOrder.length === 0 ? 'X' : 'O';
    s.players[p.userId] = { userId: p.userId, username: p.username, symbol };
    s.playerOrder.push(p.userId);
    logger.info('Player joined: %s as %s', p.username, symbol);
  }

  dispatcher.matchLabelUpdate(buildMatchLabel(s));

  if (s.playerOrder.length === 2) {
    s.gameStarted = true;
    s.lastTickMs = Date.now();
    dispatcher.broadcastMessage(OpCode.GAME_STATE, buildGameStateMsg(s));
    logger.info('Game started between %s and %s',
      s.players[s.playerOrder[0]].username,
      s.players[s.playerOrder[1]].username);
  } else {
    dispatcher.broadcastMessage(OpCode.PLAYER_JOINED, JSON.stringify({
      message: 'Waiting for opponent...',
      players: s.players,
    }));
  }

  return { state: s };
};

const matchLeave: nkruntime.MatchLeaveFunction = (
  _ctx, logger, nk, dispatcher, _tick, state, presences
) => {
  const s = state as MatchState;

  if (s.gameStarted && !s.winner) {
    for (const p of presences) {
      let remainingId: string | undefined;
      for (let i = 0; i < s.playerOrder.length; i++) {
        if (s.playerOrder[i] !== p.userId) { remainingId = s.playerOrder[i]; break; }
      }
      if (remainingId) {
        s.winner = remainingId;
        logger.info('%s disconnected; %s wins by forfeit', p.username, s.players[remainingId]?.username);
        dispatcher.broadcastMessage(OpCode.GAME_OVER, JSON.stringify({
          winner: remainingId,
          winnerUsername: s.players[remainingId]?.username,
          isDraw: false,
          reason: 'opponent_disconnected',
          board: s.board,
          players: s.players,
        }));
        updatePlayerStats(nk, logger, s.players, s.playerOrder, remainingId);
      }
    }
  }

  return { state: s };
};

const matchLoop: nkruntime.MatchLoopFunction = (
  _ctx, logger, nk, dispatcher, tick, state, messages
) => {
  const s = state as MatchState;

  // Terminate terminated games after a grace period
  if (s.winner !== null) {
    s.ticksSinceGameOver++;
    if (s.ticksSinceGameOver > TICK_RATE * 10) return null; // 10s after game over
    return { state: s };
  }

  // Process incoming player moves
  for (const msg of messages) {
    if (msg.opCode !== OpCode.MOVE || !s.gameStarted) continue;

    const currentPlayerId = s.playerOrder[s.currentTurnIndex];
    if (msg.sender.userId !== currentPlayerId) {
      dispatcher.broadcastMessage(
        OpCode.ERROR,
        JSON.stringify({ message: 'Not your turn' }),
        [msg.sender]
      );
      continue;
    }

    let move: MoveMessage;
    try {
      move = JSON.parse(nk.binaryToString(msg.data));
    } catch (_e) {
      continue;
    }

    const pos = move.position;
    if (typeof pos !== 'number' || pos < 0 || pos > 8 || s.board[pos] !== '') {
      dispatcher.broadcastMessage(
        OpCode.ERROR,
        JSON.stringify({ message: 'Invalid move' }),
        [msg.sender]
      );
      continue;
    }

    // Apply move
    s.board[pos] = s.players[currentPlayerId].symbol;
    const result = checkResult(s.board);

    if (result) {
      if (result === 'draw') {
        s.winner = 'draw';
        dispatcher.broadcastMessage(OpCode.GAME_OVER, JSON.stringify({
          winner: null,
          isDraw: true,
          reason: 'draw',
          board: s.board,
          players: s.players,
        }));
        updatePlayerStats(nk, logger, s.players, s.playerOrder, null);
      } else {
        let winnerId: string = s.playerOrder[0];
        for (let i = 0; i < s.playerOrder.length; i++) {
          if (s.players[s.playerOrder[i]].symbol === result) { winnerId = s.playerOrder[i]; break; }
        }
        s.winner = winnerId;
        dispatcher.broadcastMessage(OpCode.GAME_OVER, JSON.stringify({
          winner: winnerId,
          winnerUsername: s.players[winnerId].username,
          isDraw: false,
          reason: 'win',
          board: s.board,
          players: s.players,
        }));
        updatePlayerStats(nk, logger, s.players, s.playerOrder, winnerId);
      }
    } else {
      // Switch turns
      s.currentTurnIndex = s.currentTurnIndex === 0 ? 1 : 0;
      s.timeLeft = TIMER_DURATION_SECS;
      s.lastTickMs = Date.now();
      dispatcher.broadcastMessage(OpCode.GAME_STATE, buildGameStateMsg(s));
    }
  }

  // Timer mode: decrement and auto-forfeit on timeout
  if (s.gameStarted && !s.winner && s.timerMode) {
    const nowMs = Date.now();
    const elapsed = (nowMs - s.lastTickMs) / 1000;
    s.lastTickMs = nowMs;
    s.timeLeft -= elapsed;

    if (s.timeLeft <= 0) {
      const loserIndex = s.currentTurnIndex;
      const winnerIndex = loserIndex === 0 ? 1 : 0;
      const winnerId = s.playerOrder[winnerIndex];
      s.winner = winnerId;

      dispatcher.broadcastMessage(OpCode.GAME_OVER, JSON.stringify({
        winner: winnerId,
        winnerUsername: s.players[winnerId]?.username,
        isDraw: false,
        reason: 'timeout',
        board: s.board,
        players: s.players,
      }));
      updatePlayerStats(nk, logger, s.players, s.playerOrder, winnerId);
    } else if (tick % TICK_RATE === 0) {
      // Broadcast timer update once per second
      dispatcher.broadcastMessage(OpCode.TIMER_UPDATE, JSON.stringify({
        timeLeft: Math.ceil(s.timeLeft),
        currentTurnUserId: s.playerOrder[s.currentTurnIndex],
      }));
    }
  }

  return { state: s };
};

const matchTerminate: nkruntime.MatchTerminateFunction = (
  _ctx, _logger, _nk, _dispatcher, _tick, state, _graceSeconds
) => ({ state });

const matchSignal: nkruntime.MatchSignalFunction = (
  _ctx, _logger, _nk, _dispatcher, _tick, state, data
) => ({ state, data: '' });

// ─── RPC Functions ────────────────────────────────────────────────────────────
const rpcCreateMatch: nkruntime.RpcFunction = (ctx, logger, nk, payload) => {
  let params: { timerMode?: boolean; label?: string } = {};
  try { if (payload) params = JSON.parse(payload); } catch (_e) {}

  const matchParams: { [key: string]: string } = {
    timerMode: String(!!params.timerMode),
    label: params.label || 'classic',
  };

  const matchId = nk.matchCreate(MATCH_MODULE, matchParams);
  logger.info('Match created: %s by %s', matchId, ctx.userId);
  return JSON.stringify({ matchId });
};

const rpcFindOrCreateMatch: nkruntime.RpcFunction = (ctx, logger, nk, payload) => {
  let params: { timerMode?: boolean } = {};
  try { if (payload) params = JSON.parse(payload); } catch (_e) {}

  const timerMode = !!params.timerMode;

  // Look for an open match (1 player waiting, same mode)
  const matches = nk.matchList(10, true, null, 1, 1, '*');
  for (const m of matches) {
    try {
      const lbl = JSON.parse(m.label || '{}');
      if (lbl.timerMode === timerMode && !lbl.started) {
        logger.info('Found existing match %s for %s', m.matchId, ctx.userId);
        return JSON.stringify({ matchId: m.matchId });
      }
    } catch (_e) {}
  }

  // No match found — create one
  const matchParams: { [key: string]: string } = {
    timerMode: String(timerMode),
    label: timerMode ? 'timed' : 'classic',
  };
  const matchId = nk.matchCreate(MATCH_MODULE, matchParams);
  logger.info('No open match found, created new: %s', matchId);
  return JSON.stringify({ matchId });
};

const rpcLeaderboard: nkruntime.RpcFunction = (ctx, logger, nk, _payload) => {
  try {
    const result = nk.leaderboardRecordsList(LEADERBOARD_ID, [], 20, undefined, undefined);
    const records = (result.records || []).map((r: any) => ({
      rank: r.rank,
      username: r.username,
      wins: r.score,
      maxStreak: r.subscore,
      ownerId: r.ownerId,
    }));
    return JSON.stringify({ records });
  } catch (e) {
    logger.error('rpcLeaderboard error: %s', e);
    return JSON.stringify({ records: [] });
  }
};

const rpcMyStats: nkruntime.RpcFunction = (ctx, logger, nk, _payload) => {
  if (!ctx.userId) return JSON.stringify({ error: 'Not authenticated' });
  try {
    const objs = nk.storageRead([{ collection: STORAGE_COLLECTION, key: 'stats', userId: ctx.userId }]);
    if (objs.length === 0) {
      return JSON.stringify({ wins: 0, losses: 0, draws: 0, currentStreak: 0, maxStreak: 0 });
    }
    return (objs[0] as any).value;
  } catch (e) {
    logger.error('rpcMyStats error: %s', e);
    return JSON.stringify({ wins: 0, losses: 0, draws: 0, currentStreak: 0, maxStreak: 0 });
  }
};

// ─── Module initializer ───────────────────────────────────────────────────────
function InitModule(
  _ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  initializer: nkruntime.Initializer
) {
  // Create wins leaderboard (descending score, increment operator)
  try {
    nk.leaderboardCreate(LEADERBOARD_ID, false, nkruntime.SortOrder.DESCENDING, nkruntime.Operator.INCREMENTAL, '', {});
    logger.info('Leaderboard "%s" ready', LEADERBOARD_ID);
  } catch (_e) {
    logger.info('Leaderboard "%s" already exists', LEADERBOARD_ID);
  }

  // Register match handler
  initializer.registerMatch(MATCH_MODULE, {
    matchInit,
    matchJoinAttempt,
    matchJoin,
    matchLeave,
    matchLoop,
    matchTerminate,
    matchSignal,
  });

  // Register RPC endpoints
  initializer.registerRpc('create_match', rpcCreateMatch);
  initializer.registerRpc('find_or_create_match', rpcFindOrCreateMatch);
  initializer.registerRpc('get_leaderboard', rpcLeaderboard);
  initializer.registerRpc('get_my_stats', rpcMyStats);

  logger.info('TicTacToe module initialized successfully');
}
