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
KIND = {'vinyl': 0, 'wood': 1, 'metal': 2, 'cloth': 3, 'plastic': 4, 'leaf': 5, 'plaster': 6, 'tint': 7, 'stone': 8, 'lamp': 9, 'water': 10}
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
def frond(rib, a, wmax, col, droop=0.35, reach=0.05):
    """Leaflets either side of a rib heading off at angle a: longest midway, drooping."""
    verts, faces, side = [], [], (-math.sin(a), math.cos(a))
    for i, p in enumerate(rib):
        t = i / (len(rib) - 1)
        w = wmax * math.sin(math.pi * min(1.0, t * 1.15))
        verts += [p, (p[0] + side[0] * w + math.cos(a) * reach, p[1] + side[1] * w + math.sin(a) * reach, p[2] - droop * w - 0.01),
                  (p[0] - side[0] * w + math.cos(a) * reach, p[1] - side[1] * w + math.sin(a) * reach, p[2] - droop * w - 0.01)]
    for i in range(len(rib) - 1):
        a0, b0 = 3 * i, 3 * i + 3
        faces += [(a0, a0 + 1, b0), (a0, b0, a0 + 2)]
    return mesh_obj('frond', verts, faces, col, 'leaf', smooth=False)


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
        frond(rib, a, 0.2, ['#3a8a3a', '#4a9a3e', '#2f7a34'][k % 3])
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


# =============== the island: rocks, planting, lamps, the jetty, the beach's things, the pool house ===============
# Made to the place's metrics (a unit is two metres: a door 0.62 wide and 1.15 tall, a step 0.075 high, a lantern 0.68
# tall, a lounger 0.95 long) and, like a level's kit, as pieces props.js puts down many times (a rock, a shrub, a bay of
# the jetty): each kept to a small budget (a rock some 400 triangles, a shrub one to two thousand), its variety coming
# from where it is put, how it is turned and sized and the tint it is given. Nothing is pure black or pure white.
import random
from mathutils import Vector

_tex = {}


def clouds(scale):
    if scale not in _tex:
        t = bpy.data.textures.new('clouds', 'CLOUDS')
        t.noise_scale, t.noise_depth = scale, 2
        _tex[scale] = t
    return _tex[scale]


def noise_origin(R):
    """An empty somewhere far off: each piece reads the noise from its own place in it."""
    e = bpy.data.objects.new('noise_origin', None)
    bpy.context.collection.objects.link(e)
    e.location = (R.uniform(-60, 60), R.uniform(-60, 60), R.uniform(-60, 60))
    return e


def lumpy(o, R, strength, scale, dec=0.0):
    m = o.modifiers.new('lumps', 'DISPLACE')
    m.texture, m.strength, m.mid_level, m.texture_coords, m.texture_coords_object = clouds(round(scale, 3)), strength, 0.5, 'OBJECT', noise_origin(R)
    if dec:
        d = o.modifiers.new('dec', 'DECIMATE')
        d.ratio = dec
    return o


def blob(R, at, r, col, kind, scale=(1, 1, 1), sub=2, rough=0.4, dec=0.0):
    """A lumpy ball: a clump of leaves, a pebble."""
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub, radius=r, location=at, scale=scale)
    return tag(lumpy(active(), R, r * rough, r * 0.6, dec), col, kind)


def lathe(prof, col, kind, seg=24, at=(0, 0, 0)):
    """A surface of revolution about z: prof [(r, z), ...]."""
    verts, faces = [], []
    for r, z in prof:
        for s in range(seg):
            a = s / seg * TAU
            verts.append((at[0] + r * math.cos(a), at[1] + r * math.sin(a), at[2] + z))
    for i in range(len(prof) - 1):
        for s in range(seg):
            a, b = i * seg + s, i * seg + (s + 1) % seg
            faces.append((a, b, b + seg, a + seg))
    return mesh_obj('lathe', verts, faces, col, kind)


def star(c, n, r, col, kind='tint', points=5, inner=0.45):
    """A flat star (a flower, seen from above) at c facing n."""
    n = Vector(n).normalized()
    u = n.orthogonal().normalized()
    w = n.cross(u)
    verts = [tuple(Vector(c) + n * 0.004)]
    for i in range(points * 2):
        a, rr = i / (points * 2) * TAU, r if i % 2 == 0 else r * inner
        verts.append(tuple(Vector(c) + (u * math.cos(a) + w * math.sin(a)) * rr))
    faces = [(0, 1 + i, 1 + (i + 1) % (points * 2)) for i in range(points * 2)]
    return mesh_obj('star', verts, faces, col, kind, smooth=False)


def blade(pts, widths, col, kind='leaf', ridge=0.0):
    """A flat leaf along pts, its width per point, a ridge down its middle (a V in section)."""
    verts, faces = [], []
    for i, p in enumerate(pts):
        a, b = Vector(pts[max(0, i - 1)]), Vector(pts[min(len(pts) - 1, i + 1)])
        t = (b - a).normalized()
        side = t.cross(Vector((0, 0, 1)))
        side = side.normalized() if side.length > 1e-4 else Vector((1, 0, 0))
        up = side.cross(t).normalized()
        P = Vector(p)
        verts += [tuple(P - side * widths[i]), tuple(P + up * ridge * widths[i]), tuple(P + side * widths[i])]
    for i in range(len(pts) - 1):
        a, b = 3 * i, 3 * i + 3
        faces += [(a, a + 1, b + 1, b), (a + 1, a + 2, b + 2, b + 1)]
    return mesh_obj('blade', verts, faces, col, kind)


