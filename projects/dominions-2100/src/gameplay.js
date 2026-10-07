import {
  COSTES_AVANCE,
  ERA_IDS,
  ERA_INICIAL,
  RECURSOS,
  RECURSO_IDS,
  obtenerEdificio,
  obtenerEra,
  obtenerUnidad,
} from './catalog.js';

export const LIMITE_POBLACION = 100;
export const RECURSOS_INICIALES = Object.freeze({
  alimentos: 600,
  materiales: 650,
  energia: 200,
  datos: 0,
});

const fallo = (estado, mensaje) => ({ exito: false, estado, mensaje });
const exito = (estado, mensaje, entidad) => ({ exito: true, estado, mensaje, ...(entidad && { entidad }) });

function crearEntidad(ficha, categoria, equipo, numero) {
  const prefijo = categoria === 'unidad' ? 'u' : 'e';
  return {
    ...ficha,
    id: `${equipo}-${prefijo}-${numero}`,
    categoria,
    equipo,
    vidaMaxima: ficha.vida,
  };
}

export function crearEstado({ equipo = 'jugador', recursos = {} } = {}) {
  if (typeof equipo !== 'string' || !equipo.trim()) throw new TypeError('The team must have a name.');

  const bolsa = { ...RECURSOS_INICIALES, ...recursos };
  for (const recurso of RECURSO_IDS) {
    if (!Number.isFinite(bolsa[recurso]) || bolsa[recurso] < 0) {
      throw new TypeError(`The amount of ${RECURSOS[recurso].nombre.toLowerCase()} is invalid.`);
    }
  }

  const centro = crearEntidad(obtenerEdificio('centro', ERA_INICIAL), 'edificio', equipo, 1);
  const fichaTrabajador = obtenerUnidad('trabajador', ERA_INICIAL);
  const unidades = [2, 3, 4].map((numero) => crearEntidad(fichaTrabajador, 'unidad', equipo, numero));

  return {
    equipo,
    era: ERA_INICIAL,
    recursos: Object.fromEntries(RECURSO_IDS.map((recurso) => [recurso, bolsa[recurso]])),
    poblacion: { actual: 3, limite: centro.capacidadPoblacion, maximo: LIMITE_POBLACION },
    unidades,
    edificios: [centro],
    siguienteId: 5,
  };
}

export function puedePagar(recursos, coste = {}) {
  return RECURSO_IDS.every((recurso) => (recursos[recurso] ?? 0) >= (coste[recurso] ?? 0));
}

function pagar(recursos, coste) {
  return Object.fromEntries(
    RECURSO_IDS.map((recurso) => [recurso, recursos[recurso] - (coste[recurso] ?? 0)]),
  );
}

function mensajeRecursos(recursos, coste) {
  const faltantes = RECURSO_IDS
    .filter((recurso) => recursos[recurso] < (coste[recurso] ?? 0))
    .map((recurso) => RECURSOS[recurso].nombre.toLowerCase());
  return `Insufficient resources: ${faltantes.join(', ')}.`;
}

export function recolectar(estado, recurso, cantidad) {
  if (!RECURSO_IDS.includes(recurso)) return fallo(estado, 'That resource does not exist.');
  if (!Number.isFinite(cantidad) || cantidad <= 0) return fallo(estado, 'The gathered amount must be greater than zero.');

  return exito({
    ...estado,
    recursos: { ...estado.recursos, [recurso]: estado.recursos[recurso] + cantidad },
  }, `Gathered ${cantidad} ${RECURSOS[recurso].nombre.toLowerCase()}.`);
}

export function entrenarUnidad(estado, tipo) {
  const ficha = obtenerUnidad(tipo, estado.era);
  if (!ficha) return fallo(estado, 'That unit is not available in this age.');

  const tieneProductor = estado.edificios.some(
    (edificio) => edificio.vida > 0 && edificio.entrena.includes(tipo),
  );
  if (!tieneProductor) return fallo(estado, `You need a building that can train ${ficha.nombre.toLowerCase()}.`);
  if (estado.poblacion.actual + ficha.poblacion > estado.poblacion.limite) {
    return fallo(estado, 'Build more housing to increase the population limit.');
  }
  if (!puedePagar(estado.recursos, ficha.coste)) return fallo(estado, mensajeRecursos(estado.recursos, ficha.coste));

  const unidad = crearEntidad(ficha, 'unidad', estado.equipo, estado.siguienteId);
  const siguiente = {
    ...estado,
    recursos: pagar(estado.recursos, ficha.coste),
    poblacion: { ...estado.poblacion, actual: estado.poblacion.actual + ficha.poblacion },
    unidades: [...estado.unidades, unidad],
    siguienteId: estado.siguienteId + 1,
  };
  return exito(siguiente, `${unidad.nombre} trained.`, unidad);
}

