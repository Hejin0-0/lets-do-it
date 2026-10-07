export const ERA_IDS = Object.freeze([1800, 1900, 2000, 2100]);
export const ERA_INICIAL = ERA_IDS[0];
export const ERA_FINAL = ERA_IDS.at(-1);

export const ERAS = Object.freeze([
  Object.freeze({ id: 1800, nombre: 'Steam Age', equivalente: 'Dark Age', descripcion: 'Steam, coal, and handcrafted production.' }),
  Object.freeze({ id: 1900, nombre: 'Industrial Age', equivalente: 'Feudal Age', descripcion: 'Engines, steel, and mass production.' }),
  Object.freeze({ id: 2000, nombre: 'Digital Age', equivalente: 'Castle Age', descripcion: 'Networks, automation, and precision warfare.' }),
  Object.freeze({ id: 2100, nombre: 'Fusion Age', equivalente: 'Imperial Age', descripcion: 'Fusion, synthetic intelligence, and programmable matter.' }),
]);

export const RECURSOS = Object.freeze({
  alimentos: Object.freeze({ id: 'alimentos', nombre: 'Food', icono: '◆', color: '#e5b85c' }),
  materiales: Object.freeze({ id: 'materiales', nombre: 'Materials', icono: '⬢', color: '#b6c2c9' }),
  energia: Object.freeze({ id: 'energia', nombre: 'Energy', icono: 'ϟ', color: '#65d5ff' }),
  datos: Object.freeze({ id: 'datos', nombre: 'Data', icono: '◫', color: '#c088ff' }),
});
export const RECURSO_IDS = Object.freeze(Object.keys(RECURSOS));

// Narrative resource pattern by age, adapted from the MIT reference:
// https://github.com/alandaitch/imperios-1800-2100
export const IDENTIDAD_ERAS = Object.freeze({
  1800: Object.freeze({
    tema: 'Steam',
    recursos: Object.freeze({ alimentos: 'Provisions', materiales: 'Timber and iron', energia: 'Coal', datos: 'Blueprints' }),
    bono: Object.freeze({ nombre: 'Efficient boilers', recurso: 'energia', multiplicador: 1.1 }),
  }),
  1900: Object.freeze({
    tema: 'Industrial',
    recursos: Object.freeze({ alimentos: 'Rations', materiales: 'Steel', energia: 'Oil', datos: 'Patents' }),
    bono: Object.freeze({ nombre: 'Mass production', recurso: 'materiales', multiplicador: 1.1 }),
  }),
  2000: Object.freeze({
    tema: 'Digital',
    recursos: Object.freeze({ alimentos: 'Biocrops', materiales: 'Composites', energia: 'Power grid', datos: 'Intelligence' }),
    bono: Object.freeze({ nombre: 'Networked economy', recurso: 'datos', multiplicador: 1.1 }),
  }),
  2100: Object.freeze({
    tema: 'Fusion',
    recursos: Object.freeze({ alimentos: 'Synthetic nutrients', materiales: 'Nanofiber', energia: 'Fusion', datos: 'Quantum computing' }),
    bono: Object.freeze({ nombre: 'Fusion reactors', recurso: 'energia', multiplicador: 1.15 }),
  }),
});

export const COSTES_AVANCE = Object.freeze({
  1800: null,
  1900: Object.freeze({ alimentos: 500, materiales: 700, energia: 150 }),
  2000: Object.freeze({ alimentos: 800, materiales: 1_000, energia: 600, datos: 200 }),
  2100: Object.freeze({ alimentos: 1_200, materiales: 1_400, energia: 1_000, datos: 800 }),
});

