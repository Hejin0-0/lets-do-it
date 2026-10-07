import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import './styles.css';
import {
  COSTES_AVANCE,
  EDIFICIOS,
  ERA_IDS,
  IDENTIDAD_ERAS,
  RECURSOS,
  UNIDADES,
  obtenerEdificio,
  obtenerEra,
  obtenerUnidad,
} from './catalog.js';
import {
  atacar,
  avanzarEra,
  construirEdificio,
  crearEstado,
  entrenarUnidad,
  puedePagar,
  recalcularPoblacion,
  recolectar,
} from './gameplay.js';
import { FOG_VISIBLE, createVisibilityField } from './visibility.js';
import {
  TEAM_COLORS,
  configureRenderer,
  createBuilding,
  createCommandFX,
  createIsometricCamera,
  createUnit,
  createWorld,
  disposeObject3D,
  findSelectableRoot,
  resizeIsometricCamera,
  setSelected,
} from './world.js';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const mount = $('#scene');
const canvasHost = $('#battlefield');
const loading = $('#loading-screen');
const loadingBar = $('#loading-bar');
const loadingStatus = $('#loading-status');
const minimap = $('#minimap');
const mapContext = minimap.getContext('2d');

const FACTIONS = {
  atlas: { nombre: 'Atlas League', marca: 'A', color: 0x28b8ff, acento: '#72d7c4' },
  helios: { nombre: 'Helios Pact', marca: 'H', color: 0xf1a23e, acento: '#f2bd67' },
  boreal: { nombre: 'Boreal Union', marca: 'B', color: 0x8b75e8, acento: '#a89bee' },
};

const scene = new THREE.Scene();
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.domElement.setAttribute('aria-hidden', 'true');
mount.append(renderer.domElement);
configureRenderer(renderer, { exposure: 1.02, pixelRatio: Math.min(devicePixelRatio, 1.7) });

const camera = createIsometricCamera({ width: innerWidth, height: innerHeight, viewSize: 49 });
const world = createWorld({ scene, renderer, size: 92, segments: 84, seed: 'nuevo-horizonte', shadowMapSize: 2048 });
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.3, 0.42, 0.88);
composer.addPass(bloom);
composer.addPass(new OutputPass());

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let previousFrame = performance.now();
const cameraTarget = new THREE.Vector3(-9, 0, 9);
const cameraGoal = cameraTarget.clone();
const cameraLook = new THREE.Vector3();
const keys = new Set();

function createInitialState() {
  let state = crearEstado({
    equipo: 'jugador',
    recursos: { alimentos: 920, materiales: 980, energia: 460, datos: 120 },
  });
  for (const type of ['vivienda', 'cuartel', 'fabrica']) state = construirEdificio(state, type).estado;
  state = entrenarUnidad(state, 'infanteria').estado;
  return { ...state, recursos: { alimentos: 920, materiales: 980, energia: 460, datos: 120 } };
}

const app = {
  started: false,
  paused: false,
  reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
  faction: 'atlas',
  elapsed: 0,
  waveAt: 95,
  wave: 0,
  yaw: Math.PI / 4,
  selected: [],
  inspected: null,
  actors: new Set(),
  resources: [],
  projectiles: new Set(),
  pendingBuild: null,
  pointerDirty: false,
  lastPointerEvent: null,
  drag: null,
  uiAccumulator: 0,
  minimapAccumulator: 0,
  economyAccumulator: 0,
  fpsFrames: 0,
  fpsTime: 0,
  commandSignature: '',
  nextEnemyId: 1,
  shake: 0,
  state: createInitialState(),
};

function loadingStep(percent, message) {
  loadingBar.style.width = `${percent}%`;
  loadingStatus.textContent = message;
}

loadingStep(24, 'Shaping the continent…');

function groundY(x, z) {
  return world.heightAt(x, z);
}

function placeOnGround(object, x, z, lift = 0.06) {
  object.position.set(x, groundY(x, z) + lift, z);
  return object;
}

function createFogOfWar() {
  const mapSize = 92;
  const size = mapSize * 3.5;
  const field = createVisibilityField({ worldSize: mapSize, resolution: 96, radius: 15 });
  const pixels = new Uint8Array(field.resolution * field.resolution * 4);
  const texture = new THREE.DataTexture(pixels, field.resolution, field.resolution, THREE.RGBAFormat);
  texture.name = 'Persistent visibility';
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  field.writeRgba(pixels);
  texture.needsUpdate = true;
  const map = document.createElement('canvas');
  map.width = map.height = field.resolution;
  const mapRenderer = map.getContext('2d');
  const mapImage = mapRenderer.createImageData(field.resolution, field.resolution);
  const geometry = new THREE.PlaneGeometry(size, size, 96, 96);
  geometry.rotateX(-Math.PI / 2);
  const vertices = geometry.attributes.position;
  for (let index = 0; index < vertices.count; index += 1) {
    const x = vertices.getX(index);
    const z = vertices.getZ(index);
    const insideMap = Math.abs(x) <= mapSize * 0.5 && Math.abs(z) <= mapSize * 0.5;
    vertices.setY(index, (insideMap ? Math.max(groundY(x, z), world.water.position.y) : world.water.position.y) + 0.16);
  }
  const material = new THREE.ShaderMaterial({
    uniforms: { uFog: { value: texture }, uMapSize: { value: mapSize } },
    vertexShader: `
      varying vec2 vWorld;
      void main() {
        vWorld = position.xz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uFog;
      uniform float uMapSize;
      varying vec2 vWorld;
      void main() {
        vec2 uv = vWorld / uMapSize + 0.5;
        if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) {
          gl_FragColor = vec4(0.02, 0.055, 0.07, 0.96);
        } else {
          gl_FragColor = texture2D(uFog, uv);
        }
      }
    `,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'Fog of war';
  mesh.renderOrder = 100;
  mesh.visible = false;
  mesh.userData = { scenery: 'fog-of-war', raycastIgnore: true };
  world.group.add(mesh);
  return {
    mesh,
    stateAt: (position) => field.stateAt(position),
    update() {
      const scouts = [...app.actors]
        .filter((actor) => actor.alive && actor.team === 'player')
        .map((actor) => actor.root.position);
      field.update(scouts);
      field.writeRgba(pixels);
      texture.needsUpdate = true;
      mapImage.data.set(pixels);
      mapRenderer.putImageData(mapImage, 0, 0);
      app.resources.forEach((node) => { node.visible = field.stateAt(node.position) === FOG_VISIBLE; });
      app.actors.forEach((actor) => { if (actor.team === 'enemy') actor.root.visible = field.stateAt(actor.root.position) === FOG_VISIBLE; });
      if (app.selected.some((actor) => actor.team === 'enemy' && !actor.root.visible)) setSelection(app.selected.filter((actor) => actor.root.visible));
    },
    drawOn(context, width, height) {
      context.drawImage(map, 0, 0, width, height);
    },
  };
}

const fogOfWar = createFogOfWar();

function addMesh(root, geometry, material, position, scale, rotation = [0, 0, 0]) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.entityPart = true;
  root.add(mesh);
  return mesh;
}

const RESOURCE_VISUALS = {
  alimentos: { color: 0xd9ad52, glow: 0x5d3f0c, nombre: 'Highland crops' },
  materiales: { color: 0xa7b4bc, glow: 0x253d47, nombre: 'Material deposit' },
  energia: { color: 0x54e1cd, glow: 0x0a6058, nombre: 'Geothermal vent' },
  datos: { color: 0x9c8aff, glow: 0x332a78, nombre: 'Precursor archive' },
};

function createResourceNode(type, x, z) {
  const visual = RESOURCE_VISUALS[type];
  const capacity = type === 'datos' ? 900 : 1800;
  const root = new THREE.Group();
  root.name = visual.nombre;
  root.userData = {
    selectable: true,
    entityType: 'resource',
    type,
    resource: type,
    team: 'neutral',
    radius: 2.1,
    amount: capacity,
    initialAmount: capacity,
  };
  const baseMaterial = new THREE.MeshStandardMaterial({ color: visual.color, roughness: 0.72, metalness: type === 'materiales' ? 0.35 : 0.06 });
  const darkMaterial = new THREE.MeshStandardMaterial({ color: visual.glow, roughness: 0.9 });
  const glowMaterial = new THREE.MeshStandardMaterial({ color: visual.color, emissive: visual.glow, emissiveIntensity: 2.4, roughness: 0.25 });

  if (type === 'alimentos') {
    addMesh(root, new THREE.CylinderGeometry(2.1, 2.25, 0.16, 20), darkMaterial, [0, 0.08, 0], [1, 1, 1]);
    for (let index = 0; index < 13; index += 1) {
      const angle = index * 2.4;
      const radius = 0.35 + (index % 4) * 0.38;
      addMesh(root, new THREE.CylinderGeometry(0.05, 0.08, 1.05, 5), baseMaterial, [Math.cos(angle) * radius, 0.58, Math.sin(angle) * radius], [1, 1, 1], [0, 0, (index % 3 - 1) * 0.08]);
    }
  } else if (type === 'materiales') {
    addMesh(root, new THREE.CylinderGeometry(2, 2.3, 0.18, 9), darkMaterial, [0, 0.08, 0], [1, 1, 1]);
    for (let index = 0; index < 7; index += 1) {
      const angle = index * 2.1;
      addMesh(root, new THREE.DodecahedronGeometry(0.55, 0), index % 3 ? baseMaterial : glowMaterial, [Math.cos(angle) * (0.4 + index * 0.16), 0.42, Math.sin(angle) * (0.4 + index * 0.13)], [0.75 + index * 0.05, 0.65 + (index % 2) * 0.45, 0.8], [0.2, angle, 0.1]);
    }
  } else if (type === 'energia') {
    addMesh(root, new THREE.CylinderGeometry(1.65, 2.1, 0.42, 16), darkMaterial, [0, 0.21, 0], [1, 1, 1]);
    addMesh(root, new THREE.CylinderGeometry(0.38, 0.58, 2.7, 10), baseMaterial, [0, 1.6, 0], [1, 1, 1]);
    for (let index = 0; index < 3; index += 1) {
      const ring = addMesh(root, new THREE.TorusGeometry(0.75 + index * 0.25, 0.055, 8, 28), glowMaterial, [0, 1.5 + index * 0.42, 0], [1, 1, 1], [Math.PI / 2, index * 0.35, 0]);
      ring.userData.spin = (index % 2 ? -1 : 1) * (0.35 + index * 0.13);
    }
  } else {
    addMesh(root, new THREE.CylinderGeometry(1.7, 2.05, 0.25, 8), darkMaterial, [0, 0.12, 0], [1, 1, 1]);
    addMesh(root, new THREE.BoxGeometry(1, 1, 1), baseMaterial, [0, 1.55, 0], [0.9, 3, 0.9], [0, Math.PI / 4, 0]);
    addMesh(root, new THREE.OctahedronGeometry(0.58, 0), glowMaterial, [0, 3.48, 0], [1, 1, 1]);
  }
  root.traverse((child) => { if (child.isMesh) child.userData.raycastRole = 'resource'; });
  placeOnGround(root, x, z);
  world.register(root);
  app.resources.push(root);
  return root;
}

function createHealthBadge(actor) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 18;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
  sprite.scale.set(actor.kind === 'building' ? 4.8 : 2.3, actor.kind === 'building' ? 0.68 : 0.34, 1);
  sprite.position.y = actor.kind === 'building' ? Math.max(5.6, actor.root.userData.radius * 1.15) : 2.45;
  sprite.renderOrder = 30;
  sprite.userData.raycastIgnore = true;
  actor.root.add(sprite);
  actor.healthBadge = { canvas, context: canvas.getContext('2d'), texture, sprite };
  updateHealthBadge(actor);
}

