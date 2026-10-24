# The island's mood pieces, run inside build_props.py (exec'd there, after its helpers and the jetty): the two palms,
# the cabana, the rowing boat, the hanging lantern, and a rail along the jetty, after the sample art (Part A, Part S).
# Names, sizes and origins stay the ones props.js places and lights (the lantern hangs from its origin, its glass
# about 0.27 below; the boat's waterline at z 0, its bow at +x; the cabana 1 across, its mattress the placement's tint).
import math


def extend(name):
    """Add pieces to a model already begun."""
    global cur
    cur = models[name]


# ----- palms: a trunk of stacked rings flaring at the foot, broad glossy fronds notched along their edges (as the
# palm ring's, props_floats.py leaf), drooping, a cluster of coconuts -----
def palm(name, h, lean, fronds, rise=0.16, droop=0.22, L0=0.85, crown=0.0):
    model(name)
    n = 44
    ctrl = [(0, 0, 0), (lean * 0.15, 0, h * 0.35), (lean * 0.55, 0, h * 0.7), (lean, 0, h)]
    trunk = path(ctrl, n // 3)
    m = len(trunk)
    radii = []
    for i in range(m):
        t = i / (m - 1)
        r = 0.09 - 0.035 * t + 0.07 * max(0.0, 0.12 - t) / 0.12 * (1 + crown)   # a flared foot
        radii.append(r * (0.9 + 0.14 * ((i % 4) / 3)))   # stacked rings, each wider at its top
    tube(trunk, radii, '#8f6440', 'wood', res=8)
    top = trunk[-1]
    for k in range(fronds):
        a = k / fronds * TAU + 0.35 * math.sin(k * 2.3)
        L = L0 + 0.18 * math.sin(k * 1.7)
        up = rise * (1.4 if k % 2 else 1.0)
        leaf((top[0], top[1], top[2] + 0.02), a, L, 0.17, up * 1.6, droop + up * 1.6, ['#3fa04a', '#4fb453', '#33903f'][k % 3], '#8fd27a', kind='leaf')
    for k in range(5):
        a = k / 5 * TAU + 0.4
        ball((top[0] + math.cos(a) * 0.065, top[1] + math.sin(a) * 0.065, top[2] - 0.06 - 0.02 * (k % 2)), 0.05, '#7c8a2e' if k % 2 else '#6a7a26', 'wood', seg=(16, 10))


palm('palm', 1.8, 0.28, 9, rise=0.2, droop=0.35)
palm('palm2', 1.45, -0.12, 8, rise=0.3, droop=0.12, L0=0.7, crown=0.8)

# ----- the hanging lantern: a brass ring and dome, four glass panes between corner posts, a candle inside -----
model('hanglamp')   # hangs from its origin
torus(0.02, 0.005, BRASS, 'metal', at=(0, 0, -0.02), seg=(20, 8), rot=(math.pi / 2, 0, 0))
tube([(0, 0, -0.04), (0, 0, -0.14)], 0.004, BRASS, 'metal', res=2)
lathe([(0.0, -0.14), (0.02, -0.145), (0.05, -0.17), (0.072, -0.2), (0.075, -0.208)], BRASS, 'metal', seg=24)   # the dome
box((0, 0, -0.212), (0.12, 0.12, 0.012), BRASS, 'metal', bevel=0.003)
for sx in (-1, 1):
    for sy in (-1, 1):
        box((sx * 0.052, sy * 0.052, -0.275), (0.012, 0.012, 0.13), BRASS, 'metal')
for k in range(4):   # the panes
    a = k * math.pi / 2
    box((math.cos(a) * 0.052, math.sin(a) * 0.052, -0.275), (0.006 if k % 2 == 0 else 0.092, 0.092 if k % 2 == 0 else 0.006, 0.12), GLASS, 'lamp')
box((0, 0, -0.343), (0.12, 0.12, 0.014), BRASS, 'metal', bevel=0.003)
cone((0, 0, -0.362), 0.05, 0.012, 0.024, BRASS, 'metal', n=20)
cone((0, 0, -0.31), 0.018, 0.018, 0.05, '#f4eee0', 'plastic', n=14)   # the candle
ball((0, 0, -0.276), 0.012, '#ffd27a', 'lamp', scale=(1, 1, 1.6), seg=(10, 6))

# ----- the jetty's rail: posts and two rails along its far side (the boat moors on the near side) -----
for name, L, y in (('jetty', 1.0, 0.3), ('jettyend', 1.1, 0.5)):
    extend(name)
    for x in ((0.06, 0.94) if name == 'jetty' else (0.06, 0.55, 1.04)):
        box((x, y, 0.2), (0.05, 0.05, 0.4), '#7a5c40', 'wood', bevel=0.006)
    box((L / 2, y, 0.4), (L, 0.06, 0.04), '#8c6e50', 'wood', bevel=0.006)
    box((L / 2, y, 0.22), (L, 0.035, 0.03), '#8c6e50', 'wood', bevel=0.004)

# ----- the cabana: white posts with knobs on a plank deck, a roof striped in the placement's tint and white with a
# scalloped valance, white curtains gathered and tied to the posts, a mattress in the tint, three pillows -----
model('cabana')
for x in (-0.44, 0.44):
    for y in (-0.44, 0.44):
        box((x, y, 0.55), (0.055, 0.055, 1.1), WHITE_WOOD, 'wood', bevel=0.008)
        ball((x, y, 1.12), 0.035, WHITE_WOOD, 'wood', seg=(12, 8))
for s in (-1, 1):
    box((0, s * 0.44, 1.07), (0.94, 0.045, 0.05), WHITE_WOOD, 'wood', bevel=0.006)
    box((s * 0.44, 0, 1.07), (0.045, 0.94, 0.05), WHITE_WOOD, 'wood', bevel=0.006)
for i in range(8):   # the deck: planks across
    box((-0.5 + 0.125 * i + 0.0625, 0, 0.03), (0.115, 1.0, 0.06), ['#8c6e50', '#9a7a58', '#806448'][i % 3], 'wood')
apex, eave = (0, 0, 1.5), 1.06
corners = [(0.58, 0.58), (-0.58, 0.58), (-0.58, -0.58), (0.58, -0.58)]
for k in range(4):
    (ax, ay), (bx, by) = corners[k], corners[(k + 1) % 4]
    for j in range(6):   # stripes from the apex down to the eave
        t0, t1 = j / 6, (j + 1) / 6
        p, q = (ax + (bx - ax) * t0, ay + (by - ay) * t0), (ax + (bx - ax) * t1, ay + (by - ay) * t1)
        mesh_obj('canvas', [apex, (p[0], p[1], eave), (q[0], q[1], eave)], [(0, 1, 2)], '#f6f1e6' if j % 2 else '#000000', 'cloth' if j % 2 else 'tint', smooth=False)
        pm = ((p[0] + q[0]) / 2, (p[1] + q[1]) / 2)
        mesh_obj('valance', [(p[0], p[1], eave), (q[0], q[1], eave), (q[0], q[1], eave - 0.06), (pm[0], pm[1], eave - 0.12), (p[0], p[1], eave - 0.06)],
                 [(0, 1, 2, 3, 4)], '#000000' if j % 2 else '#f6f1e6', 'tint' if j % 2 else 'cloth', smooth=False)
ball((0, 0, 1.52), 0.04, WHITE_WOOD, 'wood', seg=(12, 8))


def curtain(px, py, dx, dy):
    """A curtain hanging from the beam beside the post at (px, py), across toward (dx, dy), gathered and tied to the
    post at half its height, falling loose below."""
    nu, nv = 8, 10
    verts, faces = [], []
    for j in range(nv + 1):
        t = j / nv
        z = 1.04 - 0.98 * t
        gather = 1 - 0.85 * math.exp(-((t - 0.5) / 0.16) ** 2)   # pinched at the tie
        for i in range(nu + 1):
            u = i / nu * 0.3 * gather
            fold = 0.018 * math.sin(i * 2.4) * (0.4 + gather)
            verts.append((px + dx * u - dy * fold, py + dy * u + dx * fold, z))
    for j in range(nv):
        for i in range(nu):
            a = j * (nu + 1) + i
            faces.append((a, a + 1, a + nu + 2, a + nu + 1))
    mesh_obj('curtain', verts, faces, '#f8f4ec', 'cloth')
    torus(0.04, 0.008, '#e8dcc4', 'cloth', at=(px + dx * 0.03, py + dy * 0.03, 0.55), seg=(16, 6))


for x, y in ((-0.44, -0.44), (0.44, -0.44), (-0.44, 0.44), (0.44, 0.44)):
    for dx, dy in ((-math.copysign(1, x), 0), (0, -math.copysign(1, y))):
        curtain(x + dx * 0.03, y + dy * 0.03, dx, dy)
box((0, 0.04, 0.14), (0.8, 0.72, 0.1), '#000000', 'tint', bevel=0.03)   # the mattress
for k, x in enumerate((-0.25, 0.0, 0.25)):
    ball((x, 0.3, 0.23), 0.11, '#fbf8f2' if k != 1 else '#f2c94c', 'cloth', scale=(1.1, 0.45, 0.7), rot=(0.4, 0, 0), seg=(18, 10))

# ----- the rowing boat: a white hull with a teal stripe, varnished wood inside and along the gunwales, two thwarts,
# two oars shipped with their blades, a coil of rope at the bow -----
model('boat')   # 1 long (bow at +x), afloat: its waterline at z 0
secs, ring = 16, 11


def hull(scale_w, scale_d, lift):
    vs = []
    for i in range(secs + 1):
        t = i / secs
        w = 0.21 * math.sin(math.pi * (0.22 + 0.78 * t)) ** 0.7 * scale_w
        d = 0.17 * (0.35 + 0.65 * math.sin(math.pi * (0.15 + 0.85 * t)) ** 0.5) * scale_d
        sheer = 0.11 + 0.05 * (t - 0.55) ** 2 * 4
        for j in range(ring):
            th = -math.pi / 2 + math.pi * j / (ring - 1)
            vs.append((-0.5 + t, w * math.sin(th), sheer - d * math.cos(th) ** 0.8 + lift))
    return vs


out, inner = hull(1, 1, 0), hull(0.9, 0.86, 0.012)
faces = [(i * ring + j, i * ring + j + ring, i * ring + j + ring + 1, i * ring + j + 1) for i in range(secs) for j in range(ring - 1)]
mesh_obj('hull', out, faces, '#f6f2ea', 'plastic')
mesh_obj('inside', inner, [tuple(reversed(f)) for f in faces], '#b07a48', 'wood')
mesh_obj('transom', [out[j] for j in range(ring)], [tuple(range(ring))], '#f6f2ea', 'plastic', smooth=False)
for s in (0, ring - 1):
    edge = [out[i * ring + s] for i in range(secs + 1)]
    tube([(v[0], v[1], v[2] + 0.004) for v in edge], 0.014, '#a06a3a', 'wood', res=4)   # the gunwale
    tube([(v[0], v[1] * 1.02, v[2] - 0.03) for v in edge], 0.008, '#2aa0a8', 'plastic', res=3)   # the stripe
tube([(v[0], 0, v[2] - 0.004) for v in (out[i * ring + ring // 2] for i in range(secs + 1))], 0.01, '#a06a3a', 'wood', res=3)   # the keel
for x in (-0.2, 0.12):
    box((x, 0, 0.075), (0.075, 0.38, 0.018), '#c08a54', 'wood', bevel=0.004)
for s in (-1, 1):   # the oars, shipped
    tube([(-0.33, s * 0.075, 0.1), (0.3, s * 0.1, 0.1)], 0.009, '#c89a66', 'wood', res=3)
    ball((0.38, s * 0.105, 0.1), 0.065, '#c89a66', 'wood', scale=(1.4, 0.4, 0.1), seg=(16, 8))
for k in range(3):   # a coil of rope at the bow
    torus(0.035 - 0.006 * k, 0.007, '#d8c49a', 'cloth', at=(0.3, 0, 0.05 + 0.012 * k), seg=(20, 6))

# ----- an uplight at a column's foot: a little brass housing, its glass facing up -----
model('uplight')
box((0, 0, 0.025), (0.09, 0.09, 0.05), BRASS, 'metal', bevel=0.008)
box((0, 0, 0.052), (0.065, 0.065, 0.006), GLASS, 'lamp')
