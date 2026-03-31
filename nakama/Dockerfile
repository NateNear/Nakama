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