function updateHealthBadge(actor) {
  if (!actor.healthBadge) return;
  const { canvas, context, texture, sprite } = actor.healthBadge;
  const ratio = Math.max(0, actor.hp / actor.maxHp);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = 'rgba(2,8,10,.8)';
  context.fillRect(2, 2, 124, 14);
  context.fillStyle = ratio > 0.55 ? '#62d6ad' : ratio > 0.25 ? '#e4b85c' : '#ef6757';
  context.fillRect(5, 5, 118 * ratio, 8);
  context.strokeStyle = 'rgba(245,231,188,.65)';
  context.strokeRect(2.5, 2.5, 123, 13);
  texture.needsUpdate = true;
  sprite.visible = actor.hp < actor.maxHp || app.selected.includes(actor);
}

function entityColor(team) {
  return team === 'player' ? FACTIONS[app.faction].color : TEAM_COLORS.enemy;
}

function spawnActor(entity, team, x, z, options = {}) {
  const kind = entity.categoria === 'edificio' || EDIFICIOS[entity.era]?.some(({ tipo }) => tipo === entity.tipo)
    ? 'building'
    : 'unit';
  const maker = kind === 'building' ? createBuilding : createUnit;
  const root = maker({ type: entity.tipo, era: entity.era, team, color: entityColor(team), name: entity.nombre });
  placeOnGround(root, x, z, kind === 'building' ? 0.04 : 0.08);
  world.register(root);
  const actor = {
    id: entity.id,
    team,
    kind,
    type: entity.tipo,
    data: { ...entity, equipo: team === 'player' ? 'jugador' : 'enemigo' },
    root,
    hp: entity.vida,
    maxHp: entity.vidaMaxima ?? entity.vida,
    speed: kind === 'unit' ? entity.velocidad : 0,
    range: entity.alcance ?? 0,
    attackCooldown: Math.random() * 0.4,
    destination: null,
    target: null,
    gatherNode: null,
    gatherClock: 0,
    alive: true,
    construction: options.construction ?? 1,
  };
  root.userData.actor = actor;
  if (actor.construction < 1) root.scale.setScalar(Math.max(0.05, actor.construction));
  createHealthBadge(actor);
  app.actors.add(actor);
  return actor;
}

function createRoad(points, width = 1.45) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, 0, z)));
  const samples = curve.getPoints(28);
  const positions = [];
  const uvs = [];
  const indices = [];
  samples.forEach((point, index) => {
    const before = samples[Math.max(0, index - 1)];
    const after = samples[Math.min(samples.length - 1, index + 1)];
    const side = new THREE.Vector3(-(after.z - before.z), 0, after.x - before.x).normalize().multiplyScalar(width * 0.5);
    for (const direction of [-1, 1]) {
      const x = point.x + side.x * direction;
      const z = point.z + side.z * direction;
      positions.push(x, groundY(x, z) + 0.075, z);
      uvs.push(index / (samples.length - 1), direction > 0 ? 1 : 0);
    }
    if (index < samples.length - 1) {
      const vertex = index * 2;
      indices.push(vertex, vertex + 2, vertex + 1, vertex + 1, vertex + 2, vertex + 3);
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const road = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0x8a7657, roughness: 1, metalness: 0, side: THREE.DoubleSide }));
  road.name = 'Strategic road';
  road.receiveShadow = true;
  road.userData = { scenery: 'road', raycastIgnore: true };
  world.group.add(road);
}