# ----- rocks: sea-worn boulders and a flat ledge, their middles at the origin (props.js sinks them into the ground) -----
def rock(name, seed, size, col):
    model(name)
    R = random.Random(seed)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=5, radius=1, scale=size)   # (Blender counts the bare icosahedron as 1)
    o = active()
    lumpy(o, R, 0.32, 0.85)
    m = o.modifiers.new('pits', 'DISPLACE')
    m.texture, m.strength, m.mid_level, m.texture_coords, m.texture_coords_object = clouds(0.22), 0.07, 0.5, 'OBJECT', noise_origin(R)
    d = o.modifiers.new('dec', 'DECIMATE')
    d.ratio = 0.08
    tag(o, col, 'stone')


rock('rock', 3, (0.3, 0.26, 0.2), '#cdbfa6')
rock('rock2', 8, (0.24, 0.22, 0.21), '#c2b49c')
rock('ledge', 13, (0.46, 0.3, 0.1), '#d6c9b0')
model('stepstone')   # a flat paving stone for a path through the grass
R0 = random.Random(21)
blob(R0, (0, 0, 0), 1, '#ddd2bd', 'stone', scale=(0.17, 0.13, 0.03), sub=4, rough=0.12, dec=0.15)


# ----- plants: shrubs (some flowering: their flowers take the placement's tint), a fern, an agave, a tuft of dune grass -----
def shrub(name, seed, cols, n=7, r=0.15, spread=0.15, h=0.2, flowers=0, fr=0.026, tall=1.0):
    model(name)
    R = random.Random(seed)
    clumps = []
    for i in range(n):
        a = i / n * TAU + R.random() * 0.6
        d = spread * (0.45 + 0.55 * R.random()) if i else 0.0
        rr = r * (0.75 + 0.45 * R.random())
        p = (math.cos(a) * d, math.sin(a) * d, (h * (0.65 + 0.5 * R.random()) if i else h * 1.15) * tall)
        blob(R, p, rr, cols[i % len(cols)], 'leaf', scale=(1, 1, 0.82 * tall), sub=4, rough=0.5, dec=0.13)
        clumps.append((Vector(p), rr))
    for _ in range(flowers):
        p, rr = clumps[R.randrange(n)]
        v = Vector((R.uniform(-1, 1), R.uniform(-1, 1), R.uniform(-0.1, 1.1))).normalized()
        star(p + Vector((v.x * rr, v.y * rr, v.z * rr * 0.82 * tall)) * 1.08, v, fr * (0.8 + 0.4 * R.random()), '#ffffff')


shrub('shrub', 31, ['#3f8a3a', '#4c9a40', '#2f7434'])
shrub('shrub2', 32, ['#567f2e', '#6a9236', '#4a7a30'], n=6, r=0.13, spread=0.12, h=0.17)
shrub('flowerbush', 33, ['#3a7c36', '#2f6c30', '#468a3a'], n=7, r=0.15, h=0.21, flowers=70)
shrub('oleander', 34, ['#3a7a3c', '#447f3a', '#33703a'], n=9, r=0.12, spread=0.1, h=0.34, flowers=55, tall=1.6)

model('fern')
for k in range(12):
    a = k / 12 * TAU + 0.3 * math.sin(k * 1.9)
    L = 0.3 + 0.06 * math.sin(k * 2.7)
    rib = path([(0, 0, 0.02), (math.cos(a) * L * 0.3, math.sin(a) * L * 0.3, L * 0.62), (math.cos(a) * L * 0.72, math.sin(a) * L * 0.72, L * 0.6), (math.cos(a) * L, math.sin(a) * L, L * 0.22)], 5)
    frond(rib, a, 0.055, ['#3f8f3c', '#4f9e44', '#357f36'][k % 3], droop=0.5, reach=0.012)

model('agave')
for k in range(17):
    a, lift = k * 2.4, 0.35 + 0.55 * (k / 16)   # a rosette: each leaf turned the golden angle on, the inner ones more upright
    L = 0.3 - 0.1 * (k / 16)
    pts = [(math.cos(a) * L * t * (1 - lift * 0.5), math.sin(a) * L * t * (1 - lift * 0.5), 0.02 + L * t * lift - 0.25 * L * t * t * (1 - lift)) for t in (0, 0.25, 0.5, 0.75, 1.0)]
    blade(pts, [0.035, 0.034, 0.027, 0.015, 0.002], ['#6f9a86', '#7aa48e', '#628f7c'][k % 3], ridge=0.5)

model('tuft')   # dune grass
R1 = random.Random(41)
for k in range(28):
    a, L, lean = R1.random() * TAU, 0.16 + 0.16 * R1.random(), 0.25 + 0.5 * R1.random()
    pts = [(math.cos(a) * L * lean * t * t, math.sin(a) * L * lean * t * t, L * t) for t in (0, 0.35, 0.7, 1.0)]
    blade(pts, [0.008, 0.007, 0.004, 0.0005], ['#a8b468', '#93a85a', '#bcbf7a'][k % 3])


# ----- pots: terracotta, with a shrub, a little fan palm, or flowers (the placement's tint) -----
POT = [(0.0, 0.0), (0.1, 0.0), (0.115, 0.03), (0.15, 0.24), (0.165, 0.25), (0.165, 0.28), (0.14, 0.28), (0.13, 0.26), (0.0, 0.26)]


def pot(name):
    model(name)
    lathe(POT, '#c27450', 'plaster', seg=28)


pot('potshrub')
Rp = random.Random(51)
for i, (x, y, z, r) in enumerate([(0, 0, 0.42, 0.14), (0.08, 0.04, 0.36, 0.1), (-0.07, 0.06, 0.37, 0.1), (0.0, -0.08, 0.36, 0.1), (0.02, 0.0, 0.52, 0.09)]):
    blob(Rp, (x, y, z), r, ['#3f8a3a', '#4c9a40', '#357d36'][i % 3], 'leaf', sub=4, rough=0.45, dec=0.12)
