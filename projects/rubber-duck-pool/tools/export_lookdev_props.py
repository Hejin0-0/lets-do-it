"""The look-development props (Codex's Blender models in assets/02_models/props) made ready for the page, each in place
of the model of the same name the props layer draws today. Each triangle takes one colour and one kind of surface from
its material: the colour is an override below (where the source's colour was procedural and its GLB lost it), else the
image under Base Color (the triangle cut where the image changes, each piece the image's colour there), else Base Color; the kind comes from the material's name. Each
model is reduced to its triangle budget, turned to the page's axes (Blender's z is the page's y, its -y the page's z),
scaled to the size the page gives that thing today and set on its base (or on its centre, for a ball). Writes
public/props/lookdev.bin (ten float32 a vertex: position, normal, linear colour, kind; then uint32 indices, each model's
counted from its own first vertex) and src/pool/lookdev-shapes.js.
Run: blender -b --factory-startup -P tools/export_lookdev_props.py"""
import bpy, json, math, os, struct
from array import array

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', '02_models', 'props')

# fit: (page axis or 'max', extent): the size the model it replaces has, or ('scale', factor); set: 'base', 'middle' or 'origin'
MODELS = {
    'parasol': dict(src='parasol/parasol-cream-v7.glb', tris=7000, fit=('y', 1.155), set='base', drop=('Canvas | fine stitch',),   # stitching too fine to see
                    colours={'sun-warmed ivory': '#ede7d9', 'warm honey': '#c4945a', 'warm stone': '#d9d2c3'},
                    kinds={'seafoam border': 7}),   # kind 7 takes its placement's tint: each parasol's bands in its own colour
    'towels': dict(src='beach-towels/beach-towels-r33.blend', tris=5000, fit=('max', 0.234), set='base', drop=('Studio', 'Loop')),   # the backdrop; the terry-loop prototypes the lookdev instanced
    'bucket': dict(src='beach-pail/beach-pail-v13.glb', tris=5000, fit=('y', 0.164), set='base', drop=('Sand | grain',),
                   colours={'fine warm beige': '#d8c39f', 'warm ash wood': '#c49a62'}),
    'lifebuoy': dict(src='lifebuoy/lifebuoy-v4-game.glb', tris=4500, fit=('max', 0.383), set='base'),
    'surfboards': dict(src='surfboard/surfboard-v7.glb', tris=3500, fit=('y', 0.895), set='base', colours={'warm ash': '#e6cba8'}),
    'ball': dict(src='beach-ball/beach-ball-v6.glb', tris=4500, fit=('max', 0.33), set='middle', drop=('Material',)),
    # Terra's beach props (tools/create_beach_props.py), at the old models' sizes; the flat ones sink a little into the sand
    # as the old ones did, so a slope does not show a gap under them.
    'sandcastle': dict(src='sandcastle/sandcastle.glb', tris=6000, fit=('y', 0.33), set='base',   # packed wet sand a shade under the beach's #ecd6a4
                       colours={'damp golden sand': '#dcc08a', 'dark wet sand': '#cdb07a'}),
    'shell': dict(src='shell/shell.glb', tris=600, fit=('max', 0.075), set='base', lift=-0.002),
    'starfish': dict(src='starfish/starfish.glb', tris=900, fit=('max', 0.117), set='base', lift=-0.006),
    'driftwood': dict(src='driftwood/driftwood.glb', tris=2500, fit=('max', 0.711), set='base', lift=-0.014,   # warmer: the silver read as metal
                      colours={'silver grey driftwood': '#b5a892', 'pale weathered grain': '#cdbfa6', 'recessed grey grain': '#8c8170'}),
    # Terra's resort props (tools/create_resort_props.py), made at the old models' sizes and anchors: the pool house's
    # door, step and awning on +x where the sconce and paths expect them, the lamps' glow where LIGHT puts it.
    'poolhouse': dict(src='poolhouse/poolhouse.glb', tris=6000, fit=('scale', 1.0), set='origin',
                      kinds={'awning stripe': 7, 'limestone': 6}),   # stone (8) would take the awning's tint too: the plinth and step as plaster
    'noodles': dict(src='noodles/noodles.glb', tris=3000, fit=('y', 0.628), set='base'),
    'torch': dict(src='torch/torch.glb', tris=900, fit=('y', 1.04), set='base'),
    'lantern': dict(src='lantern/lantern.glb', tris=800, fit=('y', 0.729), set='base', kinds={'dark iron': 4}),   # as metal (2) the dark iron mirrored the sky and read blue by day
    # Terra's garden shrubs (tools/create_garden_plants.py): every placement copies the mesh, so each keeps the old one's
    # triangles; the petals (kind 7) take the placement's bloom tint, their centres stay leaf.
    'shrub': dict(src='shrub/shrub.glb', tris=1150, fit=('y', 0.38), set='base'),
    'shrub2': dict(src='shrub2/shrub2.glb', tris=950, fit=('y', 0.30), set='base'),
    'flowerbush': dict(src='flowerbush/flowerbush.glb', tris=1850, fit=('y', 0.36), set='base', kinds={'bloom centre': 5, 'bloom': 7}),
    'oleander': dict(src='oleander/oleander.glb', tris=2000, fit=('y', 0.52), set='base', kinds={'bloom centre': 5, 'bloom': 7}),
    # Terra's wall plants (tools/create_wall_plants.py), at the authored size: the pots (their blooms take the tint).
    'potflower': dict(src='potflower/potflower.glb', tris=1900, fit=('scale', 1.0), set='base', kinds={'bloom centre': 5, 'bloom': 7}),
    'potshrub': dict(src='potshrub/potshrub.glb', tris=1500, fit=('scale', 1.0), set='base'),
    # Terra's shore props (tools/create_shore_props.py): a tide pool on the beach, and the wall lantern on its old frame (the
    # wall's face at its origin, the light where LIGHT puts it), its iron painted as the post lantern's.
    'rockpool': dict(src='rockpool/rockpool.glb', tris=2500, fit=('scale', 1.0), set='base', colours={'sea-worn grey': '#b0a48e'}),   # the beach boulders' warm grey
    'sconce': dict(src='sconce/sconce.glb', tris=500, fit=('scale', 1.0), set='origin', kinds={'dark iron': 4}),
}
# The six collectibles (tools/create_collectibles.py), one scale for the set, each on its own origin: its waterline. The page
# floats an item's origin 0.04 above the water at its scale 0.8 (props.js; a summoned item's sphere floats about as high),
# so a bottle's waterline is drawn 0.05 below the origin.
for cid in ('bottle-first', 'bottle-second', 'bottle-third', 'diorama-first', 'diorama-second', 'diorama-third',
            'bottle-fourth', 'bottle-fifth', 'bottle-sixth', 'diorama-fourth', 'diorama-fifth', 'diorama-sixth'):
    MODELS['collectible-' + cid] = dict(src=f'collectibles/{cid}.glb', tris=8000, fit=('scale', 1.25), set='origin',
                                        lift=-0.05 if cid.startswith('bottle') else -0.0125)   # an island rides 3 cm higher: its own sea clear of the waves
