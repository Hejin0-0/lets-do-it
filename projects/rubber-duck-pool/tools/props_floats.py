# The four things on and by the pool, run inside build_props.py (exec'd there, after its helpers): the flamingo ring,
# the palm ring, the beach ball and the boombox, after the sample art (Part E): glossy vinyl with seams, soft forms.
# Their sizes are the world's (world.js TOYS: the rings' R and r, the ball's radius; the props layer lets the air out
# of a ring by its R, r and the side its neck or palm stands on), so only their looks change here.
import math


def seam(R, r, col, at=(0, 0, 0)):
    """The welded seam round a ring's outer equator: a thin bead a shade darker."""
    torus(R + r * 0.98, r * 0.07, col, 'vinyl', at=at, seg=(96, 8))


def bent_cone(pts, r0, r1, col, kind='vinyl', res=8):
    tube(pts, taper(len(pts), r0, r1), col, kind, res=res)


def leaf(base, a, L, W, rise, droop, col, vein, kind='vinyl'):
    """A palm frond: a long blade from base along angle a (radians round z), rising then drooping, its edges cut into
    teeth toward the tip, folded a little along its vein."""
    n = 16
    dx, dy = math.cos(a), math.sin(a)
    px, py = -dy, dx
    verts, faces = [], []
    for i in range(n + 1):
        t = i / n
        cx, cy = base[0] + dx * L * t, base[1] + dy * L * t
        cz = base[2] + rise * t - droop * t * t
        w = W * math.sin(math.pi * min(1.0, t * 1.05)) ** 0.7
        if 0.35 < t < 0.97 and i % 2:
            w *= 0.62   # the teeth
        verts += [(cx + px * w, cy + py * w, cz - 0.25 * w), (cx, cy, cz + 0.006), (cx - px * w, cy - py * w, cz - 0.25 * w)]
    for i in range(n):
        a0 = 3 * i
        faces += [(a0, a0 + 3, a0 + 4, a0 + 1), (a0 + 1, a0 + 4, a0 + 5, a0 + 2)]
    mesh_obj('frond', verts, faces, col, kind)
    tube([(base[0] + dx * L * t, base[1] + dy * L * t, base[2] + rise * t - droop * t * t + 0.007) for t in [k / 10 for k in range(10)]], taper(10, 0.007 * W / 0.07, 0.002), vein, kind, res=3)


