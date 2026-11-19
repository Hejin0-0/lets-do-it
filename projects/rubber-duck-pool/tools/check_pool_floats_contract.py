#!/usr/bin/env python3
"""Check the authored float meshes without Blender or third-party packages.

The same vertex and triangle lists are handed directly to bpy by the generator.
Values below are deliberately independent of the generator's design parameters.
"""

import json
import math
import re
import sys

from create_pool_floats import COLORS, build_model, cross


CONTRACT = {
    "flamingo": (0.30, 0.103, 1, 0.60, 0.68),
    "palmring": (0.28, 0.110, -1, 0.55, 0.70),
    "swan": (0.45, 0.108, 1, 0.68, 0.76),
}

REQUIRED_COLORS = {
    "flamingo": {"Vinyl | Coral": "#f4777e", "Vinyl | Coral Seam": "#df646d",
                 "Vinyl | Flamingo Beak": "#f5b7a0", "Vinyl | Black Beak": "#292427",
                 "Plastic | Eye White": "#ffffff", "Plastic | Eye Black": "#17191c"},
    "palmring": {"Vinyl | Golden": "#eeb23a", "Vinyl | Golden Seam": "#d7982b",
                 "Vinyl | Trunk": "#98613d", "Vinyl | Trunk Seam": "#794729",
                 "Vinyl | Leaf": "#4eae56", "Vinyl | Leaf Seam": "#318841"},
    "swan": {"Vinyl | Swan": "#f8f6f0", "Vinyl | Orange Beak": "#f28a32",
             "Vinyl | Black Beak": "#292427", "Vinyl | Swan Panel": "#fffdf9",
             "Vinyl | Swan Seam": "#dcd9d1", "Plastic | Eye White": "#ffffff", "Plastic | Eye Black": "#17191c"},
}


def require(condition, message):
    if not condition:
        raise AssertionError(message)


def torus_error(point, major, minor):
    x, y, z = point
    return abs(math.hypot(math.hypot(x, y) - major, z) - minor)


def triangle_area(a, b, c):
    u = tuple(b[i] - a[i] for i in range(3))
    v = tuple(c[i] - a[i] for i in range(3))
    return math.sqrt(sum(t*t for t in cross(u, v))) / 2


def subtract(a, b):
    return tuple(x-y for x, y in zip(a, b))


def dot(a, b):
    return sum(x*y for x, y in zip(a, b))


def point_segment_distance(point, a, b):
    edge, offset = subtract(b, a), subtract(point, a)
    t = max(0, min(1, dot(offset, edge)/dot(edge, edge)))
    return math.dist(point, tuple(a[i]+t*edge[i] for i in range(3)))


def point_triangle_distance(point, a, b, c):
    ab, ac, ap = subtract(b, a), subtract(c, a), subtract(point, a)
    normal = cross(ab, ac)
    scale = dot(ap, normal)/dot(normal, normal)
    projected = tuple(point[i]-scale*normal[i] for i in range(3))
    aq = subtract(projected, a)
    d00, d01, d11 = dot(ab, ab), dot(ab, ac), dot(ac, ac)
    d20, d21 = dot(aq, ab), dot(aq, ac)
    denominator = d00*d11-d01*d01
    v = (d11*d20-d01*d21)/denominator
    w = (d00*d21-d01*d20)/denominator
    if v >= 0 and w >= 0 and v+w <= 1:
        return abs(scale)*math.sqrt(dot(normal, normal))
    return min(point_segment_distance(point, u, v) for u, v in ((a, b), (b, c), (c, a)))


def surface_distance(point, part):
    return min(point_triangle_distance(point, *(part.vertices[i] for i in face)) for face in part.faces)


def vertical_heights(part, x, y):
    """Intersect a vertical line with the mesh, including its faceted surface."""
    heights = []
    for face in part.faces:
        a, b, c = (part.vertices[i] for i in face)
        if not (min(a[0], b[0], c[0])-1e-9 <= x <= max(a[0], b[0], c[0])+1e-9
                and min(a[1], b[1], c[1])-1e-9 <= y <= max(a[1], b[1], c[1])+1e-9):
            continue
        denominator = (b[1]-c[1])*(a[0]-c[0]) + (c[0]-b[0])*(a[1]-c[1])
        if abs(denominator) < 1e-12:
            continue
        u = ((b[1]-c[1])*(x-c[0]) + (c[0]-b[0])*(y-c[1]))/denominator
        v = ((c[1]-a[1])*(x-c[0]) + (a[0]-c[0])*(y-c[1]))/denominator
        w = 1-u-v
        if min(u, v, w) >= -1e-9:
            heights.append(u*a[2]+v*b[2]+w*c[2])
    return heights


