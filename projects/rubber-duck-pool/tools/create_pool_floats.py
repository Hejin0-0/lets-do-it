#!/usr/bin/env python3
"""Author the pool inflatables from shared, plain-Python triangle meshes.

From projects/rubber-duck-pool:
  blender -b --factory-startup --python-exit-code 1 -P tools/create_pool_floats.py -- all

Importing this file does not require Blender; build_model is also used by the
contract checker. Blender only consumes these meshes, with no modifiers.
Coordinates are metres, Blender Z up, and the tube centre is at z = 0.
"""

import json
import math
import sys
from dataclasses import dataclass
from pathlib import Path


# The values in this table are sRGB hex, not linear shader values. A colour is
# deliberately associated with exactly one named material in each model.
COLORS = {
    "Vinyl | Coral": "#f4777e",
    "Vinyl | Coral Seam": "#df646d",
    "Vinyl | Flamingo Beak": "#f5b7a0",
    "Vinyl | Golden": "#eeb23a",
    "Vinyl | Golden Seam": "#d7982b",
    "Vinyl | Trunk": "#98613d",
    "Vinyl | Trunk Seam": "#794729",
    "Vinyl | Leaf": "#4eae56",
    "Vinyl | Leaf Seam": "#318841",
    "Vinyl | Swan": "#f8f6f0",
    "Vinyl | Swan Panel": "#fffdf9",
    "Vinyl | Swan Seam": "#dcd9d1",
    "Vinyl | Orange Beak": "#f28a32",
    "Vinyl | Black Beak": "#292427",
    "Plastic | Eye White": "#ffffff",
    "Plastic | Eye Black": "#17191c",
}

TAU = math.tau


@dataclass
class Part:
    name: str
    role: str
    material: str
    vertices: list
    faces: list


def grid_faces(rows, columns, wrap_rows=False, wrap_columns=True, reverse=False):
    faces = []
    for i in range(rows if wrap_rows else rows - 1):
        for j in range(columns if wrap_columns else columns - 1):
            a = i*columns + j
            b = ((i+1) % rows)*columns + j
            c = ((i+1) % rows)*columns + (j+1) % columns
            d = i*columns + (j+1) % columns
            faces.extend(((a, d, c), (a, c, b)) if reverse else ((a, b, c), (a, c, d)))
    return faces


def torus(name, role, material, major, minor, center=(0, 0, 0), segments=64, sections=20):
    vertices = []
    for i in range(segments):
        a = TAU*i/segments
        for j in range(sections):
            b = TAU*j/sections
            radial = major + minor*math.cos(b)
            vertices.append((center[0]+radial*math.cos(a), center[1]+radial*math.sin(a), center[2]+minor*math.sin(b)))
    return Part(name, role, material, vertices, grid_faces(segments, sections, True))


def cross(a, b):
    return (a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0])


def unit(v):
    length = math.sqrt(sum(x*x for x in v))
    if length < 1e-12:
        raise ValueError("zero-length direction")
    return tuple(x/length for x in v)


def cap_sweep(vertices, faces, rows, sections, centers):
    first = len(vertices)
    vertices.extend((centers[0], centers[-1]))
    for j in range(sections):
        nxt = (j+1) % sections
        faces.extend(((first, nxt, j), (first+1, (rows-1)*sections+j, (rows-1)*sections+nxt)))


def sweep(name, role, material, centers, widths, depths, sections=10):
    """A soft tube whose centreline lies in XZ; widths are across XZ, depths along Y."""
    vertices = []
    for i, center in enumerate(centers):
        before, after = centers[max(0, i-1)], centers[min(len(centers)-1, i+1)]
        dx, dz = after[0]-before[0], after[2]-before[2]
        n = unit((dz, 0, -dx))
        for j in range(sections):
            a = TAU*j/sections
            vertices.append((center[0]+n[0]*widths[i]*math.cos(a),
                             center[1]+depths[i]*math.sin(a),
                             center[2]+n[2]*widths[i]*math.cos(a)))
    faces = grid_faces(len(centers), sections, reverse=True)
    cap_sweep(vertices, faces, len(centers), sections, centers)
    return Part(name, role, material, vertices, faces)


