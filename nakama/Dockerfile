# ─── Build stage ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps

COPY . .

ARG REACT_APP_NAKAMA_HOST=localhost
ARG REACT_APP_NAKAMA_PORT=7350
ARG REACT_APP_NAKAMA_SSL=false
ARG REACT_APP_SERVER_KEY=defaultkey

ENV REACT_APP_NAKAMA_HOST=$REACT_APP_NAKAMA_HOST
ENV REACT_APP_NAKAMA_PORT=$REACT_APP_NAKAMA_PORT
ENV REACT_APP_NAKAMA_SSL=$REACT_APP_NAKAMA_SSL
ENV REACT_APP_SERVER_KEY=$REACT_APP_SERVER_KEY

RUN npm run build

# ─── Serve stage ─────────────────────────────────────────────────────────────
FROM nginx:alpine
COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
