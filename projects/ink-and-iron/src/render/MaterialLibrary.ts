// Shared material roles (Worker-C). The ROLE LIST is part of the contract: Worker-B builds the
// miniatures and the board with mat(role), so a role may gain better parameters here but must not
// disappear. paintMatte and enamel keep vertexColors for B's merged, vertex-painted pieces.
// Room-only materials (vertex-tinted, world-UV batched) live under roomMat().
import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import {
  ashlarSet, flameRamp, floorSet, leatherSet, marbleSet, metalSet, oakSet, parchmentSet,
} from './ProceduralTextures.ts'
import type { TexSet } from './ProceduralTextures.ts'

export type MatRole =
  | 'brass' | 'oak' | 'paintMatte' | 'enamel' | 'lead' | 'parchment' | 'ink'
  | 'wax' | 'flame' | 'stone' | 'cloth'

/** Materials only the room uses. All take a `color` vertex attribute (tint) except 'floor'. */
export type RoomMat = 'oakV' | 'ashlarV' | 'floor' | 'marbleV' | 'ironV' | 'brassV' | 'leatherV' | 'parchV'

const sets = new Map<string, TexSet>()
function texSet(name: string, make: () => TexSet): TexSet {
  let s = sets.get(name)
  if (!s) { s = make(); sets.set(name, s) }
  return s
}
const oak = () => texSet('oak', () => oakSet())
const ashlar = () => texSet('ashlar', () => ashlarSet())
const parch = () => texSet('parchment', () => parchmentSet())
const leather = () => texSet('leather', () => leatherSet())
const metal = () => texSet('metal', () => metalSet())
const marble = () => texSet('marble', () => marbleSet())
/** Press centre lines (world z) the floor's grime follows; RoomView sets it before first use. */
export const floorOptions = { pressZ: [] as number[] }
const floor = () => texSet('floor', () => floorSet(31, floorOptions.pressZ))

const cache = new Map<string, THREE.Material>()
function cached<T extends THREE.Material>(key: string, make: () => T): T {
  let m = cache.get(key) as T | undefined
  if (!m) { m = make(); m.name = key; cache.set(key, m) }
  return m
}

function std(p: THREE.MeshStandardMaterialParameters, s?: TexSet, bumpScale = 1): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    roughness: 1, ...(s ? { map: s.map, roughnessMap: s.roughnessMap, bumpMap: s.bumpMap, bumpScale } : {}), ...p,
  })
}

export function mat(role: MatRole): THREE.Material {
  return cached(role, () => {
    switch (role) {
      case 'brass': return std({ color: '#c9a45e', metalness: 1, roughness: 1, roughnessMap: metal().roughnessMap, bumpMap: metal().bumpMap, bumpScale: 0.4, envMapIntensity: 1.1 })
      case 'oak': return std({ color: '#ffffff' }, oak(), 1.2)
      // roughness 1.0 (x the parchment map, 0.6-1.0): at 0.76 the product fell to ~0.4 and the
      // blockhouse roof in S2 blew out white under the chandelier key. Matte paint is matte.
      case 'paintMatte': return std({ vertexColors: true, roughness: 1.0, roughnessMap: parch().roughnessMap, envMapIntensity: 0.6 })
      case 'enamel': return std({ vertexColors: true, roughness: 0.37, roughnessMap: parch().roughnessMap, envMapIntensity: 1.0 })
      case 'lead': return std({ color: '#707276', metalness: 1, roughness: 1.12, roughnessMap: metal().roughnessMap, bumpMap: metal().bumpMap, bumpScale: 0.5 })
      case 'parchment': return std({ color: '#ffffff' }, parch(), 0.6)
      case 'ink': return std({ color: '#1d1a17', roughness: 0.25, transparent: true, opacity: 0.85 })
      case 'wax': return std({ color: '#efe4c8', roughness: 0.66, roughnessMap: parch().roughnessMap, bumpMap: parch().bumpMap, bumpScale: 0.4, emissive: '#3a2410', emissiveIntensity: 0.35 })
      case 'flame': return new THREE.MeshBasicMaterial({ color: new THREE.Color(2.8, 2.3, 1.6), map: flameRamp(), transparent: true, depthWrite: false })
      case 'stone': return std({ color: '#ffffff' }, ashlar(), 1.5)
      case 'cloth': return new THREE.MeshPhysicalMaterial({ color: '#6a2e2a', roughness: 0.92, sheen: 1, sheenRoughness: 0.5, sheenColor: new THREE.Color('#c08a6a'), bumpMap: leather().bumpMap, bumpScale: 0.5 })
    }
  })
}

export function roomMat(name: RoomMat): THREE.MeshStandardMaterial {
  return cached('room:' + name, () => {
    switch (name) {
      case 'oakV': return std({ vertexColors: true }, oak(), 1.4)
      case 'ashlarV': return std({ vertexColors: true }, ashlar(), 2.0)
      case 'floor': return std({ color: '#ffffff' }, floor(), 1.6)
      case 'marbleV': return std({ vertexColors: true }, marble(), 0.4)
      case 'ironV': return std({ vertexColors: true, color: '#3a3836', metalness: 0.85, roughness: 1.35, roughnessMap: metal().roughnessMap, bumpMap: metal().bumpMap, bumpScale: 0.8 })
      case 'brassV': return std({ vertexColors: true, color: '#c9a45e', metalness: 1, roughness: 1, roughnessMap: metal().roughnessMap, bumpMap: metal().bumpMap, bumpScale: 0.4, envMapIntensity: 1.1 })
      case 'leatherV': return std({ vertexColors: true }, leather(), 1.0)
      case 'parchV': return std({ vertexColors: true }, parch(), 0.6)
    }
  })
}

let envTex: THREE.Texture | null = null

/**
 * PMREM RoomEnvironment for reflections and soft fill, tinted amber so brass and varnish mirror a
 * candle-lit room rather than a white photo studio. Also raises every baked texture to the GPU's
 * anisotropy (grazing flagstones and shelf fronts stay crisp).
 */
export function applyEnvironment(scene: THREE.Scene, r: THREE.WebGLRenderer, intensity = 0.35): void {
  if (!envTex) {
    const env = new RoomEnvironment()
    const warm = new THREE.Color(1.0, 0.7, 0.42)
    env.traverse((o) => {
      const m = (o as THREE.Mesh).material as (THREE.Material & { color?: THREE.Color }) | undefined
      if (m?.color) m.color.multiply(warm)
      if ((o as THREE.PointLight).isPointLight) (o as THREE.PointLight).color.multiply(warm)
    })
    const pmrem = new THREE.PMREMGenerator(r)
    envTex = pmrem.fromScene(env, 0.04).texture
    pmrem.dispose()
    env.dispose()
  }
  scene.environment = envTex
  scene.environmentIntensity = intensity
  const an = Math.min(8, r.capabilities.getMaxAnisotropy())
  for (const s of sets.values()) s.map.anisotropy = s.roughnessMap.anisotropy = s.bumpMap.anisotropy = an
}