def is_planar(part):
    a, b, c = part.vertices[:3]
    u, v = subtract(b, a), subtract(c, a)
    normal = cross(u, v)
    length = math.sqrt(dot(normal, normal))
    return length > 0 and all(abs(dot(subtract(p, a), normal)) <= 1e-9*length for p in part.vertices)


def check_bead(body, bead):
    # Test the actual faceted surface, not just the ideal tube's centreline.
    for point in bead.vertices:
        require(surface_distance(point, body) <= .002, f"{bead.name}: bead is detached from {body.name}")


def ring_surface_error(part, major, minor):
    # The unsigned distance to a torus is 1-Lipschitz. Subdivide each triangle
    # in barycentric coordinates: every point is within max_edge/20 of a sample.
    # Thus the reported upper bound covers the interiors, not just vertices.
    subdivisions = 20
    worst, bound = 0.0, 0.0
    for face in part.faces:
        a, b, c = (part.vertices[i] for i in face)
        ab, ac = tuple(b[i]-a[i] for i in range(3)), tuple(c[i]-a[i] for i in range(3))
        longest = max(math.dist(a, b), math.dist(b, c), math.dist(c, a))
        sample_max = 0.0
        for i in range(subdivisions+1):
            for j in range(subdivisions+1-i):
                point = tuple(a[k]+(ab[k]*i+ac[k]*j)/subdivisions for k in range(3))
                sample_max = max(sample_max, torus_error(point, major, minor))
        worst = max(worst, sample_max)
        bound = max(bound, sample_max + longest/subdivisions)
    return worst, bound


def check_faces(part):
    for face in part.faces:
        require(len(face) == 3 and len(set(face)) == 3, f"{part.name}: invalid triangle {face}")
        require(all(isinstance(i, int) and 0 <= i < len(part.vertices) for i in face), f"{part.name}: bad index")
        require(triangle_area(*(part.vertices[i] for i in face)) > 1e-12, f"{part.name}: degenerate triangle")


def check_geometry(model):
    for part in model:
        require(part.vertices and part.faces, f"{part.name}: empty geometry")
        require(part.material in COLORS, f"{part.name}: undefined material")
        require(part.role in {"ring", "ring_detail", "neck", "wing", "tail"}, f"{part.name}: unknown role")
        for point in part.vertices:
            require(len(point) == 3 and all(math.isfinite(x) for x in point), f"{part.name}: invalid vertex")
        check_faces(part)


def check_ring_topology(part):
    # An actual closed tube, including the upper surface, not a clipped strip.
    edges, adjacent = {}, {i: set() for i in range(len(part.vertices))}
    for a, b, c in part.faces:
        for u, v in ((a, b), (b, c), (c, a)):
            edge = tuple(sorted((u, v)))
            edges.setdefault(edge, []).append((u, v))
            adjacent[u].add(v)
            adjacent[v].add(u)
    require(all(len(directions) == 2 for directions in edges.values()), f"{part.name}: ring is not closed")
    require(all(directions[0] == tuple(reversed(directions[1])) for directions in edges.values()),
            f"{part.name}: inconsistent winding")
    pending, visited = [0], set()
    while pending:
        vertex = pending.pop()
        if vertex not in visited:
            visited.add(vertex)
            pending.extend(adjacent[vertex] - visited)
    require(len(visited) == len(part.vertices), f"{part.name}: ring is disconnected")
    require(len(part.vertices) - len(edges) + len(part.faces) == 0, f"{part.name}: ring is not toroidal")


def check_ring(part, major, minor):
    check_ring_topology(part)
    for axis in (0, 1):
        lo = min(v[axis] for v in part.vertices)
        hi = max(v[axis] for v in part.vertices)
        require(abs(lo + major + minor) < .006 and abs(hi - major - minor) < .006,
                f"{part.name}: ring is not centred or has the wrong radius")
    require(abs(min(v[2] for v in part.vertices) + minor) < .006, f"{part.name}: ring bottom")
    require(abs(max(v[2] for v in part.vertices) - minor) < .006, f"{part.name}: ring top")
    sample, bound = ring_surface_error(part, major, minor)
    require(bound <= .006, f"{part.name}: torus deviation bound {bound:.6f} m")
    return sample, bound


def check_partition(model, major, minor, side):
    for part in model:
        for x, y, z in part.vertices:
            neck = side*x > major - .8*minor and z > .55*minor
            if part.role == "neck":
                require(neck, f"{part.name}: neck vertex outside fold region: {(x, y, z)}")
            elif part.role == "ring" and neck:
                # The existing shader folds this part of the complete tube with
                # the neck. No attached detail gets the same exception.
                require(torus_error((x, y, z), major, minor) <= .006,
                        f"{part.name}: fold-region vertex is not on the torus: {(x, y, z)}")
            else:
                require(not neck, f"{part.name}: {part.role} vertex in neck fold region: {(x, y, z)}")
            if part.role in {"wing", "tail"}:
                require(math.hypot(x, y) <= major + minor + .09 + 1e-9, f"{part.name}: exceeds plan limit")
            if part.role == "neck":
                require(math.hypot(x, y) <= major + minor + .12 + 1e-9, f"{part.name}: neck extends too far")