# The material's prefix before " | " names its surface; without one, a word in its name does.
PREFIX = {'shell': 3, 'glass': 13, 'lava': 9, 'lamp': 9, 'canvas': 3, 'rigging': 3, 'snow': 3, 'smoke': 3, 'sand': 3, 'terry': 3, 'binding': 3,
          'loop': 3, 'rope': 3, 'wood': 1, 'cork': 1, 'stand and stringer': 1, 'brass': 2, 'metal': 2,
          'vinyl': 0, 'ocean': 4, 'paint': 4, 'pail': 4, 'handle': 4, 'surfboard': 4, 'stone': 8, 'rock': 8, 'leaf': 5,
          'base': 6, 'plaster': 6, 'water': 10}
WORDS = [(3, ('terry', 'canvas', 'cloth', 'rope', 'thread', 'seam', 'stitch', 'piping', 'binding', 'fringe')),
         (0, ('vinyl', 'valve', 'weld')), (2, ('brass', 'metal', 'steel')), (1, ('wood', 'maple', 'cork'))]


def lin(c):
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


def kind_of(name):
    low = name.lower().rsplit('.', 1)[0] if '.' in name[-4:] else name.lower()
    head = low.split(' | ')[0].strip()
    if head in PREFIX: return PREFIX[head]
    for k, words in WORDS:
        if any(w in low for w in words): return k
    return 4