def interpolate_controls(controls, divisions=3):
    """Catmull-Rom centreline and widths; endpoints stay at the controls."""
    result = []
    for i in range(len(controls)-1):
        p0, p1 = controls[max(0, i-1)], controls[i]
        p2, p3 = controls[i+1], controls[min(len(controls)-1, i+2)]
        for k in range(divisions):
            t = k/divisions
            result.append(tuple(.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t)
                                for a, b, c, d in zip(p0, p1, p2, p3)))
    result.append(controls[-1])
    return result


def shaped_tube(name, role, material, controls, divisions=3, sections=10):
    samples = interpolate_controls(controls, divisions)
    return sweep(name, role, material, [tuple(s[:3]) for s in samples],
                 [s[3] for s in samples], [s[4] for s in samples], sections)


def ellipsoid(name, role, material, center, radii, segments=20, rings=10):
    """An indexed, closed ellipsoid without duplicate pole vertices."""
    vertices = [(center[0], center[1], center[2]-radii[2])]
    for k in range(1, rings):
        latitude = -math.pi/2 + math.pi*k/rings
        for j in range(segments):
            a = TAU*j/segments
            vertices.append((center[0]+radii[0]*math.cos(latitude)*math.cos(a),
                             center[1]+radii[1]*math.cos(latitude)*math.sin(a),
                             center[2]+radii[2]*math.sin(latitude)))
    north = len(vertices)
    vertices.append((center[0], center[1], center[2]+radii[2]))
    faces = []
    for j in range(segments):
        nxt = (j+1) % segments
        faces.append((0, 1+nxt, 1+j))
        for k in range(rings-2):
            a, b = 1+k*segments+j, 1+k*segments+nxt
            faces.extend(((a, b, b+segments), (a, b+segments, a+segments)))
        a, b = 1+(rings-2)*segments+j, 1+(rings-2)*segments+nxt
        faces.append((north, a, b))
    return Part(name, role, material, vertices, faces)


def print_disc(name, material, center, axes, radius, side, segments=12):
    """Flat ink discs on each side, with a separate white glint."""
    across, up = axes
    vertices = [center] + [tuple(center[k] + radius*(across[k]*math.cos(TAU*j/segments)
                                                       + up[k]*math.sin(TAU*j/segments))
                                 for k in range(3)) for j in range(segments)]
    faces = []
    for j in range(segments):
        a, b = 1+j, 1+(j+1) % segments
        faces.append((0, b, a) if side > 0 else (0, a, b))
    return Part(name, "neck", material, vertices, faces)


def head_surface(head, x, z, side):
    """Return the outside face under an eye and its normal, in the XZ projection."""
    hits = []
    for face in head.faces:
        a, b, c = (head.vertices[i] for i in face)
        d = (b[2]-c[2])*(a[0]-c[0]) + (c[0]-b[0])*(a[2]-c[2])
        if abs(d) < 1e-12:
            continue
        u = ((b[2]-c[2])*(x-c[0]) + (c[0]-b[0])*(z-c[2]))/d
        v = ((c[2]-a[2])*(x-c[0]) + (a[0]-c[0])*(z-c[2]))/d
        w = 1-u-v
        if min(u, v, w) >= -1e-9:
            normal = unit(cross(tuple(b[i]-a[i] for i in range(3)),
                                tuple(c[i]-a[i] for i in range(3))))
            hits.append((side*(u*a[1]+v*b[1]+w*c[1]), normal))
    if not hits:
        raise ValueError("eye position does not intersect the head")
    distance, normal = max(hits, key=lambda hit: hit[0])
    return (x, side*distance, z), normal