def find_part(model, name):
    return next((part for part in model if part.name == name), None)


def count_prefix(model, prefix):
    return sum(part.name.startswith(prefix) for part in model)


def check_height(name, model, low, high):
    height_parts = ([p for p in model if p.name == "head"] if name != "palmring"
                    else [p for p in model if p.name.startswith("frond ")])
    require(height_parts, f"{name}: head or crown is missing")
    height = max(v[2] for p in height_parts for v in p.vertices)
    require(low <= height <= high, f"{name}: head/crown height {height:.6f} m")
    return height


def check_common_details(name, model):
    require(find_part(model, "valve cap") is not None, f"{name}: missing valve cap")
    require(find_part(model, "outer seam") is not None, f"{name}: missing outer seam")
    require(count_prefix(model, "neck seam ") == 2, f"{name}: missing neck side seams")
    body = find_part(model, "trunk" if name == "palmring" else "neck")
    require(body is not None, f"{name}: missing neck or trunk")
    for side in (-1, 1):
        seam = find_part(model, f"neck seam {side}")
        require(seam is not None, f"{name}: missing neck seam {side}")
        check_bead(body, seam)


def check_leaf_seams(model, fronds):
    for index in range(1, fronds+1):
        leaf, seam = find_part(model, f"frond {index}"), find_part(model, f"leaf seam {index}")
        require(leaf is not None and seam is not None, f"palmring: missing frond or seam {index}")
        check_bead(leaf, seam)


def check_palm_details(model):
    fronds = count_prefix(model, "frond ")
    require(5 <= fronds <= 7, "palmring: frond count")
    require(count_prefix(model, "leaf seam ") == fronds, "palmring: leaf seam count")
    require(count_prefix(model, "trunk segment crease ") == 4, "palmring: trunk segments")
    check_leaf_seams(model, fronds)


def check_eyes(name, model):
    head = find_part(model, "head")
    for side in (-1, 1):
        for detail in ("white", "pupil", "glint"):
            eye = find_part(model, f"eye {detail} {side}")
            require(eye is not None and is_planar(eye), f"{name}: printed eye {detail}")
        eye = find_part(model, f"eye white {side}")
        require(surface_distance(eye.vertices[0], head) <= .0005, f"{name}: printed eye is detached")


def wing_edges(part):
    edges = {}
    for face in part.faces:
        a, b, c = (part.vertices[i] for i in face)
        nz = cross(subtract(b, a), subtract(c, a))[2]
        for u, v in zip(face, face[1:]+face[:1]):
            edges.setdefault(tuple(sorted((u, v))), []).append((u, v, nz))
    return edges


def check_wing_closed(panel, edges):
    require(all(len(directions) == 2 and directions[0][:2] == tuple(reversed(directions[1][:2]))
                for directions in edges.values()), f"{panel.name}: panel is not closed and consistently wound")
    require(len(panel.vertices)-len(edges)+len(panel.faces) == 2, f"{panel.name}: panel is not a pillow")


def check_wing_contact(panel, ring):
    count = 0
    for face in panel.faces:
        a, b, c = (panel.vertices[i] for i in face)
        if cross(subtract(b, a), subtract(c, a))[2] >= -1e-12:
            continue
        point = tuple((a[k]+b[k]+c[k])/3 for k in range(3))
        heights = vertical_heights(ring, point[0], point[1])
        require(heights, f"{panel.name}: underside misses the tube")
        offset = point[2]-max(heights)
        require(-.007 <= offset <= .0001, f"{panel.name}: underside detached from tube ({offset:.6f} m)")
        count += 1
    require(count, f"{panel.name}: no underside")


def check_rim_loop(rim):
    edges = wing_edges(rim)
    require(all(len(directions) in (1, 2) for directions in edges.values()), f"{rim.name}: invalid rim")
    boundary = [edge for edge, directions in edges.items() if len(directions) == 1]
    adjacent = {}
    for a, b in boundary:
        adjacent.setdefault(a, set()).add(b)
        adjacent.setdefault(b, set()).add(a)
    require(adjacent and all(len(neighbors) == 2 for neighbors in adjacent.values()),
            f"{rim.name}: rim is broken")
    loops, unseen = 0, set(adjacent)
    while unseen:
        loops += 1
        pending = [next(iter(unseen))]
        while pending:
            vertex = pending.pop()
            if vertex in unseen:
                unseen.remove(vertex)
                pending.extend(adjacent[vertex] & unseen)
    require(loops == 2, f"{rim.name}: expected a continuous rim strip")