class Texture:
    def __init__(self, img):
        n = len(img.pixels)   # loads the image; its size is known after
        self.w, self.h = img.size
        self.px = array('f', [0.0]) * n
        img.pixels.foreach_get(self.px)
        self.srgb = img.colorspace_settings.name.lower().startswith('srgb')

    def at(self, u, v):
        o = ((int((v % 1) * self.h) % self.h) * self.w + int((u % 1) * self.w) % self.w) * 4
        c = tuple(self.px[o:o + 3])
        return lin(c) if self.srgb else c


def cut(corners, tex, depth=3):
    """A textured triangle as pieces of one colour each: cut in four where its image changes across it (to depth cuts),
    each piece taking the image at its middle, so a painted edge stays an edge instead of a blur between corners."""
    half = lambda a, b: (tuple((x + y) / 2 for x, y in zip(a[0], b[0])), norm(tuple(x + y for x, y in zip(a[1], b[1]))),
                         tuple((x + y) / 2 for x, y in zip(a[2], b[2])))
    a, b, c = corners
    ab, bc, ca = half(a, b), half(b, c), half(c, a)
    middle = tuple((x + y + z) / 3 for x, y, z in zip(a[2], b[2], c[2]))
    seen = [tex.at(*q[2]) for q in (a, b, c, ab, bc, ca)] + [tex.at(*middle)]
    if depth == 0 or max(abs(x - y) for col in seen for x, y in zip(col, seen[-1])) < 0.08:   # the paint's grain and shading stay whole
        return [[(q[0], q[1], seen[-1]) for q in corners]]
    return [piece for part in ((a, ab, ca), (ab, b, bc), (ca, bc, c), (ab, bc, ca)) for piece in cut(part, tex, depth - 1)]


def norm(v):
    l = math.sqrt(sum(x * x for x in v)) or 1
    return tuple(x / l for x in v)


