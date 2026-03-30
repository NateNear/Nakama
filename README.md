# Multiplayer Tic-Tac-Toe with Nakama

Real-time multiplayer Tic-Tac-Toe with server-authoritative game logic, matchmaking, leaderboards, and optional 30-second turn timers.

---

## Architecture Overview

```
┌──────────────────────────┐        WebSocket        ┌─────────────────────────┐
│   React Frontend (SPA)   │ ◄──────────────────────► │   Nakama Game Server    │
│                          │                          │                         │
│  - Auth (device ID)      │  REST (HTTP/2)           │  - Match handler (TS)   │
│  - Lobby / Matchmaking   │ ◄──────────────────────► │  - Server-auth logic    │
│  - Game board (live)     │                          │  - Leaderboard API      │
│  - Leaderboard           │                          │  - RPC endpoints        │
└──────────────────────────┘                          └────────────┬────────────┘
                                                                   │
                                                        ┌──────────▼──────────┐
                                                        │     PostgreSQL 14   │
                                                        │  (state & storage)  │
                                                        └─────────────────────┘
```

### Key Design Decisions

| Decision | Rationale |
|---|---|
| **Server-authoritative match logic** | All move validation, win detection, and timer enforcement happen in `matchLoop` on the server — clients cannot cheat |
| **Nakama TypeScript runtime** | Compiled to JS, runs inside the Nakama process for lowest latency (no network hop for game logic) |
| **Device-ID authentication** | Zero-friction anonymous login with persistent identity stored in `localStorage` |
| **Op-code protocol** | Binary-efficient integer op-codes over WebSocket instead of REST for real-time events |
| **Separate leaderboard + storage** | Nakama leaderboard (wins/streak) + Storage engine (full W/L/D stats) for rich player profiles |
| **Tick rate = 5 Hz** | 200 ms ticks give 1-second timer granularity (sent every 5th tick) without excess CPU |

---

## Project Structure

```
tictactoe/
├── nakama/
│   ├── src/main.ts          # Full server module (match handler + RPCs)
│   ├── dist/                # Compiled JS → mounts into Nakama container
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── hooks/useNakama.ts  # Nakama JS client hook
│   │   ├── components/
│   │   │   ├── Game.tsx        # Board, status, post-game stats
│   │   │   ├── Board.tsx       # 3×3 grid
│   │   │   ├── Cell.tsx        # Individual cell
│   │   │   ├── Timer.tsx       # Countdown bar
│   │   │   ├── Lobby.tsx       # Create / Quick match / Join by ID
│   │   │   └── Leaderboard.tsx # Global rankings
│   │   ├── App.tsx             # Screen router (auth→lobby→game→leaderboard)
│   │   └── types.ts            # Shared TypeScript interfaces
│   ├── public/index.html
│   ├── Dockerfile
│   └── nginx.conf
├── docker-compose.yml
└── README.md
```

---

## Local Development Setup

### Prerequisites
- Docker Desktop (or Docker + Docker Compose)
- Node.js 20+ (for building the Nakama module)

### 1 — Build the Nakama TypeScript module

```bash
cd nakama
npm install
npm run build          # outputs dist/index.js
# Rename to index.js so Nakama picks it up
```

### 2 — Start the stack

```bash
# From the project root
docker-compose up -d
```

Services:
| Service | URL |
|---|---|
| Nakama HTTP API | http://localhost:7350 |
| Nakama Console | http://localhost:7351 |
| PostgreSQL | localhost:5432 |

### 3 — Run the frontend locally

```bash
cd frontend
cp .env.example .env.local     # adjust if needed
npm install
npm start                       # http://localhost:3000
```

---

## Deployment

### Option A — DigitalOcean Droplet (recommended for demo)