def add_printed_eyes(parts, head, center):
    x, _, z = center
    for side in (-1, 1):
        surface, normal = head_surface(head, x+.008, z+.010, side)
        across = unit((1, -normal[0]/normal[1], 0))
        up = tuple(side*v for v in unit(cross(across, normal)))
        axes = (across, up)
        def position(dx, dz, offset):
            return tuple(surface[i]+dx*across[i]+dz*up[i]+offset*normal[i] for i in range(3))
        parts.append(print_disc(f"eye white {side}", "Plastic | Eye White", position(0, 0, .00015), axes, .012, side))
        parts.append(print_disc(f"eye pupil {side}", "Plastic | Eye Black", position(.002, 0, .00055), axes, .0065, side, 10))
        parts.append(print_disc(f"eye glint {side}", "Plastic | Eye White", position(.003, .0025, .00095), axes, .0023, side, 8))


def line_tube(name, role, material, points, radius, sections=4):
    """A small round bead following a nonvertical 3-D path."""
    vertices = []
    for i, point in enumerate(points):
        before, after = points[max(0, i-1)], points[min(len(points)-1, i+1)]
        tangent = unit(tuple(after[j]-before[j] for j in range(3)))
        ref = (0, 0, 1) if abs(tangent[2]) < .9 else (0, 1, 0)
        across = unit(cross(tangent, ref))
        normal = unit(cross(tangent, across))
        for j in range(sections):
            a = TAU*j/sections
            vertices.append(tuple(point[k]+radius*(across[k]*math.cos(a)+normal[k]*math.sin(a)) for k in range(3)))
    faces = grid_faces(len(points), sections, reverse=True)
    cap_sweep(vertices, faces, len(points), sections, points)
    return Part(name, role, material, vertices, faces)


def valve(major, minor, side, seam_material, body_material):
    angle = 3*math.pi/4 if side == 1 else math.pi/4
    x, y = major*math.cos(angle), major*math.sin(angle)
    # Embedded flange and rounded, visibly separate press cap.
    flange = ellipsoid("valve flange", "ring_detail", seam_material, (x, y, minor-.001), (.019, .019, .005), 12, 5)
    cap = ellipsoid("valve cap", "ring_detail", body_material, (x, y, minor+.003), (.013, .013, .006), 12, 5)
    return [flange, cap]


def ring_parts(major, minor, side, body, seam, segments=64):
    parts = [torus("ring", "ring", body, major, minor, segments=segments)]
    parts.append(torus("outer seam", "ring_detail", seam, major+minor-.001, .0022, segments=64, sections=4))
    parts.extend(valve(major, minor, side, seam, body))
    return parts


def neck_parts(controls, body, seam):
    samples = interpolate_controls(controls, 3)
    centers = [tuple(s[:3]) for s in samples]
    parts = [sweep("neck", "neck", body, centers, [s[3] for s in samples], [s[4] for s in samples], 12)]
    # The seam sits just proud of the side, follows the whole S, and disappears
    # into the head. The first row is embedded at the ring join.
    for side in (-1, 1):
        path = [(s[0], side*(s[4]-.0001), s[2]) for s in samples]
        parts.append(line_tube(f"neck seam {side}", "neck", seam, path, .0016))
    first = controls[0]
    parts.append(torus("neck join crease", "neck", seam, first[3]-.003, .0015,
                       (first[0], 0, first[2]+.009), 16, 4))
    return parts


def feathers(major, body, swan=False):
    parts = []
    for index, y in enumerate((-.035, 0, .035)):
        lift = .112 if swan else .085
        if index != 1:
            lift *= .86
        controls = [(-major+.026, y*.68, .080, .030, .027),
                    (-major-.001, y, .108, .032, .030),
                    (-major-.022, y*1.05, .080+lift*.72, .024, .023),
                    (-major-.025, y*1.08, .080+lift, .003, .004)]
        parts.append(shaped_tube(f"tail feather {index+1}", "tail", body, controls, 2, 8))
    return parts


