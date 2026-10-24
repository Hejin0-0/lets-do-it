# The duck mural, run inside build_props.py (exec'd there, after its helpers: model, tag, tube, ball, path, taper).
# An illustration in relief, as a sign painter cuts one from board: every piece is a flat 2D shape (drawn as a signed
# distance, so circles and ellipses melt into one soft silhouette) cut out by marching squares, raised 0.05 to 0.15 m
# off the wall with its edges rounded, a dark rim behind it for an outline, and lines and dots painted on its face.
# The wall's face is x 0 (the relief faces +x, into the courtyard); u runs along the wall (Blender y), v up it (z).
import math

import bmesh

ROT = (math.pi / 2, 0, math.pi / 2)   # a curve's own x, y, z to the wall's y, z, x


def sd_ellipse(u, v, cu, cv, ru, rv, a=0.0):
    du, dv = u - cu, v - cv
    if a:
        c, s = math.cos(a), math.sin(a)
        du, dv = c * du + s * dv, -s * du + c * dv
    return (math.hypot(du / ru, dv / rv) - 1) * min(ru, rv)


def smin(a, b, k):
    h = max(k - abs(a - b), 0) / k
    return min(a, b) - h * h * k * 0.25


def contour(f, box, h):
    """The closed outlines where f crosses 0 inside box (u0, v0, u1, v1), sampled every h, as lists of (u, v)."""
    u0, v0, u1, v1 = box
    nu, nv = int((u1 - u0) / h) + 2, int((v1 - v0) / h) + 2
    val = [[f(u0 + i * h, v0 + j * h) for j in range(nv)] for i in range(nu)]
    pt = {}

    def cross(key):
        if key not in pt:
            d, i, j = key
            a = val[i][j]
            b = val[i + 1][j] if d == 'h' else val[i][j + 1]
            t = a / (a - b) if a != b else 0.5
            pt[key] = (u0 + (i + t) * h, v0 + j * h) if d == 'h' else (u0 + i * h, v0 + (j + t) * h)
        return key
    nxt = {}
    for i in range(nu - 1):
        for j in range(nv - 1):
            c = [val[i][j] < 0, val[i + 1][j] < 0, val[i + 1][j + 1] < 0, val[i][j + 1] < 0]
            e = [('h', i, j), ('v', i + 1, j), ('h', i, j + 1), ('v', i, j)]   # bottom, right, top, left
            ins = [k for k in range(4) if c[k] != c[(k + 1) % 4]]
            if not ins:
                continue
            segs = []
            if len(ins) == 2:
                segs.append((e[ins[0]], e[ins[1]]))
            else:   # a saddle: decide by the middle
                mid = (val[i][j] + val[i + 1][j] + val[i + 1][j + 1] + val[i][j + 1]) / 4 < 0
                if mid == c[0]:
                    segs += [(e[0], e[1]), (e[2], e[3])]
                else:
                    segs += [(e[3], e[0]), (e[1], e[2])]
            for a, b in segs:
                nxt.setdefault(cross(a), []).append(cross(b))
                nxt.setdefault(b, []).append(a)
    loops, seen = [], set()
    for start in nxt:
        if start in seen:
            continue
        loop, prev, cur = [], None, start
        while cur not in seen:
            seen.add(cur)
            loop.append(pt[cur])
            nb = [n for n in nxt[cur] if n != prev]
            if not nb:
                break
            prev, cur = cur, nb[0]
        if len(loop) > 6:
            loops.append(loop)
    return loops


def simplify(loop, eps):
    """A closed outline with the points dropped that stray less than eps from the line through their neighbours
    (Douglas-Peucker, from its two farthest-apart points)."""
    def rdp(pts):
        if len(pts) < 3:
            return pts
        (au, av), (bu, bv) = pts[0], pts[-1]
        L = math.hypot(bu - au, bv - av) or 1e-9
        k, dm = 0, -1.0
        for i in range(1, len(pts) - 1):
            d = abs((bu - au) * (av - pts[i][1]) - (au - pts[i][0]) * (bv - av)) / L
            if d > dm:
                k, dm = i, d
        return rdp(pts[:k + 1])[:-1] + rdp(pts[k:]) if dm > eps else [pts[0], pts[-1]]
    j = max(range(len(loop)), key=lambda i: (loop[i][0] - loop[0][0]) ** 2 + (loop[i][1] - loop[0][1]) ** 2)
    return rdp(loop[:j + 1])[:-1] + rdp(loop[j:] + [loop[0]])[:-1]


