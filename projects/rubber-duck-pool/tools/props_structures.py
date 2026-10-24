# The pool's structures that are its own pieces, run inside build_props.py (exec'd there, after its helpers), after
# the sample art (Part S: pool_structure, whirlpool_bowl): the spa at the big pool's head, its fountain and the little
# waterfall it spills into the pool; the round pool's tiled rim and its drain. The pools' water and the ducks' ways
# through them are the world's (layout.js), so these stand round them.
import math


def ring_tiles(r0, r1, z0, z1, n, cols, kind='plaster', rows=1):
    """A band of square tiles round a ring (from radius r0 at z0 to r1 at z1), coloured by turns."""
    for row in range(rows):
        za, zb = z0 + (z1 - z0) * row / rows, z0 + (z1 - z0) * (row + 1) / rows
        ra, rb = r0 + (r1 - r0) * row / rows, r0 + (r1 - r0) * (row + 1) / rows
        for c in range(len(cols)):
            verts, faces = [], []
            for i in range(c + row % len(cols), n, len(cols)):
                a0, a1 = i / n * TAU, (i + 1) / n * TAU
                g = 0.008 / max(ra, 0.05)   # the grout between tiles
                k = len(verts)
                verts += [(ra * math.cos(a0 + g), ra * math.sin(a0 + g), za + 0.003), (ra * math.cos(a1 - g), ra * math.sin(a1 - g), za + 0.003),
                          (rb * math.cos(a1 - g), rb * math.sin(a1 - g), zb - 0.003), (rb * math.cos(a0 + g), rb * math.sin(a0 + g), zb - 0.003)]
                faces.append((k, k + 1, k + 2, k + 3))
            if faces:
                mesh_obj('tile', verts, faces, cols[c], kind, smooth=False)


# ----- the spa at the big pool's head: a raised round basin, tiled, brimming; the fountain's nozzle in its middle (the
# spout the toys come back out of: layout SPOUT, 0.5 over the terrace); a little waterfall from its front lip down
# into the pool (toward the pool: -y here, the pool's +z). The basin stands a little toward the pool from the nozzle
# (props.js places it), clear of the colonnade's middle column; the nozzle is NZ behind its middle -----
model('spa')
SR, SH, NZ = 0.18, 0.26, 0.11
lathe([(SR - 0.035, 0.0), (SR - 0.035, SH - 0.03), (SR - 0.025, SH), (SR + 0.01, SH + 0.01), (SR + 0.03, SH - 0.005), (SR + 0.035, SH - 0.04), (SR + 0.03, 0.0)], '#f4efe6', 'plaster', seg=48)
ring_tiles(SR + 0.037, SR + 0.037, 0.03, SH - 0.05, 28, ['#3fb3ae', '#f4f1ea'], rows=3)
lathe([(0.0, SH - 0.012), (SR - 0.034, SH - 0.012)], '#5fc6d6', 'fall', seg=40)   # the brimming water
lathe([(0.0, 0.0), (0.035, 0.0), (0.03, 0.2), (0.022, 0.42), (0.03, 0.47), (0.0, 0.48)], '#f4efe6', 'plaster', seg=20, at=(0, NZ, 0))   # the nozzle's column
cone((0, NZ - 0.02, 0.495), 0.012, 0.008, 0.05, BRASS, 'metal', rot=(math.pi / 2 - 0.5, 0, 0), n=12)
# the waterfall: a sheet curving out over the lip and down to the pool (its water about 0.05 under the terrace)
fall = []
n, w = 12, 0.075
for i in range(n + 1):
    t = i / n
    y = -(SR + 0.02) - 0.07 * math.sin(t * math.pi / 2) - 0.02 * t
    z = SH - 0.005 - (SH + 0.06) * t ** 1.6
    fall += [(-w * (1 + 0.15 * t), y, z), (w * (1 + 0.15 * t), y, z)]
mesh_obj('fall', fall, [(2 * i, 2 * i + 2, 2 * i + 3, 2 * i + 1) for i in range(n)], '#7fd6e6', 'fall')
for k in range(9):   # the foam where it lands
    a = (k / 8 - 0.5) * 1.6
    ball((math.sin(a) * 0.09, -(SR + 0.1) - 0.04 * math.cos(a), -0.055), 0.03 + 0.012 * (k % 3), '#f4fbff', 'paint', scale=(1, 1, 0.45), seg=(12, 6))

# ----- the round pool's rim (a whirlpool): a white marble lip with a band of teal and white tiles outside it -----
model('bowlrim')
RR = 0.92
lathe([(RR - 0.01, 0.0), (RR - 0.01, 0.07), (RR + 0.01, 0.092), (RR + 0.05, 0.1), (RR + 0.13, 0.1), (RR + 0.16, 0.085), (RR + 0.17, 0.06), (RR + 0.17, 0.0)], '#f2ede4', 'plaster', seg=128)
ring_tiles(RR + 0.171, RR + 0.171, 0.0, 0.058, 64, ['#3fb3ae', '#f4f1ea'], rows=2)

# ----- the drain at the round pool's bottom: a chrome ring, a dark grate with its bars -----
model('drain')
torus(0.11, 0.014, '#c8ccd2', 'metal', seg=(48, 10))
cone((0, 0, -0.004), 0.1, 0.1, 0.006, '#20262c', 'plastic', n=40)
for k in range(5):
    box((-0.08 + 0.04 * k, 0, 0.002), (0.012, 0.19 - 0.06 * abs(k - 2), 0.008), '#aab0b8', 'metal')