# ----- the flamingo ring: coral vinyl; its neck rises at +x (side 1), a tail feather at the back -----
model('flamingo')
FR, Fr, PINK, PINK2 = 0.30, 0.103, '#f4777e', '#e2626c'
torus(FR, Fr, PINK, 'vinyl', seg=(96, 32))
seam(FR, Fr, PINK2)
neck = path([(0.29, 0, 0.06), (0.37, 0, 0.17), (0.37, 0, 0.3), (0.3, 0, 0.4), (0.27, 0, 0.5), (0.31, 0, 0.58), (0.38, 0, 0.6)], 6)
bent_cone(neck, 0.075, 0.05, PINK)
hx, hz = 0.39, 0.6
ball((hx, 0, hz), 0.07, PINK, 'vinyl', scale=(1.25, 0.9, 0.95), seg=(32, 16))
beak = path([(hx + 0.07, 0, hz + 0.005), (hx + 0.12, 0, hz - 0.02), (hx + 0.15, 0, hz - 0.06), (hx + 0.15, 0, hz - 0.1)], 5)
bent_cone(beak[:len(beak) * 3 // 5], 0.03, 0.022, '#f7c2a8')
bent_cone(beak[len(beak) * 3 // 5 - 1:], 0.022, 0.006, '#2a1a1a')
for s in (-1, 1):
    ball((hx + 0.025, s * 0.052, hz + 0.02), 0.022, '#ffffff', 'plastic', scale=(1, 0.5, 1), seg=(16, 10))
    ball((hx + 0.032, s * 0.062, hz + 0.022), 0.013, '#2a1a14', 'plastic', scale=(1, 0.5, 1), seg=(12, 8))
    ball((hx + 0.035, s * 0.068, hz + 0.03), 0.004, '#ffffff', 'plastic', seg=(8, 6))
tail = path([(-FR - 0.02, 0, Fr * 0.6), (-FR - 0.06, 0, Fr * 1.3), (-FR - 0.05, 0, Fr * 2.0), (-FR - 0.01, 0, Fr * 2.4)], 6)
bent_cone(tail, 0.06, 0.012, PINK)

# ----- the palm ring: golden vinyl; an inflatable palm leans out of its back at -x (side -1) -----
model('palmring')
PR, Pr, GOLD, GOLD2 = 0.28, 0.11, '#eeb23a', '#d79a24'
torus(PR, Pr, GOLD, 'vinyl', seg=(96, 32))
seam(PR, Pr, GOLD2)
trunk = path([(-0.25, 0, 0.06), (-0.24, 0, 0.24), (-0.19, 0, 0.42), (-0.1, 0, 0.58), (-0.02, 0, 0.66)], 6)
bent_cone(trunk, 0.06, 0.035, '#8a5230')
for i in range(2, len(trunk) - 2, 3):   # soft bulges down the trunk
    torus(0.058 - 0.022 * i / len(trunk), 0.006, '#744224', 'vinyl', at=trunk[i], seg=(24, 6))
top = trunk[-1]
for k, (a, L) in enumerate(((0.2, 0.32), (1.25, 0.3), (2.3, 0.34), (3.35, 0.28), (4.4, 0.33), (5.4, 0.3))):
    leaf((top[0], top[1], top[2] + 0.01), a, L, 0.07, 0.05, 0.2 + 0.04 * (k % 2), '#4cae4c' if k % 2 else '#5cbf52', '#86d873')
ball((top[0], top[1], top[2] + 0.015), 0.04, '#5cbf52', 'vinyl', seg=(16, 10))

# ----- the beach ball: six gores in the sample's colours round white caps, a valve -----
model('ball')
BR = 0.165
gores = ['#f0643c', '#ffffff', '#3ab54a', '#ffffff', '#2f6fd8', '#ffffff']
for g in range(6):
    sphere_patch(BR, g / 6 * TAU, (g + 1) / 6 * TAU, -1.28, 1.28, gores[g], 'vinyl', nl=12, nt=24)
sphere_patch(BR, 0, TAU, 1.28, math.pi / 2, '#ffffff', 'vinyl', nl=48, nt=6)
sphere_patch(BR, 0, TAU, -math.pi / 2, -1.28, '#ffffff', 'vinyl', nl=48, nt=6)
for g in range(6):   # the seams between the gores
    lo = g / 6 * TAU
    tube([(BR * 1.004 * math.cos(la) * math.cos(lo), BR * 1.004 * math.cos(la) * math.sin(lo), BR * 1.004 * math.sin(la)) for la in [-1.28 + 2.56 * k / 16 for k in range(17)]], 0.0016, '#e8e4dc', 'vinyl', res=2)
cone((0, 0, BR + 0.004), 0.012, 0.009, 0.012, '#f2f0ea', 'vinyl', n=16)

# ----- the boombox: orange, a silver panel between two speakers (they face -y: the pool's +z), a handle, an aerial -----
model('radio')
OR, OR2, STEEL, DARK = '#f5821f', '#d96c12', '#c9ced6', '#3a3c42'
box((0, 0, 0.105), (0.4, 0.13, 0.19), OR, 'plastic', bevel=0.03)
box((0, 0, 0.105), (0.404, 0.004, 0.13), OR2, 'plastic')   # the seam between its halves
F = -0.066   # its front face
box((0, F, 0.1), (0.11, 0.008, 0.15), STEEL, 'metal', bevel=0.006)
box((0, F - 0.004, 0.16), (0.09, 0.004, 0.024), '#2a2c30', 'plastic')   # the dial's window
for k in range(9):
    box((-0.04 + k * 0.01, F - 0.0065, 0.163), (0.0012, 0.002, 0.008), '#d8dce2', 'plastic')
box((0.008, F - 0.007, 0.16), (0.0025, 0.002, 0.02), '#e83a2a', 'plastic')   # the needle
for x, col in ((-0.032, '#f2c23a'), (-0.006, '#2fa8b8')):
    cone((x, F - 0.007, 0.128), 0.011, 0.009, 0.01, col, 'plastic', rot=(math.pi / 2, 0, 0), n=16)
for x, col in ((0.02, '#4ac25a'), (0.038, '#e84a3a')):
    box((x, F - 0.005, 0.13), (0.012, 0.006, 0.009), col, 'plastic', bevel=0.002)
box((0, F - 0.004, 0.088), (0.085, 0.004, 0.045), '#8e939c', 'metal', bevel=0.003)   # the cassette door
box((0, F - 0.006, 0.088), (0.06, 0.002, 0.028), '#2a2c30', 'plastic')
for x in (-0.014, 0.014):
    torus(0.006, 0.0018, '#e8e8ea', 'plastic', at=(x, F - 0.0075, 0.088), seg=(16, 6), rot=(math.pi / 2, 0, 0))
for k, col in enumerate(('#e84a3a', '#e8e8ea', '#4ac25a', '#4a6ad8')):   # the keys
    box((-0.033 + k * 0.022, F - 0.006, 0.047), (0.019, 0.01, 0.012), col, 'plastic', bevel=0.002)
for x in (-0.135, 0.135):
    cone((x, F + 0.002, 0.1), 0.068, 0.068, 0.004, DARK, 'plastic', rot=(math.pi / 2, 0, 0), n=48)
    torus(0.066, 0.007, '#9aa0aa', 'metal', at=(x, F - 0.002, 0.1), seg=(48, 10), rot=(math.pi / 2, 0, 0))
    cone((x, F - 0.008, 0.1), 0.058, 0.02, 0.02, '#4a4c54', 'plastic', rot=(-math.pi / 2, 0, 0), n=48)
    ball((x, F - 0.017, 0.1), 0.02, '#5a5c64', 'plastic', scale=(1, 0.5, 1), seg=(20, 10))
tube(path([(-0.13, 0, 0.19), (-0.13, 0, 0.27), (-0.1, 0, 0.295), (0.1, 0, 0.295), (0.13, 0, 0.27), (0.13, 0, 0.19)], 5), 0.017, OR, 'plastic', res=5)
ball((0.12, 0.025, 0.2), 0.012, STEEL, 'metal', seg=(12, 8))
tube([(0.12, 0.025, 0.2), (0.0, 0.03, 0.34)], 0.0045, STEEL, 'metal', res=3)
tube([(0.0, 0.03, 0.34), (-0.09, 0.034, 0.445)], 0.0032, STEEL, 'metal', res=3)
ball((-0.09, 0.034, 0.445), 0.006, STEEL, 'metal', seg=(10, 6))