def check_wing_rim(panel, edges, rim):
    require(rim is not None and rim.role == "wing" and rim.material == "Vinyl | Swan Seam",
            f"{panel.name.replace('panel', 'rim')}: missing seam or wing role")
    check_rim_loop(rim)
    require(all(surface_distance(point, panel) <= .001 for point in rim.vertices), f"{rim.name}: seam is detached")
    # The top/side-wall transition is the whole welded perimeter of the pillow.
    perimeter = {v for edge, faces in edges.items()
                 if any(f[2] > 1e-12 for f in faces) and any(abs(f[2]) <= 1e-12 for f in faces)
                 for v in edge}
    require(perimeter and all(surface_distance(panel.vertices[v], rim) <= .001 for v in perimeter),
            f"{rim.name}: seam does not surround the panel")


def check_swan_wings(model):
    ring = find_part(model, "ring")
    for side in (-1, 1):
        panel = find_part(model, f"wing panel {side}")
        require(panel is not None and panel.material == "Vinyl | Swan Panel", f"wing panel {side}: missing panel")
        edges = wing_edges(panel)
        check_wing_closed(panel, edges)
        heights = vertical_heights(panel, 0, side*.48)
        require(len(heights) >= 2 and .015 <= max(heights)-min(heights) <= .025,
                f"{panel.name}: middle thickness must be 15–25 mm")
        check_wing_contact(panel, ring)
        check_wing_rim(panel, edges, find_part(model, f"wing rim {side}"))


def check_bird_details(name, model):
    require(sum(p.role == "tail" for p in model) >= 2, f"{name}: missing tail feathers")
    require(find_part(model, "beak") and find_part(model, "beak tip"), f"{name}: missing beak")
    check_eyes(name, model)
    if name == "swan":
        require(sum(p.role == "wing" and p.name.startswith("wing panel ") for p in model) == 2, "swan: missing folded wings")
        check_swan_wings(model)


def check_materials(name, model):
    used = {p.material for p in model}
    require(all(n.partition(" | ")[0] in {"Vinyl", "Plastic"} and " | " in n for n in used),
            f"{name}: invalid material kind prefix")
    require(all(re.fullmatch(r"#[0-9a-fA-F]{6}", COLORS[n]) for n in used), f"{name}: invalid sRGB hex")
    require(len({COLORS[n].lower() for n in used}) == len(used), f"{name}: duplicate materials for a colour")
    for material, color in REQUIRED_COLORS[name].items():
        require(material in used and COLORS[material].lower() == color, f"{name}: missing identity color {material}")
    return used


def check_ring_details(name, model, major, minor, side):
    seam = find_part(model, "outer seam")
    require(all(abs(v[2]) <= .006 and abs(math.hypot(v[0], v[1])-(major+minor)) <= .006
                for v in seam.vertices), f"{name}: outer seam does not follow equator")
    valve = find_part(model, "valve cap")
    require(side*sum(v[0] for v in valve.vertices)/len(valve.vertices) < 0, f"{name}: valve is on neck side")


def model_stats(name, model, triangles, height, sample_error, error_bound, used):
    points = [v for p in model for v in p.vertices]
    bounds = [[min(v[i] for v in points), max(v[i] for v in points)] for i in range(3)]
    return {"id": name, "triangles": triangles, "vertices": len(points), "bounds": bounds,
            "head_or_crown_top": height, "ring_sampled_error": sample_error, "ring_error_bound": error_bound,
            "materials": {n: COLORS[n] for n in sorted(used)}}


def check_model(name, model):
    major, minor, side, low, high = CONTRACT[name]
    check_geometry(model)
    rings = [p for p in model if p.role == "ring"]
    require(len(rings) == 1, f"{name}: expected one ring")
    sample_error, error_bound = check_ring(rings[0], major, minor)
    triangles = sum(len(p.faces) for p in model)
    require(triangles <= 6000, f"{name}: {triangles} triangles exceeds budget")
    height = check_height(name, model, low, high)
    check_common_details(name, model)
    if name == "palmring":
        check_palm_details(model)
    else:
        check_bird_details(name, model)
    used = check_materials(name, model)
    check_ring_details(name, model, major, minor, side)
    check_partition(model, major, minor, side)
    return model_stats(name, model, triangles, height, sample_error, error_bound, used)


def main():
    errors = []
    for name in CONTRACT:
        try:
            print("CONTRACT_STATS " + json.dumps(check_model(name, build_model(name)), sort_keys=True))
        except AssertionError as exc:
            errors.append(f"{name}: {exc}")
    if errors:
        print("\n".join("CONTRACT_FAILED " + error for error in errors), file=sys.stderr)
        raise SystemExit(1)


if __name__ == "__main__":
    main()
