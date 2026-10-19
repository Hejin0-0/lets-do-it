// Made by tools/build_duck_assets.py from models/duck-*.glb (npm run assets:ducks); not edited by hand.
// The runtime duck mesh in public/ducks/duck.bin (vertices: position, normal, uv, kind as 9 float32; then uint32
// indices), and the duck in the pool's space: bounds, physics spheres [x, y, z, r], its head (centre, radius).
export const DUCK_SHAPE = {
  vertices: 3556, indices: 13281, triangles: { 'DuckBeak:DuckBeakOrange': 520, 'DuckBody:DuckYellow': 2503, 'DuckEye_L:DuckEyeBlack': 196, 'DuckEye_L:DuckEyeCatchlight': 80, 'DuckEye_R:DuckEyeBlack': 196, 'DuckEye_R:DuckEyeCatchlight': 80, 'DuckCrown:DuckCrownGold': 852 },
  bounds: [[-0.0901, 0.0000, -0.0842], [0.0901, 0.1750, 0.0842]],
  spheres: [[0.0000, 0.0581, 0.0000, 0.0774], [-0.0396, 0.0519, 0.0000, 0.0505], [0.0208, 0.1247, 0.0000, 0.0503]],
  head: { centre: [0.0208, 0.1247, 0.0000], r: 0.0503 },
};