def slab(loops, x0, depth, bevel, col, kind, name='relief', res=2):
    """Flat shapes (outlines in u, v) raised from x0 to x0 + depth, their edges rounded by bevel."""
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions, cu.fill_mode = '2D', 'BOTH'
    cu.extrude, cu.bevel_depth, cu.bevel_resolution = max(0.0, depth / 2 - bevel), bevel, res
    for lp in loops:
        lp = simplify(lp, 0.002)
        sp = cu.splines.new('POLY')
        sp.points.add(len(lp) - 1)
        for k, (u, v) in enumerate(lp):
            sp.points[k].co = (u, v, 0, 1)
        sp.use_cyclic_u = True
    o = bpy.data.objects.new(name, cu)
    bpy.context.collection.objects.link(o)
    o.rotation_euler = ROT
    o.location = (x0 + depth / 2, 0, 0)
    return tag(o, col, kind)


def piece(f, box, x0, depth, col, line='#3a2a2a', kind='paint', bevel=None, rim=0.012, h=None):
    """A cut-out: the shape f < 0 raised depth off x0 with rounded edges, and behind it a dark rim reaching rim further
    round it (the outline). Sampled every h (default: a 90th of the box's smaller side). Returns the x of its face."""
    b = bevel if bevel is not None else min(0.01, depth * 0.3)
    h = h or max(0.0025, min(box[2] - box[0], box[3] - box[1]) / 90)
    slab(contour(lambda u, v: f(u, v) + 0.5 * b, box, h), x0, depth, b, col, kind)   # the bevel rounds it out by b: draw it a little in
    if rim:
        w = 0.5 * b + rim
        slab(contour(lambda u, v: f(u, v) - w, (box[0] - w, box[1] - w, box[2] + w, box[3] + w), h), x0 - 0.002, depth * 0.6, min(0.004, b), line, kind, 'rim', res=1)
    return x0 + depth


def line_on(pts, x, r, col, kind='paint'):
    """A painted line raised a hair off a face at x: through (u, v) points."""
    tube([(x, u, v) for u, v in pts], r, col, kind, res=2)


def dot(u, v, x, r, col, kind='paint', flat=0.35):
    ball((x, u, v), r, col, kind, scale=(flat, 1, 1), seg=(14, 8))


# ----- the pieces -----
YELLOW, YELLOW2, BEAK, INK = '#ffcf26', '#f7b51a', '#ff7a1a', '#3a2412'


def cartoon_duck(cu, cv, s, face=-1, x0=0.0, body=YELLOW, wing=YELLOW2, depth=0.05):
    """A cartoon rubber duck in profile, s tall, standing at (cu, cv), looking along face (+1: +u, -1: -u)."""
    F = lambda u, v: ((u - cu) * face / s, (v - cv) / s)

    def sil(u, v):
        p, q = F(u, v)
        d = sd_ellipse(p, q, -0.04, 0.3, 0.47, 0.28)
        d = smin(d, sd_ellipse(p, q, -0.43, 0.5, 0.15, 0.1, -0.75), 0.14)   # the tail, turned up
        d = smin(d, sd_ellipse(p, q, 0.24, 0.74, 0.27, 0.26), 0.16)        # the head
        return d * s
    box = (cu - 0.7 * s, cv - 0.05 * s, cu + 0.7 * s, cv + 1.08 * s)
    fx = piece(sil, box, x0, depth, body, INK, rim=0.004 * s / 0.3)
    beak = lambda u, v: smin(sd_ellipse(*F(u, v), 0.53, 0.68, 0.14, 0.06, 0.12), sd_ellipse(*F(u, v), 0.5, 0.62, 0.11, 0.045, -0.1), 0.03) * s
    piece(beak, (cu - 0.8 * s, cv + 0.5 * s, cu + 0.8 * s, cv + 0.82 * s), fx - 0.02, 0.032, BEAK, INK, rim=0.003 * s / 0.3)

    def wingf(u, v):   # a wing with three feather tips toward the tail
        p, q = F(u, v)
        d = sd_ellipse(p, q, -0.02, 0.36, 0.24, 0.13, 0.3)
        for k in range(3):
            d = smin(d, sd_ellipse(p, q, -0.22 - 0.03 * k, 0.42 - 0.07 * k, 0.1, 0.05, 0.5), 0.05)
        return d * s
    piece(wingf, (cu - 0.55 * s, cv + 0.1 * s, cu + 0.45 * s, cv + 0.62 * s), fx - 0.014, 0.024, wing, INK, rim=0)
    eu, ev = cu + face * 0.3 * s, cv + 0.8 * s
    dot(eu, ev, fx + 0.003, 0.05 * s, '#1a1208')
    dot(eu + face * 0.014 * s, ev + 0.018 * s, fx + 0.012, 0.016 * s, '#ffffff')
    dot(cu + face * 0.16 * s, cv + 0.63 * s, fx + 0.002, 0.055 * s, '#ff8f8f', flat=0.22)


