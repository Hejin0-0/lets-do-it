# The pool's things for people, modelled here in Blender from primitives, curves and subdivision, in the pool's units
# (a unit about two metres): the inflatables (a flamingo ring, a ring with an inflatable palm, a beach ball, the big
# swan), a wooden deck chair, a boombox, a parasol, two palms, the colonnade's arch. Each part has one colour and a kind
# of surface (how the page shades it; 'tint' takes the colour each placement gives: a chair's sling, a parasol's
# panels). Written for the page: public/props/props.bin (vertices: position, normal, colour (linear), kind as 10
# float32; then uint32 indices, each model's counted from its own first vertex) and src/pool/prop-shapes.js (each
# model's range). Blender's z is the pool's y and its -y the pool's z; a model's front (a float's head, a chair's back)
# is +x. Run with npm run assets:props (Blender 5: blender -b --factory-startup -P tools/build_props.py).
import array
import bpy
import math
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, 'public', 'props')
SHAPES = os.path.join(ROOT, 'src', 'pool', 'prop-shapes.js')
KIND = {'vinyl': 0, 'wood': 1, 'metal': 2, 'cloth': 3, 'plastic': 4, 'leaf': 5, 'plaster': 6, 'tint': 7}
TAU = math.pi * 2

bpy.ops.wm.read_factory_settings(use_empty=True)
models = {}
cur = []


def model(name):
    global cur
    cur = []
    models[name] = cur


def tag(o, col, kind, smooth=True, sub=0):
    o['col'], o['kind'], o['smooth'] = col, kind, smooth
    if sub:
        m = o.modifiers.new('sub', 'SUBSURF')
        m.levels = m.render_levels = sub
    cur.append(o)
    return o


def active():
    return bpy.context.active_object


def torus(R, r, col, kind, at=(0, 0, 0), seg=(64, 24), rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, major_segments=seg[0], minor_segments=seg[1], location=at, rotation=rot)
    return tag(active(), col, kind)


def ball(at, r, col, kind, scale=(1, 1, 1), rot=(0, 0, 0), seg=(32, 16)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg[0], ring_count=seg[1], radius=r, location=at, rotation=rot, scale=scale)
    return tag(active(), col, kind)


def cone(at, r1, r2, h, col, kind, rot=(0, 0, 0), n=24, smooth=True):
    bpy.ops.mesh.primitive_cone_add(vertices=n, radius1=r1, radius2=r2, depth=h, location=at, rotation=rot)
    return tag(active(), col, kind, smooth=smooth)


def box(at, size, col, kind, rot=(0, 0, 0), bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=at, rotation=rot, scale=size)
    o = active()
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        m = o.modifiers.new('bevel', 'BEVEL')
        m.width, m.segments = bevel, 2
    return tag(o, col, kind, smooth=False)


def path(ctrl, n=8):
    """Catmull-Rom through control points, n samples between each pair."""
    out = []
    for i in range(len(ctrl) - 1):
        a, b, d, e = ctrl[max(0, i - 1)], ctrl[i], ctrl[i + 1], ctrl[min(len(ctrl) - 1, i + 2)]
        for j in range(n):
            t = j / n
            out.append(tuple(0.5 * (2 * b[k] + (d[k] - a[k]) * t + (2 * a[k] - 5 * b[k] + 4 * d[k] - e[k]) * t * t + (3 * b[k] - a[k] - 3 * d[k] + e[k]) * t ** 3) for k in range(3)))
    out.append(tuple(ctrl[-1]))
    return out


def tube(pts, radii, col, kind, res=6):
    """A round tube along pts, its radius per point (or one radius), its ends capped."""
    cu = bpy.data.curves.new('tube', 'CURVE')
    cu.dimensions, cu.bevel_depth, cu.bevel_resolution, cu.use_fill_caps = '3D', 1.0, res, True
    sp = cu.splines.new('POLY')
    sp.points.add(len(pts) - 1)
    for i, p in enumerate(pts):
        sp.points[i].co = (*p, 1.0)
        sp.points[i].radius = radii if isinstance(radii, (int, float)) else radii[i]
    o = bpy.data.objects.new('tube', cu)
    bpy.context.collection.objects.link(o)
    return tag(o, col, kind)


