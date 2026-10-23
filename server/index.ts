/**
 * Tick Talk local server:
 *  - serves the build (dist/) with an SPA fallback (/, /explicar);
 *  - /api/info returns the PC's local network addresses;
 *  - /ws relays messages between the table and the describer's phone.
 *
 * Usage: `npm run play` (build + server on 0.0.0.0:5174) or `npm run dev` (with Vite).
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';
import { WebSocketServer, type WebSocket } from 'ws';
import { lanAddresses } from './network';
import { Relay, isValidClientId, type Connection } from './relay';

const DEV = process.argv.includes('--dev');
const PORT = Number(process.env.TICKTALK_PORT ?? 5174);
const HOST = process.env.TICKTALK_HOST ?? '0.0.0.0';
/** Port the phone should open: in dev mode it is Vite's. */
const PAGE_PORT = DEV ? Number(process.env.VITE_PORT ?? 5173) : PORT;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(root, 'dist');

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function serveFile(res: ServerResponse, file: string, cache: boolean): void {
  const type = MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
  res.writeHead(200, {
    'Content-Type': type,
    'Cache-Control': cache ? 'public, max-age=31536000, immutable' : 'no-cache',
    'X-Content-Type-Options': 'nosniff',
  });
  createReadStream(file).pipe(res);
}

function handleHttp(req: IncomingMessage, res: ServerResponse): void {
  const url = new URL(req.url ?? '/', 'http://localhost');

  if (url.pathname === '/api/info') {
    sendJson(res, 200, { addresses: lanAddresses(), port: PAGE_PORT, dev: DEV });
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405).end();
    return;
  }

  if (!existsSync(path.join(distDir, 'index.html'))) {
    res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(DEV ? `Modo dev: abre o jogo em http://localhost:${PAGE_PORT}` : 'Falta a build. Corre "npm run play".');
    return;
  }

  let pathname: string;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    res.writeHead(400).end();
    return;
  }
  const file = path.normalize(path.join(distDir, pathname));
  if (file.startsWith(distDir + path.sep) && existsSync(file) && statSync(file).isFile()) {
    serveFile(res, file, pathname.startsWith('/assets/'));
    return;
  }
  // SPA routes ("/", "/explicar"…) → index.html
  serveFile(res, path.join(distDir, 'index.html'), false);
}

const relay = new Relay();
const server = createServer(handleHttp);
const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });

const alive = new WeakMap<WebSocket, boolean>();

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (url.pathname !== '/ws') {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
});

wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const role = url.searchParams.get('role');
  const id = url.searchParams.get('id');
  const conn: Connection = {
    send: (data) => ws.readyState === ws.OPEN && ws.send(data),
    close: (code, reason) => ws.close(code, reason),
  };
  alive.set(ws, true);
  ws.on('pong', () => alive.set(ws, true));

  if (role === 'host') {
    relay.addHost(conn);
    log(`Mesa ligada.`);
    ws.on('message', (data) => relay.fromHost(conn, data.toString()));
    ws.on('close', () => {
      relay.removeHost(conn);
      log('Mesa desligada.');
    });
  } else if (role === 'describer' && isValidClientId(id)) {
    relay.addDescriber(id, conn);
    log(`Tela de quem explica ligada (${relay.describerCount}).`);
    ws.on('message', (data) => relay.fromDescriber(id, conn, data.toString()));
    ws.on('close', () => {
      relay.removeDescriber(id, conn);
      log(`Tela de quem explica desligada (${relay.describerCount}).`);
    });
  } else {
    ws.close(4002, 'bad role');
  }
});

// Detect dead connections (a phone that lost Wi-Fi without saying goodbye).
const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (!alive.get(ws)) {
      ws.terminate();
      continue;
    }
    alive.set(ws, false);
    ws.ping();
  }
}, 5000);

function log(message: string): void {
  const time = new Date().toLocaleTimeString('pt-PT', { hour12: false });
  console.log(`[${time}] ${message}`);
}

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\nA porta ${PORT} já está a ser usada. Fecha o outro servidor ou usa TICKTALK_PORT=5180.\n`);
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, HOST, async () => {
  const addresses = lanAddresses();
  const lines = [
    '',
    '  Tick Talk',
    '',
    `  Mesa (neste PC):     http://localhost:${PAGE_PORT}/`,
    ...addresses.map((ip, i) => `  ${i === 0 ? 'Telemóvel:          ' : '                     '} http://${ip}:${PAGE_PORT}/explicar`),
    '',
  ];
  console.log(lines.join('\n'));
  if (addresses.length === 0) {
    console.log('  Não encontrei nenhuma rede local. Liga o PC ao Wi-Fi para usar o telemóvel.\n');
  } else {
    const qr = await QRCode.toString(`http://${addresses[0]}:${PAGE_PORT}/explicar`, { type: 'terminal', small: true });
    console.log(qr);
    console.log('  Lê o código com a câmara do telemóvel (na mesma rede Wi-Fi).');
    console.log('  Se não abrir, permite o Node.js na firewall do Windows (redes privadas).\n');
  }
  if (DEV) console.log(`  Servidor WebSocket em :${PORT} (o Vite reencaminha /ws e /api).\n`);
});

function shutdown(): void {
  clearInterval(heartbeat);
  for (const ws of wss.clients) ws.close(1001, 'server shutdown');
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 500).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