const LINEAS_UNIDAD = [
  {
    tipo: 'trabajador',
    rol: 'Economy',
    nombres: ['Worker', 'Operator', 'Field Engineer', 'Synthetic'],
    costes: [
      { alimentos: 50 },
      { alimentos: 55 },
      { alimentos: 60, energia: 10 },
      { alimentos: 70, datos: 20 },
    ],
    vida: [40, 50, 60, 75], ataque: [3, 4, 6, 9], defensa: [0, 1, 2, 4],
    alcance: [1, 1, 2, 2], velocidad: [4, 4.2, 4.5, 5], poblacion: [1, 1, 1, 1],
    recoleccion: [10, 12, 15, 18],
  },
  {
    tipo: 'infanteria',
    rol: 'Infantry',
    nombres: ['Rifleman', 'Soldier', 'Commando', 'Photon Sentinel'],
    costes: [
      { alimentos: 60, materiales: 20 },
      { alimentos: 70, materiales: 30 },
      { alimentos: 80, materiales: 40, energia: 20 },
      { alimentos: 90, energia: 45, datos: 25 },
    ],
    vida: [70, 90, 115, 150], ataque: [12, 18, 26, 38], defensa: [2, 4, 7, 11],
    alcance: [6, 7, 8, 9], velocidad: [4.2, 4.3, 4.5, 4.8], poblacion: [1, 1, 1, 1],
    recoleccion: [0, 0, 0, 0],
  },
  {
    tipo: 'vehiculo',
    rol: 'Fast Unit',
    nombres: ['Armored Dragoon', 'Tank', 'Autonomous Armor', 'Gravity Mech'],
    costes: [
      { alimentos: 80, materiales: 80 },
      { materiales: 120, energia: 50 },
      { materiales: 150, energia: 100, datos: 30 },
      { materiales: 180, energia: 160, datos: 80 },
    ],
    vida: [120, 180, 240, 330], ataque: [18, 28, 40, 58], defensa: [5, 9, 14, 22],
    alcance: [2, 6, 7, 8], velocidad: [6, 5, 5.5, 6.5], poblacion: [2, 3, 3, 3],
    recoleccion: [0, 0, 0, 0],
  },
  {
    tipo: 'artilleria',
    rol: 'Siege',
    nombres: ['Field Gun', 'Howitzer', 'Missile Launcher', 'Plasma Cannon'],
    costes: [
      { materiales: 120, energia: 40 },
      { materiales: 160, energia: 80 },
      { materiales: 200, energia: 140, datos: 50 },
      { materiales: 240, energia: 220, datos: 120 },
    ],
    vida: [85, 120, 160, 220], ataque: [32, 46, 65, 95], defensa: [1, 3, 6, 10],
    alcance: [10, 12, 14, 16], velocidad: [2.5, 2.8, 3.2, 4], poblacion: [3, 3, 4, 4],
    recoleccion: [0, 0, 0, 0],
  },
];

const LINEAS_EDIFICIO = [
  {
    tipo: 'centro',
    funcion: 'Main center',
    nombres: ['Industrial Outpost', 'Modern Town Hall', 'Command Center', 'Colony Core'],
    costes: [
      { alimentos: 200, materiales: 350 },
      { alimentos: 250, materiales: 450, energia: 100 },
      { alimentos: 300, materiales: 550, energia: 250, datos: 100 },
      { alimentos: 400, materiales: 700, energia: 450, datos: 300 },
    ],
    vida: [900, 1_150, 1_450, 1_900], defensa: [5, 8, 12, 18], ataque: [6, 10, 16, 25],
    alcance: [7, 8, 9, 10], capacidadPoblacion: [10, 10, 10, 10], entrena: ['trabajador'],
  },
  {
    tipo: 'vivienda',
    funcion: 'Increases population',
    nombres: ['Bunkhouse', 'Urban House', 'Habitation Module', 'Orbital Habitat'],
    costes: [
      { materiales: 100 },
      { materiales: 120, energia: 20 },
      { materiales: 140, energia: 40 },
      { materiales: 170, energia: 70, datos: 20 },
    ],
    vida: [350, 430, 520, 650], defensa: [1, 2, 4, 7], ataque: [0, 0, 0, 0],
    alcance: [0, 0, 0, 0], capacidadPoblacion: [5, 8, 10, 12], entrena: [],
  },
  {
    tipo: 'cuartel',
    funcion: 'Trains infantry',
    nombres: ['Arsenal', 'Mechanized Barracks', 'Tactical Base', 'Photon Bastion'],
    costes: [
      { materiales: 180 },
      { materiales: 220, energia: 50 },
      { materiales: 260, energia: 100, datos: 30 },
      { materiales: 320, energia: 160, datos: 70 },
    ],
    vida: [550, 700, 900, 1_150], defensa: [3, 5, 8, 13], ataque: [0, 0, 0, 0],
    alcance: [0, 0, 0, 0], capacidadPoblacion: [0, 0, 0, 0], entrena: ['infanteria'],
  },
  {
    tipo: 'fabrica',
    funcion: 'Produces vehicles and artillery',
    nombres: ['Foundry', 'War Factory', 'Robotics Plant', 'Nanometric Assembler'],
    costes: [
      { materiales: 240, energia: 60 },
      { materiales: 300, energia: 100 },
      { materiales: 360, energia: 180, datos: 60 },
      { materiales: 440, energia: 280, datos: 140 },
    ],
    vida: [600, 780, 980, 1_280], defensa: [3, 6, 9, 14], ataque: [0, 0, 0, 0],
    alcance: [0, 0, 0, 0], capacidadPoblacion: [0, 0, 0, 0], entrena: ['vehiculo', 'artilleria'],
  },
  {
    tipo: 'laboratorio',
    funcion: 'Generates data',
    nombres: ['Academy', 'Technical Institute', 'Data Center', 'Applied Singularity'],
    costes: [
      { materiales: 160, energia: 80 },
      { materiales: 200, energia: 120 },
      { materiales: 250, energia: 180, datos: 40 },
      { materiales: 320, energia: 260, datos: 120 },
    ],
    vida: [420, 520, 680, 880], defensa: [2, 3, 6, 10], ataque: [0, 0, 0, 0],
    alcance: [0, 0, 0, 0], capacidadPoblacion: [0, 0, 0, 0], entrena: [],
  },
];