def taper(n, r0, r1):
    return [r0 + (r1 - r0) * i / (n - 1) for i in range(n)]


def mesh_obj(name, verts, faces, col, kind, smooth=True):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    return tag(o, col, kind, smooth=smooth)


def sphere_patch(r, lon0, lon1, lat0, lat1, col, kind, nl=12, nt=12):
    """The part of a sphere between two longitudes and two latitudes (radians, each pair increasing), as its own piece."""
    verts, faces = [], []
    for j in range(nt + 1):
        la = lat0 + (lat1 - lat0) * j / nt
        for i in range(nl + 1):
            lo = lon0 + (lon1 - lon0) * i / nl
            verts.append((r * math.cos(la) * math.cos(lo), r * math.cos(la) * math.sin(lo), r * math.sin(la)))
    for j in range(nt):
        for i in range(nl):
            a = j * (nl + 1) + i
            faces.append((a, a + 1, a + nl + 2, a + nl + 1))
    return mesh_obj('patch', verts, faces, col, kind)


# ----- the inflatables: glossy vinyl, sized as the floats the world floats (world.js TOYS, layout SWAN) -----
def bird_float(name, R, r, body, light, beak, neck_ctrl, neck_r, head_r):
    """A ring float with a bird's neck and head at its front (+x), wings along its sides, a tail at the back."""
    model(name)
    torus(R, r, body, 'vinyl')
    neck = path(neck_ctrl, 6)
    tube(neck, taper(len(neck), neck_r, neck_r * 0.72), body, 'vinyl', res=8)
    hx, _, hz = neck_ctrl[-1]
    ball((hx + head_r * 0.25, 0, hz + head_r * 0.15), head_r, body, 'vinyl', scale=(1.3, 0.92, 0.95))
    cone((hx + head_r * 1.35, 0, hz), head_r * 0.42, head_r * 0.12, head_r * 1.3, beak[0], 'vinyl', rot=(0, math.radians(108), 0))
    ball((hx + head_r * 1.95, 0, hz - head_r * 0.2), head_r * 0.16, beak[1], 'vinyl')
    for s in (-1, 1):
        ball((hx + head_r * 0.7, s * head_r * 0.62, hz + head_r * 0.42), head_r * 0.2, '#ffffff', 'plastic')
        ball((hx + head_r * 0.82, s * head_r * 0.7, hz + head_r * 0.45), head_r * 0.11, '#1a1a1a', 'plastic')
        ball((-R * 0.1, s * R * 1.0, r * 0.75), R * 0.42, light, 'vinyl', scale=(1.35, 0.32, 0.55), rot=(s * 0.25, 0, 0))
    cone((-R - r * 0.6, 0, r * 0.9), r * 0.8, r * 0.15, r * 1.6, light, 'vinyl', rot=(0, math.radians(-55), 0))


bird_float('flamingo', 0.30, 0.103, '#f2829a', '#f7a0b4', ('#f6d6c4', '#202020'),
           [(0.30, 0, 0.04), (0.37, 0, 0.17), (0.34, 0, 0.31), (0.27, 0, 0.42), (0.29, 0, 0.51), (0.35, 0, 0.55)], 0.062, 0.062)
bird_float('swan', 0.45, 0.108, '#f8f6f0', '#ffffff', ('#f2731e', '#1a1a1a'),
           [(0.45, 0, 0.05), (0.53, 0, 0.22), (0.5, 0, 0.42), (0.43, 0, 0.58), (0.46, 0, 0.68), (0.52, 0, 0.71)], 0.075, 0.075)

# a yellow ring with an inflatable palm standing out of its back
model('palmring')
torus(0.28, 0.11, '#f6c22a', 'vinyl')
trunk = path([(-0.24, 0, 0.05), (-0.22, 0, 0.24), (-0.16, 0, 0.42), (-0.07, 0, 0.56)], 6)
tube(trunk, taper(len(trunk), 0.05, 0.034), '#9a6438', 'vinyl', res=6)
for i in range(1, len(trunk) - 1, 2):   # the trunk's rings
    torus(0.05 - 0.016 * i / len(trunk), 0.008, '#7a4a26', 'vinyl', at=trunk[i], seg=(24, 8))