function replaceActorVisual(actor, era = actor.data.era) {
  const ficha = actor.kind === 'unit' ? obtenerUnidad(actor.type, era) : obtenerEdificio(actor.type, era);
  if (!ficha) return;
  const position = actor.root.position.clone();
  const rotation = actor.root.rotation.y;
  const selected = app.selected.includes(actor);
  const ratio = actor.hp / actor.maxHp;
  world.unregister(actor.root);
  disposeObject3D(actor.root);
  actor.data = { ...actor.data, ...ficha, id: actor.id, equipo: actor.team === 'player' ? 'jugador' : 'enemigo' };
  actor.maxHp = ficha.vida;
  actor.hp = Math.max(1, Math.round(ficha.vida * ratio));
  actor.speed = actor.kind === 'unit' ? ficha.velocidad : 0;
  actor.range = ficha.alcance ?? 0;
  const maker = actor.kind === 'unit' ? createUnit : createBuilding;
  actor.root = maker({ type: actor.type, era, team: actor.team, color: entityColor(actor.team), name: ficha.nombre });
  actor.root.position.copy(position);
  actor.root.rotation.y = rotation;
  actor.root.userData.actor = actor;
  world.register(actor.root);
  createHealthBadge(actor);
  setSelected(actor.root, selected);
}

function enemyEntity(type, kind, era = app.state.era) {
  const ficha = kind === 'building' ? obtenerEdificio(type, era) : obtenerUnidad(type, era);
  return {
    ...ficha,
    id: `enemigo-${kind}-${app.nextEnemyId++}`,
    categoria: kind === 'building' ? 'edificio' : 'unidad',
    equipo: 'enemigo',
    vidaMaxima: ficha.vida,
  };
}

function setupScenario() {
  const center = spawnActor(app.state.edificios[0], 'player', -10, 9);
  const buildingSpots = [[-17, 5.5], [-8, 17], [0, 9]];
  app.state.edificios.slice(1).forEach((building, index) => spawnActor(building, 'player', ...buildingSpots[index]));
  const workerSpots = [[-18, 13], [-2, 15], [-3, 2], [3, 4]];
  app.state.unidades.forEach((unit, index) => spawnActor(unit, 'player', ...workerSpots[index]));

  createRoad([[-17, 5.5], [-13.5, 7], [-10, 9], [-8.5, 13], [-8, 17]]);
  createRoad([[-10, 9], [-5, 9], [0, 9]], 1.7);
  createRoad([[-10, 9], [-8, 5], [-4, 1]], 1.15);

  const enemyEra = 1800;
  const enemyCenter = spawnActor(enemyEntity('centro', 'building', enemyEra), 'enemy', 21, -16);
  enemyCenter.id = 'nucleo-enemigo';
  [[16, -11], [19, -9], [24, -10]].forEach(([x, z]) => {
    const unit = spawnActor(enemyEntity('infanteria', 'unit', enemyEra), 'enemy', x, z);
    unit.guard = enemyCenter;
  });

  [
    ['alimentos', -18, 11], ['alimentos', -16, 1],
    ['materiales', -2, 14], ['materiales', 7, -3],
    ['energia', -4, 1], ['energia', 13, 10],
    ['datos', -20, -3], ['datos', 3, -15],
  ].forEach(([type, x, z]) => createResourceNode(type, x, z));

  const workers = [...app.actors].filter((actor) => actor.team === 'player' && actor.type === 'trabajador');
  ['alimentos', 'materiales'].forEach((resource, index) => {
    const worker = workers[index];
    const node = app.resources.filter((item) => item.userData.resource === resource)
      .sort((a, b) => a.position.distanceTo(worker.root.position) - b.position.distanceTo(worker.root.position))[0];
    worker.gatherNode = node;
    worker.destination = node.position.clone();
  });

  cameraTarget.set(center.root.position.x, center.root.position.y, center.root.position.z);
  cameraGoal.copy(cameraTarget);
  app.actors.forEach((actor) => updateHealthBadge(actor));
}

loadingStep(52, 'Deploying forces…');
setupScenario();
loadingStep(74, 'Synchronizing tactical command…');

function resourceIcon(id) {
  return { alimentos: 'F', materiales: 'M', energia: 'E', datos: 'D' }[id];
}

function formatCost(cost = {}) {
  return Object.entries(cost).filter(([, amount]) => amount).map(([id, amount]) => `${amount} ${resourceIcon(id)}`).join(' · ');
}

function nextEra() {
  const index = ERA_IDS.indexOf(app.state.era);
  return index >= 0 ? ERA_IDS[index + 1] : undefined;
}

function producerExists(type) {
  return app.state.edificios.some((building) => building.vida > 0 && building.entrena.includes(type));
}

function commandCatalog() {
  const era = app.state.era;
  const unit = (type, icon, key) => {
    const ficha = obtenerUnidad(type, era);
    const available = producerExists(type)
      && app.state.poblacion.actual + ficha.poblacion <= app.state.poblacion.limite
      && puedePagar(app.state.recursos, ficha.coste);
    return { id: type, action: 'train', type, icon, key, label: ficha.nombre, cost: ficha.coste, available };
  };
  const building = (type, icon, key) => {
    const ficha = obtenerEdificio(type, era);
    return { id: type, action: 'build', type, icon, key, label: ficha.nombre, cost: ficha.coste, available: puedePagar(app.state.recursos, ficha.coste) };
  };
  const targetEra = nextEra();
  const advanceCost = targetEra ? COSTES_AVANCE[targetEra] : {};
  return [
    unit('trabajador', '♟', '1'), unit('infanteria', '⌁', '2'), unit('vehiculo', '⬡', '3'), unit('artilleria', '◈', '4'),
    building('vivienda', '⌂', '5'), building('cuartel', '⚔', '6'), building('fabrica', '⚙', '7'), building('laboratorio', '◇', '8'),
    { id: 'advance', action: 'advance', icon: '⟰', key: '9', label: targetEra ? `Advance to ${targetEra}` : 'Final Age reached', cost: advanceCost, available: Boolean(targetEra && puedePagar(app.state.recursos, advanceCost)) },
  ];
}

function renderCommands() {
  const commands = commandCatalog();
  const signature = commands.map(({ id, label, available, cost }) => `${id}:${label}:${available}:${formatCost(cost)}`).join('|');
  if (signature === app.commandSignature) return;
  app.commandSignature = signature;
  $('#orders-title').textContent = `ORDERS · ${obtenerEra(app.state.era).nombre.toUpperCase()}`;
  $('#command-grid').innerHTML = commands.map((command) => `
    <button type="button" data-command="${command.id}" ${command.available ? '' : 'disabled'} title="${command.available ? command.label : `Unavailable: ${formatCost(command.cost)}`}">
      <span class="command-icon" aria-hidden="true">${command.icon}</span>
      <span><b>${command.label}</b><small>${formatCost(command.cost) || 'Complete'}</small></span>
      <kbd>${command.key}</kbd>
    </button>`).join('');
}

function notify(message, alert = false) {
  const feed = $('#notifications');
  const item = document.createElement('div');
  item.className = `intel-message${alert ? ' alert' : ''}`;
  item.textContent = message;
  feed.prepend(item);
  while (feed.children.length > 4) feed.lastElementChild.remove();
}

function setSelection(actors) {
  app.selected.forEach((actor) => {
    if (actor.alive) setSelected(actor.root, false);
    updateHealthBadge(actor);
  });
  app.selected = [...new Set(actors.filter((actor) => actor?.alive))];
  app.selected.forEach((actor) => {
    setSelected(actor.root, true);
    updateHealthBadge(actor);
  });
  updateSelectionPanel();
}

const PORTRAITS = { centro: '⌖', trabajador: '♟', infanteria: '⌁', vehiculo: '⬡', artilleria: '◈', vivienda: '⌂', cuartel: '⚔', fabrica: '⚙', laboratorio: '◇' };