```bash
# 1. Provision a $6/mo Droplet (Ubuntu 22.04, 1 vCPU, 1 GB RAM)
# 2. SSH in and install Docker
curl -fsSL https://get.docker.com | sh
apt-get install -y docker-compose-plugin

# 3. Clone repo
git clone <your-repo-url> /opt/tictactoe && cd /opt/tictactoe

# 4. Build Nakama module
cd nakama && npm install && npm run build && cd ..

# 5. Set your domain / IP in frontend env
export NAKAMA_PUBLIC_HOST=<YOUR_SERVER_IP_OR_DOMAIN>

# 6. Build frontend with production Nakama host
docker build \
  --build-arg REACT_APP_NAKAMA_HOST=$NAKAMA_PUBLIC_HOST \
  --build-arg REACT_APP_NAKAMA_PORT=7350 \
  --build-arg REACT_APP_NAKAMA_SSL=false \
  -t ttt-frontend ./frontend

# 7. Start all services
docker-compose up -d
```

The frontend will be accessible on port **3000** and Nakama on **7350**.

### Option B — AWS EC2 / GCP Compute Engine

Follow the same steps as Option A. Ensure the following ports are open in your security group / firewall:
- `3000` — frontend
- `7350` — Nakama HTTP + WebSocket
- `7349` — Nakama gRPC (optional)

### Option C — Deploying frontend to Vercel/Netlify

```bash
# Build with the deployed Nakama URL
REACT_APP_NAKAMA_HOST=<nakama-server-ip> npm run build
# Upload the `build/` folder to Vercel / Netlify
```

### Nakama Console
After deployment, visit `http://<HOST>:7351` (default credentials: `admin` / `password`) to:
- Inspect active matches
- View leaderboard records
- Monitor storage objects

---

## Server Configuration Details

### Nakama Module — RPC Endpoints

| RPC ID | Method | Payload | Returns |
|---|---|---|---|
| `create_match` | GET | `{"timerMode": bool}` | `{"matchId": "..."}` |
| `find_or_create_match` | GET | `{"timerMode": bool}` | `{"matchId": "..."}` |
| `get_leaderboard` | GET | — | `{"records": [...]}` |
| `get_my_stats` | GET | — | `{"wins":0,"losses":0,"draws":0,"currentStreak":0,"maxStreak":0}` |

### WebSocket Op-codes

| Code | Direction | Payload |
|---|---|---|
| `1` MOVE | Client → Server | `{"position": 0-8}` |
| `2` GAME_STATE | Server → Client | Full board + turn + timer |
| `3` GAME_OVER | Server → Client | Winner, reason, final board |
| `4` PLAYER_JOINED | Server → Client | Waiting message |
| `5` TIMER_UPDATE | Server → Client | `{"timeLeft": N, "currentTurnUserId": "..."}` |
| `6` ERROR | Server → Client | `{"message": "..."}` |

### Game Modes

| Mode | Description |
|---|---|
| **Classic** | Standard Tic-Tac-Toe, no time limit |
| **Timed** | 30 seconds per turn; auto-forfeit on timeout |

---

## How to Test Multiplayer

### Browser test (2 tabs)
1. Open `http://localhost:3000` in two browser tabs (or different browsers)
2. Enter different usernames in each tab
3. Click **Quick Match** in both tabs — they will be paired automatically
4. Make moves alternately; observe real-time updates

### Cross-device test
1. Deploy to a server or use a local tunnel (e.g. `ngrok http 3000`)
2. Share the URL with another person
3. Both click **Quick Match**

### Timer mode test
1. Select **Timed (30s)** mode in both tabs
2. Click **Quick Match**
3. Don't move — after 30 seconds the inactive player forfeits

### Private room test
1. One player clicks **Create Room** → copies the Room ID
2. Second player pastes the ID into **Join by Room ID** → joins instantly

---

## Bonus Features Implemented

- **Concurrent game support** — each match is isolated in its own Nakama match instance; hundreds of games can run simultaneously
- **Leaderboard system** — global win rankings with max-streak subscore; per-player W/L/D/streak in Nakama Storage
- **Timer-based mode** — 30 s per turn enforced server-side; client shows live countdown bar

---

## Troubleshooting

| Issue | Fix |
|---|---|
| `Failed to connect` | Ensure Nakama is running (`docker-compose ps`) and port 7350 is reachable |
| Module not loading | Verify `nakama/dist/index.js` exists and is mounted into the container |
| Match not starting | Check Nakama console logs: `docker-compose logs nakama` |
| Leaderboard empty | Finish at least one game; records are written only on game completion |