top = trunk[-1]
for k in range(6):
    a = k / 6 * TAU + 0.3
    leaf = path([top, (top[0] + math.cos(a) * 0.12, top[1] + math.sin(a) * 0.12, top[2] + 0.06), (top[0] + math.cos(a) * 0.24, top[1] + math.sin(a) * 0.24, top[2] + 0.02),
                 (top[0] + math.cos(a) * 0.3, top[1] + math.sin(a) * 0.3, top[2] - 0.07)], 5)
    tube(leaf, taper(len(leaf), 0.035, 0.008), '#3fa64a' if k % 2 else '#56b84e', 'vinyl', res=5)
for k in range(3):
    a = k / 3 * TAU
    ball((top[0] + math.cos(a) * 0.035, top[1] + math.sin(a) * 0.035, top[2] - 0.035), 0.028, '#7a4a26', 'vinyl')

# a beach ball: six coloured gores and white caps
model('ball')
gores = ['#e8405a', '#ffffff', '#2a8ad8', '#ffffff', '#f2c62a', '#ffffff']
for g in range(6):
    sphere_patch(0.165, g / 6 * TAU, (g + 1) / 6 * TAU, -1.25, 1.25, gores[g], 'vinyl', nl=8, nt=16)
sphere_patch(0.165, 0, TAU, 1.25, math.pi / 2, '#ffffff', 'vinyl', nl=36, nt=4)
sphere_patch(0.165, 0, TAU, -math.pi / 2, -1.25, '#ffffff', 'vinyl', nl=36, nt=4)

# ----- a wooden deck chair, its sling striped in the placement's colour and white; its back up at +x -----
model('chair')
W = 0.19
for s in (-1, 1):
    y = s * W
    for (x0, z0, x1, z1) in ((-0.36, 0.0, 0.30, 0.56), (0.36, 0.0, -0.14, 0.31), (-0.3, 0.2, 0.0, 0.2)):
        L, ang = math.hypot(x1 - x0, z1 - z0), math.atan2(z1 - z0, x1 - x0)
        box(((x0 + x1) / 2, y, (z0 + z1) / 2), (L, 0.03, 0.022), '#9a7046', 'wood', rot=(0, -ang, 0), bevel=0.004)
for (x, z) in ((0.29, 0.55), (-0.3, 0.2), (0.1, 0.2), (-0.34, 0.02), (0.34, 0.02)):
    box((x, 0, z), (0.026, 2 * W + 0.03, 0.022), '#9a7046', 'wood', bevel=0.004)
strips = 6
for j in range(strips):
    y0, y1 = -W + 0.015 + (2 * W - 0.03) * j / strips, -W + 0.015 + (2 * W - 0.03) * (j + 1) / strips
    verts, faces, n = [], [], 10
    for i in range(n + 1):
        t = i / n
        x, z = -0.3 + 0.59 * t, 0.2 + 0.35 * t - 0.09 * math.sin(math.pi * t)
        verts += [(x, y0, z), (x, y1, z)]
    for i in range(n):
        faces.append((2 * i, 2 * i + 2, 2 * i + 3, 2 * i + 1))
    mesh_obj('sling', verts, faces, '#ffffff' if j % 2 else '#000000', 'cloth' if j % 2 else 'tint')

# ----- a boombox; its speakers face -y (the pool's +z) -----
model('radio')
box((0, 0, 0.1), (0.38, 0.12, 0.17), '#d83a3a', 'plastic', bevel=0.02)
box((0, -0.061, 0.1), (0.13, 0.004, 0.1), '#2a2a2e', 'plastic')
for x in (-0.115, 0.115):
    cone((x, -0.062, 0.1), 0.062, 0.062, 0.006, '#1c1c1e', 'plastic', rot=(math.pi / 2, 0, 0), n=32)
    cone((x, -0.068, 0.1), 0.045, 0.012, 0.016, '#3a3a3e', 'plastic', rot=(-math.pi / 2, 0, 0), n=32)
    torus(0.062, 0.006, '#c8ccd2', 'metal', at=(x, -0.064, 0.1), seg=(32, 8), rot=(math.pi / 2, 0, 0))
