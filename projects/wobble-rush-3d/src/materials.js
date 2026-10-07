import * as THREE from 'three';

const cache = new Map();

/**
 * The one material recipe the whole diorama uses: glossy moulded plastic.
 * Cached by its full signature so the scene shares instances.
 */
export function toy(color, options = {}) {
  const { roughness = 0.28, metalness = 0, emissive = 0x000000, emissiveIntensity = 1 } = options;
  const key = `${color}|${roughness}|${metalness}|${emissive}|${emissiveIntensity}`;

  let material = cache.get(key);
  if (!material) {
    material = new THREE.MeshStandardMaterial({
      color,
      roughness,
      metalness,
      emissive,
      emissiveIntensity,
    });
    cache.set(key, material);
  }
  return material;
}

/** A fresh (uncached) toy material, for anything that animates its colour. */
export function toyUnique(color, options = {}) {
  const { roughness = 0.28, metalness = 0, emissive = 0x000000, emissiveIntensity = 1 } = options;
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
    emissive,
    emissiveIntensity,
  });
}

export function disposeMaterialCache() {
  for (const material of cache.values()) material.dispose();
  cache.clear();
}
