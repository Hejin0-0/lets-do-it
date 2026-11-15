"""Create an isolated, editable longship-in-a-bottle collectible study.

Blender 5.3: blender -b --python create_longship_bottle_study.py -- 5
"""
import math
import sys
from array import array
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets/02_models/props/sailboat-bottle-study/sailboat-bottle-v9.blend'
OUT = ROOT / 'assets/02_models/props/longship-bottle-study'
REVISION = int(sys.argv[sys.argv.index('--') + 1]) if '--' in sys.argv else 5
STEM = f'longship-bottle-v{REVISION}'
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



wood_color = (.30, .14, .055) if REVISION >= 5 else (.55, .31, .14)
wood = material('Longship | honey oak', wood_color, .46)
wood_light = material('Longship | fresh cut oak', (.46, .24, .09) if REVISION >= 5 else (.73, .48, .25), .46)
dark = material('Longship | oak seams', (.25, .115, .043), .5)
ivory = material('Longship | ivory canvas', (.88, .79, .61), .55)
coral = material('Longship | faded coral canvas', (.70, .22, .14), .51)
teal = material('Longship | lagoon teal shields', (.055, .32, .285), .4)
brass = material('Longship | satin brass', (.64, .39, .10), .28, .58)
floor_mat = material('STUDIO | warm sand', (.58, .45, .33), .82)
glass_mat = next(m for m in bpy.data.materials if m.name.startswith('Glass | clear seafoam'))
glass_shader = next(n for n in glass_mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
glass_shader.inputs['Base Color'].default_value = (.95, 1, .98, 1)
glass_shader.inputs['IOR'].default_value = 1.20
glass_shader.inputs['Roughness'].default_value = .035

if REVISION >= 3:
    def encode(linear):
        return 12.92 * linear if linear <= .0031308 else 1.055 * linear ** (1 / 2.4) - .055

    pixels = array('f')
    for y in range(256):
        for x in range(256):
            u, v = x / 256, y / 256
            grain = 1 + .055 * math.sin(math.tau * (v * 17 + .12 * math.sin(math.tau * u * 2)))
            pixels.extend((*(encode(c * grain) for c in wood_color), 1))
    image = bpy.data.images.new('longship-wood', width=256, height=256, alpha=True)
    image.pixels.foreach_set(pixels)
    image.filepath_raw = str(OUT / 'longship-wood.png')
    image.file_format = 'PNG'
    image.save()
    image.pack()
    texture = wood.node_tree.nodes.new('ShaderNodeTexImage')
    texture.image = image
    shader = next(n for n in wood.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    wood.node_tree.links.new(texture.outputs['Color'], shader.inputs['Base Color'])

if REVISION >= 5:
    # Blender-only microtexture; the base colors remain explicit for export.
    for canvas in (ivory, coral):
        nodes, links = canvas.node_tree.nodes, canvas.node_tree.links
        noise = nodes.new('ShaderNodeTexNoise')
        noise.inputs['Scale'].default_value = 280
        bump = nodes.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value = .12
        bump.inputs['Distance'].default_value = .0008
        links.new(noise.outputs['Fac'], bump.inputs['Height'])
        links.new(bump.outputs['Normal'], next(n for n in nodes if n.type == 'BSDF_PRINCIPLED').inputs['Normal'])

def mesh(name, vertices, faces, mats, smooth=False):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    for mat in mats:
        data.materials.append(mat)
    for face in data.polygons:
        face.use_smooth = smooth
    return obj


def box(name, loc, size, mat, bevel=.002):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    if bevel:
        mod = obj.modifiers.new('Gently rounded edges', 'BEVEL')
        # A bevel wider than half a thin paddle or band collapses its faces.
        mod.width = min(bevel, .45 * min(size)) if REVISION >= 8 else bevel
        mod.segments = 2
        obj.modifiers.new('Weighted normals', 'WEIGHTED_NORMAL')
    return obj


def cylinder(name, loc, radius, depth, mat, vertices=16):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    mod = obj.modifiers.new('Soft lip', 'BEVEL')
    mod.width = min(.0015, radius / 4)
    mod.segments = 2
    obj.modifiers.new('Weighted normals', 'WEIGHTED_NORMAL')
    return obj


def between(name, start, end, radius, mat, vertices=12):
    start, end = Vector(start), Vector(end)
    obj = cylinder(name, (start + end) / 2, radius, (end - start).length, mat, vertices)
    obj.rotation_euler = (end - start).to_track_quat('Z', 'Y').to_euler()
    return obj


def pipe(name, points, radius, mat, resolution=2):
    data = bpy.data.curves.new(name, 'CURVE')
    data.dimensions = '3D'
    data.resolution_u = 1
    data.bevel_depth = radius
    data.bevel_resolution = resolution
    spline = data.splines.new('POLY')
    spline.points.add(len(points) - 1)
    for point, xyz in zip(spline.points, points):
        point.co = (*xyz, 1)
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    data.materials.append(mat)
    return obj



def hull_profile(t):
    x = -.55 + t
    width = (max(.009, .145 * math.sin(math.pi * t) ** .70) if REVISION >= 3
             else max(.009, .145 * math.sin(math.pi * (.09 + .905 * t)) ** .70))
    rim = (.247 + .090 * abs(2 * t - 1) ** 5 if REVISION >= 2
           else .257 + .024 * (1 - t) ** 4 + .040 * t ** 2.5)
    bottom = .148 + .048 * abs(2 * t - 1) ** 2.4
    return x, width, rim, bottom

# A real closed shell: the inside and outside meet along both gunwales and ends.
long_steps, cross_steps = 32, 12
vertices = []
for inside in (False, True):
    for i in range(long_steps + 1):
        x, width, rim, bottom = hull_profile(i / long_steps)
        for j in range(cross_steps + 1):
            angle = math.pi * j / cross_steps
            y = (width - (.006 if inside else 0)) * math.cos(angle)
            z = bottom + (rim - bottom) * (1 - math.sin(angle) ** .70)
            if inside:
                z += .006 * math.sin(angle) ** .5
            vertices.append((x, y, z))
row = cross_steps + 1
layer = (long_steps + 1) * row
index = lambda i, j: i * row + j
faces = []
for i in range(long_steps):
    for j in range(cross_steps):
        a, b, c, d = index(i, j), index(i + 1, j), index(i + 1, j + 1), index(i, j + 1)
        faces.extend(((a, b, c, d), (layer + d, layer + c, layer + b, layer + a)))
for i in range(long_steps):
    for j in (0, cross_steps):
        a, b = index(i, j), index(i + 1, j)
        faces.append((a, layer + a, layer + b, b) if j == 0 else (b, layer + b, layer + a, a))
for i in (0, long_steps):
    for j in range(cross_steps):
        a, b = index(i, j), index(i, j + 1)
        faces.append((b, layer + b, layer + a, a) if i == 0 else (a, layer + a, layer + b, b))
hull = mesh('Longship | hull', vertices, faces, [wood, wood_light, wood, wood_light], smooth=True)
for polygon in hull.data.polygons:
    if polygon.index < long_steps * cross_steps * 2 and polygon.index % 2:
        polygon.material_index = 1
    elif polygon.index < long_steps * cross_steps * 2:
        across = (polygon.index // 2) % cross_steps
        plank = min(across, cross_steps - 1 - across)
        polygon.material_index = 2 if plank in (0, 3) else (3 if plank in (2, 5) else 0)


# Plank seams, sheer rails, and high curling ends make the hull read as a longship.
for side in (-1, 1):
    rail = []
    for i in range(33):
        x, width, top, bottom = hull_profile(i / 32)
        rail.append((x, side * width, top + .002))
    pipe('Longship | oak gunwale', rail, .0045, wood_light)
    if REVISION >= 2:
        for angle in (.34, .64):
            seam = []
            for i in range(33):
                x, width, top, bottom = hull_profile(i / 32)
                seam.append((x, side * (width * math.cos(angle) + .0008),
                             bottom + (top - bottom) * (1 - math.sin(angle) ** .70)))
            pipe('Longship | plank seam', seam, .0011, dark, 1)
for sign in (-1, 1):
    profile = (((.50,.335),(.54,.350),(.56,.378),(.56,.407),(.54,.423),(.52,.425),(.50,.415))
               if REVISION >= 2 else
               ((.45,.279),(.49,.300),(.515,.334),(.52,.373),(.51,.394),(.49,.402),(.47,.392)))
    end = [(sign * x - .05, 0, z) for x, z in profile]
    if REVISION >= 3:
        # A sampled Catmull-Rom curve removes the conspicuous polygonal corners.
        smooth = []
        for i in range(len(end) - 1):
            p0, p1 = Vector(end[max(0, i - 1)]), Vector(end[i])
            p2, p3 = Vector(end[i + 1]), Vector(end[min(len(end) - 1, i + 2)])
            for step in range(8):
                t = step / 8
                point = .5 * ((2 * p1) + (-p0 + p2) * t +
                              (2*p0 - 5*p1 + 4*p2 - p3) * t*t +
                              (-p0 + 3*p1 - 3*p2 + p3) * t*t*t)
                smooth.append(tuple(point))
        end = smooth + [end[-1]]
    pipe('Longship | carved curled end', end, .009, wood)
    if REVISION == 3:
        # A small contrasting eye inset emphasizes the carved stem, without a character.
        bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=6, radius=1,
                                             location=(sign * .462 - .05, -.007, .393))
        obj = bpy.context.object
        obj.name = 'Longship | carved stem pin'
        obj.scale = (.003,.002,.003)
        obj.data.materials.append(brass)

# Floorboards, thwarts and ribs stay visible around the foot of the mast.
for x in (-.30, -.16, -.02, .12, .26):
    _, width, top, _ = hull_profile(x + .55)
    box('Longship | oak thwart', (x, 0, top - .026), (.050, 2 * (width - .012), .008), wood_light)
for y in (-.045, -.022, 0, .022, .045):
    box('Longship | floor plank', (-.05, y, .174), (.55, .020, .006), wood, .001)
if REVISION >= 2:
    for x in (-.40, -.30, -.20, -.10, 0, .10, .20, .30):
        _, width, top, bottom = hull_profile(x + .55)
        rib = []
        for j in range(13):
            angle = math.pi * j / 12
            rib.append((x, (width - .008) * math.cos(angle),
                        bottom + (top - bottom) * (1 - math.sin(angle) ** .70) + .007))
        pipe('Longship | curved rib', rib, .002, wood_light, 1)

# Round shields sit outside both sides of the hull; brass bosses provide focus.
for side in (-1, 1):
    for index, x in enumerate((-.37, -.24, -.11, .02, .15, .28)):
        _, width, top, _ = hull_profile(x + .55)
        y = side * (width + .006)
        z = top - .015
        disc = cylinder('Longship | shield', (x, y, z), .038, .009,
                        teal if index % 2 == 0 else coral, 24)
        disc.rotation_euler[0] = math.pi / 2
        boss = cylinder('Longship | shield brass boss', (x, y + side * .006, z), .009, .005, brass, 16)
        boss.rotation_euler[0] = math.pi / 2
        if REVISION >= 2:
            # Metal rim is a separate curved ring rather than a flat painted outline.
            points = [(x + .035 * math.cos(math.tau * i / 32), y + side * .005,
                       z + .035 * math.sin(math.tau * i / 32)) for i in range(33)]
            pipe('Longship | shield rim', points, .0018, wood_light, 1)

# Mast, spars, rigging and a continuous double-sided striped textile sail.
between('Longship | mast', (-.04, 0, .205), (-.04, 0, .570), .0065, wood_light)
between('Longship | yard', (-.30, 0, .551), (.22, 0, .551), .0055, wood_light)
if REVISION >= 2:
    between('Longship | boom', (-.28, 0, .315), (.20, 0, .315), .004, wood_light)
nx, nz = 12, 10
sail_verts, sail_faces = [], []
for j in range(nz + 1):
    v = j / nz
    width = .48 + .025 * math.sin(math.pi * v)
    for i in range(nx + 1):
        u = i / nx
        x = -.04 + (u - .5) * width
        y = -.006 - (.026 if REVISION >= 2 else .015) * math.sin(math.pi * u) * math.sin(math.pi * v)
        z = (.545 - .222 * v + .004 * math.sin(math.pi * u) * math.sin(math.pi * v)
             + (.022 * math.sin(math.pi * u) * v ** 4 if REVISION >= 4 else 0))
        sail_verts.append((x, y, z))
for j in range(nz):
    for i in range(nx):
        a = j * (nx + 1) + i
        sail_faces.append((a, a + 1, a + nx + 2, a + nx + 1))
sail = mesh('Longship | striped canvas sail', sail_verts, sail_faces, [ivory, coral], smooth=True)
for polygon in sail.data.polygons:
    polygon.material_index = (polygon.index % nx // 2) % 2
solidify = sail.modifiers.new('Real textile thickness', 'SOLIDIFY')
solidify.thickness = .0015
if REVISION >= 2:
    for u in range(0, nx + 1, 2):
        points = [sail_verts[j * (nx + 1) + u] for j in range(nz + 1)]
        pipe('Longship | stitched sail seam', [(x, y - .001, z) for x, y, z in points], .00055, ivory, 1)
    for x in (-.27, .19):
        between('Longship | rigging', (-.04, 0, .562), (x, 0, .27), .001, dark)
if REVISION >= 4:
    # Canvas hems and small lashings make the sheet visibly attached to the yard.
    for label, indexes in (('top', range(nx + 1)),
                           ('bottom', range(nz * (nx + 1), (nz + 1) * (nx + 1)))):
        pipe('Longship | canvas ' + label + ' hem',
             [(sail_verts[i][0], sail_verts[i][1] - .001, sail_verts[i][2]) for i in indexes],
             .0013, ivory, 1)
    for i in range(0, nx + 1, 2):
        x = sail_verts[i][0]
        loops = [(x, .007 * math.cos(math.tau * j / 16),
                  .551 + .007 * math.sin(math.tau * j / 16)) for j in range(17)]
        pipe('Longship | sail lashing', loops, .001, ivory, 1)
if REVISION >= 3:
    for side in (-1, 1):
        for x in (-.28, -.08, .12):
            between('Longship | oar shaft', (x - .06, side * .065, .270),
                    (x + .075, side * .168, .205), .0026, wood_light)
            blade = box('Longship | oar blade', (x + .055, side * .157, .212),
                        (.085, .018, .005), wood_light, .002)
            blade.rotation_euler[2] = side * .55

sys.path.insert(0, str(Path(__file__).resolve().parent))
import bottle_collection_water as water
water.height = lambda x, y: (.159 + .0034 * math.sin(20 * x + 9 * y)
                             + .0026 * math.sin(31 * x - 22 * y)
                             + .0015 * math.sin(57 * y + 6 * x))
water.make_filled_water()
if REVISION >= 3:
    for obj in bpy.context.scene.objects:
        if obj.type != 'MESH' or wood.name not in obj.data.materials or obj.data.uv_layers:
            continue
        uv = obj.data.uv_layers.new(name='UVMap')
        for polygon in obj.data.polygons:
            for index in polygon.loop_indices:
                co = obj.data.vertices[obj.data.loops[index].vertex_index].co
                uv.data[index].uv = ((co.x + .6) / 1.2, (co.z + .1) / .7)
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
    combined.name = 'Longship | static opaque assembly'
    glass.name = 'Bottle | thick transparent glass export'
    bpy.ops.object.select_all(action='DESELECT')
    for obj in (combined, glass):
        obj.select_set(True)
    bpy.context.view_layer.objects.active = combined
    bpy.ops.export_scene.gltf(filepath=str(OUT / (STEM + '.glb')), export_format='GLB',
                              use_selection=True, export_apply=True)
    bpy.ops.export_scene.fbx(filepath=str(OUT / (STEM + '.fbx')), use_selection=True,
                             apply_unit_scale=True, add_leaf_bones=False,
                             path_mode='COPY' if REVISION >= 3 else 'AUTO', embed_textures=REVISION >= 3)
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
print('LONGSHIP_STUDY_OK', REVISION, len(asset), str(OUT), flush=True)