def polar(u, v, cu, cv, R):
    """Distance outside a closed shape round (cu, cv) whose radius at angle a is R(a) (a star, a sun's rays)."""
    du, dv = u - cu, v - cv
    return math.hypot(du, dv) - R(math.atan2(dv, du))


def arms(a, n, a0=0.0):
    """How near angle a is to the nearest of n arms (the first at a0): 1 on an arm, 0 midway between two."""
    w = TAU / n
    t = (a - a0) % w
    return 1 - min(t, w - t) / (w / 2)


def sun(cu, cv, r, x0=0.0):
    rays = lambda u, v: polar(u, v, cu, cv, lambda a: r * (1.12 + 0.5 * arms(a, 12, math.pi / 2) ** 2.5))
    fx = piece(rays, (cu - 1.8 * r, cv - 1.8 * r, cu + 1.8 * r, cv + 1.8 * r), x0, 0.03, '#ffa53a', INK, rim=0.004)
    face = lambda u, v: sd_ellipse(u, v, cu, cv, r, r)
    fx = piece(face, (cu - 1.1 * r, cv - 1.1 * r, cu + 1.1 * r, cv + 1.1 * r), fx - 0.01, 0.03, '#ffd84a', INK, rim=0.004)
    for s in (-1, 1):
        dot(cu + s * 0.33 * r, cv + 0.15 * r, fx + 0.002, 0.1 * r, '#3a2412')
        dot(cu + s * 0.33 * r + 0.03 * r, cv + 0.19 * r, fx + 0.008, 0.035 * r, '#ffffff')
        dot(cu + s * 0.55 * r, cv - 0.12 * r, fx + 0.001, 0.13 * r, '#ff9a8a', flat=0.2)
    line_on([(cu + r * 0.32 * math.cos(a), cv - 0.12 * r - r * 0.22 * math.sin(a)) for a in [math.pi * i / 12 for i in range(13)]], fx + 0.003, 0.012 * r / 0.2, '#3a2412')


def cloud(cu, cv, s, x0=0.0):
    def f(u, v):
        d = 9.0
        for du, dv, r in ((0, 0.02, 0.17), (0.17, -0.01, 0.13), (-0.17, -0.02, 0.12), (0.08, 0.1, 0.12), (-0.08, 0.09, 0.11), (0.28, -0.04, 0.08), (-0.28, -0.05, 0.08)):
            d = smin(d, sd_ellipse(u, v, cu + du * s, cv + dv * s, r * s, r * s), 0.012 * s)
        return smin(d, max(sd_ellipse(u, v, cu, cv - 0.04 * s, 0.34 * s, 0.07 * s), -9), 0.02 * s)   # a soft underside
    piece(f, (cu - 0.42 * s, cv - 0.15 * s, cu + 0.42 * s, cv + 0.28 * s), x0, 0.035, '#fbfdff', '#5a7c9a', rim=0.005)


def wave_band(top, bot, u0, u1, x0, depth, col, hi=None):
    """A ribbon of sea between the curves bot(u) and top(u), from u0 to u1 with round ends; a white streak along it."""
    def f(u, v):
        d = max(bot(u) - v, v - top(u))
        e = max(u0 - u, u - u1)
        return max(d, e) if e < 0 else math.hypot(e, max(d, 0))
    lo = min(bot(u0 + (u1 - u0) * k / 40) for k in range(41)) - 0.02
    up = max(top(u0 + (u1 - u0) * k / 40) for k in range(41)) + 0.02
    fx = piece(f, (u0 - 0.03, lo, u1 + 0.03, up), x0, depth, col, '#173f6a', rim=0.007, h=0.006)
    if hi:   # a streak of light along its upper side
        us = [u0 + 0.15 + (u1 - u0 - 0.3) * k / 60 for k in range(61)]
        line_on([(u, top(u) - 0.35 * (top(u) - bot(u))) for u in us], fx + 0.001, 0.007, hi)
    return fx


