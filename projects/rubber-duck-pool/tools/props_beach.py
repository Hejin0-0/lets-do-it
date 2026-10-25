# The beach's and the poolside's small things, run inside build_props.py (exec'd there, after its helpers and the mood
# pieces): a sandcastle, a bucket and spade, two surfboards stood in the sand, a cooler (its body the placement's
# tint), a basket of pool noodles, a stack of folded towels. A unit is about two metres; each stands on z 0 at its
# origin, its front at +x.
import math

SAND = '#e3c88f'   # (cloth: a matte surface in its own colour; stone would take the placement's tint)

# ----- a sandcastle: a keep with battlements and a flag, four corner towers joined by walls, a dark gate -----
model('sandcastle')
box((0, 0, 0.03), (0.36, 0.32, 0.06), SAND, 'cloth', bevel=0.02)   # the mound it stands on
lathe([(0.0, 0.05), (0.07, 0.05), (0.064, 0.17), (0.074, 0.18), (0.074, 0.2), (0.0, 0.2)], SAND, 'cloth', seg=16)
for k in range(6):
    a = k / 6 * TAU
    box((0.062 * math.cos(a), 0.062 * math.sin(a), 0.212), (0.024, 0.024, 0.024), SAND, 'cloth')
for sx in (-1, 1):
    for sy in (-1, 1):
        lathe([(0.0, 0.0), (0.042, 0.0), (0.037, 0.11), (0.046, 0.12), (0.046, 0.136), (0.0, 0.136)], SAND, 'cloth', seg=12, at=(sx * 0.13, sy * 0.11, 0.05))
for y in (-0.11, 0.11):
    box((0, y, 0.09), (0.24, 0.028, 0.08), SAND, 'cloth')
for x in (-0.13, 0.13):
    box((x, 0, 0.09), (0.028, 0.2, 0.08), SAND, 'cloth')
box((0.146, 0, 0.08), (0.006, 0.045, 0.06), '#8f7748', 'stone')   # the gate
tube([(0, 0, 0.2), (0, 0, 0.33)], 0.003, '#f4efe6', 'wood', res=2)
mesh_obj('flag', [(0, 0, 0.33), (0, 0, 0.28), (0, -0.065, 0.305)], [(0, 1, 2)], '#e8405a', 'cloth', smooth=False)
for k, (x, y) in enumerate(((0.17, 0.06), (0.17, -0.08), (-0.05, 0.155))):   # shells pressed into the mound
    ball((x, y, 0.055), 0.012, '#f6efe4' if k % 2 else '#f2c2b0', 'plastic', scale=(1, 0.8, 0.5), seg=(10, 6))

# ----- a bucket full of sand, its handle up, and a spade lying by it -----
model('bucket')
lathe([(0.0, 0.0), (0.045, 0.0), (0.06, 0.1), (0.065, 0.1), (0.065, 0.092), (0.054, 0.012), (0.0, 0.012)], '#e8452e', 'plastic', seg=28)
lathe([(0.0, 0.085), (0.057, 0.085)], SAND, 'cloth', seg=28)
tube([(0.064 * math.cos(t), 0, 0.09 + 0.07 * math.sin(t)) for t in [math.pi * k / 10 for k in range(11)]], 0.004, '#f2c62a', 'plastic', res=3)
box((0.15, 0.05, 0.005), (0.075, 0.055, 0.008), '#2a8ad8', 'plastic', rot=(0, 0, 0.4), bevel=0.003)
tube([(0.115, 0.035, 0.007), (0.02, -0.005, 0.012)], 0.006, '#2a8ad8', 'plastic', res=3)
box((0.02, -0.005, 0.012), (0.04, 0.016, 0.012), '#f2c62a', 'plastic', rot=(0, 0, 0.4), bevel=0.004)

# ----- two surfboards stood in the sand, leaning apart: one white with a coral stripe, one teal with a white -----
model('surfboards')
for y, lean, body, stripe in ((-0.1, 0.14, '#f6f2ea', '#f0645a'), (0.1, -0.16, '#2aa8b0', '#f6f2ea')):   # faces to +x, tipped apart
    c = (0, y - 0.45 * math.sin(lean), 0.45 * math.cos(lean) - 0.06)
    ball(c, 1, body, 'plastic', scale=(0.017, 0.13, 0.45), rot=(lean, 0, 0), seg=(40, 16))
    ball(c, 1, stripe, 'plastic', scale=(0.0175, 0.022, 0.452), rot=(lean, 0, 0), seg=(40, 8))   # the stripe, nose to tail
ball((0, 0, 0), 1, SAND, 'cloth', scale=(0.17, 0.3, 0.045), seg=(24, 12))   # the sand heaped round their tails

# ----- a cooler: a box in the placement's tint, a white lid, grips at the ends -----
model('cooler')
box((0, 0, 0.085), (0.3, 0.18, 0.17), '#000000', 'tint', bevel=0.02)
box((0, 0, 0.186), (0.31, 0.19, 0.034), '#f6f4ee', 'plastic', bevel=0.012)
for x in (-0.158, 0.158):
    box((x, 0, 0.14), (0.016, 0.1, 0.022), '#f6f4ee', 'plastic', bevel=0.006)
box((0, -0.0915, 0.03), (0.03, 0.004, 0.018), '#d8d4ca', 'plastic')   # the drain's plug

# ----- a wicker basket of pool noodles -----
model('noodles')
lathe([(0.0, 0.0), (0.1, 0.0), (0.112, 0.16), (0.118, 0.16), (0.118, 0.152), (0.106, 0.01), (0.0, 0.01)], '#b08a58', 'wood', seg=28)
for z in (0.04, 0.08, 0.12):
    torus(0.108 + 0.04 * z, 0.005, '#8c6a40', 'wood', at=(0, 0, z), seg=(40, 6))
for k, col in enumerate(('#ff5fa2', '#5fd36a', '#ffd23a', '#3aa8ff', '#ff8a3a')):
    a = k / 5 * TAU + 0.3
    tilt = 0.12 + 0.06 * (k % 2)
    cone((0.05 * math.cos(a) + 0.15 * math.sin(tilt) * math.cos(a), 0.05 * math.sin(a) + 0.15 * math.sin(tilt) * math.sin(a), 0.32), 0.022, 0.022, 0.62, col, 'plastic',
         rot=(-tilt * math.sin(a), tilt * math.cos(a), 0), n=10)

# ----- a stack of folded towels, each with a white stripe, a rolled one on top -----
model('towels')
for k, col in enumerate(('#2a8ad8', '#f2c62a', '#e8405a')):
    z = 0.018 + k * 0.036
    box((0.004 * k, -0.003 * k, z), (0.22, 0.15, 0.034), col, 'cloth', rot=(0, 0, 0.05 * (k - 1)), bevel=0.014)
    box((0.004 * k, -0.003 * k, z), (0.222, 0.025, 0.035), '#f6f2ea', 'cloth', rot=(0, 0, 0.05 * (k - 1)))
tube([(-0.09, 0, 0.13), (0.09, 0, 0.13)], 0.026, '#3ab89a', 'cloth', res=6)