def look_of(mat, spec):
    """(flat linear colour or None, texture or None) for a material."""
    if mat is None: return (0.6, 0.6, 0.6), None
    for key, hexc in spec.get('colours', {}).items():
        if key in mat.name.lower(): return lin(tuple(int(hexc[i:i + 2], 16) / 255 for i in (1, 3, 5))), None
    p = next((n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None) if mat.use_nodes else None
    if p is None: return tuple(mat.diffuse_color[:3]), None
    base = p.inputs['Base Color']
    if base.is_linked and base.links[0].from_node.type == 'TEX_IMAGE' and base.links[0].from_node.image:
        return None, Texture(base.links[0].from_node.image)
    return tuple(base.default_value[:3]), None


def export(name, spec):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    path = os.path.join(SRC, spec['src'])
    if path.endswith('.glb'): bpy.ops.import_scene.gltf(filepath=path)
    else: bpy.ops.wm.open_mainfile(filepath=path)
    drop = spec.get('drop', ())
    dropped = lambda m: m is not None and any(m.name.startswith(d) for d in drop)
    scene = bpy.context.scene
    dg = bpy.context.evaluated_depsgraph_get()
    meshes = []
    for o in scene.objects:
        if o.type not in {'MESH', 'CURVE'} or o.hide_render: continue
        mats = [s.material for s in o.material_slots if s.material]
        if mats and all(dropped(m) for m in mats): continue
        me = bpy.data.meshes.new_from_object(o.evaluated_get(dg)); me.transform(o.matrix_world); meshes.append(me)
    counts = []
    for me in meshes:
        me.calc_loop_triangles()
        counts.append(sum(1 for t in me.loop_triangles if not dropped(me.materials[t.material_index] if t.material_index < len(me.materials) else None)))
    # The budget shared out: every part keeps its first FLOOR triangles (a small part stays whole), and what is left of the
    # budget is spread evenly over the rest, so large surfaces lying close together are reduced alike.
    FLOOR = 48
    total, kept = sum(counts), sum(min(n, FLOOR) for n in counts)
    share = min(1.0, max(0.0, spec['tris'] - kept) / max(total - kept, 1))
    tris, looks = [], {}
    for me, n in zip(meshes, counts):
        ob = bpy.data.objects.new('reduce', me); scene.collection.objects.link(ob)
        ratio = (min(n, FLOOR) + share * max(n - FLOOR, 0)) / max(n, 1)
        if ratio < 1:
            d = ob.modifiers.new('reduce', 'DECIMATE'); d.ratio = ratio; d.use_collapse_triangulate = True
        out = bpy.data.meshes.new_from_object(ob.evaluated_get(bpy.context.evaluated_depsgraph_get()))
        for f in out.polygons: f.use_smooth = True
        out.set_sharp_from_angle(angle=math.radians(40))   # the decimated mesh has lost its custom normals: smooth curves, crisp creases
        out.calc_loop_triangles()
        uv = out.uv_layers.active.data if out.uv_layers.active else None
        for t in out.loop_triangles:
            mat = out.materials[t.material_index] if t.material_index < len(out.materials) else None
            if dropped(mat): continue
            key = mat.name if mat else ''
            if key not in looks: looks[key] = (*look_of(mat, spec), next((k for w, k in spec.get('kinds', {}).items() if w in key.lower()), kind_of(key)))
            flat, tex, kind = looks[key]
            corners = []
            for li in t.loops:
                p = out.vertices[out.loops[li].vertex_index].co; n = out.corner_normals[li].vector
                corners.append(((p.x, p.z, -p.y), (n.x, n.z, -n.y), tuple(uv[li].uv) if tex and uv else flat))
            tris += [(piece, kind) for piece in cut(corners, tex)] if tex and uv else [(corners, kind)]
    for key, (flat, tex, kind) in sorted(looks.items()):
        print('LOOKDEV_MATERIAL', name, repr(key), 'kind', kind, 'texture' if tex else [round(c, 3) for c in flat])
    lo = [min(c[0][k] for t, _ in tris for c in t) for k in range(3)]
    hi = [max(c[0][k] for t, _ in tris for c in t) for k in range(3)]
    axis, extent = spec['fit']
    s = extent if axis == 'scale' else extent / (max(h - l for l, h in zip(lo, hi)) if axis == 'max' else hi['xyz'.index(axis)] - lo['xyz'.index(axis)])
    mid = [(l + h) / 2 for l, h in zip(lo, hi)]
    shift = {'base': (-mid[0], -lo[1], -mid[2]), 'middle': tuple(-m for m in mid), 'origin': (0, 0, 0)}[spec['set']]
    lift = (0, spec.get('lift', 0), 0)
    verts, inds, seen = [], [], {}
    for corners, kind in tris:
        for p, n, c in corners:
            q = tuple((p[k] + shift[k]) * s + lift[k] for k in range(3))
            key = (tuple(round(v, 5) for v in q), tuple(round(v, 3) for v in n), tuple(round(v, 3) for v in c), kind)
            if key not in seen: seen[key] = len(verts); verts.append((*q, *n, *c, float(kind)))
            inds.append(seen[key])
    blo = [min(v[k] for v in verts) for k in range(3)]; bhi = [max(v[k] for v in verts) for k in range(3)]
    print('LOOKDEV', name, 'from', total, 'to', len(inds) // 3, 'triangles,', len(verts), 'vertices, size', [round(h - l, 3) for l, h in zip(blo, bhi)])
    return verts, inds, [blo, bhi]


verts, inds, models = [], [], {}
for name, spec in MODELS.items():
    v, i, b = export(name, spec)
    models[name] = {'vertex': len(verts), 'vertices': len(v), 'index': len(inds), 'indices': len(i),
                    'bounds': [[round(x, 4) for x in b[0]], [round(x, 4) for x in b[1]]]}
    verts += v; inds += i
with open(os.path.join(ROOT, 'public', 'props', 'lookdev.bin'), 'wb') as f:
    for v in verts: f.write(struct.pack('<10f', *v))
    f.write(array('I', inds).tobytes())
with open(os.path.join(ROOT, 'src', 'pool', 'lookdev-shapes.js'), 'w') as f:
    f.write('// Generated by tools/export_lookdev_props.py from the look-development models in assets/02_models/props; not edited by hand.\n'
            'export const LOOKDEV_SHAPES = ' + json.dumps({'vertices': len(verts), 'indices': len(inds), 'models': models}) + ';\n')
print('LOOKDEV_DONE', len(verts), 'vertices', len(inds) // 3, 'triangles')