pot('potpalm')
for k in range(9):
    a = k / 9 * TAU + 0.2 * math.sin(k * 3.1)
    L = 0.42 + 0.06 * math.sin(k * 1.3)
    rib = path([(0, 0, 0.26), (math.cos(a) * L * 0.25, math.sin(a) * L * 0.25, 0.26 + L * 0.85), (math.cos(a) * L * 0.65, math.sin(a) * L * 0.65, 0.26 + L * 0.95), (math.cos(a) * L, math.sin(a) * L, 0.26 + L * 0.7)], 5)
    frond(rib, a, 0.09, ['#3c8c3e', '#4a9a44', '#2f7c36'][k % 3], droop=0.45, reach=0.02)
    tube(rib, 0.006, '#5a7a2e', 'leaf', res=2)
pot('potflower')
for i, (x, y, z, r) in enumerate([(0, 0, 0.36, 0.13), (0.07, 0.05, 0.33, 0.09), (-0.07, 0.04, 0.33, 0.09), (0.0, -0.08, 0.32, 0.09)]):
    blob(Rp, (x, y, z), r, ['#3a7c36', '#468a3a'][i % 2], 'leaf', sub=4, rough=0.45, dec=0.12)
for _ in range(40):
    v = Vector((Rp.uniform(-1, 1), Rp.uniform(-1, 1), Rp.uniform(0.0, 1.2))).normalized()
    star(Vector((0, 0, 0.34)) + v * 0.15, v, 0.024, '#ffffff')


# ----- lamps: a post lantern, a hanging lantern (from the colonnade), a wall lantern, a beach torch. Their glass glows by
# night (kind 'lamp'); props.js names where each one's light comes from -----
DARK, BRASS, GLASS = '#2e2c2a', '#b08a4a', '#ffe0a6'


def lantern_head(z, s=1.0):
    box((0, 0, z), (0.1 * s, 0.1 * s, 0.13 * s), GLASS, 'lamp')
    for x in (-1, 1):
        for y in (-1, 1):
            box((x * 0.052 * s, y * 0.052 * s, z), (0.014 * s, 0.014 * s, 0.15 * s), DARK, 'plastic')
    box((0, 0, z - 0.075 * s), (0.12 * s, 0.12 * s, 0.018 * s), DARK, 'plastic')
    cone((0, 0, z + 0.11 * s), 0.1 * s, 0.01 * s, 0.07 * s, DARK, 'plastic', rot=(0, 0, math.pi / 4), n=4, smooth=False)
    ball((0, 0, z + 0.155 * s), 0.014 * s, DARK, 'plastic', seg=(10, 6))


model('lantern')
box((0, 0, 0.02), (0.1, 0.1, 0.04), DARK, 'plastic', bevel=0.006)
box((0, 0, 0.25), (0.04, 0.04, 0.46), DARK, 'plastic')
lantern_head(0.56)

model('hanglamp')   # hangs from its origin
tube([(0, 0, 0), (0, 0, -0.16)], 0.005, BRASS, 'metal', res=2)
cone((0, 0, -0.18), 0.012, 0.06, 0.05, BRASS, 'metal', n=16)
lathe([(0.055, -0.205), (0.07, -0.24), (0.072, -0.28), (0.06, -0.32), (0.035, -0.335)], GLASS, 'lamp', seg=16)
cone((0, 0, -0.345), 0.04, 0.008, 0.03, BRASS, 'metal', n=16)
for k in range(6):
    a = k / 6 * TAU
    tube([(0.057 * math.cos(a), 0.057 * math.sin(a), -0.205), (0.074 * math.cos(a), 0.074 * math.sin(a), -0.26), (0.062 * math.cos(a), 0.062 * math.sin(a), -0.32)], 0.003, BRASS, 'metal', res=2)

model('sconce')   # on a wall, its back to the wall at the origin, facing +x
box((0.01, 0, 0), (0.02, 0.07, 0.14), DARK, 'plastic', bevel=0.004)
tube([(0.02, 0, -0.02), (0.08, 0, -0.02), (0.11, 0, 0.0)], 0.007, DARK, 'plastic', res=2)
n0 = len(cur)
lantern_head(0.06, 0.8)
for o in cur[n0:]:
    o.location.x += 0.11

model('torch')   # a bamboo torch for the beach; its flame glows by night
tube([(0, 0, 0), (0, 0, 0.86)], 0.017, '#c9a86a', 'wood', res=3)
for z in (0.2, 0.42, 0.64):
    torus(0.018, 0.004, '#a8884a', 'wood', at=(0, 0, z), seg=(12, 4))
cone((0, 0, 0.88), 0.03, 0.05, 0.07, '#6a5232', 'wood', n=12)
lathe([(0.0, 0.0), (0.04, 0.02), (0.045, 0.05), (0.03, 0.09), (0.0, 0.14)], '#ffa848', 'lamp', seg=12, at=(0, 0, 0.9))


# ----- seats for people: a daybed for the colonnade, a sun lounger for the beach (their cushions take the tint) -----
WHITE_WOOD = '#ece4d4'
model('daybed')   # its back along +y (the pool's -z): against a wall
box((0, 0, 0.12), (0.98, 0.52, 0.1), WHITE_WOOD, 'wood', bevel=0.01)
for x in (-0.45, 0.45):
    for y in (-0.22, 0.22):
        box((x, y, 0.035), (0.06, 0.06, 0.07), WHITE_WOOD, 'wood')
box((0, 0.245, 0.3), (0.98, 0.04, 0.3), WHITE_WOOD, 'wood', bevel=0.01)
for x in (-0.47, 0.47):
    box((x, 0.0, 0.25), (0.04, 0.52, 0.18), WHITE_WOOD, 'wood', bevel=0.008)
box((0, -0.01, 0.21), (0.9, 0.47, 0.08), '#000000', 'tint', bevel=0.025)
Rd = random.Random(61)
for x, c in ((-0.3, '#f4efe4'), (0.0, '#000000'), (0.3, '#f4efe4')):
    blob(Rd, (x, 0.17, 0.33), 0.1, c, 'cloth' if c != '#000000' else 'tint', scale=(1.1, 0.45, 0.9), sub=3, rough=0.08)

