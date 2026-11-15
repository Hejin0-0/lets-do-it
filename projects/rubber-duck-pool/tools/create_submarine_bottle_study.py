"""Create an isolated, editable submarine-in-a-bottle collectible study.

Blender 5.3: blender -b --python create_submarine_bottle_study.py -- 6
"""
import math
import sys
from array import array
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets/02_models/props/sailboat-bottle-study/sailboat-bottle-v9.blend'
OUT = ROOT / 'assets/02_models/props/submarine-bottle-study'
REVISION = int(sys.argv[sys.argv.index('--') + 1]) if '--' in sys.argv else 6
STEM = f'submarine-bottle-v{REVISION}'
OUT.mkdir(parents=True, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
with bpy.data.libraries.load(str(SOURCE), link=False) as (source, destination):
    destination.objects = [n for n in source.objects if n.startswith(('Bottle |', 'Cradle |', 'Ocean |'))]
for obj in destination.objects:
    if obj:
        bpy.context.scene.collection.objects.link(obj)


def material(name, color, roughness=.4, metallic=0, emission=0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    shader = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Metallic'].default_value = metallic
    if emission:
        shader.inputs['Emission Color'].default_value = (*color, 1)
        shader.inputs['Emission Strength'].default_value = emission
    return mat


teal = material('Submarine | lagoon enamel', (.055, .31, .275), .32, .18)
shadow_teal = material('Submarine | deep teal trim', (.025, .16, .15), .36, .22)
ivory = material('Submarine | ivory belt', (.88, .79, .61), .35)
coral = material('Submarine | coral detail', (.80, .29, .16), .4)
brass = material('Submarine | satin brass', (.68, .42, .13), .25, .68)
window = material('Submarine | deep blue porthole', (.018, .115, .145), .20, .22)
glint = material('Submarine | window glint', (.40, .76, .72), .23, .08)
floor_mat = material('STUDIO | warm sand', (.58, .45, .33), .82)
glass_mat = next(m for m in bpy.data.materials if m.name.startswith('Glass | clear seafoam'))
glass_shader = next(n for n in glass_mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
glass_shader.inputs['Base Color'].default_value = (.95, 1.0, .98, 1)
glass_shader.inputs['IOR'].default_value = 1.20
glass_shader.inputs['Roughness'].default_value = .035

if REVISION >= 5:
    # An actual packed image survives the GLB and FBX; variation is restrained
    # so the paint stays legible at the tiny collectible's normal viewing size.
    def encode(linear):
        return 12.92 * linear if linear <= .0031308 else 1.055 * linear ** (1 / 2.4) - .055

    size = 256
    pixels = array('f')
    for y in range(size):
        v = y / size
        for x in range(size):
            u = x / size
            mottle = (.022 * math.sin(math.tau * (u * 7 + v * 5))
                      + .014 * math.sin(math.tau * (u * 17 - v * 11))
                      + .007 * math.sin(math.tau * (u * 43 + v * 37)))
            value = 1 + mottle
            rgb = (.055 * value, .31 * value, .275 * value)
            pixels.extend((*(encode(c) for c in rgb), 1) if REVISION >= 6 else (*rgb, 1))
    enamel_image = bpy.data.images.new('submarine-enamel', width=size, height=size, alpha=True)
    enamel_image.pixels.foreach_set(pixels)
    enamel_image.filepath_raw = str(OUT / 'submarine-enamel.png')
    enamel_image.file_format = 'PNG'
    enamel_image.save()
    enamel_image.pack()
    tex = teal.node_tree.nodes.new('ShaderNodeTexImage')
    tex.image = enamel_image
    shader = next(n for n in teal.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    teal.node_tree.links.new(tex.outputs['Color'], shader.inputs['Base Color'])


def sphere(name, loc, size, mat, segments=32, rings=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, radius=1, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    for face in obj.data.polygons:
        face.use_smooth = True
    return obj


def cylinder(name, loc, radius, depth, mat, vertices=24):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    bevel = obj.modifiers.new('Softened edge', 'BEVEL')
    bevel.width = min(.0015, radius * .2, depth * .35)
    bevel.segments = 2
    obj.modifiers.new('Weighted normals', 'WEIGHTED_NORMAL')
    return obj


def between(name, start, end, radius, mat):
    start, end = Vector(start), Vector(end)
    obj = cylinder(name, (start + end) / 2, radius, (end - start).length, mat, 16)
    obj.rotation_euler = (end - start).to_track_quat('Z', 'Y').to_euler()
    return obj


def pipe(name, points, radius, mat):
    data = bpy.data.curves.new(name, 'CURVE')
    data.dimensions = '3D'
    data.resolution_u = 1
    data.bevel_depth, data.bevel_resolution = radius, 2
    spline = data.splines.new('POLY')
    spline.points.add(len(points) - 1)
    for point, xyz in zip(spline.points, points):
        point.co = (*xyz, 1)
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    data.materials.append(mat)
    return obj


def torus(name, loc, major, minor, mat, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_segments=32, minor_segments=10,
                                    location=loc, rotation=rotation,
                                    major_radius=major, minor_radius=minor)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    for face in obj.data.polygons:
        face.use_smooth = True
    return obj


def porthole_frame(name, x, y, z, inner, outer, mat):
    """A thick annular metal plate, with an actual opening for the lens."""
    vertices, sides = [], 40
    side = -1 if y < 0 else 1
    for radius, depth in ((outer, -.002), (outer, .006), (inner, .006), (inner, -.002)):
        for i in range(sides):
            angle = math.tau * i / sides
            vertices.append((x + radius * math.cos(angle), y + side * depth, z + radius * math.sin(angle)))
    faces = []
    for ring in range(4):
        for i in range(sides):
            a, b = ring * sides + i, ring * sides + (i + 1) % sides
            c, d = ((ring + 1) % 4) * sides + (i + 1) % sides, ((ring + 1) % 4) * sides + i
            faces.append((a, b, c, d))
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    data.materials.append(mat)
    bevel = obj.modifiers.new('Gently rolled rim edges', 'BEVEL')
    bevel.width, bevel.segments = .0008, 2
    obj.modifiers.new('Weighted normals', 'WEIGHTED_NORMAL')
    return obj


def conning_tower():
    """Rounded rectangle taper, rather than a featureless oval blob."""
    vertices, count = [], 40
    for z, hx, hy in ((.386, .150, .075), (.452, .115, .065)):
        for i in range(count):
            angle = math.tau * i / count
            c, s = math.cos(angle), math.sin(angle)
            vertices.append((-.075 + hx * math.copysign(abs(c) ** .5, c),
                             hy * math.copysign(abs(s) ** .5, s), z))
    faces = [tuple(reversed(range(count))), tuple(range(count, 2 * count))]
    faces += [(i, (i + 1) % count, (i + 1) % count + count, i + count) for i in range(count)]
    data = bpy.data.meshes.new('Submarine | conning tower')
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new('Submarine | conning tower', data)
    bpy.context.scene.collection.objects.link(obj)
    data.materials.append(teal)
    bevel = obj.modifiers.new('Soft tower edges', 'BEVEL')
    bevel.width, bevel.segments = .004, 3
    obj.modifiers.new('Weighted normals', 'WEIGHTED_NORMAL')
    return obj


def box(name, loc, size, mat, bevel=.002):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    if bevel:
        mod = obj.modifiers.new('Rounded corners', 'BEVEL')
        mod.width = min(bevel, .45 * min(size))
        mod.segments = 3
        obj.modifiers.new('Weighted normals', 'WEIGHTED_NORMAL')
    return obj


CX, CZ, LENGTH, RY, RZ = -.05, .292, .445, .120, .108


def side_surface(x, z):
    factor = max(.0001, 1 - ((x - CX) / LENGTH) ** 2 - ((z - CZ) / RZ) ** 2)
    return RY * math.sqrt(factor)


# Closed ellipsoid and real, separately modeled features on both sides.
sphere('Submarine | pressure hull', (CX, 0, CZ), (LENGTH, RY, RZ), teal, 64, 32)
if REVISION >= 3:
    conning_tower()
else:
    sphere('Submarine | conning tower', (-.075, 0, .407), (.155, .076, .058), teal, 40, 20)
torus('Submarine | tower base rim', (-.075, 0, .404), .075, .0027, brass)
hatch_z = .457 if REVISION >= 3 else .463
cap = cylinder('Submarine | hatch', (-.075, 0, hatch_z), .046, .008, shadow_teal, 32)
torus('Submarine | hatch brass trim', (-.075, 0, hatch_z + .005), .044, .002, brass)
between('Submarine | periscope', (-.12, 0, .466), (-.12, 0, .545), .008, brass)
between('Submarine | periscope elbow', (-.12, 0, .545), (-.16, 0, .545), .008, brass)
sphere('Submarine | periscope corner', (-.12, 0, .545), (.008, .008, .008), brass, 16, 8)
between('Submarine | periscope lens', (-.16, 0, .545), (-.164, 0, .545), .006, window)

for side in (-1, 1):
    for x in (-.265, -.05, .165):
        y = side * (side_surface(x, CZ) + .0035)
        port_radius = .045 if REVISION >= 2 else .037
        if REVISION >= 3:
            porthole_frame('Submarine | porthole rim', x, y, CZ, .039, .052, brass)
        else:
            torus('Submarine | porthole rim', (x, y, CZ), port_radius, .005 if REVISION >= 2 else .004, brass, (math.pi / 2, 0, 0))
        sphere('Submarine | porthole glass', (x, side * (abs(y) + .001), CZ),
               (port_radius - .004, .008 if REVISION >= 5 else .004, port_radius - .004), window, 32, 16)
        if REVISION >= 2:
            for i in range(8):
                angle = math.tau * i / 8
                sphere('Submarine | porthole rivet',
                       (x + port_radius * math.cos(angle), side * (abs(y) + (.0075 if REVISION >= 4 else .004)), CZ + port_radius * math.sin(angle)),
                       (.0018, .0018, .0018), shadow_teal if REVISION >= 4 else ivory, 10, 6)
        if REVISION >= 3:
            sphere('Submarine | porthole soft glint',
                   (x - .010, side * (abs(y) + (.010 if REVISION >= 6 else .0052)), CZ + .011), (.007, .0008, .003), glint, 16, 8)

    if REVISION >= 2:
        for z, radius, mat, name in ((CZ, .0019, ivory, 'ivory belt'),
                                     (CZ + .065, .0016, coral, 'coral upper stripe')):
            spans = [(CX - .38, CX + .38)]
            if REVISION >= 3 and name == 'ivory belt':
                spans = [(CX - .38, -.32), (-.21, -.105), (.005, .110), (.22, CX + .38)]
            for start, end in spans:
                points = []
                for i in range(25):
                    x = start + (end - start) * i / 24
                    points.append((x, side * (side_surface(x, z) + .0015), z))
                pipe('Submarine | ' + name, points, radius, mat)

if REVISION >= 4:
    # Two subtle circumferential seams tell how the pressure hull is assembled.
    for x in (-.345, .285):
        scale = math.sqrt(max(0, 1 - ((x - CX) / LENGTH) ** 2))
        points = []
        for i in range(97):
            angle = math.tau * i / 96
            points.append((x, (RY * scale + .001) * math.cos(angle),
                           CZ + (RZ * scale + .001) * math.sin(angle)))
        pipe('Submarine | hull panel seam', points, .0011, shadow_teal)

def fin_mesh(name, outline, axis, thickness, mat):
    """Close a tapered fin, then soften its physically meaningful edges."""
    vertices = []
    for offset in (-thickness / 2, thickness / 2):
        for a, b in outline:
            vertices.append((a, offset, b) if axis == 'y' else (a, b, CZ + offset))
    count = len(outline)
    faces = [tuple(reversed(range(count))), tuple(range(count, count * 2))]
    faces += [(i, (i + 1) % count, (i + 1) % count + count, i + count) for i in range(count)]
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    data.materials.append(mat)
    bevel = obj.modifiers.new('Rounded fin edges', 'BEVEL')
    bevel.width, bevel.segments = min(.003, thickness * .3), 3
    obj.modifiers.new('Weighted normals', 'WEIGHTED_NORMAL')
    return obj


# Rounded metal tailplanes and a three-blade propeller.
for side in (-1, 1):
    if REVISION >= 2:
        fin_mesh('Submarine | side tail fin',
                 ((.23, side * .09), (.36, side * .17), (.41, side * .16), (.37, side * .06)),
                 'z', .012, teal)
    else:
        fin = sphere('Submarine | side tail fin', (.315, side * .114, .29),
                     (.105, .060, .009), teal, 24, 12)
        fin.rotation_euler[2] = side * -.24
if REVISION >= 2:
    shape = ((.20, .36), (.30, .405), (.34, .455), (.37, .462), (.39, .45), (.37, .34)) if REVISION >= 5 else ((.20, .36), (.34, .455), (.39, .45), (.37, .34))
    fin_mesh('Submarine | vertical tail fin', shape, 'y', .014, teal)
else:
    vertical = sphere('Submarine | vertical tail fin', (.315, 0, .39), (.10, .009, .075), teal, 24, 12)
    vertical.rotation_euler[1] = -.20
between('Submarine | propeller shaft', (.39, 0, CZ), (.455, 0, CZ), .009, brass)
sphere('Submarine | propeller hub', (.459, 0, CZ), (.017, .014, .014), brass, 20, 10)
for index in range(3):
    angle = math.tau * index / 3
    blade = sphere('Submarine | propeller blade', (.46, .032 * math.cos(angle), CZ + .032 * math.sin(angle)),
                   (.006, .030 if REVISION >= 2 else .023, .013), brass, 20, 10)
    blade.rotation_euler[0] = angle

if REVISION >= 3:
    # Two dark slits per side provide scale without putting windows on its top.
    for side in (-1, 1):
        for x in (-.13, -.035):
            y = side * .070
            box('Submarine | tower viewport frame', (x, y, .427), (.065, .006, .025), brass, .005)
            box('Submarine | tower viewport glass', (x, y + side * .004, .427), (.053, .003, .015), window, .004)

sys.path.insert(0, str(Path(__file__).resolve().parent))
import bottle_collection_water as water
water_level = .184 if REVISION >= 4 else .159
water.height = lambda x, y: (water_level + .0023 * math.sin(20 * x + 9 * y)
                             + .0018 * math.sin(31 * x - 22 * y)
                             + .0010 * math.sin(57 * y + 6 * x))
water.make_filled_water()
if REVISION >= 5:
    for obj in bpy.context.scene.objects:
        if obj.type != 'MESH' or teal.name not in obj.data.materials or obj.data.uv_layers:
            continue
        uv = obj.data.uv_layers.new(name='UVMap')
        for polygon in obj.data.polygons:
            for index in polygon.loop_indices:
                point = obj.data.vertices[obj.data.loops[index].vertex_index].co
                uv.data[index].uv = ((point.x + .6) / 1.2, (point.z + .1) / .7)
asset = list(bpy.context.scene.objects)


def export_product(objects):
    """Keep the editable parts; export an opaque assembly plus the glass."""
    bpy.context.view_layer.update()
    graph = bpy.context.evaluated_depsgraph_get()
    opaque, glass = [], None
    for obj in objects:
        if obj.type not in {'MESH', 'CURVE'}:
            continue
        evaluated = obj.evaluated_get(graph)
        data = bpy.data.meshes.new_from_object(evaluated, preserve_all_data_layers=True, depsgraph=graph)
        copy = bpy.data.objects.new('Export copy | ' + obj.name, data)
        bpy.context.scene.collection.objects.link(copy)
        copy.matrix_world = obj.matrix_world.copy()
        if obj.name.startswith('Bottle | thick transparent glass'):
            glass = copy
        else:
            opaque.append(copy)
    if not glass or not opaque:
        raise RuntimeError('Missing bottle glass or opaque parts')
    bpy.ops.object.select_all(action='DESELECT')
    for obj in opaque:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = opaque[0]
    bpy.ops.object.join()
    combined = bpy.context.view_layer.objects.active
    combined.name = 'Submarine | static opaque assembly'
    glass.name = 'Bottle | thick transparent glass export'
    bpy.ops.object.select_all(action='DESELECT')
    for obj in (combined, glass):
        obj.select_set(True)
    bpy.context.view_layer.objects.active = combined
    bpy.ops.export_scene.gltf(filepath=str(OUT / (STEM + '.glb')), export_format='GLB',
                              use_selection=True, export_apply=True)
    bpy.ops.export_scene.fbx(filepath=str(OUT / (STEM + '.fbx')), use_selection=True,
                             apply_unit_scale=True, add_leaf_bones=False,
                             path_mode='COPY' if REVISION >= 5 else 'AUTO', embed_textures=REVISION >= 5)
    for obj in (combined, glass):
        bpy.data.objects.remove(obj, do_unlink=True)


export_product(asset)
box('STUDIO | floor', (0, 0, -.015), (200, 200, .02), floor_mat, .001)
scene = bpy.context.scene
scene.world = bpy.data.worlds.new('STUDIO | world')
scene.world.color = (.22, .22, .22)


def area(name, loc, energy, size, target):
    data = bpy.data.lights.new(name, 'AREA')
    data.energy, data.shape, data.size = energy, 'DISK', size
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    obj.location = loc
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()


area('STUDIO | key', (-2.5, -3, 4), 310, 1.5, (0, 0, .3))
area('STUDIO | rim', (1.3, 1.8, 3.1), 240, 2, (0, 0, .3))
area('STUDIO | fill', (3, -2, 2), 100, 2, (0, 0, .3))
bpy.ops.object.camera_add(location=(1.0, -4.5, 2.35))
camera = bpy.context.object
camera.name = 'STUDIO | hero camera'
camera.rotation_euler = (Vector((.03, 0, .31)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
camera.data.type = 'ORTHO'
camera.data.ortho_scale = 2.25
scene.camera = camera
scene.render.engine = 'CYCLES'
scene.cycles.samples = 56
scene.cycles.use_denoising = True
scene.render.resolution_x, scene.render.resolution_y = 1200, 860
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.view_settings.view_transform = 'AgX'
scene.view_settings.look = 'AgX - Medium High Contrast'
scene.render.filepath = str(OUT / (STEM + '-blender.png'))
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / (STEM + '.blend')), compress=True)
bpy.ops.render.render(write_still=True)
glass = next(obj for obj in asset if obj.name.startswith('Bottle | thick transparent glass'))
glass.hide_render = True
camera.data.ortho_scale = 1.25
camera.rotation_euler = (Vector((-.01, 0, .30)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
scene.render.filepath = str(OUT / (STEM + '-cutaway.png'))
bpy.ops.render.render(write_still=True)
print('SUBMARINE_STUDY_OK', REVISION, len(asset), str(OUT), flush=True)
