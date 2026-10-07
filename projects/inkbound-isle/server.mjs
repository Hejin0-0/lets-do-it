import { createServer as createViteServer } from 'vite';
import { WebSocket, WebSocketServer } from 'ws';
import { randomUUID } from 'node:crypto';
import {
  applyCanonicalWorldEvent,
  canonicalWorldEvents,
  createWelcomeMessage,
  createRateLimiter,
  isAllowedOrigin,
  sanitizeName,
  validatedState,
  validatedWorldEvent,
} from './server-protocol.mjs';

const players = new Map();
const clientMeta = new WeakMap();
const sessionWorld = {
  resources: new Map(),
  structures: new Map(),
  creatures: new Map(),
};

const vite = await createViteServer({
  server: { host: '0.0.0.0', port: 4173 },
  appType: 'spa',
});
await vite.listen();

const relay = new WebSocketServer({
  host: '0.0.0.0',
  port: 4174,
  maxPayload: 4096,
  verifyClient: ({ origin, req }) =>
    players.size < 24 && isAllowedOrigin(origin, req.headers.host),
});

function broadcast(message, except) {
  const encoded = JSON.stringify(message);
  for (const client of relay.clients) {
    if (client !== except
      && client.readyState === WebSocket.OPEN
      && client.bufferedAmount < 64 * 1024) client.send(encoded);
  }
}

relay.on('connection', (socket) => {
  const id = randomUUID().slice(0, 8);
  const initial = { id, name: 'Scout', x: 0, y: 6, z: 6, yaw: 0, slot: 'hands' };
  players.set(socket, initial);
  clientMeta.set(socket, {
    allowMessage: createRateLimiter(),
    invalidMessages: 0,
    lastStateAt: Date.now(),
    hasState: false,
  });
  socket.isAlive = true;
  socket.on('pong', () => { socket.isAlive = true; });
  socket.send(JSON.stringify(createWelcomeMessage(
    id,
    [...players.values()].filter((player) => player.id !== id),
    canonicalWorldEvents(sessionWorld),
  )));

  socket.on('message', (buffer) => {
    const meta = clientMeta.get(socket);
    if (!meta || !meta.allowMessage(Date.now())) {
      socket.close(1008, 'message rate exceeded');
      return;
    }
    let message;
    try {
      message = JSON.parse(buffer.toString());
    } catch {
      meta.invalidMessages += 1;
      return;
    }
    if (!message || typeof message !== 'object') {
      meta.invalidMessages += 1;
      return;
    }
    const current = players.get(socket);
    if (!current) return;
    if (message.type === 'join') {
      players.set(socket, { ...current, name: sanitizeName(message.name) });
      return;
    }
    if (message.type === 'state') {
      const now = Date.now();
      const elapsed = Math.max(0.05, (now - meta.lastStateAt) / 1_000);
      const next = validatedState(
        id,
        current,
        message,
        meta.hasState ? 1.5 + elapsed * 12 : Infinity,
      );
      if (!next) {
        meta.invalidMessages += 1;
      } else {
        meta.lastStateAt = now;
        meta.hasState = true;
        players.set(socket, next);
        broadcast({ type: 'state', player: next }, socket);
      }
    } else if (message.type === 'world') {
      const event = validatedWorldEvent(message.event);
      if (!event) {
        meta.invalidMessages += 1;
      } else {
        applyCanonicalWorldEvent(sessionWorld, event);
        broadcast({ type: 'world', actorId: id, event }, socket);
      }
    } else {
      meta.invalidMessages += 1;
    }
    if (meta.invalidMessages >= 8) socket.close(1008, 'invalid messages');
  });

  socket.on('close', () => {
    players.delete(socket);
    broadcast({ type: 'leave', id }, socket);
  });
});

const heartbeat = setInterval(() => {
  for (const socket of relay.clients) {
    if (socket.isAlive === false) {
      socket.terminate();
      continue;
    }
    socket.isAlive = false;
    socket.ping();
  }
}, 30_000);
heartbeat.unref();

console.log('Inkbound Isle: http://localhost:4173 · multiplayer relay ws://localhost:4174');

const shutdown = async () => {
  clearInterval(heartbeat);
  for (const client of relay.clients) client.close();
  relay.close();
  await vite.close();
  process.exit(0);
};
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