model('lounger')   # its back up at +x
for y in (-0.15, 0.15):
    box((0, y, 0.17), (0.95, 0.03, 0.035), WHITE_WOOD, 'wood', bevel=0.005)
    for x in (-0.42, 0.25):
        box((x, y, 0.08), (0.035, 0.03, 0.16), WHITE_WOOD, 'wood')
for i in range(9):
    box((-0.44 + i * 0.075, 0, 0.19), (0.05, 0.3, 0.012), WHITE_WOOD, 'wood')
box((-0.12, 0, 0.215), (0.62, 0.29, 0.035), '#000000', 'tint', bevel=0.012)
box((0.33, 0, 0.32), (0.34, 0.29, 0.035), '#000000', 'tint', rot=(0, -math.radians(40), 0), bevel=0.012)
box((0.36, 0, 0.3), (0.34, 0.3, 0.02), WHITE_WOOD, 'wood', rot=(0, -math.radians(40), 0))


# ----- the jetty: a bay of boardwalk (planks across, two bearers, a pair of piles down to the sea floor) from x 0 to
# 1, its deck at z 0; its end, a wider platform with a ladder into the sea; steps down onto it from the headland -----
TIMBER = '#8c6e50'


def planks(x0, x1, w, z=0.0, n=None):
    n = n or max(1, round((x1 - x0) / 0.125))
    for i in range(n):
        a = x0 + (x1 - x0) * i / n
        box((a + (x1 - x0) / n / 2, 0, z - 0.0125), ((x1 - x0) / n - 0.012, w, 0.025), ['#8c6e50', '#9a7a58', '#806448'][i % 3], 'wood')


model('jetty')
planks(0, 1, 0.64)
for y in (-0.22, 0.22):
    box((0.5, y, -0.055), (1.0, 0.05, 0.06), '#6e5640', 'wood')
for y in (-0.34, 0.34):
    box((0.06, y, -0.55), (0.065, 0.065, 1.26), '#6a5440', 'wood')
model('jettyend')
planks(0, 1.1, 1.1)
for y in (-0.42, 0.0, 0.42):
    box((0.55, y, -0.055), (1.1, 0.05, 0.06), '#6e5640', 'wood')
for x in (0.06, 1.04):
    for y in (-0.52, 0.52):
        box((x, y, -0.55), (0.07, 0.07, 1.26), '#6a5440', 'wood')
for y in (-0.12, 0.12):
    box((1.1, y, -0.28), (0.02, 0.02, 0.6), '#c8ccd2', 'metal')
for z in (-0.06, -0.2, -0.34, -0.48):
    box((1.1, 0, z), (0.02, 0.24, 0.015), '#c8ccd2', 'metal')
for y in (-0.42, 0.42):
    cone((0.95, y, 0.05), 0.04, 0.035, 0.1, '#3a3a3c', 'metal', n=12)
model('jettysteps')   # from the headland (z 0.3) down to the deck (z 0), heading +x
for i in range(4):
    box((0.075 + i * 0.15, 0, 0.3 - i * 0.075 - 0.012), (0.15, 0.64, 0.025), TIMBER, 'wood')
for y in (-0.32, 0.32):
    box((0.3, y, 0.13), (0.68, 0.04, 0.08), '#6e5640', 'wood', rot=(0, math.atan2(0.3, 0.6), 0))


# ----- the beach: a cabana, a rowing boat for the jetty, driftwood, a starfish, a shell, a little rock pool -----
model('cabana')
for x in (-0.44, 0.44):
    for y in (-0.44, 0.44):
        box((x, y, 0.55), (0.05, 0.05, 1.1), WHITE_WOOD, 'wood')
for s in (-1, 1):
    box((0, s * 0.44, 1.08), (0.94, 0.04, 0.05), WHITE_WOOD, 'wood')
    box((s * 0.44, 0, 1.08), (0.04, 0.94, 0.05), WHITE_WOOD, 'wood')
