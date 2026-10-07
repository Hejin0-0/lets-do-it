import assert from 'node:assert/strict';
import WebSocket from 'ws';

const relayUrl = process.env.INKBOUND_RELAY_URL ?? 'ws://localhost:4174';
const origin = process.env.INKBOUND_ORIGIN ?? 'http://localhost:4173';

function waitFor(socket, predicate, timeoutMs = 3_000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => finish(new Error('Timed out waiting for relay message')), timeoutMs);
    const onMessage = (raw) => {
      let message;
      try {
        message = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (predicate(message)) finish(null, message);
    };
    const onClose = () => finish(new Error('Relay closed before the expected message'));
    const finish = (error, value) => {
      clearTimeout(timeout);
      socket.off('message', onMessage);
      socket.off('close', onClose);
      if (error) reject(error);
      else resolve(value);
    };
    socket.on('message', onMessage);
    socket.on('close', onClose);
  });
}

async function connect() {
  const socket = new WebSocket(relayUrl, { origin });
  const welcome = waitFor(socket, (message) => message.type === 'welcome');
  await new Promise((resolve, reject) => {
    socket.once('open', resolve);
    socket.once('error', reject);
  });
  return { socket, welcome: await welcome };
}

const nonce = Date.now().toString(36);
const structureId = `smoke-${nonce}`;
const nodeId = `node-${nonce}`;
const creatureId = `creature-${nonce}`;
const first = await connect();
const second = await connect();

try {
  const stateReceived = waitFor(second.socket, (message) =>
    message.type === 'state' && message.player?.name === 'Session-Smoke');
  first.socket.send(JSON.stringify({ type: 'join', name: 'Session-Smoke' }));
  first.socket.send(JSON.stringify({
    type: 'state', x: 3, y: 2, z: 4, yaw: 0.5, slot: 'torch',
  }));
  const state = await stateReceived;
  assert.equal(state.player.slot, 'torch');

  const worldReceived = waitFor(second.socket, (message) =>
    message.type === 'world' && message.event?.structureId === structureId);
  first.socket.send(JSON.stringify({
    type: 'world',
    event: {
      kind: 'build', action: 'place', structureId, buildType: 'campfire',
      x: 1, y: 1, z: 1, rotation: 0,
    },
  }));
  await worldReceived;

  const gatherReceived = waitFor(second.socket, (message) =>
    message.type === 'world' && message.event?.nodeId === nodeId);
  const creatureReceived = waitFor(second.socket, (message) =>
    message.type === 'world' && message.event?.creatureId === creatureId);
  first.socket.send(JSON.stringify({
    type: 'world', event: { kind: 'gather', nodeId, remaining: 1 },
  }));
  first.socket.send(JSON.stringify({
    type: 'world',
    event: { kind: 'creature', creatureId, health: 40, dead: false, tamed: false, trust: 1 },
  }));
  await Promise.all([gatherReceived, creatureReceived]);

  const leaveReceived = waitFor(second.socket, (message) =>
    message.type === 'leave' && message.id === first.welcome.id);
  first.socket.close();
  await leaveReceived;

  const third = await connect();
  try {
    assert(third.welcome.worldEvents.some((event) => event.structureId === structureId));
    assert(third.welcome.worldEvents.some((event) => event.nodeId === nodeId));
    assert(third.welcome.worldEvents.some((event) => event.creatureId === creatureId));
    third.socket.send(JSON.stringify({
      type: 'world', event: { kind: 'build', action: 'remove', structureId },
    }));
  } finally {
    third.socket.close();
  }
  console.log('Session smoke passed: presence, shared world deltas, replay, and leave.');
} finally {
  first.socket.close();
  second.socket.close();
}
