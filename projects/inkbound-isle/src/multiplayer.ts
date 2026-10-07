import type { SelectedSlot } from './ui.ts';

export interface RemoteSnapshot {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  slot: SelectedSlot;
}

export type WorldEvent =
  | { kind: 'gather'; nodeId: string; remaining: number }
  | {
    kind: 'build';
    action: 'place';
    structureId: string;
    buildType: 'foundation' | 'wall' | 'campfire';
    x: number;
    y: number;
    z: number;
    rotation: number;
  }
  | { kind: 'build'; action: 'remove'; structureId: string }
  | {
    kind: 'creature';
    creatureId: string;
    health: number;
    dead: boolean;
    tamed: boolean;
    trust: number;
  };

type StatusHandler = (label: string, status: 'connecting' | 'online' | 'offline') => void;
type SnapshotHandler = (snapshot: RemoteSnapshot | null, departedId?: string) => void;
type WorldHandler = (event: WorldEvent) => void;

const validSlots = new Set<SelectedSlot>(['hands', 'axe', 'spear', 'torch', 'foundation', 'wall', 'campfire']);
const RELAY_MESSAGE_LIMIT = 16_000;
const safeId = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-zA-Z0-9_-]{1,40}$/.test(value);

const isSnapshot = (value: unknown): value is RemoteSnapshot => {
  if (!value || typeof value !== 'object') return false;
  const data = value as Record<string, unknown>;
  return typeof data.id === 'string'
    && typeof data.name === 'string'
    && ['x', 'y', 'z', 'yaw'].every((key) => Number.isFinite(data[key]))
    && validSlots.has(data.slot as SelectedSlot);
};

const isWorldEvent = (value: unknown): value is WorldEvent => {
  if (!value || typeof value !== 'object') return false;
  const data = value as Record<string, unknown>;
  if (data.kind === 'gather') {
    return safeId(data.nodeId) && Number.isInteger(data.remaining) && Number(data.remaining) >= 0 && Number(data.remaining) <= 20;
  }
  if (data.kind === 'build') {
    if (!safeId(data.structureId) || !['place', 'remove'].includes(String(data.action))) return false;
    if (data.action === 'remove') return true;
    return ['foundation', 'wall', 'campfire'].includes(String(data.buildType))
      && ['x', 'y', 'z', 'rotation'].every((key) => Number.isFinite(data[key]));
  }
  return data.kind === 'creature'
    && safeId(data.creatureId)
    && Number.isFinite(data.health)
    && typeof data.dead === 'boolean'
    && typeof data.tamed === 'boolean'
    && Number.isInteger(data.trust);
};

export class MultiplayerClient {
  readonly remotes = new Map<string, RemoteSnapshot>();
  private socket: WebSocket | null = null;
  private localId = '';
  private sendAccumulator = 0;
  private reconnectTimer: number | null = null;

  constructor(
    private readonly onStatus: StatusHandler,
    private readonly onSnapshot: SnapshotHandler,
    private readonly onWorld: WorldHandler,
  ) {}

  connect(): void {
    if (this.socket && this.socket.readyState <= WebSocket.OPEN) return;
    this.onStatus('Linking expedition…', 'connecting');
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.socket = new WebSocket(`${protocol}//${location.hostname}:4174`);
    this.socket.addEventListener('open', () => {
      this.onStatus('Expedition link online', 'online');
      this.send({ type: 'join', name: `Scout-${Math.floor(Math.random() * 900 + 100)}` });
    });
    this.socket.addEventListener('message', (event) => this.handleMessage(event.data));
    this.socket.addEventListener('close', () => {
      this.onStatus('Solo expedition · relay offline', 'offline');
      for (const id of this.remotes.keys()) this.onSnapshot(null, id);
      this.remotes.clear();
      this.socket = null;
      if (this.reconnectTimer === null) {
        this.reconnectTimer = window.setTimeout(() => {
          this.reconnectTimer = null;
          this.connect();
        }, 2_000);
      }
    });
    this.socket.addEventListener('error', () => this.onStatus('Solo expedition · relay offline', 'offline'));
  }

  update(delta: number, snapshot: Omit<RemoteSnapshot, 'id' | 'name'>): void {
    this.sendAccumulator += delta;
    if (this.sendAccumulator < 0.1 || this.socket?.readyState !== WebSocket.OPEN) return;
    this.sendAccumulator = 0;
    this.send({ type: 'state', ...snapshot });
  }

  sendWorld(event: WorldEvent): void {
    this.send({ type: 'world', event });
  }

  private handleMessage(raw: unknown): void {
    if (typeof raw !== 'string' || raw.length > RELAY_MESSAGE_LIMIT) return;
    let message: Record<string, unknown>;
    try {
      message = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return;
    }
    if (message.type === 'welcome' && typeof message.id === 'string') {
      this.localId = message.id;
      const players = Array.isArray(message.players) ? message.players : [];
      for (const player of players) if (isSnapshot(player)) this.acceptSnapshot(player);
      const worldEvents = Array.isArray(message.worldEvents) ? message.worldEvents : [];
      for (const event of worldEvents) if (isWorldEvent(event)) this.onWorld(event);
      return;
    }
    if (message.type === 'state' && isSnapshot(message.player) && message.player.id !== this.localId) {
      this.acceptSnapshot(message.player);
      return;
    }
    if (message.type === 'leave' && typeof message.id === 'string') {
      this.remotes.delete(message.id);
      this.onSnapshot(null, message.id);
      this.onStatus(`${this.remotes.size + 1} explorers online`, 'online');
      return;
    }
    if (message.type === 'world' && isWorldEvent(message.event)) {
      this.onWorld(message.event);
    }
  }

  private acceptSnapshot(snapshot: RemoteSnapshot): void {
    const safe = { ...snapshot, name: snapshot.name.slice(0, 18) };
    this.remotes.set(safe.id, safe);
    this.onSnapshot(safe);
    this.onStatus(`${this.remotes.size + 1} explorers online`, 'online');
  }

  private send(message: Record<string, unknown>): void {
    if (this.socket?.readyState === WebSocket.OPEN && this.socket.bufferedAmount < 64 * 1024) {
      this.socket.send(JSON.stringify(message));
    }
  }
}