def swirl(cu, cv, r, x, col='#eaf8fd', turns=1.6):
    """A curl of foam: a spiral tube, its dark outline a thicker spiral behind."""
    n = 40
    pts = [(cu + r * (1 - 0.85 * i / n) * math.cos(1.2 + turns * TAU * i / n), cv + r * (1 - 0.85 * i / n) * math.sin(1.2 + turns * TAU * i / n)) for i in range(n + 1)]
    tube([(x - 0.004, u, v) for u, v in pts], taper(n + 1, r * 0.34, r * 0.13), '#173f6a', 'paint', res=3)
    tube([(x + 0.006, u, v) for u, v in pts], taper(n + 1, r * 0.27, r * 0.09), col, 'paint', res=3)


def fish(cu, cv, s, face, col, stripe=None, x0=0.0):
    F = lambda u, v: ((u - cu) * face / s, (v - cv) / s)

    def f(u, v):
        p, q = F(u, v)
        d = sd_ellipse(p, q, 0, 0, 0.5, 0.3)
        tail = max(abs(q) - (0.06 + (-0.38 - p) * 0.55), -0.82 - p, p + 0.38)   # a fan behind
        return smin(d, tail, 0.05) * s
    fx = piece(f, (cu - 1.0 * s, cv - 0.5 * s, cu + 1.0 * s, cv + 0.5 * s), x0, 0.028, col, INK, rim=0.004)
    if stripe:   # a fin on its back, and spots
        piece(lambda u, v: sd_ellipse(*F(u, v), -0.05, 0.27, 0.2, 0.1, -0.3) * s, (cu - 0.5 * s, cv + 0.05 * s, cu + 0.5 * s, cv + 0.45 * s), x0 - 0.002, 0.02, stripe, INK, rim=0.003)
        for du, dv in ((-0.1, 0.05), (0.05, -0.08), (-0.2, -0.06)):
            dot(cu + face * du * s, cv + dv * s, fx + 0.001, 0.05 * s, stripe, flat=0.25)
    dot(cu + face * 0.25 * s, cv + 0.06 * s, fx + 0.002, 0.07 * s, '#ffffff')
    dot(cu + face * 0.27 * s, cv + 0.06 * s, fx + 0.006, 0.04 * s, '#1a1208')


def turtle(cu, cv, s, face, x0=0.0):
    F = lambda u, v: ((u - cu) * face / s, (v - cv) / s)

    def limbs(u, v):
        p, q = F(u, v)
        d = sd_ellipse(p, q, 0.55, 0.08, 0.2, 0.15)   # the head
        for fu, fv, a in ((0.3, 0.32, 0.6), (0.3, -0.32, -0.6), (-0.35, 0.28, -0.6), (-0.35, -0.28, 0.6)):
            d = smin(d, sd_ellipse(p, q, fu, fv, 0.2, 0.08, a), 0.03)
        return d * s
    piece(limbs, (cu - 0.8 * s, cv - 0.55 * s, cu + 0.8 * s, cv + 0.55 * s), x0, 0.025, '#8cc87a', INK, rim=0.003)
    fx = piece(lambda u, v: sd_ellipse(*F(u, v), 0, 0, 0.45, 0.33) * s, (cu - 0.5 * s, cv - 0.4 * s, cu + 0.5 * s, cv + 0.4 * s), x0 + 0.005, 0.035, '#5f9a52', INK, rim=0.003)
    for k in range(7):   # the plates on its shell
        a = k / 6 * TAU
        pu, pv = (0, 0) if k == 6 else (0.24 * math.cos(a), 0.17 * math.sin(a))
        dot(cu + face * pu * s, cv + pv * s, fx + 0.001, 0.09 * s, '#7ab86a', flat=0.18)
    dot(cu + face * 0.62 * s, cv + 0.12 * s, fx - 0.008, 0.035 * s, '#1a1208')