function updateSelectionPanel() {
  const portrait = $('#selection-portrait span');
  const setStats = (attack = '—', defense = '—', range = '—') => {
    $('#stat-attack').textContent = attack;
    $('#stat-defense').textContent = defense;
    $('#stat-range').textContent = range;
  };
  if (!app.selected.length) {
    $('#selection-class').textContent = 'NO SELECTION';
    $('#selection-name').textContent = 'Sector Command';
    $('#selection-description').textContent = 'Select a unit or building to view its status.';
    $('#health-value').textContent = '—';
    $('#health-fill').style.width = '0%';
    setStats();
    portrait.textContent = '⌖';
    return;
  }
  if (app.selected.length > 1) {
    const hp = app.selected.reduce((sum, actor) => sum + actor.hp, 0);
    const max = app.selected.reduce((sum, actor) => sum + actor.maxHp, 0);
    $('#selection-class').textContent = 'TACTICAL GROUP';
    $('#selection-name').textContent = `${app.selected.length} units selected`;
    $('#selection-description').textContent = 'Coordinated order ready. Right-click to move or attack.';
    $('#health-value').textContent = `${Math.round(hp)} / ${Math.round(max)}`;
    $('#health-fill').style.width = `${(hp / max) * 100}%`;
    setStats(
      Math.round(app.selected.reduce((sum, actor) => sum + (actor.data.ataque || 0), 0)),
      Math.round(app.selected.reduce((sum, actor) => sum + (actor.data.defensa || 0), 0) / app.selected.length),
      Math.max(...app.selected.map((actor) => actor.data.alcance || 0)),
    );
    portrait.textContent = '✥';
    return;
  }
  const actor = app.selected[0];
  $('#selection-class').textContent = `${actor.kind === 'unit' ? 'UNIT' : 'BUILDING'} · ${actor.data.era}`;
  $('#selection-name').textContent = actor.data.nombre;
  $('#selection-description').textContent = actor.data.rol || actor.data.funcion || 'Strategic entity.';
  $('#health-value').textContent = `${Math.ceil(actor.hp)} / ${actor.maxHp}`;
  $('#health-fill').style.width = `${(actor.hp / actor.maxHp) * 100}%`;
  setStats(actor.data.ataque || 0, actor.data.defensa || 0, actor.data.alcance || 0);
  portrait.textContent = PORTRAITS[actor.type] || '⌖';
}

function renderHUD() {
  document.body.dataset.era = String(ERA_IDS.indexOf(app.state.era));
  const identity = IDENTIDAD_ERAS[app.state.era];
  Object.entries(identity.recursos).forEach(([id, label]) => {
    const element = document.querySelector(`.resource[data-resource="${id}"] small`);
    if (element) element.textContent = label.toUpperCase();
  });
  Object.keys(RECURSOS).forEach((id) => { $(`#resource-${id}`).textContent = Math.floor(app.state.recursos[id]).toLocaleString('en-US'); });
  $('#resource-poblacion').textContent = `${app.state.poblacion.actual}/${app.state.poblacion.limite}`;
  $('#mission-clock').textContent = new Date(app.elapsed * 1000).toISOString().slice(14, 19);
  const remaining = Math.max(0, app.waveAt - app.elapsed);
  $('#wave-timer').textContent = new Date(remaining * 1000).toISOString().slice(14, 19);
  const eraIndex = ERA_IDS.indexOf(app.state.era);
  $$('#era-track li').forEach((item, index) => {
    item.classList.toggle('active', index === eraIndex);
    item.classList.toggle('complete', index < eraIndex);
  });
  $('#era-progress').style.width = `${(eraIndex / (ERA_IDS.length - 1)) * 100}%`;
  $('[data-objective="era"]').classList.toggle('complete', app.state.era >= 2000);
  $('[data-objective="army"]').classList.toggle('complete', app.state.unidades.length >= 6);
  const enemyCoreAlive = [...app.actors].some((actor) => actor.alive && actor.team === 'enemy' && actor.type === 'centro');
  $('[data-objective="enemy"]').classList.toggle('complete', !enemyCoreAlive);
  renderCommands();
  updateSelectionPanel();
}

function train(type) {
  const result = entrenarUnidad(app.state, type);
  if (!result.exito) return notify(result.mensaje, true);
  app.state = result.estado;
  const producer = [...app.actors].find((actor) => actor.team === 'player' && actor.kind === 'building' && actor.data.entrena?.includes(type));
  const angle = Math.random() * Math.PI * 2;
  const radius = (producer?.root.userData.radius || 3) + 2.1;
  const x = (producer?.root.position.x || -10) + Math.cos(angle) * radius;
  const z = (producer?.root.position.z || 9) + Math.sin(angle) * radius;
  const actor = spawnActor(result.entidad, 'player', x, z, { construction: 0.05 });
  actor.destination = new THREE.Vector3(x + Math.cos(angle) * 3, 0, z + Math.sin(angle) * 3);
  setSelection([actor]);
  notify(result.mensaje);
  sound.tone(520, 0.08);
  renderHUD();
}

function tintPreview(preview, valid) {
  preview.traverse((child) => {
    if (!child.isMesh || child.userData.selectionFx) return;
    if (!child.userData.previewColor) child.userData.previewColor = child.material.color?.clone();
    if (child.material.color) child.material.color.copy(valid ? child.userData.previewColor : new THREE.Color(0xe34f48));
  });
}

function cancelPlacement() {
  if (!app.pendingBuild) return;
  world.group.remove(app.pendingBuild.preview);
  disposeObject3D(app.pendingBuild.preview);
  app.pendingBuild = null;
  canvasHost.classList.remove('is-commanding');
  $('#world-tooltip').style.display = 'none';
  $$('#command-grid button').forEach((button) => button.classList.remove('active'));
}

function beginPlacement(type) {
  cancelPlacement();
  const ficha = obtenerEdificio(type, app.state.era);
  if (!puedePagar(app.state.recursos, ficha.coste)) return notify('Not enough resources to build.', true);
  const preview = createBuilding({ type, era: app.state.era, team: 'player', color: entityColor('player'), name: `Preview: ${ficha.nombre}` });
  preview.userData.selectable = false;
  preview.traverse((child) => {
    if (!child.isMesh) return;
    child.material = child.material.clone();
    child.material.transparent = true;
    child.material.opacity = 0.55;
    child.material.depthWrite = false;
  });
  world.group.add(preview);
  app.pendingBuild = { type, ficha, preview, valid: false, position: new THREE.Vector3() };
  canvasHost.classList.add('is-commanding');
  $(`#command-grid [data-command="${type}"]`)?.classList.add('active');
  notify(`Place ${ficha.nombre.toLowerCase()} on open ground.`);
}

function placeBuilding() {
  const pending = app.pendingBuild;
  if (!pending?.valid) return notify('You cannot build in that location.', true);
  const result = construirEdificio(app.state, pending.type);
  if (!result.exito) return notify(result.mensaje, true);
  const position = pending.position.clone();
  cancelPlacement();
  app.state = result.estado;
  const actor = spawnActor(result.entidad, 'player', position.x, position.z, { construction: 0.05 });
  setSelection([actor]);
  world.addEffect(createCommandFX([position.x, position.y + 0.08, position.z], entityColor('player'), 'build'));
  notify(result.mensaje);
  sound.tone(340, 0.11);
  renderHUD();
}

function advanceAge() {
  const result = avanzarEra(app.state);
  if (!result.exito) return notify(result.mensaje, true);
  app.state = result.estado;
  world.setEra(app.state.era);
  app.actors.forEach((actor) => { if (actor.team === 'player') replaceActorVisual(actor, app.state.era); });
  app.state = recalcularPoblacion({
    ...app.state,
    unidades: app.state.unidades.map((entity) => ({ ...entity, ...obtenerUnidad(entity.tipo, app.state.era), id: entity.id, equipo: entity.equipo })),
    edificios: app.state.edificios.map((entity) => ({ ...entity, ...obtenerEdificio(entity.tipo, app.state.era), id: entity.id, equipo: entity.equipo })),
  });
  const center = [...app.actors].find((actor) => actor.team === 'player' && actor.type === 'centro');
  if (center) world.addEffect(createCommandFX(center.root.position, 0xf4dfa1, 'build'));
  document.body.classList.remove('era-transition');
  requestAnimationFrame(() => document.body.classList.add('era-transition'));
  setTimeout(() => document.body.classList.remove('era-transition'), 1300);
  notify(result.mensaje);
  notify(`Age bonus: ${IDENTIDAD_ERAS[app.state.era].bono.nombre}.`);
  sound.fanfare();
  renderHUD();
}