box((0, 0, 0.03), (1.0, 1.0, 0.06), TIMBER, 'wood')
apex, eave = (0, 0, 1.46), 1.06
corners = [(0.56, 0.56), (-0.56, 0.56), (-0.56, -0.56), (0.56, -0.56)]
for k in range(4):
    (ax, ay), (bx, by) = corners[k], corners[(k + 1) % 4]
    mx, my = (ax + bx) / 2, (ay + by) / 2
    for j, (p, q) in enumerate((((ax, ay), (mx, my)), ((mx, my), (bx, by)))):
        mesh_obj('canvas', [apex, (p[0], p[1], eave), (q[0], q[1], eave)], [(0, 1, 2)], '#f6f1e6' if j else '#000000', 'cloth' if j else 'tint', smooth=False)
    for i in range(6):   # the valance: a scalloped skirt round the eaves
        t0, t1 = i / 6, (i + 1) / 6
        p0 = (ax + (bx - ax) * t0, ay + (by - ay) * t0)
        p1 = (ax + (bx - ax) * t1, ay + (by - ay) * t1)
        pm = ((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2)
        mesh_obj('valance', [(p0[0], p0[1], eave), (p1[0], p1[1], eave), (p1[0], p1[1], eave - 0.07), (pm[0], pm[1], eave - 0.11), (p0[0], p0[1], eave - 0.07)],
                 [(0, 1, 2, 3, 4)], '#000000', 'tint', smooth=False)
for x, y in ((-0.44, -0.44), (0.44, -0.44), (-0.44, 0.44), (0.44, 0.44)):   # curtains tied back to the posts
    c = path([(x * 0.9, y * 0.9, 1.04), (x * 1.0, y * 1.0, 0.62), (x * 0.95, y * 0.95, 0.15)], 6)
    tube(c, [0.07, 0.065, 0.05, 0.035, 0.022, 0.028, 0.04, 0.05, 0.055, 0.058, 0.06, 0.06, 0.06][:len(c)], '#f6f1e6', 'cloth', res=4)
box((0, 0.05, 0.13), (0.8, 0.7, 0.08), '#000000', 'tint', bevel=0.02)

model('boat')   # a rowing boat, 1 long (bow at +x), afloat: its waterline at z 0
secs, ring = 14, 9
verts, faces = [], []
for i in range(secs + 1):
    t = i / secs
    w = 0.21 * math.sin(math.pi * (0.22 + 0.78 * t)) ** 0.7   # widest a little aft of the middle; the stern a transom
    d = 0.17 * (0.35 + 0.65 * math.sin(math.pi * (0.15 + 0.85 * t)) ** 0.5)
    sheer = 0.11 + 0.05 * (t - 0.55) ** 2 * 4
    x = -0.5 + t
    for j in range(ring):
        th = -math.pi / 2 + math.pi * j / (ring - 1)
        verts.append((x, w * math.sin(th), sheer - d * math.cos(th) ** 0.8))
for i in range(secs):
    for j in range(ring - 1):
        a = i * ring + j
        faces.append((a, a + ring, a + ring + 1, a + 1))
mesh_obj('hull', verts, faces, '#f2ede2', 'plastic')
mesh_obj('transom', [verts[j] for j in range(ring)], [tuple(range(ring))], '#f2ede2', 'plastic', smooth=False)
for s in (-1, 1):
    tube([(v[0], v[1], v[2] + 0.006) for v in (verts[i * ring + (0 if s < 0 else ring - 1)] for i in range(secs + 1))], 0.012, '#2a7f8c', 'plastic', res=3)
for x in (-0.18, 0.12):
    box((x, 0, 0.07), (0.07, 0.4, 0.018), TIMBER, 'wood')
for s in (-1, 1):   # the oars, shipped
    tube([(-0.32, s * 0.08, 0.1), (0.36, s * 0.11, 0.1)], 0.01, '#b89466', 'wood', res=2)
    box((0.42, s * 0.11, 0.1), (0.14, 0.05, 0.008), '#b89466', 'wood')

model('driftwood')
dw = path([(-0.36, 0.02, 0.02), (-0.12, -0.03, 0.03), (0.1, 0.02, 0.025), (0.34, -0.04, 0.02)], 5)
tube(dw, taper(len(dw), 0.034, 0.012), '#b4a690', 'wood', res=4)
tube(path([(0.0, 0.0, 0.03), (0.12, 0.09, 0.04), (0.22, 0.12, 0.03)], 4), taper(9, 0.016, 0.006), '#b4a690', 'wood', res=3)
model('starfish')
for k in range(5):
    a = k / 5 * TAU
    cone((math.cos(a) * 0.03, math.sin(a) * 0.03, 0.008), 0.016, 0.004, 0.06, '#e2733e', 'plastic', rot=(0, math.pi / 2, a), n=6)
ball((0, 0, 0.006), 0.02, '#e2733e', 'plastic', scale=(1, 1, 0.45), seg=(10, 6))
model('shell')
sv, sf = [(0, 0, 0.002)], []
for i in range(11):
    a = math.radians(-55 + 11 * i)
    for j, rr in enumerate((0.015, 0.03, 0.045)):
        sv.append((rr * math.cos(a), rr * math.sin(a), 0.016 * (1 - (rr / 0.05) ** 2) + 0.002 + (0.003 if i % 2 else 0)))
for i in range(10):
    a, b = 1 + i * 3, 1 + (i + 1) * 3
    sf.append((0, a, b))
    for j in range(2):
        sf.append((a + j, a + j + 1, b + j + 1, b + j))
mesh_obj('shell', sv, sf, '#efd6c2', 'plastic', smooth=False)
model('rockpool')   # a pool of sea water left among stones on the beach
Rr = random.Random(71)
pv = [(0, 0, 0.006)] + [((0.2 + 0.05 * math.sin(i * 1.7)) * math.cos(i / 16 * TAU), (0.15 + 0.04 * math.cos(i * 2.3)) * math.sin(i / 16 * TAU), 0.006) for i in range(16)]
mesh_obj('pool', pv, [(0, 1 + i, 1 + (i + 1) % 16) for i in range(16)], '#3c8c94', 'water', smooth=False)
for i in range(11):
    a = i / 11 * TAU + Rr.random() * 0.3
    blob(Rr, ((0.22 + 0.03 * Rr.random()) * math.cos(a), (0.17 + 0.03 * Rr.random()) * math.sin(a), 0.01), 0.04 + 0.03 * Rr.random(), '#c4b69e', 'stone', scale=(1, 1, 0.6), sub=3, rough=0.3, dec=0.3)


# ----- a bougainvillea spilling over a wall: its top along y at the origin (the wall's inner top edge), hanging down the
# +x face; its flowers take the tint -----
model('bougain')
Rb = random.Random(81)
clumps = []
for i in range(17):   # a crest along the top, its clumps overlapping
    y = -0.5 + i / 16
    clumps.append((Vector((-0.04 + 0.03 * Rb.random(), y, 0.04 + 0.03 * Rb.random())), 0.075 + 0.02 * Rb.random()))
for i in range(15):   # and a curtain spilling down the face, longer here and shorter there, thinning as it falls
    y = -0.47 + 0.94 * i / 14 + 0.02 * Rb.uniform(-1, 1)
    fall = 0.18 + 0.32 * (0.5 + 0.5 * math.sin(i * 1.3 + 0.7)) * (1 - abs(y) * 0.6)
    n = max(2, round(fall / 0.07))
    for j in range(n):
        t = (j + 1) / n
        clumps.append((Vector((0.045 + 0.02 * Rb.random(), y + 0.025 * Rb.uniform(-1, 1), -fall * t)), 0.07 * (1 - 0.45 * t) + 0.01 * Rb.random()))
for k, (p, r) in enumerate(clumps):   # leaves, and among them masses of bracts (the placement's tint)
    bloom = Rb.random() < 0.42
    blob(Rb, tuple(p), r, '#000000' if bloom else ['#2f6e30', '#3a7a36', '#2a6430'][k % 3], 'tint' if bloom else 'leaf', scale=(0.75, 1.0, 0.9), sub=3, rough=0.55, dec=0.35)
for _ in range(120):
    p, r = clumps[Rb.randrange(len(clumps))]
    v = Vector((Rb.uniform(0.2, 1.0), Rb.uniform(-1, 1), Rb.uniform(-0.6, 1))).normalized()
    star(p + Vector((v.x * r * 0.75, v.y * r, v.z * r * 0.9)), v, 0.018 + 0.008 * Rb.random(), '#000000')


# ----- the pool house on the headland: white walls, a hipped terracotta roof, a teal door under a striped awning (its
# front at +x), round windows like the courtyard wall's that glow by night -----
PL = '#f0e9df'
model('poolhouse')
walls = box((0, 0, 0.66), (1.4, 2.0, 1.32), PL, 'plaster')


def cut_walls(at, size=None, axis=None):
    """A doorway (a box, size) or a round window (along axis) cut through the walls."""
    if size:
        bpy.ops.mesh.primitive_cube_add(size=1, location=at, scale=size)
    else:
        bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.19, depth=0.4, location=at, rotation=(math.pi / 2, 0, 0) if axis[1] else (0, math.pi / 2, 0))
    c = active()
    c.hide_set(True)
    m = walls.modifiers.new('cut', 'BOOLEAN')
    m.operation, m.object, m.solver = 'DIFFERENCE', c, 'EXACT'