def starfish(cu, cv, r, col, x0=0.0):
    fx = piece(lambda u, v: polar(u, v, cu, cv, lambda a: r * (0.42 + 0.58 * arms(a, 5, math.pi / 2) ** 1.8)), (cu - 1.1 * r, cv - 1.1 * r, cu + 1.1 * r, cv + 1.1 * r), x0, 0.025, col, INK, rim=0.003)
    for k in range(5):
        a = math.pi / 2 + k / 5 * TAU
        for t in (0.35, 0.6):
            dot(cu + math.cos(a) * r * t, cv + math.sin(a) * r * t, fx + 0.001, 0.05 * r, '#ffe0c8', flat=0.3)


def surfboard(cu, cv, L, a, col, stripe, x0=0.0):
    fx = piece(lambda u, v: sd_ellipse(u, v, cu, cv, L / 2, L * 0.09, a), (cu - L * 0.6, cv - L * 0.35, cu + L * 0.6, cv + L * 0.35), x0, 0.022, col, INK, rim=0.003)
    line_on([(cu + math.cos(a) * L * t / 2, cv + math.sin(a) * L * t / 2) for t in (-0.85, 0, 0.85)], fx + 0.001, 0.006, stripe)


def islet(cu, cv, s, x0=0.0):
    sand = lambda u, v: max(sd_ellipse(u, v, cu, cv, 0.42 * s, 0.2 * s), cv - v)
    fx = piece(sand, (cu - 0.5 * s, cv - 0.05 * s, cu + 0.5 * s, cv + 0.25 * s), x0, 0.03, '#f6d48a', INK, rim=0.004)
    piece(lambda u, v: max(sd_ellipse(u, v, cu, cv + 0.06 * s, 0.33 * s, 0.13 * s), cv + 0.1 * s - v), (cu - 0.4 * s, cv, cu + 0.4 * s, cv + 0.22 * s), fx - 0.01, 0.018, '#7cc85a', INK, rim=0)
    for du, h, lean in ((-0.12, 0.55, -0.12), (0.12, 0.7, 0.1)):
        base, top = (cu + du * s, cv + 0.12 * s), (cu + (du + lean) * s, cv + h * s)
        pts = [(base[0] + (top[0] - base[0]) * t + 0.03 * s * math.sin(t * 3), base[1] + (top[1] - base[1]) * t) for t in [i / 8 for i in range(9)]]
        tube([(fx + 0.004, u, v) for u, v in pts], taper(9, 0.022 * s, 0.014 * s), '#9a6232', 'wood', res=3)
        for k in range(6):
            a = 0.3 + k / 5 * (math.pi - 0.6)
            leaf = lambda u, v, a=a, top=top: sd_ellipse(u, v, top[0] + math.cos(a) * 0.13 * s, top[1] + math.sin(a) * 0.04 * s - 0.03 * s * abs(math.cos(a)), 0.15 * s, 0.035 * s, math.atan2(math.sin(a) * 0.3 - 0.25 * abs(math.cos(a)), math.cos(a)))
            piece(leaf, (top[0] - 0.32 * s, top[1] - 0.15 * s, top[0] + 0.32 * s, top[1] + 0.12 * s), fx + 0.006, 0.014, '#4aa848', '#1e4a20', rim=0.002)


def seaweed(cu, h, x0=0.0, col='#5aa65a'):
    for k, (du, hh, ph) in enumerate(((-0.04, 1.0, 0.0), (0.0, 0.8, 1.3), (0.045, 0.9, 2.1))):
        pts = [(cu + du + 0.03 * math.sin(i * 0.9 + ph) * (i / 10), hh * h * i / 10) for i in range(11)]
        tube([(x0 - 0.003, u, v) for u, v in pts], taper(11, 0.024, 0.009), '#1e4a20', 'paint', res=3)
        tube([(x0 + 0.004, u, v) for u, v in pts], taper(11, 0.018, 0.006), col, 'paint', res=3)


# ----- the mural: windows (scenery.js HOLES) at u 3.0, 1.5, 0.3, -1.2, -2.5, their bottoms 0.62 to 0.93 up -----
U0, U1 = -3.6, 3.4
CRESTS = [2.25, 0.9, -0.45, -1.85]


def crest(u, lift):
    return sum(lift * math.exp(-((u - c) / 0.4) ** 2) for c in CRESTS)