def bird(name):
    flamingo = name == "flamingo"
    major, minor = (.30, .103) if flamingo else (.45, .108)
    body = "Vinyl | Coral" if flamingo else "Vinyl | Swan"
    seam = "Vinyl | Coral Seam" if flamingo else "Vinyl | Swan Seam"
    parts = ring_parts(major, minor, 1, body, seam, segments=64 if flamingo else 56)
    if flamingo:
        controls = [(.300, 0, .083, .065, .063), (.330, 0, .177, .054, .052),
                    (.304, 0, .300, .043, .044), (.270, 0, .411, .040, .042),
                    (.290, 0, .517, .043, .044), (.327, 0, .561, .047, .047)]
        head, radii = (.342, 0, .568), (.070, .057, .065)
        beak = [( .394, 0, .564, .026, .030), (.425, 0, .553, .026, .029),
                (.456, 0, .529, .020, .022), (.464, 0, .504, .015, .017)]
        tip = [(.460, 0, .513, .015, .017), (.470, 0, .493, .013, .014),
               (.467, 0, .477, .003, .004)]
        bill_material = "Vinyl | Flamingo Beak"
    else:
        controls = [(.450, 0, .090, .066, .064), (.487, 0, .187, .056, .054),
                    (.470, 0, .323, .046, .047), (.422, 0, .462, .043, .044),
                    (.424, 0, .585, .044, .045), (.474, 0, .665, .050, .048)]
        head, radii = (.485, 0, .674), (.073, .061, .073)
        beak = [(.535, 0, .666, .025, .029), (.566, 0, .662, .024, .027),
                (.600, 0, .653, .017, .019), (.608, 0, .648, .013, .015)]
        tip = [(.603, 0, .650, .013, .015), (.617, 0, .646, .011, .013),
               (.624, 0, .643, .003, .004)]
        bill_material = "Vinyl | Orange Beak"
    parts.extend(neck_parts(controls, body, seam))
    head_mesh = ellipsoid("head", "neck", body, head, radii, 24, 12)
    parts.append(head_mesh)
    parts.append(shaped_tube("beak", "neck", bill_material, beak, 3, 10))
    parts.append(shaped_tube("beak tip", "neck", "Vinyl | Black Beak", tip, 3, 10))
    add_printed_eyes(parts, head_mesh, head)
    parts.extend(feathers(major, body, swan=not flamingo))
    if not flamingo:
        parts.extend(swan_wings(parts[0]))
    return parts


def ring_surface(ring, angle, phi):
    """A point on the actual ring triangles, in their angular parameterisation."""
    sections = next(i for i, point in enumerate(ring.vertices) if abs(point[1]) > 1e-12)
    segments = len(ring.vertices)//sections
    along = angle % TAU / TAU * segments
    across = phi % TAU / TAU * sections
    i, j = int(along), int(across)
    s, t = along-i, across-j
    def vertex(row, column):
        return ring.vertices[(row % segments)*sections + column % sections]
    a, b, c, d = vertex(i, j), vertex(i+1, j), vertex(i+1, j+1), vertex(i, j+1)
    if t <= s:
        weights, points = (1-s, s-t, t), (a, b, c)
    else:
        weights, points = (1-t, s, t-s), (a, c, d)
    return tuple(sum(weight*point[k] for weight, point in zip(weights, points)) for k in range(3))


def wing_point(ring, side, t, across):
    angle = side*(.93+1.54*t)
    taper = math.sqrt(max(0, math.sin(math.pi*t)))
    # The rear tip climbs the tube; three low-amplitude waves round the outer edge.
    center = 1.05+.45*(t*t*(3-2*t))
    scallop = .5-.5*math.cos(3*TAU*t)
    low = center-(.43+.32*scallop)*taper
    high = center+.53*taper
    point = ring_surface(ring, angle, low+(high-low)*across)
    return point[0], point[1], point[2]-.0008


def wing_faces(rows, tip0, tip1, reverse):
    """Close a grid whose two ends each converge to one vertex."""
    faces = []
    for j in range(len(rows[0])-1):
        faces.extend(((tip0, rows[0][j], rows[0][j+1]),
                      (rows[-1][j], tip1, rows[-1][j+1])))
    for first, second in zip(rows, rows[1:]):
        for j in range(len(first)-1):
            faces.extend(((first[j], second[j], second[j+1]),
                          (first[j], second[j+1], first[j+1])))
    return [tuple(reversed(face)) for face in faces] if reverse else faces