cut_walls((0.7, 0, 0.58), size=(0.3, 0.62, 1.16))
for at, n in (((0, -1.0, 0.8), (0, -1, 0)), ((0, 1.0, 0.8), (0, 1, 0)), ((-0.7, 0.45, 0.8), (-1, 0, 0)), ((-0.7, -0.45, 0.8), (-1, 0, 0))):
    cut_walls(at, axis=n)
    rot = (math.pi / 2, 0, 0) if n[1] else (0, math.pi / 2, 0)
    torus(0.2, 0.025, '#f8f4ec', 'plaster', at=at, seg=(32, 8), rot=rot)
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.19, depth=0.02, location=tuple(Vector(at) - Vector(n) * 0.07), rotation=rot)
    tag(active(), '#9ab4bc', 'lamp')
box((0, 0, 0.03), (1.5, 2.1, 0.06), '#d6ccbc', 'plaster')
box((0.63, 0, 0.56), (0.03, 0.6, 1.12), '#2f8a98', 'plastic', bevel=0.006)   # the door, set back in its opening
for z in (0.32, 0.8):
    box((0.65, 0, z), (0.01, 0.5, 0.36), '#3a98a6', 'plastic', bevel=0.004)
ball((0.66, -0.22, 0.56), 0.02, BRASS, 'metal', seg=(10, 6))
box((0.86, 0, 0.04), (0.3, 0.8, 0.08), '#d6ccbc', 'plaster')   # a step
rv = [(-0.82, -1.12, 1.32), (0.82, -1.12, 1.32), (0.82, 1.12, 1.32), (-0.82, 1.12, 1.32), (0, -0.55, 1.78), (0, 0.55, 1.78)]
mesh_obj('roof', rv, [(0, 1, 4), (2, 3, 5), (1, 2, 5, 4), (3, 0, 4, 5), (0, 3, 2, 1)], '#c2704c', 'plaster', smooth=False)
tube([(0, -0.57, 1.79), (0, 0.57, 1.79)], 0.035, '#a85a3c', 'plaster', res=3)
for i in range(6):   # the awning over the door
    y0, y1 = -0.45 + 0.15 * i, -0.45 + 0.15 * (i + 1)
    mesh_obj('awning', [(0.7, y0, 1.3), (0.7, y1, 1.3), (1.04, y1, 1.12), (1.04, y0, 1.12)], [(0, 1, 2, 3)], '#000000' if i % 2 else '#f6f1e6', 'tint' if i % 2 else 'cloth', smooth=False)
    mesh_obj('awning', [(1.04, y0, 1.12), (1.04, y1, 1.12), (1.04, y1, 1.06), (1.04, y0, 1.06)], [(0, 1, 2, 3)], '#000000' if i % 2 else '#f6f1e6', 'tint' if i % 2 else 'cloth', smooth=False)


# ----- MURAL BEGIN: the duck mural in relief along the inside of the left wall, under and between its round windows
# (layout HOLES): a sea in three stacked layers of blue, curling crests where there's room between the windows, rubber
# ducks riding it (one on a surfboard), fish, turtles, starfish and weed in the water, a smiling sun and clouds in the
# gaps above, a little island at the end. Its back is the wall's face at x 0 (facing +x, into the courtyard), y along
# the wall (the pool's -z), z up from the planter's soil; its middle stands at the pool's z -0.3. -----
def mball(at, r, col, kind, scale=(1, 1, 1), rot=(0, 0, 0), seg=(12, 7)):
    return ball(at, r, col, kind, scale=scale, rot=rot, seg=seg)   # a relief's balls are small: a coarse sphere will do


MW = [(3.0, 0.62), (1.5, 0.93), (0.3, 0.73), (-1.2, 0.78), (-2.5, 0.66)]   # each window's y and how high its bottom is
CRESTS = [2.25, 0.9, -0.45, -1.85]   # between the windows: where the sea may rise
Y0, Y1 = -3.6, 3.4


def sea_top(y, lift):
    t = 0.4 + 0.05 * math.sin(y * 3.1) + 0.03 * math.sin(y * 7.3 + 1.0)
    for c in CRESTS:
        t += lift * math.exp(-((y - c) / 0.36) ** 2)
    return t


