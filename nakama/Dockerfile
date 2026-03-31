# Stage 1: compile the TypeScript module
FROM node:20-alpine AS builder
WORKDIR /build
COPY package*.json ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
RUN npx tsc

# Stage 2: Nakama server with compiled module baked in
FROM heroiclabs/nakama:3.21.1
COPY --from=builder /build/dist/index.js /nakama/data/modules/index.js

EXPOSE 7349 7350 7351

CMD ["/bin/sh", "-ecx", \
  "/nakama/nakama migrate up --database.address ${DATABASE_URL} && \
   exec /nakama/nakama \
     --name tictactoe \
     --database.address ${DATABASE_URL} \
     --logger.level INFO \
     --session.token_expiry_sec 7200 \
     --socket.outgoing_queue_size 128 \
     --runtime.js_entrypoint index.js"]