def build_mural():
    model('mural')
    T = lambda u: 0.5 + 0.04 * math.sin(u * 2.6) + crest(u, 0.24)
    bands = [   # back to front: top, bottom, colour, streak
        (lambda u: T(u), lambda u: 0.22 + 0.03 * math.sin(u * 2.1 + 1), '#a9def6', '#ffffff'),
        (lambda u: T(u) - 0.14 + 0.03 * math.sin(u * 3.3), lambda u: 0.1, '#6fc0ee', '#dff4fd'),
        (lambda u: T(u) - 0.28 + 0.035 * math.sin(u * 2.4 + 2), lambda u: 0.0, '#c4ebfa', '#ffffff'),
        (lambda u: 0.24 + 0.05 * math.sin(u * 2.9 + 0.5) + crest(u, 0.06), lambda u: 0.0, '#4ea6e2', '#9ad8f6'),
    ]
    x = 0.0
    faces = []
    for top, bot, col, hi in bands:
        faces.append(wave_band(top, bot, U0, U1, x, 0.035, col, hi))
        x += 0.012
    for c in CRESTS:   # the curling crests, and swirls in the water below them
        swirl(c + 0.12, T(c + 0.12) - 0.12, 0.13, faces[0] + 0.002)
        swirl(c - 0.32, 0.3, 0.085, faces[2] + 0.002, '#e8f8fe', 1.4)
    ducks = [(2.6, 0.31, -1), (1.9, 0.27, -1), (1.2, 0.32, -1), (0.5, 0.28, -1), (-0.15, 0.31, -1), (-0.85, 0.27, -1), (-1.5, 0.32, -1), (-2.25, 0.28, -1)]
    for i, (u, s, face) in enumerate(ducks):
        v = T(u) - 0.14 + 0.03 * math.sin(u * 3.3) - 0.08 * s
        if i in (2, 5):   # two surfers
            surfboard(u, v + 0.005, 0.42 * s / 0.27, 0.06, '#ff9a5a' if i == 2 else '#f28fb0', '#ffffff', faces[1] + 0.006)
            v += 0.02
        cartoon_duck(u, v, s, face, faces[1] + 0.008)
    turtle(2.85, 0.15, 0.3, -1, faces[3])
    turtle(-2.8, 0.13, 0.26, 1, faces[3])
    fish(1.6, 0.13, 0.2, -1, '#ff8a3a', '#ffd9b0', faces[3])
    fish(0.15, 0.1, 0.18, 1, '#c87ae6', '#f5d24a', faces[3])
    fish(-1.05, 0.14, 0.2, -1, '#4a8ae8', '#bfe0ff', faces[3])
    fish(-2.1, 0.09, 0.17, 1, '#ffc23a', '#ff8a3a', faces[3])
    starfish(0.85, 0.08, 0.09, '#ff7a5a', faces[3])
    starfish(-1.65, 0.07, 0.08, '#f592c0', faces[3])
    for u, h in ((3.25, 0.36), (2.3, 0.28), (-0.45, 0.3), (-2.55, 0.34), (-3.4, 0.28)):
        seaweed(u, h, faces[3] + 0.004)
    sun(2.25, 1.0, 0.17, 0.0)
    cloud(-0.45, 1.0, 1.15)
    cloud(-1.85, 1.08, 0.95)
    cloud(3.55, 0.98, 0.85)
    islet(-3.15, T(-3.15) - 0.06, 0.55, faces[0] + 0.004)
    flat_backs('mural')


def flat_backs(name):
    """Every piece of a relief as a plain mesh cut flat at the wall's face (x 0): nothing behind the wall."""
    dg = bpy.context.evaluated_depsgraph_get()
    out = []
    for o in models[name]:
        me = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
        me.transform(o.matrix_world)
        bm = bmesh.new()
        bm.from_mesh(me)
        bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=(0.0005, 0, 0), plane_no=(1, 0, 0), clear_inner=True)
        bm.to_mesh(me)
        bm.free()
        if not me.polygons:
            continue
        n = bpy.data.objects.new(o.name, me)
        bpy.context.collection.objects.link(n)
        n['col'], n['kind'], n['smooth'] = o['col'], o['kind'], o['smooth']
        out.append(n)
        o.hide_set(True)
        o.hide_render = True
    models[name][:] = out