for x in (-0.03, 0.0, 0.03):
    box((x, -0.02, 0.19), (0.02, 0.03, 0.012), '#202024', 'plastic')
tube(path([(-0.14, 0, 0.18), (-0.12, 0, 0.27), (0.12, 0, 0.27), (0.14, 0, 0.18)], 6), 0.011, '#c8ccd2', 'metal', res=4)
tube([(0.15, 0.03, 0.18), (0.24, 0.05, 0.42)], 0.004, '#c8ccd2', 'metal', res=3)

# ----- a parasol: a white pole, eight panels (the placement's colour and white), ribs, a finial -----
model('parasol')
cone((0, 0, 0.66), 0.018, 0.018, 1.32, '#f4f2ec', 'plastic', n=12)
apex, rim, drop, n = (0, 0, 1.4), 0.72, 1.18, 8
for k in range(n):
    a0, a1 = k / n * TAU, (k + 1) / n * TAU
    am = (a0 + a1) / 2
    p0, p1 = (rim * math.cos(a0), rim * math.sin(a0), drop), (rim * math.cos(a1), rim * math.sin(a1), drop)
    pm = (rim * 0.98 * math.cos(am), rim * 0.98 * math.sin(am), drop + 0.03)
    mid0, mid1 = tuple((apex[i] + p0[i]) / 2 for i in range(3)), tuple((apex[i] + p1[i]) / 2 for i in range(3))
    midm = tuple((apex[i] + pm[i]) / 2 + (0.0 if i < 2 else -0.025) for i in range(3))
    mesh_obj('panel', [apex, mid0, midm, mid1, p0, pm, p1], [(0, 1, 2), (0, 2, 3), (1, 4, 5, 2), (2, 5, 6, 3)], '#ffffff' if k % 2 else '#000000', 'cloth' if k % 2 else 'tint')
    tube([apex, (rim * 1.01 * math.cos(a0), rim * 1.01 * math.sin(a0), drop - 0.005)], 0.006, '#e8e6e0', 'plastic', res=3)
ball((0, 0, 1.42), 0.03, '#f4f2ec', 'plastic')


# ----- palms: a ringed trunk, a crown of feathery fronds, coconuts -----
def palm(name, h, lean, fronds):
    model(name)
    trunk = path([(0, 0, 0), (lean * 0.15, 0, h * 0.35), (lean * 0.55, 0, h * 0.7), (lean, 0, h)], 6)
    tube(trunk, [0.085 - 0.03 * i / (len(trunk) - 1) + (0.008 if i % 2 else 0.0) for i in range(len(trunk))], '#8a6a48', 'wood', res=7)
    top = trunk[-1]
    for k in range(fronds):
        a = k / fronds * TAU + 0.35 * math.sin(k * 2.3)
        L = 0.8 + 0.18 * math.sin(k * 1.7)
        rib = path([top, (top[0] + math.cos(a) * L * 0.4, top[1] + math.sin(a) * L * 0.4, top[2] + 0.16), (top[0] + math.cos(a) * L * 0.8, top[1] + math.sin(a) * L * 0.8, top[2] + 0.02),
                    (top[0] + math.cos(a) * L, top[1] + math.sin(a) * L, top[2] - 0.22)], 6)
        verts, faces, side = [], [], (-math.sin(a), math.cos(a))
        for i, p in enumerate(rib):   # leaflets either side of the rib, longest midway, drooping
            t = i / (len(rib) - 1)
            w = 0.2 * math.sin(math.pi * min(1.0, t * 1.15))
            verts += [p, (p[0] + side[0] * w + math.cos(a) * 0.05, p[1] + side[1] * w + math.sin(a) * 0.05, p[2] - 0.35 * w - 0.01),
                      (p[0] - side[0] * w + math.cos(a) * 0.05, p[1] - side[1] * w + math.sin(a) * 0.05, p[2] - 0.35 * w - 0.01)]
        for i in range(len(rib) - 1):
            a0, b0 = 3 * i, 3 * i + 3
            faces += [(a0, a0 + 1, b0), (a0, b0, a0 + 2)]
        mesh_obj('frond', verts, faces, ['#3a8a3a', '#4a9a3e', '#2f7a34'][k % 3], 'leaf', smooth=False)
        tube(rib, 0.012, '#5a7a2e', 'leaf', res=3)
    for k in range(4):
        a = k / 4 * TAU + 0.4
        ball((top[0] + math.cos(a) * 0.06, top[1] + math.sin(a) * 0.06, top[2] - 0.06), 0.045, '#6a4a28', 'wood')