function executeCommand(id) {
  const command = commandCatalog().find((item) => item.id === id);
  if (!command?.available) return notify('That order is not available yet.', true);
  if (command.action === 'train') train(command.type);
  else if (command.action === 'build') beginPlacement(command.type);
  else advanceAge();
}

$('#command-grid').addEventListener('click', (event) => {
  const button = event.target.closest('[data-command]');
  if (button) executeCommand(button.dataset.command);
});

function normalizedPointer(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  return pointer;
}

function isEffectivelyVisible(object) {
  for (let current = object; current; current = current.parent) if (!current.visible) return false;
  return true;
}

function hitsAt(event) {
  raycaster.setFromCamera(normalizedPointer(event), camera);
  return raycaster.intersectObjects(world.pickables, true)
    .filter((hit) => !hit.object.userData.raycastIgnore && isEffectivelyVisible(hit.object));
}

function groundHit(hits) {
  return hits.find((hit) => hit.object === world.terrain || hit.object.userData.worldSurface || hit.object.userData.raycastRole === 'terrain');
}

function selectableHit(hits) {
  for (const hit of hits) {
    const root = findSelectableRoot(hit);
    if (root) return root;
  }
  return null;
}

function updateBuildPreview(event) {
  if (!app.pendingBuild) return;
  const hit = groundHit(hitsAt(event));
  if (!hit) return;
  const { preview } = app.pendingBuild;
  const x = Math.round(hit.point.x);
  const z = Math.round(hit.point.z);
  const y = groundY(x, z);
  preview.position.set(x, y + 0.04, z);
  const radius = preview.userData.radius * 0.68;
  const blocked = [...app.actors].some((actor) => actor.kind === 'building' && actor.root.position.distanceTo(preview.position) < radius + actor.root.userData.radius * 0.58)
    || app.resources.some((node) => node.position.distanceTo(preview.position) < radius + node.userData.radius);
  const valid = y > world.group.userData.waterLevel + 0.25 && Math.abs(x) < 42 && Math.abs(z) < 42 && !blocked;
  app.pendingBuild.valid = valid;
  app.pendingBuild.position.copy(preview.position);
  tintPreview(preview, valid);
  const tooltip = $('#world-tooltip');
  tooltip.textContent = valid ? `Build ${app.pendingBuild.ficha.nombre}` : 'Invalid terrain';
  tooltip.style.display = 'block';
  tooltip.style.left = `${event.clientX + 14}px`;
  tooltip.style.top = `${event.clientY + 14}px`;
}

function showHover(event) {
  if (app.pendingBuild) return updateBuildPreview(event);
  const root = selectableHit(hitsAt(event));
  const tooltip = $('#world-tooltip');
  if (!root) {
    tooltip.style.display = 'none';
    return;
  }
  const actor = root.userData.actor;
  tooltip.textContent = actor
    ? `${actor.data.nombre} · ${Math.ceil(actor.hp)}/${actor.maxHp}`
    : `${root.name} · ${Math.ceil(root.userData.amount)} remaining`;
  tooltip.style.display = 'block';
  tooltip.style.left = `${event.clientX + 14}px`;
  tooltip.style.top = `${event.clientY + 14}px`;
}

function selectSingle(event) {
  const root = selectableHit(hitsAt(event));
  const actor = root?.userData.actor;
  if (!actor) return setSelection([]);
  if (event.shiftKey) {
    const next = app.selected.includes(actor) ? app.selected.filter((item) => item !== actor) : [...app.selected, actor];
    setSelection(next);
  } else setSelection([actor]);
  sound.tone(actor.team === 'enemy' ? 160 : 430, 0.045);
}

function selectInBox(start, end, additive = false) {
  const left = Math.min(start.x, end.x);
  const right = Math.max(start.x, end.x);
  const top = Math.min(start.y, end.y);
  const bottom = Math.max(start.y, end.y);
  const selected = [...app.actors].filter((actor) => {
    if (!actor.alive || actor.team !== 'player' || actor.kind !== 'unit') return false;
    const projected = actor.root.position.clone().project(camera);
    const x = (projected.x * 0.5 + 0.5) * innerWidth;
    const y = (-projected.y * 0.5 + 0.5) * innerHeight;
    return x >= left && x <= right && y >= top && y <= bottom;
  });
  setSelection(additive ? [...app.selected, ...selected] : selected);
}

renderer.domElement.addEventListener('pointerdown', (event) => {
  if (!app.started || event.button !== 0) return;
  app.drag = { start: { x: event.clientX, y: event.clientY }, end: { x: event.clientX, y: event.clientY }, moved: false };
  renderer.domElement.setPointerCapture(event.pointerId);
});

renderer.domElement.addEventListener('pointermove', (event) => {
  app.lastPointerEvent = event;
  app.pointerDirty = true;
  if (!app.drag) return;
  app.drag.end = { x: event.clientX, y: event.clientY };
  app.drag.moved = Math.hypot(app.drag.end.x - app.drag.start.x, app.drag.end.y - app.drag.start.y) > 6;
  if (!app.drag.moved || app.pendingBuild) return;
  const box = $('#selection-box');
  box.style.display = 'block';
  box.style.left = `${Math.min(app.drag.start.x, app.drag.end.x)}px`;
  box.style.top = `${Math.min(app.drag.start.y, app.drag.end.y)}px`;
  box.style.width = `${Math.abs(app.drag.end.x - app.drag.start.x)}px`;
  box.style.height = `${Math.abs(app.drag.end.y - app.drag.start.y)}px`;
});

renderer.domElement.addEventListener('pointerleave', () => {
  app.lastPointerEvent = null;
  if (!app.pendingBuild) $('#world-tooltip').style.display = 'none';
});

renderer.domElement.addEventListener('dblclick', (event) => {
  const actor = selectableHit(hitsAt(event))?.userData.actor;
  if (actor?.alive && actor.team === 'player' && actor.kind === 'unit') {
    const visiblePeers = [...app.actors].filter((candidate) => {
      if (!candidate.alive || candidate.team !== 'player' || candidate.kind !== 'unit' || candidate.type !== actor.type) return false;
      const projected = candidate.root.position.clone().project(camera);
      return Math.abs(projected.x) <= 1 && Math.abs(projected.y) <= 1 && projected.z >= -1 && projected.z <= 1;
    });
    setSelection(visiblePeers);
  } else if (actor?.alive) cameraGoal.copy(actor.root.position);
});

renderer.domElement.addEventListener('pointerup', (event) => {
  if (!app.drag || event.button !== 0) return;
  const drag = app.drag;
  app.drag = null;
  $('#selection-box').style.display = 'none';
  if (app.pendingBuild) placeBuilding();
  else if (drag.moved) selectInBox(drag.start, drag.end, event.shiftKey);
  else selectSingle(event);
});

function commandSelected(event) {
  event.preventDefault();
  if (!app.started || app.pendingBuild) return;
  const selected = app.selected.filter((actor) => actor.team === 'player' && actor.alive);
  if (!selected.length) return;
  const hits = hitsAt(event);
  const root = selectableHit(hits);
  const targetActor = root?.userData.actor;
  if (targetActor?.team === 'enemy') {
    selected.forEach((actor) => { actor.target = targetActor; actor.destination = null; actor.gatherNode = null; });
    world.addEffect(createCommandFX(targetActor.root.position, TEAM_COLORS.enemy, 'attack'));
    notify(`Attacking ${targetActor.data.nombre.toLowerCase()}.`, true);
    return;
  }
  if (root?.userData.resource) {
    const workers = selected.filter((actor) => actor.type === 'trabajador');
    workers.forEach((actor) => { actor.gatherNode = root; actor.target = null; actor.destination = root.position.clone(); });
    world.addEffect(createCommandFX(root.position, RESOURCE_VISUALS[root.userData.resource].color, 'gather'));
    notify(workers.length ? `Gathering ${RECURSOS[root.userData.resource].nombre.toLowerCase()}.` : 'Only workers can gather resources.', !workers.length);
    return;
  }
  const hit = groundHit(hits);
  if (!hit) return;
  const columns = Math.ceil(Math.sqrt(selected.length));
  selected.forEach((actor, index) => {
    const offsetX = (index % columns - (columns - 1) / 2) * 1.7;
    const offsetZ = (Math.floor(index / columns) - (Math.ceil(selected.length / columns) - 1) / 2) * 1.7;
    actor.destination = new THREE.Vector3(hit.point.x + offsetX, 0, hit.point.z + offsetZ);
    actor.target = null;
    actor.gatherNode = null;
  });
  world.addEffect(createCommandFX([hit.point.x, groundY(hit.point.x, hit.point.z) + 0.08, hit.point.z], entityColor('player'), 'move'));
  sound.tone(300, 0.045);
}