def sea_layer(depth, drop, lift, col):
    n = 90
    verts, faces = [], []
    for i in range(n + 1):
        y = Y0 + (Y1 - Y0) * i / n
        verts += [(0, y, 0), (0, y, sea_top(y, lift) - drop)]
    for i in range(n):
        faces.append((2 * i, 2 * i + 2, 2 * i + 3, 2 * i + 1))
    o = mesh_obj('sea', verts, faces, col, 'plastic', smooth=False)
    so = o.modifiers.new('depth', 'SOLIDIFY')
    so.thickness, so.offset = depth, 1.0
    bv = o.modifiers.new('round', 'BEVEL')
    bv.width, bv.segments, bv.limit_method = min(0.03, depth * 0.4), 2, 'ANGLE'
    tube([(depth + 0.004, Y0 + 0.02 + (Y1 - Y0 - 0.04) * i / 80, sea_top(Y0 + 0.02 + (Y1 - Y0 - 0.04) * i / 80, lift) - drop - 0.006) for i in range(81)], 0.016, '#eaf7fb', 'plastic', res=2)
    return o


def curl(y, z, x, r, col):
    pts = [(x, y + r * (1 - i / 28) * math.cos(-0.6 + i / 28 * 5.2), z + r * (1 - i / 28) * math.sin(-0.6 + i / 28 * 5.2)) for i in range(29)]
    tube(pts, taper(29, r * 0.38, r * 0.1), col, 'plastic', res=3)


def relief_duck(y, z, x, s, face, body='#ffd23a'):
    mball((x, y, z + 0.05 * s), 0.08 * s, body, 'plastic', scale=(0.55, 1.3, 0.85))
    mball((x + 0.005, y + face * 0.075 * s, z + 0.135 * s), 0.05 * s, body, 'plastic', scale=(0.7, 1, 1))
    mball((x, y - face * 0.1 * s, z + 0.09 * s), 0.03 * s, body, 'plastic', scale=(0.6, 1.2, 0.8))   # the tail
    cone((x + 0.01, y + face * 0.125 * s, z + 0.125 * s), 0.018 * s, 0.006 * s, 0.04 * s, '#f28a2c', 'plastic', rot=(-face * math.pi / 2, 0, 0), n=10)
    mball((x + 0.036 * s, y + face * 0.09 * s, z + 0.15 * s), 0.009 * s, '#1c1c1c', 'plastic', seg=(10, 6))
    mball((x + 0.012 * s, y - face * 0.005 * s, z + 0.07 * s), 0.035 * s, body, 'plastic', scale=(0.5, 1.2, 0.6))   # a wing


def fish(y, z, x, s, face, col, stripe=None):
    mball((x, y, z), 0.04 * s, col, 'plastic', scale=(0.45, 1.3, 0.85))
    cone((x, y - face * 0.06 * s, z), 0.03 * s, 0.004 * s, 0.035 * s, col, 'plastic', rot=(face * math.pi / 2, 0, 0), n=8)
    mball((x + 0.017 * s, y + face * 0.03 * s, z + 0.008 * s), 0.006 * s, '#1c1c1c', 'plastic', seg=(8, 6))
    if stripe:
        mball((x + 0.004, y, z), 0.041 * s, stripe, 'plastic', scale=(0.42, 0.25, 0.88))


def turtle(y, z, x, s, face):
    mball((x, y, z), 0.06 * s, '#8a6236', 'plastic', scale=(0.45, 1.2, 0.95))
    mball((x + 0.012 * s, y, z), 0.045 * s, '#a87a44', 'plastic', scale=(0.42, 1.15, 0.9))   # the shell's lighter plate
    mball((x - 0.004, y + face * 0.085 * s, z + 0.01 * s), 0.025 * s, '#6cae5a', 'plastic', scale=(0.6, 1.1, 0.9))
    for fy, fz in ((0.05, 0.05), (0.05, -0.05), (-0.05, 0.05), (-0.05, -0.05)):
        mball((x - 0.008, y + fy * s, z + fz * s), 0.022 * s, '#6cae5a', 'plastic', scale=(0.4, 0.9, 0.5), rot=(math.copysign(0.5, fy * fz), 0, 0))


def starfish_r(y, z, x, s, col):
    for k in range(5):
        a = k / 5 * TAU + math.pi / 2
        mball((x, y + math.cos(a) * 0.026 * s, z + math.sin(a) * 0.026 * s), 0.03 * s, col, 'plastic', scale=(0.35, 1.0, 0.38), rot=(a, 0, 0), seg=(12, 6))
    mball((x + 0.003, y, z), 0.02 * s, col, 'plastic', scale=(0.45, 1, 1), seg=(10, 6))


def weed(y, h, x, col, sway):
    for j in range(3):
        pts = [(x, y + 0.035 * j - 0.035 + sway * 0.025 * math.sin(i * 1.1) * (i / 8), h * (0.75 + 0.25 * (j % 2)) * i / 8) for i in range(9)]
        tube(pts, taper(9, 0.014, 0.004), col, 'plastic', res=3)


def cloud(y, z, s):
    for dy, dz, r in ((0, 0, 0.07), (0.07, -0.01, 0.055), (-0.07, -0.015, 0.05), (0.03, 0.04, 0.05), (-0.035, 0.03, 0.045)):
        mball((0.02, y + dy * s, z + dz * s), r * s, '#f6fbff', 'plastic', scale=(0.4, 1, 0.85), seg=(16, 10))
    mball((0.0, y, z - 0.03 * s), 0.09 * s, '#cfe6f6', 'plastic', scale=(0.3, 1.3, 0.45), seg=(16, 8))


