// Made by tools/build_props.py (npm run assets:props); not edited by hand. The props' meshes in public/props/props.bin
// (vertices: position, normal, colour, kind as 10 float32; then uint32 indices, each model's from its first vertex).
// Kinds: 0 vinyl, 1 wood, 2 metal, 3 cloth, 4 plastic, 5 leaf, 6 plaster, 7 the placement's tint, 8 stone (shaded by the tint),
// 9 a lamp's glass (alight by night), 10 still water, 11 a mural's paint, 12 falling water.
export const PROP_SHAPES = {
  vertices: 59002, indices: 285543,
  models: {
    swan: { vertex: 0, vertices: 6148, index: 0, indices: 36516, bounds: [[-0.595, -0.108, -0.558], [0.678, 0.793, 0.558]] },
    flamingo: { vertex: 6148, vertices: 4570, index: 36516, indices: 26328, bounds: [[-0.408, -0.103, -0.408], [0.557, 0.667, 0.408]] },
    arch: { vertex: 10718, vertices: 174, index: 62844, indices: 336, bounds: [[-0.510, -0.580, -0.100], [0.510, 0.000, 0.100]] },
    stepstone: { vertex: 10892, vertices: 98, index: 63180, indices: 576, bounds: [[-0.149, -0.037, -0.122], [0.171, 0.026, 0.128]] },
    fern: { vertex: 10990, vertices: 1080, index: 63756, indices: 1080, bounds: [[-0.298, 0.010, -0.353], [0.301, 0.240, 0.301]] },
    agave: { vertex: 12070, vertices: 255, index: 64836, indices: 816, bounds: [[-0.205, 0.020, -0.184], [0.248, 0.196, 0.227]] },
    tuft: { vertex: 12325, vertices: 336, index: 65652, indices: 1008, bounds: [[-0.168, 0.000, -0.128], [0.199, 0.314, 0.141]] },
    jetty: { vertex: 12661, vertices: 1152, index: 66660, indices: 1728, bounds: [[0.000, -1.180, -0.373], [1.000, 0.420, 0.373]] },
    jettyend: { vertex: 13813, vertices: 1656, index: 68388, indices: 2676, bounds: [[0.000, -1.180, -0.555], [1.110, 0.420, 0.555]] },
    jettysteps: { vertex: 15469, vertices: 144, index: 71064, indices: 216, bounds: [[-0.022, -0.058, -0.340], [0.622, 0.318, 0.340]] },
    spa: { vertex: 15613, vertices: 1476, index: 71280, indices: 6510, bounds: [[-0.217, -0.079, -0.217], [0.217, 0.514, 0.373]] },
    bowlrim: { vertex: 17089, vertices: 1532, index: 77790, indices: 6138, bounds: [[-1.091, 0.000, -1.091], [1.091, 0.100, 1.091]] },
    drain: { vertex: 18621, vertices: 680, index: 83928, indices: 3528, bounds: [[-0.124, -0.013, -0.124], [0.124, 0.013, 0.124]] },
    uplight: { vertex: 19301, vertices: 240, index: 87456, indices: 360, bounds: [[-0.045, 0.000, -0.045], [0.045, 0.055, 0.045]] },
    mural: { vertex: 19541, vertices: 39461, index: 87816, indices: 197727, bounds: [[0.000, -0.016, -3.892], [0.119, 1.303, 3.616]] },
  },
};
