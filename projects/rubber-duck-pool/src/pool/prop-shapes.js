// Made by tools/build_props.py (npm run assets:props); not edited by hand. The props' meshes in public/props/props.bin
// (vertices: position, normal, colour, kind as 10 float32; then uint32 indices, each model's from its first vertex).
// Kinds: 0 vinyl, 1 wood, 2 metal, 3 cloth, 4 plastic, 5 leaf, 6 plaster, 7 the placement's tint, 8 stone (shaded by the tint),
// 9 a lamp's glass (alight by night), 10 still water, 11 a mural's paint, 12 falling water.
export const PROP_SHAPES = {
  vertices: 48284, indices: 222699,
  models: {
    arch: { vertex: 0, vertices: 174, index: 0, indices: 336, bounds: [[-0.510, -0.580, -0.100], [0.510, 0.000, 0.100]] },
    stepstone: { vertex: 174, vertices: 98, index: 336, indices: 576, bounds: [[-0.149, -0.037, -0.122], [0.171, 0.026, 0.128]] },
    fern: { vertex: 272, vertices: 1080, index: 912, indices: 1080, bounds: [[-0.298, 0.010, -0.353], [0.301, 0.240, 0.301]] },
    agave: { vertex: 1352, vertices: 255, index: 1992, indices: 816, bounds: [[-0.205, 0.020, -0.184], [0.248, 0.196, 0.227]] },
    tuft: { vertex: 1607, vertices: 336, index: 2808, indices: 1008, bounds: [[-0.168, 0.000, -0.128], [0.199, 0.314, 0.141]] },
    jetty: { vertex: 1943, vertices: 1152, index: 3816, indices: 1728, bounds: [[0.000, -1.180, -0.373], [1.000, 0.420, 0.373]] },
    jettyend: { vertex: 3095, vertices: 1656, index: 5544, indices: 2676, bounds: [[0.000, -1.180, -0.555], [1.110, 0.420, 0.555]] },
    jettysteps: { vertex: 4751, vertices: 144, index: 8220, indices: 216, bounds: [[-0.022, -0.058, -0.340], [0.622, 0.318, 0.340]] },
    spa: { vertex: 4895, vertices: 1476, index: 8436, indices: 6510, bounds: [[-0.217, -0.079, -0.217], [0.217, 0.514, 0.373]] },
    bowlrim: { vertex: 6371, vertices: 1532, index: 14946, indices: 6138, bounds: [[-1.091, 0.000, -1.091], [1.091, 0.100, 1.091]] },
    drain: { vertex: 7903, vertices: 680, index: 21084, indices: 3528, bounds: [[-0.124, -0.013, -0.124], [0.124, 0.013, 0.124]] },
    uplight: { vertex: 8583, vertices: 240, index: 24612, indices: 360, bounds: [[-0.045, 0.000, -0.045], [0.045, 0.055, 0.045]] },
    mural: { vertex: 8823, vertices: 39461, index: 24972, indices: 197727, bounds: [[0.000, -0.016, -3.892], [0.119, 1.303, 3.616]] },
  },
};
