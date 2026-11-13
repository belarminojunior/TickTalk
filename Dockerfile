# Tick Talk: the table, the phone pages and the WebSocket rooms, in one small server.
# Build:  docker build -t tick-talk .
# Run:    docker run -p 8080:8080 tick-talk   → http://localhost:8080

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY server ./server
# Hosting platforms set PORT; 8080 is the default here.
ENV PORT=8080
EXPOSE 8080
USER node
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:${PORT}/healthz || exit 1
CMD ["npx", "tsx", "server/index.ts"]