def sun(y, z, r):
    mball((0.03, y, z), r, '#ffd24a', 'plastic', scale=(0.35, 1, 1))
    for k in range(12):
        a = k / 12 * TAU
        cone((0.01, y + math.cos(a) * r * 1.25, z + math.sin(a) * r * 1.25), r * 0.28, 0.0, r * 0.5, '#ffb52a', 'plastic', rot=(-a + math.pi / 2, 0, 0), n=4)
    for s in (-1, 1):
        mball((0.03 + r * 0.33, y + s * r * 0.33, z + r * 0.15), r * 0.09, '#3a2a1a', 'plastic', seg=(10, 6))
        mball((0.03 + r * 0.3, y + s * r * 0.55, z - r * 0.15), r * 0.14, '#ff8f8f', 'plastic', scale=(0.3, 1, 0.7), seg=(10, 6))
    tube([(0.03 + r * 0.34, y + r * 0.35 * math.cos(a), z - r * 0.1 - r * 0.25 * math.sin(a)) for a in [math.pi * i / 10 for i in range(11)]], r * 0.05, '#3a2a1a', 'plastic', res=2)


def islet(y, z):
    mball((0.06, y, z), 0.16, '#e8c98a', 'plastic', scale=(0.45, 1.3, 0.35))
    mball((0.075, y, z + 0.035), 0.12, '#5fb04a', 'plastic', scale=(0.4, 1.2, 0.3))
    for dy, h, lean in ((-0.05, 0.22, -0.25), (0.06, 0.18, 0.3)):
        top = (0.08, y + dy + lean * h * 0.5, z + h)
        tube([(0.08, y + dy, z + 0.03), (0.08, y + dy + lean * h * 0.2, z + h * 0.5), top], taper(3, 0.012, 0.008), '#9a6a3a', 'plastic', res=3)
        for k in range(5):
            a = k / 5 * TAU
            mball((top[0] + 0.01, top[1] + math.cos(a) * 0.045, top[2] + 0.01 + math.sin(a) * 0.022), 0.045, '#3f9a3a', 'leaf', scale=(0.25, 1, 0.3), rot=(a, 0, 0), seg=(12, 6))


model('mural')
sea_layer(0.07, 0.0, 0.2, '#2f7fc8')
sea_layer(0.12, 0.12, 0.12, '#47a7e0')
sea_layer(0.17, 0.24, 0.06, '#86d2f0')
for c in CRESTS:
    curl(c + 0.1, sea_top(c + 0.1, 0.2) - 0.13, 0.09, 0.15, '#d6f1fb')
for i, (y, s) in enumerate([(2.65, 1.5), (1.85, 1.35), (1.25, 1.6), (0.55, 1.4), (-0.05, 1.5), (-0.85, 1.35), (-1.4, 1.55), (-2.2, 1.4)]):
    z = sea_top(y, 0.12) - 0.12 - 0.02
    if i == 2:   # the surfer
        mball((0.14, y, z - 0.01), 0.2, '#ff8a3a', 'plastic', scale=(0.4, 1.25, 0.12))
        z += 0.02
    relief_duck(y, z, 0.15, s, -1)
for y, z, s, col, st in ((2.75, 0.14, 1.9, '#ff8a2a', None), (1.7, 0.2, 1.7, '#4a7fe8', None), (0.15, 0.12, 1.9, '#c86ae0', '#f5d24a'), (-1.0, 0.18, 1.9, '#ff7a4a', '#ffffff'), (-2.75, 0.13, 1.7, '#3ac0b0', None), (-0.55, 0.24, 1.4, '#ffd23a', '#4a7fe8')):
    fish(y, z, 0.18, s, -1 if y > 0 else 1, col, st)
turtle(1.25, 0.13, 0.18, 1.8, -1)
turtle(-1.95, 0.12, 0.18, 1.6, 1)
starfish_r(0.6, 0.08, 0.18, 1.8, '#ff7a5a')
starfish_r(-2.3, 0.08, 0.18, 1.6, '#f29ac8')
for y, h, col, sw in ((3.15, 0.34, '#3f9a4a', 1), (2.25, 0.26, '#5ab450', -1), (-0.75, 0.3, '#3f9a4a', 1), (-2.55, 0.34, '#5ab450', -1), (-3.35, 0.28, '#3f9a4a', 1)):
    weed(y, h, 0.175, col, sw)
for y, r in ((2.95, 0.05), (0.8, 0.04), (-1.3, 0.05), (-3.1, 0.04)):
    mball((0.175, y, r * 0.6), r, '#9a9a94', 'plastic', scale=(0.6, 1.3, 0.7), seg=(12, 6))
for k in range(24):
    y = Y0 + 0.3 + (Y1 - Y0 - 0.6) * ((k * 0.618) % 1)
    mball((0.185, y, 0.2 + 0.12 * ((k * 0.37) % 1)), 0.012 + 0.008 * ((k * 0.53) % 1), '#e8f8ff', 'plastic', seg=(8, 6))
sun(2.25, 1.05, 0.2)
cloud(-0.45, 1.05, 1.7)
cloud(-1.85, 1.15, 1.4)
cloud(3.6, 1.0, 1.2)
islet(-3.2, sea_top(-3.2, 0.2) - 0.03)
# ----- MURAL END -----

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
        f.write("// Kinds: 0 vinyl, 1 wood, 2 metal, 3 cloth, 4 plastic, 5 leaf, 6 plaster, 7 the placement's tint, 8 stone (shaded by the tint),\n// 9 a lamp's glass (alight by night), 10 still water.\n")
        f.write('export const PROP_SHAPES = {\n  vertices: %d, indices: %d,\n  models: {\n' % (len(verts) // 10, len(index)))
        for name, v0, nv, i0, ni, lo, hi in table:
            f.write('    %s: { vertex: %d, vertices: %d, index: %d, indices: %d, bounds: [%s, %s] },\n' % (name, v0, nv, i0, ni, f3(lo), f3(hi)))
        f.write('  },\n};\n')
    print('PROPS', len(verts) // 10, 'vertices,', len(index) // 3, 'triangles:', ', '.join('%s %d' % (t[0], t[4] // 3) for t in table))


export()