export function construirEdificio(estado, tipo) {
  const ficha = obtenerEdificio(tipo, estado.era);
  if (!ficha) return fallo(estado, 'That building is not available in this age.');
  if (!puedePagar(estado.recursos, ficha.coste)) return fallo(estado, mensajeRecursos(estado.recursos, ficha.coste));

  const edificio = crearEntidad(ficha, 'edificio', estado.equipo, estado.siguienteId);
  const limite = Math.min(LIMITE_POBLACION, estado.poblacion.limite + ficha.capacidadPoblacion);
  const siguiente = {
    ...estado,
    recursos: pagar(estado.recursos, ficha.coste),
    poblacion: { ...estado.poblacion, limite },
    edificios: [...estado.edificios, edificio],
    siguienteId: estado.siguienteId + 1,
  };
  return exito(siguiente, `${edificio.nombre} constructed.`, edificio);
}

export function recalcularPoblacion(estado) {
  const limite = estado.edificios
    .filter((edificio) => edificio.vida > 0)
    .reduce((total, edificio) => total + (edificio.capacidadPoblacion || 0), 0);
  return { ...estado, poblacion: { ...estado.poblacion, limite: Math.min(LIMITE_POBLACION, limite) } };
}

export function avanzarEra(estado) {
  const indice = ERA_IDS.indexOf(Number(estado.era));
  if (indice < 0) return fallo(estado, 'The current age is invalid.');
  if (indice === ERA_IDS.length - 1) return fallo(estado, 'You have already reached the final age.');

  const siguienteEra = ERA_IDS[indice + 1];
  const coste = COSTES_AVANCE[siguienteEra];
  if (!puedePagar(estado.recursos, coste)) return fallo(estado, mensajeRecursos(estado.recursos, coste));

  const siguiente = { ...estado, era: siguienteEra, recursos: pagar(estado.recursos, coste) };
  return exito(siguiente, `Advanced to the ${obtenerEra(siguienteEra).nombre}.`);
}

export function atacar(atacante, objetivo) {
  if (!atacante || !objetivo) {
    return { exito: false, atacante, objetivo, dano: 0, destruido: false, mensaje: 'The attacker or target is missing.' };
  }
  if (atacante.equipo === objetivo.equipo) {
    return { exito: false, atacante, objetivo, dano: 0, destruido: objetivo.vida <= 0, mensaje: 'You cannot attack your own team.' };
  }
  if (!Number.isFinite(atacante.ataque) || atacante.ataque <= 0) {
    return { exito: false, atacante, objetivo, dano: 0, destruido: objetivo.vida <= 0, mensaje: 'This entity cannot attack.' };
  }
  if (!Number.isFinite(objetivo.vida) || objetivo.vida <= 0) {
    return { exito: false, atacante, objetivo, dano: 0, destruido: true, mensaje: 'The target has already been destroyed.' };
  }

  const dano = Math.max(1, Math.round(atacante.ataque - Math.max(0, objetivo.defensa ?? 0)));
  const objetivoActualizado = { ...objetivo, vida: Math.max(0, objetivo.vida - dano) };
  const destruido = objetivoActualizado.vida === 0;
  return {
    exito: true,
    atacante,
    objetivo: objetivoActualizado,
    dano,
    destruido,
    mensaje: destruido
      ? `${objetivo.nombre} has been destroyed.`
      : `${atacante.nombre} deals ${dano} damage.`,
  };
}

export const estaDerrotado = (estado) => !estado.edificios.some(
  (edificio) => edificio.tipo === 'centro' && edificio.vida > 0,
);
