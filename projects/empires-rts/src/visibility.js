export const FOG_UNKNOWN = 0;
export const FOG_EXPLORED = 1;
export const FOG_VISIBLE = 2;

export function createVisibilityField({ worldSize = 92, resolution = 96, radius = 15 } = {}) {
  const explored = new Uint8Array(resolution * resolution);
  const visible = new Uint8Array(resolution * resolution);
  const half = worldSize / 2;
  const radiusInCells = radius / worldSize * resolution;

  const cell = (value) => Math.max(0, Math.min(resolution - 1, Math.floor((value / worldSize + 0.5) * resolution)));
  const indexAt = ({ x, z }) => {
    if (Math.abs(x) > half || Math.abs(z) > half) return -1;
    return cell(z) * resolution + cell(x);
  };

  return {
    resolution,
    update(points) {
      visible.fill(0);
      for (const point of points) {
        const centerX = cell(point.x);
        const centerZ = cell(point.z);
        const reach = Math.ceil(radiusInCells);
        for (let z = Math.max(0, centerZ - reach); z <= Math.min(resolution - 1, centerZ + reach); z += 1) {
          for (let x = Math.max(0, centerX - reach); x <= Math.min(resolution - 1, centerX + reach); x += 1) {
            if ((x - centerX) ** 2 + (z - centerZ) ** 2 > radiusInCells ** 2) continue;
            const index = z * resolution + x;
            visible[index] = 1;
            explored[index] = 1;
          }
        }
      }
    },
    stateAt(position) {
      const index = indexAt(position);
      if (index < 0) return FOG_UNKNOWN;
      return visible[index] ? FOG_VISIBLE : explored[index] ? FOG_EXPLORED : FOG_UNKNOWN;
    },
    writeRgba(target) {
      for (let index = 0; index < explored.length; index += 1) {
        const offset = index * 4;
        target[offset] = 5;
        target[offset + 1] = 14;
        target[offset + 2] = 18;
        target[offset + 3] = visible[index] ? 0 : explored[index] ? 112 : 245;
      }
      return target;
    },
  };
}
