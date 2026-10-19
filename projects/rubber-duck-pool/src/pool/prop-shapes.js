// Made by tools/build_props.py (npm run assets:props); not edited by hand. The props' meshes in public/props/props.bin
// (vertices: position, normal, colour, kind as 10 float32; then uint32 indices, each model's from its first vertex).
// Kinds: 0 vinyl, 1 wood, 2 metal, 3 cloth, 4 plastic, 5 leaf, 6 plaster, 7 the placement's tint.
export const PROP_SHAPES = {
  vertices: 35692, indices: 182772,
  models: {
    flamingo: { vertex: 0, vertices: 6148, index: 0, indices: 36516, bounds: [[-0.438, -0.103, -0.403], [0.481, 0.618, 0.403]] },
    swan: { vertex: 6148, vertices: 6148, index: 36516, indices: 36516, bounds: [[-0.595, -0.108, -0.558], [0.678, 0.793, 0.558]] },
    palmring: { vertex: 12296, vertices: 6558, index: 73032, indices: 38028, bounds: [[-0.390, -0.110, -0.390], [0.390, 0.645, 0.390]] },
    ball: { vertex: 18854, vertices: 1288, index: 111060, indices: 6336, bounds: [[-0.165, -0.165, -0.165], [0.165, 0.165, 0.165]] },
    chair: { vertex: 20142, vertices: 2508, index: 117396, indices: 3924, bounds: [[-0.365, -0.008, -0.205], [0.364, 0.567, 0.205]] },
    radio: { vertex: 22650, vertices: 1372, index: 121320, indices: 6492, bounds: [[-0.190, 0.015, -0.060], [0.244, 0.421, 0.076]] },
    parasol: { vertex: 24022, vertices: 882, index: 127812, indices: 4020, bounds: [[-0.729, 0.000, -0.729], [0.729, 1.450, 0.729]] },
    palm: { vertex: 24904, vertices: 5464, index: 131832, indices: 25920, bounds: [[-0.650, -0.005, -0.784], [1.146, 1.971, 0.973]] },
    palm2: { vertex: 30368, vertices: 5150, index: 157752, indices: 24684, bounds: [[-1.154, -0.004, -0.826], [0.654, 1.621, 0.741]] },
    arch: { vertex: 35518, vertices: 174, index: 182436, indices: 336, bounds: [[-0.510, -0.580, -0.100], [0.510, 0.000, 0.100]] },
  },
};