renderer.domElement.addEventListener('contextmenu', commandSelected);
renderer.domElement.addEventListener('wheel', (event) => {
  event.preventDefault();
  const hit = groundHit(hitsAt(event));
  camera.zoom = THREE.MathUtils.clamp(camera.zoom * Math.exp(-event.deltaY * 0.001), 0.72, 1.8);
  camera.updateProjectionMatrix();
  if (hit && event.deltaY < 0) cameraGoal.lerp(hit.point, 0.16);
}, { passive: false });

function makeProjectile(source, target, color) {
  const geometry = new THREE.SphereGeometry(0.12, 8, 6);
  const material = new THREE.MeshBasicMaterial({ color, toneMapped: false });
  const mesh = new THREE.Mesh(geometry, material);
  const start = source.clone().add(new THREE.Vector3(0, 1.3, 0));
  const end = target.clone().add(new THREE.Vector3(0, 1, 0));
  mesh.position.copy(start);
  scene.add(mesh);
  let age = 0;
  const projectile = { mesh, age, duration: 0.28, start, end };
  app.projectiles.add(projectile);
}

function createDebrisFX(position, color) {
  const group = new THREE.Group();
  group.position.copy(position);
  group.name = 'Destruction debris';
  const geometry = new THREE.BoxGeometry(0.32, 0.24, 0.28);
  const materials = [
    new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0.2 }),
    new THREE.MeshStandardMaterial({ color: 0x252c2c, roughness: 0.92 }),
  ];
  const fragments = [];
  for (let index = 0; index < 14; index += 1) {
    const angle = index * 2.39996;
    const mesh = new THREE.Mesh(geometry, materials[index % 2]);
    mesh.position.y = 0.5 + (index % 4) * 0.22;
    mesh.scale.setScalar(0.65 + (index % 3) * 0.28);
    mesh.castShadow = true;
    group.add(mesh);
    fragments.push({
      mesh,
      velocity: new THREE.Vector3(Math.cos(angle) * (2.4 + index % 5), 3.4 + (index % 4) * 0.8, Math.sin(angle) * (2.4 + index % 5)),
      spin: new THREE.Vector3(1.4 + index * 0.08, 2.1 - index * 0.04, 1.1 + (index % 3)),
    });
  }
  let age = 0;
  group.done = false;
  group.update = (delta) => {
    age += delta;
    fragments.forEach(({ mesh, velocity, spin }) => {
      velocity.y -= 13 * delta;
      mesh.position.addScaledVector(velocity, delta);
      if (mesh.position.y < 0.12) { mesh.position.y = 0.12; velocity.y *= -0.22; velocity.x *= 0.68; velocity.z *= 0.68; }
      mesh.rotation.x += spin.x * delta;
      mesh.rotation.y += spin.y * delta;
      mesh.rotation.z += spin.z * delta;
      mesh.scale.multiplyScalar(1 - delta * 0.35);
    });
    group.done = age > 2.2;
  };
  group.dispose = () => disposeObject3D(group);
  return group;
}

function updateProjectiles(delta) {
  for (const projectile of app.projectiles) {
    projectile.age += delta;
    const progress = Math.min(1, projectile.age / projectile.duration);
    projectile.mesh.position.lerpVectors(projectile.start, projectile.end, progress);
    projectile.mesh.position.y += Math.sin(progress * Math.PI) * 0.65;
    if (progress < 1) continue;
    scene.remove(projectile.mesh);
    projectile.mesh.geometry.dispose();
    projectile.mesh.material.dispose();
    app.projectiles.delete(projectile);
  }
}

function removeActor(actor) {
  if (!actor.alive) return;
  actor.alive = false;
  app.selected = app.selected.filter((item) => item !== actor);
  world.addEffect(createCommandFX(actor.root.position, actor.team === 'enemy' ? 0xff654f : 0xf4dfa1, 'impact'));
  world.addEffect(createDebrisFX(actor.root.position, actor.team === 'enemy' ? 0x7d3028 : 0x315b65));
  app.shake = Math.min(1.4, app.shake + (actor.kind === 'building' ? 0.85 : 0.3));
  world.unregister(actor.root);
  disposeObject3D(actor.root);
  app.actors.delete(actor);
  if (actor.team === 'player') {
    if (actor.kind === 'unit') {
      app.state = {
        ...app.state,
        unidades: app.state.unidades.filter(({ id }) => id !== actor.id),
        poblacion: { ...app.state.poblacion, actual: Math.max(0, app.state.poblacion.actual - (actor.data.poblacion || 1)) },
      };
    } else {
      app.state = recalcularPoblacion({
        ...app.state,
        edificios: app.state.edificios.filter(({ id }) => id !== actor.id),
      });
    }
  }
  updateSelectionPanel();
  if (actor.team === 'enemy' && actor.type === 'centro') {
    notify('Enemy core destroyed. The sector is ours.');
    setTimeout(showVictory, 1200);
  }
}

function strike(attacker, target) {
  const result = atacar(
    { ...attacker.data, vida: attacker.hp, equipo: attacker.team },
    { ...target.data, vida: target.hp, equipo: target.team },
  );
  if (!result.exito) return;
  target.hp = result.objetivo.vida;
  app.shake = Math.min(0.65, app.shake + (attacker.type === 'artilleria' ? 0.2 : 0.035));
  updateHealthBadge(target);
  makeProjectile(attacker.root.position, target.root.position, attacker.team === 'player' ? entityColor('player') : TEAM_COLORS.enemy);
  if (target.hp <= 0) removeActor(target);
}

function moveActor(actor, destination, delta) {
  const direction = destination.clone().sub(actor.root.position);
  direction.y = 0;
  const distance = direction.length();
  if (distance < 0.18) return true;
  direction.normalize();
  const step = Math.min(distance, actor.speed * delta);
  actor.root.position.addScaledVector(direction, step);
  actor.root.position.y = groundY(actor.root.position.x, actor.root.position.z) + 0.08;
  const targetRotation = Math.atan2(-direction.z, direction.x);
  actor.root.rotation.y = THREE.MathUtils.lerp(actor.root.rotation.y, targetRotation, Math.min(1, delta * 8));
  return distance < 0.25;
}

function closestActor(source, predicate, maxDistance = Infinity) {
  let closest = null;
  let distance = maxDistance;
  for (const candidate of app.actors) {
    if (!candidate.alive || candidate === source || !predicate(candidate)) continue;
    const nextDistance = source.root.position.distanceTo(candidate.root.position);
    if (nextDistance < distance) { closest = candidate; distance = nextDistance; }
  }
  return closest;
}

function depleteResourceNode(node) {
  app.actors.forEach((actor) => {
    if (actor.gatherNode !== node) return;
    actor.gatherNode = null;
    actor.destination = null;
  });
  world.unregister(node);
  disposeObject3D(node);
  app.resources = app.resources.filter((resource) => resource !== node);
}