const crearUnidad = (linea, indice) => Object.freeze({
  tipo: linea.tipo,
  nombre: linea.nombres[indice],
  rol: linea.rol,
  era: ERA_IDS[indice],
  coste: Object.freeze(linea.costes[indice]),
  vida: linea.vida[indice],
  ataque: linea.ataque[indice],
  defensa: linea.defensa[indice],
  alcance: linea.alcance[indice],
  velocidad: linea.velocidad[indice],
  poblacion: linea.poblacion[indice],
  recoleccion: linea.recoleccion[indice],
});

const crearEdificio = (linea, indice) => Object.freeze({
  tipo: linea.tipo,
  nombre: linea.nombres[indice],
  funcion: linea.funcion,
  era: ERA_IDS[indice],
  coste: Object.freeze(linea.costes[indice]),
  vida: linea.vida[indice],
  ataque: linea.ataque[indice],
  defensa: linea.defensa[indice],
  alcance: linea.alcance[indice],
  capacidadPoblacion: linea.capacidadPoblacion[indice],
  entrena: Object.freeze([...linea.entrena]),
});

export const UNIDADES = Object.freeze(Object.fromEntries(
  ERA_IDS.map((era, indice) => [era, Object.freeze(LINEAS_UNIDAD.map((linea) => crearUnidad(linea, indice)))]),
));

export const EDIFICIOS = Object.freeze(Object.fromEntries(
  ERA_IDS.map((era, indice) => [era, Object.freeze(LINEAS_EDIFICIO.map((linea) => crearEdificio(linea, indice)))]),
));

export const TIPOS_UNIDAD = Object.freeze(LINEAS_UNIDAD.map(({ tipo }) => tipo));
export const TIPOS_EDIFICIO = Object.freeze(LINEAS_EDIFICIO.map(({ tipo }) => tipo));

export const obtenerEra = (era) => ERAS.find(({ id }) => id === Number(era)) ?? null;
export const obtenerUnidad = (tipo, era) => UNIDADES[Number(era)]?.find((unidad) => unidad.tipo === tipo) ?? null;
export const obtenerEdificio = (tipo, era) => EDIFICIOS[Number(era)]?.find((edificio) => edificio.tipo === tipo) ?? null;

export function catalogoDeEra(era) {
  const ficha = obtenerEra(era);
  return ficha ? { era: ficha, unidades: UNIDADES[ficha.id], edificios: EDIFICIOS[ficha.id] } : null;
}