def wing_rim(side, vertices, rows, tip0, tip1):
    """A narrow continuous welded strip, laid on the pillow's upper surface."""
    boundary = [tip0] + [row[0] for row in rows] + [tip1] + [row[-1] for row in reversed(rows)]
    toward = [rows[0][len(rows[0])//2]] + [row[1] for row in rows]
    toward += [rows[-1][len(rows[-1])//2]] + [row[-2] for row in reversed(rows)]
    rim = []
    for outer, inner in zip(boundary, toward):
        a, b = vertices[outer], vertices[inner]
        fraction = min(.45, .0025/math.dist(a, b))
        rim.extend((tuple(a[k]+(.0002 if k == 2 else 0) for k in range(3)),
                    tuple(a[k]+fraction*(b[k]-a[k])+(.0002 if k == 2 else 0) for k in range(3))))
    faces = grid_faces(len(boundary), 2, wrap_rows=True, wrap_columns=False, reverse=side < 0)
    return Part(f"wing rim {side}", "wing", "Vinyl | Swan Seam", rim, faces)


def swan_wing(ring, side):
    stations, columns, lower_columns = 21, 5, 5
    tip = wing_point(ring, side, 0, .5)
    vertices = [(tip[0], tip[1], tip[2]+.0048), tip]
    top, bottom = [], []
    for i in range(1, stations):
        u = i/stations
        t = .25*u+.75*(1-math.cos(math.pi*u))/2
        upper = []
        for j in range(columns):
            across = j/(columns-1)
            x, y, z = wing_point(ring, side, t, across)
            dome = .0048+.017*math.sin(math.pi*t)**.45 * math.sin(math.pi*across)**.7
            upper.append(len(vertices))
            vertices.append((x, y, z+dome))
        lower = []
        for j in range(lower_columns):
            lower.append(len(vertices))
            vertices.append(wing_point(ring, side, t, j/(lower_columns-1)))
        top.append(upper)
        bottom.append(lower)
    tip1, tip = len(vertices), wing_point(ring, side, 1, .5)
    vertices.extend(((tip[0], tip[1], tip[2]+.0048), tip))
    faces = wing_faces(top, 0, tip1, reverse=side < 0)
    faces += wing_faces(bottom, 1, tip1+1, reverse=side > 0)
    for edge, reverse in ((0, side > 0), (-1, side < 0)):
        upper = [0] + [row[edge] for row in top] + [tip1]
        lower = [1] + [row[edge] for row in bottom] + [tip1+1]
        for a, b, c, d in zip(upper, upper[1:], lower[1:], lower):
            pair = ((a, b, c), (a, c, d))
            faces.extend(tuple(reversed(face)) for face in pair) if reverse else faces.extend(pair)
    panel = Part(f"wing panel {side}", "wing", "Vinyl | Swan Panel", vertices, faces)
    return panel, wing_rim(side, vertices, top, 0, tip1)


def swan_wings(ring):
    return [part for side in (-1, 1) for part in swan_wing(ring, side)]


def palm_trunk():
    controls = [(-.280, 0, .085, .055, .057), (-.292, 0, .200, .050, .050),
                (-.300, 0, .320, .044, .044), (-.320, 0, .444, .037, .039),
                (-.345, 0, .565, .031, .034)]
    samples = interpolate_controls(controls, 5)
    centers = [tuple(s[:3]) for s in samples]
    # A single welded tube with five plump, softly pinched segments.
    factors = [.83+.17*(.5-.5*math.cos(TAU*5*i/(len(samples)-1))) for i in range(len(samples))]
    widths = [s[3]*f for s, f in zip(samples, factors)]
    depths = [s[4]*f for s, f in zip(samples, factors)]
    sections = 10
    parts = [sweep("trunk", "neck", "Vinyl | Trunk", centers, widths, depths, sections)]
    for side in (-1, 1):
        path = [(s[0], side*(depth*math.cos(math.pi/sections)-.0001), s[2])
                for s, depth in zip(samples, depths)]
        parts.append(line_tube(f"neck seam {side}", "neck", "Vinyl | Trunk Seam", path, .0015))
    parts.append(torus("neck join crease", "neck", "Vinyl | Trunk Seam", .047, .0015, (-.280, 0, .094), 16, 4))
    for index in (4, 8, 12, 16):
        parts.append(torus(f"trunk segment crease {index//4}", "neck", "Vinyl | Trunk Seam",
                           max(widths[index], depths[index])+.0003, .0012, centers[index], 12, 3))
    return parts


def frond(index, base, angle, length):
    dx, dy = math.cos(angle), math.sin(angle)
    across = (-dy, dx, 0)
    rows, sections = 11, 6
    vertices, centers, ridge = [], [], []
    for i in range(rows):
        t = i/(rows-1)
        z = base[2]+.045*math.sin(math.pi*t*.86)-.026*t
        dz = .045*math.pi*.86*math.cos(math.pi*t*.86)-.026
        normal = unit((-dz*dx, -dz*dy, length))
        center = (base[0]+dx*length*t, base[1]+dy*length*t, z)
        width = .003+.032*math.sin(math.pi*t)**.85
        thickness = .002+.009*math.sin(math.pi*t)**.8
        centers.append(center)
        ridge.append(tuple(center[k]+normal[k]*(thickness*math.cos(math.pi/sections)-.0001) for k in range(3)))
        for j in range(sections):
            a = TAU*j/sections
            vertices.append(tuple(center[k]+width*across[k]*math.cos(a)+thickness*normal[k]*math.sin(a) for k in range(3)))
    faces = grid_faces(rows, sections, reverse=True)
    cap_sweep(vertices, faces, rows, sections, centers)
    leaf = Part(f"frond {index}", "neck", "Vinyl | Leaf", vertices, faces)
    bead = line_tube(f"leaf seam {index}", "neck", "Vinyl | Leaf Seam", ridge, .0011)
    return leaf, bead


def palmring():
    parts = ring_parts(.28, .11, -1, "Vinyl | Golden", "Vinyl | Golden Seam")
    parts.extend(palm_trunk())
    base = (-.345, 0, .565)
    parts.append(ellipsoid("crown", "neck", "Vinyl | Leaf", base, (.033, .033, .029), 16, 8))
    for index in range(6):
        angle = TAU*index/6+.12
        length = .145 if index in (0, 3) else .155
        parts.extend(frond(index+1, base, angle, length))
    return parts


def build_model(name):
    if name in ("flamingo", "swan"):
        return bird(name)
    if name == "palmring":
        return palmring()
    raise ValueError(f"unknown float: {name}")


def srgb_to_linear(value):
    return value/12.92 if value <= .04045 else ((value+.055)/1.055)**2.4


def create_material(bpy, name):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    rgb = tuple(srgb_to_linear(int(COLORS[name][i:i+2], 16)/255) for i in (1, 3, 5))
    mat.diffuse_color = (*rgb, 1)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*rgb, 1)
    shader.inputs["Roughness"].default_value = .29 if name.startswith("Vinyl") else .38
    shader.inputs["Metallic"].default_value = 0
    return mat


def make_blender_mesh(bpy, part, materials):
    mesh = bpy.data.meshes.new(part.name)
    mesh.from_pydata(part.vertices, [], part.faces)
    mesh.update()
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    obj = bpy.data.objects.new(part.name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(materials[part.material])
    return obj


def evaluated_stats(bpy, objects, name):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    coordinates, triangles, vertices = [], 0, 0
    for obj in objects:
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        try:
            mesh.calc_loop_triangles()
            triangles += len(mesh.loop_triangles)
            vertices += len(mesh.vertices)
            coordinates.extend(tuple(evaluated.matrix_world @ vertex.co) for vertex in mesh.vertices)
        finally:
            evaluated.to_mesh_clear()
    bounds = [[min(v[i] for v in coordinates), max(v[i] for v in coordinates)] for i in range(3)]
    if triangles > 6000:
        raise ValueError(f"{name}: {triangles} evaluated triangles exceed the 6000 budget")
    return {"id": name, "triangles": triangles, "vertices": vertices, "bounds": bounds}, coordinates


def add_light(bpy, Vector, name, position, energy, size, target):
    light = bpy.data.lights.new("STUDIO " + name, "AREA")
    light.energy, light.shape, light.size = energy, "DISK", size
    obj = bpy.data.objects.new("STUDIO " + name, light)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = position
    obj.rotation_euler = (Vector(target)-obj.location).to_track_quat("-Z", "Y").to_euler()


def studio(bpy, Vector, coordinates, side, image_path):
    scene = bpy.context.scene
    world = scene.world or bpy.data.worlds.new("STUDIO light backdrop")
    scene.world = world
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (.72, .75, .77, 1)
    background.inputs["Strength"].default_value = .8
    direction = Vector((.85*side, -2, 1.25)).normalized()
    rotation = (-direction).to_track_quat("-Z", "Y")
    inverse = rotation.inverted()
    projected = [inverse @ Vector(point) for point in coordinates]
    limits = [(min(p[i] for p in projected), max(p[i] for p in projected)) for i in range(3)]
    center = rotation @ Vector(tuple((lo+hi)/2 for lo, hi in limits))
    camera = bpy.data.cameras.new("STUDIO camera")
    camera.type = "ORTHO"
    camera.ortho_scale = max(limits[0][1]-limits[0][0], (limits[1][1]-limits[1][0])*4/3)/.80
    camera_obj = bpy.data.objects.new("STUDIO camera", camera)
    scene.collection.objects.link(camera_obj)
    camera_obj.location = center+direction*3
    camera_obj.rotation_euler = rotation.to_euler()
    scene.camera = camera_obj
    add_light(bpy, Vector, "key", (2, -3, 4), 90, 2.5, (0, 0, .25))
    add_light(bpy, Vector, "fill", (-3, -1, 2), 45, 3, (0, 0, .25))
    add_light(bpy, Vector, "rim", (0, 3, 3), 65, 2.5, (0, 0, .25))
    scene.view_settings.view_transform = "AgX"
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 32
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = 960, 720
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.render.filepath = str(image_path)


def write_model(bpy, Vector, output, name):
    # A fresh scene for every model, even when the command requests all three.
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    parts = build_model(name)
    materials = {n: create_material(bpy, n) for n in {p.material for p in parts}}
    objects = [make_blender_mesh(bpy, p, materials) for p in parts]
    bpy.context.view_layer.update()
    stats, coordinates = evaluated_stats(bpy, objects, name)
    for obj in bpy.context.selected_objects:
        obj.select_set(False)
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.export_scene.gltf(filepath=str(output / (name+".glb")), export_format="GLB",
                              export_yup=True, export_apply=True, use_selection=True)
    studio(bpy, Vector, coordinates, -1 if name == "palmring" else 1, output / (name+".png"))
    bpy.ops.wm.save_as_mainfile(filepath=str(output / (name+".blend")), compress=True)
    bpy.ops.render.render(write_still=True)
    print("MODEL_STATS " + json.dumps(stats, sort_keys=True), flush=True)


def main():
    arguments = sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
    if len(arguments) != 1 or arguments[0] not in ("flamingo", "palmring", "swan", "all"):
        raise SystemExit("choose one: flamingo, palmring, swan, all")
    import bpy
    from mathutils import Vector
    bpy.context.preferences.filepaths.save_version = 0
    output = Path(__file__).resolve().parents[1] / "assets/02_models/props/pool-floats"
    output.mkdir(parents=True, exist_ok=True)
    for name in (("flamingo", "palmring", "swan") if arguments[0] == "all" else arguments):
        write_model(bpy, Vector, output, name)


if __name__ == "__main__":
    main()
