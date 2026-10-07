import assert from 'node:assert/strict';
import {
  EDIFICIOS,
  ERA_IDS,
  IDENTIDAD_ERAS,
  RECURSO_IDS,
  UNIDADES,
  catalogoDeEra,
} from './catalog.js';
import {
  atacar,
  avanzarEra,
  construirEdificio,
  crearEstado,
  entrenarUnidad,
  recalcularPoblacion,
  recolectar,
} from './gameplay.js';
import { FOG_EXPLORED, FOG_UNKNOWN, FOG_VISIBLE, createVisibilityField } from './visibility.js';

assert.deepEqual(ERA_IDS, [1800, 1900, 2000, 2100]);
for (const era of ERA_IDS) {
  assert.equal(UNIDADES[era].length, 4);
  assert.equal(EDIFICIOS[era].length, 5);
  assert.equal(catalogoDeEra(era).era.id, era);
  assert.deepEqual(Object.keys(IDENTIDAD_ERAS[era].recursos), RECURSO_IDS);
  assert.ok(RECURSO_IDS.includes(IDENTIDAD_ERAS[era].bono.recurso));
  assert.ok(IDENTIDAD_ERAS[era].bono.multiplicador > 1);
}
for (const recurso of RECURSO_IDS) {
  assert.equal(new Set(ERA_IDS.map((era) => IDENTIDAD_ERAS[era].recursos[recurso])).size, ERA_IDS.length);
}

const inicial = crearEstado({
  equipo: 'azul',
  recursos: { alimentos: 10_000, materiales: 10_000, energia: 10_000, datos: 10_000 },
});
assert.equal(inicial.era, 1800);
assert.deepEqual(inicial.poblacion, { actual: 3, limite: 10, maximo: 100 });

const cosecha = recolectar(inicial, 'alimentos', 25);
assert.equal(cosecha.exito, true);
assert.equal(cosecha.estado.recursos.alimentos, inicial.recursos.alimentos + 25);
assert.equal(inicial.recursos.alimentos, 10_000);

const cuartel = construirEdificio(inicial, 'cuartel');
assert.equal(cuartel.exito, true);

const entrenamiento = entrenarUnidad(cuartel.estado, 'infanteria');
assert.equal(entrenamiento.exito, true);
assert.equal(entrenamiento.entidad.tipo, 'infanteria');
assert.equal(entrenamiento.estado.poblacion.actual, 4);

const construccion = construirEdificio(entrenamiento.estado, 'vivienda');
assert.equal(construccion.exito, true);
assert.equal(construccion.estado.poblacion.limite, 15);

const viviendaIndustrial = {
  ...construccion.estado,
  edificios: construccion.estado.edificios.map((edificio) => (
    edificio.tipo === 'vivienda' ? { ...edificio, capacidadPoblacion: 8 } : edificio
  )),
};
assert.equal(recalcularPoblacion(viviendaIndustrial).poblacion.limite, 18);
assert.equal(recalcularPoblacion({
  ...viviendaIndustrial,
  edificios: viviendaIndustrial.edificios.map((edificio) => (
    edificio.tipo === 'vivienda' ? { ...edificio, vida: 0 } : edificio
  )),
}).poblacion.limite, 10);

let progreso = construccion.estado;
for (const era of [1900, 2000, 2100]) {
  const avance = avanzarEra(progreso);
  assert.equal(avance.exito, true);
  assert.equal(avance.estado.era, era);
  progreso = avance.estado;
}
assert.equal(avanzarEra(progreso).exito, false);

const sinRecursos = crearEstado({
  recursos: { alimentos: 0, materiales: 0, energia: 0, datos: 0 },
});
assert.equal(entrenarUnidad(sinRecursos, 'trabajador').exito, false);

const atacante = { ...inicial.unidades[0], ataque: 12, equipo: 'azul' };
const objetivo = { ...inicial.unidades[1], vida: 9, defensa: 2, equipo: 'rojo' };
const golpe = atacar(atacante, objetivo);
assert.equal(golpe.exito, true);
assert.equal(golpe.dano, 10);
assert.equal(golpe.objetivo.vida, 0);
assert.equal(golpe.destruido, true);

const visibility = createVisibilityField({ worldSize: 100, resolution: 20, radius: 10 });
visibility.update([{ x: 0, z: 0 }]);
assert.equal(visibility.stateAt({ x: 0, z: 0 }), FOG_VISIBLE);
assert.equal(visibility.stateAt({ x: 45, z: 45 }), FOG_UNKNOWN);
visibility.update([{ x: 30, z: 30 }]);
assert.equal(visibility.stateAt({ x: 0, z: 0 }), FOG_EXPLORED);
assert.equal(visibility.stateAt({ x: 30, z: 30 }), FOG_VISIBLE);
const fogPixels = visibility.writeRgba(new Uint8Array(20 * 20 * 4));
const fogAlphas = fogPixels.filter((_, index) => index % 4 === 3);
assert.ok(fogAlphas.includes(0) && fogAlphas.includes(112) && fogAlphas.includes(245));

console.log('gameplay.test.js: all checks passed');