palm('palm', 1.8, 0.28, 10)
palm('palm2', 1.45, -0.18, 9)

# ----- the colonnade's arch: a plaster panel under the lintel between two columns, a half-round opening in it -----
model('arch')
panel = box((0, 0, -0.29), (1.02, 0.2, 0.58), '#ece4d6', 'plaster')
bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=0.44, depth=0.4, location=(0, 0, -0.62), rotation=(math.pi / 2, 0, 0))
cutter = active()
cutter.hide_set(True)
cut = panel.modifiers.new('arch', 'BOOLEAN')
cut.operation, cut.object, cut.solver = 'DIFFERENCE', cutter, 'EXACT'


def export():
    os.makedirs(OUT, exist_ok=True)
    dg = bpy.context.evaluated_depsgraph_get()
    verts, index, table = array.array('f'), array.array('I'), []
    srgb = lambda c: c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    for name, objs in models.items():
        v0, i0 = len(verts) // 10, len(index)
        lo, hi = [1e9] * 3, [-1e9] * 3
        for o in objs:
            me = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
            me.transform(o.matrix_world)
            for p in me.polygons:
                p.use_smooth = o['smooth']
            me.calc_loop_triangles()
            h = o['col'].lstrip('#')
            col = [srgb(int(h[k:k + 2], 16) / 255) for k in (0, 2, 4)]
            kind, seen = KIND[o['kind']], {}
            for t in me.loop_triangles:
                for li in t.loops:
                    vi = me.loops[li].vertex_index
                    n = me.corner_normals[li].vector
                    key = (vi, round(n.x, 3), round(n.y, 3), round(n.z, 3))
                    if key not in seen:
                        seen[key] = len(verts) // 10
                        c = me.vertices[vi].co
                        p = (c.x, c.z, -c.y)
                        verts.extend([*p, n.x, n.z, -n.y, *col, float(kind)])
                        lo, hi = [min(lo[k], p[k]) for k in range(3)], [max(hi[k], p[k]) for k in range(3)]
                    index.append(seen[key] - v0)
        table.append((name, v0, len(verts) // 10 - v0, i0, len(index) - i0, lo, hi))
    with open(os.path.join(OUT, 'props.bin'), 'wb') as f:
        verts.tofile(f)
        index.tofile(f)
    f3 = lambda p: '[' + ', '.join('%.3f' % x for x in p) + ']'
    with open(SHAPES, 'w') as f:
        f.write("// Made by tools/build_props.py (npm run assets:props); not edited by hand. The props' meshes in public/props/props.bin\n")
        f.write("// (vertices: position, normal, colour, kind as 10 float32; then uint32 indices, each model's from its first vertex).\n")
        f.write("// Kinds: 0 vinyl, 1 wood, 2 metal, 3 cloth, 4 plastic, 5 leaf, 6 plaster, 7 the placement's tint.\n")
        f.write('export const PROP_SHAPES = {\n  vertices: %d, indices: %d,\n  models: {\n' % (len(verts) // 10, len(index)))
        for name, v0, nv, i0, ni, lo, hi in table:
            f.write('    %s: { vertex: %d, vertices: %d, index: %d, indices: %d, bounds: [%s, %s] },\n' % (name, v0, nv, i0, ni, f3(lo), f3(hi)))
        f.write('  },\n};\n')
    print('PROPS', len(verts) // 10, 'vertices,', len(index) // 3, 'triangles:', ', '.join('%s %d' % (t[0], t[4] // 3) for t in table))


export()