function updateActor(actor, delta) {
  if (!actor.alive) return;
  actor.attackCooldown -= delta;
  if (actor.construction < 1) {
    actor.construction = Math.min(1, actor.construction + delta * 0.72);
    actor.root.scale.setScalar(THREE.MathUtils.smoothstep(actor.construction, 0, 1));
  }
  if (actor.kind === 'building' && actor.data.ataque > 0 && !actor.target) {
    actor.target = closestActor(actor, (candidate) => candidate.team !== actor.team, actor.range + 1.5);
  }
  if (actor.team === 'enemy' && actor.kind === 'unit' && !actor.target && app.elapsed > 75) {
    actor.target = closestActor(actor, (candidate) => candidate.team === 'player' && candidate.kind === 'building');
  }
  if (actor.target && !actor.target.alive) actor.target = null;
  if (actor.target) {
    const distance = actor.root.position.distanceTo(actor.target.root.position);
    const attackRange = Math.max(1.2, actor.range * 0.52) + actor.target.root.userData.radius * 0.28;
    if (distance > attackRange && actor.kind === 'unit') moveActor(actor, actor.target.root.position, delta);
    else if (distance <= attackRange && actor.attackCooldown <= 0) {
      strike(actor, actor.target);
      actor.attackCooldown = actor.type === 'artilleria' ? 2.25 : 1.05;
    }
    return;
  }
  if (actor.gatherNode) {
    const node = actor.gatherNode;
    if (node.userData.amount <= 0) { depleteResourceNode(node); return; }
    const arrived = moveActor(actor, node.position, delta);
    if (arrived || actor.root.position.distanceTo(node.position) < node.userData.radius + 0.8) {
      actor.destination = null;
      actor.gatherClock += delta;
      if (actor.gatherClock >= 1) {
        actor.gatherClock = 0;
        const identity = IDENTIDAD_ERAS[app.state.era];
        const bonus = identity.bono.recurso === node.userData.resource ? identity.bono.multiplicador : 1;
        const requested = Math.max(2, Math.round((actor.data.recoleccion || 8) * 0.65 * bonus));
        const amount = Math.min(requested, node.userData.amount);
        const result = recolectar(app.state, node.userData.resource, amount);
        app.state = result.estado;
        node.userData.amount -= amount;
        if (node.userData.amount <= 0) depleteResourceNode(node);
        else node.scale.setScalar(0.45 + node.userData.amount / node.userData.initialAmount * 0.55);
      }
    }
    return;
  }
  if (actor.destination && moveActor(actor, actor.destination, delta)) actor.destination = null;
}

function runEconomyTick() {
  const buildings = app.state.edificios;
  const yields = {
    alimentos: 2 + buildings.filter(({ tipo }) => tipo === 'centro').length,
    materiales: buildings.filter(({ tipo }) => tipo === 'fabrica').length * 2,
    energia: 1 + buildings.filter(({ tipo }) => tipo === 'cuartel').length,
    datos: buildings.filter(({ tipo }) => tipo === 'laboratorio').length * 3,
  };
  const bonus = IDENTIDAD_ERAS[app.state.era].bono;
  yields[bonus.recurso] *= bonus.multiplicador;
  Object.entries(yields).forEach(([resource, amount]) => { if (amount) app.state = recolectar(app.state, resource, amount).estado; });
}

function spawnWave() {
  app.wave += 1;
  const enemyEra = ERA_IDS[Math.min(ERA_IDS.length - 1, Math.floor(app.elapsed / 110))];
  const enemyCore = [...app.actors].find((actor) => actor.team === 'enemy' && actor.type === 'centro');
  if (enemyCore && enemyCore.data.era !== enemyEra) replaceActorVisual(enemyCore, enemyEra);
  const count = Math.min(6, 2 + app.wave);
  for (let index = 0; index < count; index += 1) {
    const type = app.wave >= 2 && index === count - 1 ? 'vehiculo' : 'infanteria';
    const x = 18 + index * 1.7;
    const z = -10 - (index % 2) * 1.6;
    const unit = spawnActor(enemyEntity(type, 'unit', enemyEra), 'enemy', x, z, { construction: 0.2 });
    unit.target = closestActor(unit, (actor) => actor.team === 'player' && actor.kind === 'building');
  }
  app.waveAt = app.elapsed + Math.max(45, 78 - app.wave * 4);
  notify(`Enemy raid ${app.wave} detected.`, true);
  sound.alarm();
}

function updateCamera(delta) {
  const fast = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 2.1 : 1;
  const speed = 18 * fast / camera.zoom;
  let side = 0;
  let forward = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) forward += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) forward -= 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) side -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) side += 1;
  const event = app.lastPointerEvent;
  if (event && !app.drag && !app.pendingBuild) {
    const margin = 9;
    if (event.clientX < margin) side -= 1;
    if (event.clientX > innerWidth - margin) side += 1;
    if (event.clientY < margin) forward += 1;
    if (event.clientY > innerHeight - margin) forward -= 1;
  }
  if (side || forward) {
    const length = Math.hypot(side, forward) || 1;
    side /= length;
    forward /= length;
    const cos = Math.cos(app.yaw);
    const sin = Math.sin(app.yaw);
    cameraGoal.x += (side * sin - forward * cos) * speed * delta;
    cameraGoal.z += (-side * cos - forward * sin) * speed * delta;
  }
  cameraGoal.x = THREE.MathUtils.clamp(cameraGoal.x, -28, 28);
  cameraGoal.z = THREE.MathUtils.clamp(cameraGoal.z, -28, 28);
  cameraTarget.lerp(cameraGoal, 1 - Math.exp(-delta * 7.5));
  const radius = 55;
  camera.position.set(cameraTarget.x + Math.cos(app.yaw) * radius, 45, cameraTarget.z + Math.sin(app.yaw) * radius);
  if (app.shake > 0.001 && !app.reducedMotion) {
    const phase = performance.now() * 0.035;
    camera.position.x += Math.sin(phase * 1.7) * app.shake;
    camera.position.y += Math.sin(phase * 2.3) * app.shake * 0.55;
    camera.position.z += Math.cos(phase * 1.3) * app.shake;
    app.shake *= Math.exp(-delta * 7.5);
  }
  cameraLook.set(cameraTarget.x, groundY(cameraTarget.x, cameraTarget.z), cameraTarget.z);
  camera.lookAt(cameraLook);
}

function drawMinimap() {
  const { width, height } = minimap;
  const gradient = mapContext.createRadialGradient(width * 0.48, height * 0.46, 5, width * 0.5, height * 0.5, width * 0.7);
  gradient.addColorStop(0, '#3c563d');
  gradient.addColorStop(0.72, '#304b36');
  gradient.addColorStop(0.73, '#927d55');
  gradient.addColorStop(0.79, '#174e5a');
  gradient.addColorStop(1, '#092c3a');
  mapContext.fillStyle = gradient;
  mapContext.fillRect(0, 0, width, height);
  mapContext.strokeStyle = 'rgba(235,216,164,.1)';
  mapContext.lineWidth = 1;
  for (let x = 0; x < width; x += 22) { mapContext.beginPath(); mapContext.moveTo(x, 0); mapContext.lineTo(x, height); mapContext.stroke(); }
  for (let y = 0; y < height; y += 20) { mapContext.beginPath(); mapContext.moveTo(0, y); mapContext.lineTo(width, y); mapContext.stroke(); }
  const mapPoint = (position) => ({ x: (position.x / 92 + 0.5) * width, y: (position.z / 92 + 0.5) * height });
  app.resources.forEach((node) => {
    if (app.started && fogOfWar.stateAt(node.position) !== FOG_VISIBLE) return;
    const point = mapPoint(node.position);
    mapContext.fillStyle = `#${RESOURCE_VISUALS[node.userData.resource].color.toString(16).padStart(6, '0')}`;
    mapContext.fillRect(point.x - 1.5, point.y - 1.5, 3, 3);
  });
  app.actors.forEach((actor) => {
    if (!actor.alive || (actor.team === 'enemy' && app.started && fogOfWar.stateAt(actor.root.position) !== FOG_VISIBLE)) return;
    const point = mapPoint(actor.root.position);
    mapContext.fillStyle = actor.team === 'player' ? FACTIONS[app.faction].acento : '#ef6955';
    const size = actor.kind === 'building' ? 5 : 2.5;
    mapContext.fillRect(point.x - size / 2, point.y - size / 2, size, size);
  });
  if (app.started) fogOfWar.drawOn(mapContext, width, height);
  const focus = mapPoint(cameraTarget);
  mapContext.strokeStyle = 'rgba(244,223,161,.85)';
  mapContext.strokeRect(focus.x - 18 / camera.zoom, focus.y - 12 / camera.zoom, 36 / camera.zoom, 24 / camera.zoom);
}

minimap.addEventListener('click', (event) => {
  const rect = minimap.getBoundingClientRect();
  cameraGoal.x = ((event.clientX - rect.left) / rect.width - 0.5) * 92;
  cameraGoal.z = ((event.clientY - rect.top) / rect.height - 0.5) * 92;
});

function createSoundscape() {
  let context;
  let master;
  let enabled = false;
  const oscillators = [];
  const ensure = () => {
    if (context) return;
    context = new AudioContext();
    master = context.createGain();
    master.gain.value = 0;
    master.connect(context.destination);
    [54, 81].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = index ? 'sine' : 'triangle';
      oscillator.frequency.value = frequency;
      gain.gain.value = index ? 0.018 : 0.012;
      oscillator.connect(gain).connect(master);
      oscillator.start();
      oscillators.push(oscillator);
    });
  };
  const setEnabled = (value) => {
    ensure();
    enabled = value;
    master.gain.cancelScheduledValues(context.currentTime);
    master.gain.linearRampToValueAtTime(value ? 0.65 : 0, context.currentTime + 0.3);
    $('#audio-toggle').setAttribute('aria-pressed', String(value));
    $('#audio-toggle').setAttribute('aria-label', value ? 'Mute sound' : 'Enable sound');
  };
  const tone = (frequency, duration = 0.08, volume = 0.05) => {
    if (!enabled || !context) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(60, frequency * 0.8), context.currentTime + duration);
    gain.gain.setValueAtTime(volume, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
    oscillator.connect(gain).connect(master);
    oscillator.start();
    oscillator.stop(context.currentTime + duration);
  };
  return {
    toggle: () => setEnabled(!enabled),
    tone,
    fanfare: () => { [330, 440, 660].forEach((frequency, index) => setTimeout(() => tone(frequency, 0.3, 0.07), index * 120)); },
    alarm: () => { tone(150, 0.35, 0.08); setTimeout(() => tone(110, 0.35, 0.08), 220); },
  };
}

const sound = createSoundscape();

function updateGame(delta) {
  app.elapsed += delta;
  app.actors.forEach((actor) => updateActor(actor, delta));
  updateProjectiles(delta);
  app.resources.forEach((node) => node.traverse((child) => { if (child.userData.spin) child.rotation.z += child.userData.spin * delta; }));
  app.economyAccumulator += delta;
  if (app.economyAccumulator >= 1) { app.economyAccumulator -= 1; runEconomyTick(); }
  if (app.elapsed >= app.waveAt) spawnWave();
  app.uiAccumulator += delta;
  if (app.uiAccumulator >= 0.25) { app.uiAccumulator = 0; renderHUD(); }
  app.minimapAccumulator += delta;
  if (app.minimapAccumulator >= 0.12) { app.minimapAccumulator = 0; fogOfWar.update(); drawMinimap(); }
}

function animate(now = performance.now()) {
  requestAnimationFrame(animate);
  const delta = Math.min((now - previousFrame) / 1000, 0.05);
  previousFrame = now;
  app.fpsFrames += 1;
  app.fpsTime += delta;
  if (app.fpsTime > 0.8) {
    $('#fps-counter').textContent = `${Math.round(app.fpsFrames / app.fpsTime)} FPS`;
    app.fpsFrames = 0;
    app.fpsTime = 0;
  }
  if (!app.paused) {
    if (!app.started && !app.reducedMotion) app.yaw += delta * 0.045;
    updateCamera(delta);
    world.update(app.reducedMotion ? 0 : delta, app.elapsed);
    if (app.started) updateGame(delta);
    if (app.pointerDirty && app.lastPointerEvent) {
      app.pointerDirty = false;
      showHover(app.lastPointerEvent);
    }
  }
  composer.render();
}

function selectFaction(id) {
  app.faction = id;
  const faction = FACTIONS[id];
  document.documentElement.style.setProperty('--teal', faction.acento);
  $$('.faction-choice button').forEach((button) => button.classList.toggle('selected', button.dataset.faction === id));
  $('.faction-mark').textContent = faction.marca;
  $('.faction-badge strong').textContent = faction.nombre.toUpperCase();
  app.actors.forEach((actor) => { if (actor.team === 'player') replaceActorVisual(actor, actor.data.era); });
}

$$('.faction-choice button').forEach((button) => button.addEventListener('click', () => selectFaction(button.dataset.faction)));

$('#start-game').addEventListener('click', () => {
  app.started = true;
  fogOfWar.mesh.visible = true;
  fogOfWar.update();
  $('#intro').classList.add('is-leaving');
  $('#hud').classList.remove('is-hidden');
  notify('Operation New Horizon launched.');
  notify('Order your workers to gather resources.');
  sound.tone(440, 0.18);
  setTimeout(() => { $('#intro').style.display = 'none'; }, 1150);
});

$('#audio-toggle').addEventListener('click', () => sound.toggle());
$('#motion-toggle').addEventListener('click', () => {
  app.reducedMotion = !app.reducedMotion;
  document.documentElement.classList.toggle('no-motion', app.reducedMotion);
  $('#motion-toggle').setAttribute('aria-pressed', String(app.reducedMotion));
  bloom.strength = app.reducedMotion ? 0.14 : 0.3;
});

const helpDialog = $('#help-dialog');
$('#help-toggle').addEventListener('click', () => { app.paused = true; helpDialog.showModal(); });
helpDialog.addEventListener('close', () => { app.paused = false; });

function showVictory() {
  app.paused = true;
  $('#end-screen').classList.add('visible');
  $('#end-screen').setAttribute('aria-hidden', 'false');
  sound.fanfare();
}

$('#restart-game').addEventListener('click', () => location.reload());

addEventListener('keydown', (event) => {
  if (['INPUT', 'TEXTAREA', 'BUTTON'].includes(event.target.tagName) && event.code !== 'Escape') return;
  if (event.code === 'KeyQ') app.yaw -= Math.PI / 12;
  else if (event.code === 'KeyE') app.yaw += Math.PI / 12;
  else if (event.code === 'KeyH') {
    const center = [...app.actors].find((actor) => actor.team === 'player' && actor.type === 'centro');
    if (center) cameraGoal.copy(center.root.position);
  } else if (event.code === 'Period') {
    const worker = [...app.actors].find((actor) => actor.team === 'player' && actor.type === 'trabajador' && !actor.destination && !actor.gatherNode && !actor.target);
    if (worker) { setSelection([worker]); cameraGoal.copy(worker.root.position); }
  }
  else keys.add(event.code);
  if (event.code === 'Escape') cancelPlacement();
  if (app.started && /^Digit[1-9]$/.test(event.code)) {
    const command = commandCatalog()[Number(event.code.slice(-1)) - 1];
    if (command) executeCommand(command.id);
  }
});
addEventListener('keyup', (event) => keys.delete(event.code));
addEventListener('blur', () => keys.clear());

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  resizeIsometricCamera(camera, innerWidth, innerHeight);
});

renderHUD();
drawMinimap();
loadingStep(100, 'Sector ready.');
requestAnimationFrame(() => setTimeout(() => loading.classList.add('is-done'), 450));
animate();

// ponytail: direct movement; add navmesh pathfinding when terrain creates real route blockers.
