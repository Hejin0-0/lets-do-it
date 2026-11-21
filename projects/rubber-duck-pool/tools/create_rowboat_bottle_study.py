"""Build an isolated, editable rowboat-in-a-bottle look-development study.

Blender 5.3: blender -b --python create_rowboat_bottle_study.py -- 9
The revision argument retains earlier visual comparisons rather than replacing them.
"""
import math
import sys
from array import array
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets/02_models/props/sailboat-bottle-study/sailboat-bottle-v9.blend'
OUT = ROOT / 'assets/02_models/props/rowboat-bottle-study'
REVISION = int(sys.argv[sys.argv.index('--') + 1]) if '--' in sys.argv else 9
OUT.mkdir(parents=True, exist_ok=True)
STEM = f'rowboat-bottle-v{REVISION}'

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


teal = material('Rowboat | lagoon teal painted hull', (.055, .32, .285), .35)
teal_light = material('Rowboat | lagoon teal upper planks', (.071, .355, .30), .38)
teal_dark = material('Rowboat | lagoon teal lower planks', (.043, .275, .245), .38)
wood = material('Rowboat | honey oak', (.55, .31, .14), .48)
light_wood = material('Rowboat | fresh cut oak', (.73, .48, .25), .45)
seat_wood = material('Rowboat | textured oak thwarts', (.73, .48, .25), .45) if REVISION >= 9 else light_wood
dark_wood = material('Rowboat | oak seams', (.27, .12, .043), .5)
ivory = material('Rowboat | warm ivory trim', (.88, .79, .61), .4)
coral = material('Rowboat | faded coral stripe', (.70, .22, .14), .38)
brass = material('Rowboat | brushed brass', (.64, .39, .10), .27, .62)
lantern_glow = material('Rowboat | lantern amber glass', (1.0, .46, .085), .27, 0, 1.1 if REVISION >= 4 else .38)
floor_mat = material('STUDIO | warm sand', (.58, .45, .33) if REVISION >= 4 else (.48, .37, .27), .82)

if REVISION >= 4:
    glass_mat = next(m for m in bpy.data.materials if m.name.startswith('Glass | clear seafoam'))
    glass_shader = next(n for n in glass_mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    glass_shader.inputs['Base Color'].default_value = (.95, 1.0, .98, 1)
    glass_shader.inputs['IOR'].default_value = 1.20
    glass_shader.inputs['Roughness'].default_value = .035

if REVISION >= 3:
    for mat, scale, strength in ((wood, 120, .12), (light_wood, 135, .10), (teal, 190, .045)):
        nodes, links = mat.node_tree.nodes, mat.node_tree.links
        noise = nodes.new('ShaderNodeTexNoise')
        noise.inputs['Scale'].default_value = scale
        bump = nodes.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value = strength
        bump.inputs['Distance'].default_value = .0015
        links.new(noise.outputs['Fac'], bump.inputs['Height'])
        links.new(bump.outputs['Normal'], next(n for n in nodes if n.type == 'BSDF_PRINCIPLED').inputs['Normal'])


def add_wood_texture(mat, filename, color):
    """Pack a subtle, tileable grain that survives GLB and FBX export."""
    size = 256
    pixels = array('f')
    for y in range(size):
        v = y / size
        for x in range(size):
            u = x / size
            wave = math.sin(math.tau * (v * 19 + .16 * math.sin(math.tau * u * 2)))
            fine = math.sin(math.tau * (v * 47 + .08 * math.sin(math.tau * u * 3)))
            value = .91 + .065 * wave + .025 * fine
            pixels.extend((color[0] * value, color[1] * value, color[2] * value, 1))
    image = bpy.data.images.new(filename, width=size, height=size, alpha=True)
    image.pixels.foreach_set(pixels)
    image.filepath_raw = str(OUT / (filename + '.png'))
    image.file_format = 'PNG'
    image.save()
    image.pack()
    texture = mat.node_tree.nodes.new('ShaderNodeTexImage')
    texture.image = image
    shader = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    mat.node_tree.links.new(texture.outputs['Color'], shader.inputs['Base Color'])


if REVISION >= 9:
    add_wood_texture(wood, 'rowboat-wood-honey', (.55, .31, .14))
    add_wood_texture(seat_wood, 'rowboat-wood-thwart', (.73, .48, .25))


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
    if REVISION >= 3:
        x = -.55 + t
        width = max(.009, .145 * math.sin(math.pi * (.09 + .905 * t)) ** .70)
        rim = .257 + .024 * (1 - t) ** 4 + .040 * t ** 2.5
        bottom = .148 + .048 * abs(2 * t - 1) ** 2.4
    else:
        x = (-.42 + .80 * t) if REVISION >= 2 else (-.46 + .88 * t)
        width = (max(.012, .135 * math.sin(math.pi * (.08 + .915 * t)) ** .65)
                 if REVISION >= 2 else .115 * math.sin(math.pi * (.08 + .89 * t)) ** .65)
        rim = .251 + .018 * (1 - t) ** 4 + .022 * t ** 3
        bottom = .160 + .020 * abs(2 * t - 1) ** 2.4
    return x, width, rim, bottom


def hull_parameter(x):
    return x + .55 if REVISION >= 3 else ((x + .42) / .80 if REVISION >= 2 else (x + .46) / .88)


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
hull = mesh('Rowboat | hull', vertices, faces, [teal, wood, teal_light, teal_dark], smooth=True)
if REVISION >= 9:
    uv = hull.data.uv_layers.new(name='UVMap')
    for polygon in hull.data.polygons:
        for loop_index in polygon.loop_indices:
            co = hull.data.vertices[hull.data.loops[loop_index].vertex_index].co
            uv.data[loop_index].uv = (co.x + .55, .5 + co.y * 5 + co.z * 3)
for polygon in hull.data.polygons:
    if polygon.index < long_steps * cross_steps * 2 and polygon.index % 2:
        polygon.material_index = 1
    elif REVISION >= 5 and polygon.index < long_steps * cross_steps * 2:
        across = (polygon.index // 2) % cross_steps
        plank = min(across, cross_steps - 1 - across)
        polygon.material_index = 2 if plank in (0, 3) else (3 if plank in (2, 5) else 0)

# Matching sheer rails and subtle plank seams follow the compound hull curvature.
for side in (-1, 1):
    gunwale = []
    stripe = []
    for i in range(33):
        x, w, top, bottom = hull_profile(i / 32)
        gunwale.append((x, side * w, top + .001))
        stripe.append((x, side * w * .975, top - .007))
    pipe('Rowboat | ivory gunwale', gunwale, .0045, ivory)
    pipe('Rowboat | coral sheer stripe', stripe, .0013, coral)
    if REVISION >= 2:
        for angle in (.36, .64):
            contour = []
            for i in range(33):
                x, w, top, bottom = hull_profile(i / 32)
                contour.append((x, side * (w * math.cos(angle) + .0005), bottom + (top - bottom) * (1 - math.sin(angle) ** .70)))
            pipe('Rowboat | hull plank seam', contour, .00065, dark_wood, 1)

# Three thwarts and floorboards give the open boat an interior, not a solid deck.
for x in ((-.28, -.04, .20) if REVISION >= 3 else (-.22, -.015, .18)):
    t = hull_parameter(x)
    _, w, rim, _ = hull_profile(t)
    box('Rowboat | oak thwart', (x, 0, rim - .024), (.066, 2 * (w - .012), .009), seat_wood, .002)
    if REVISION >= 3:
        for dx in (-.018, 0, .018):
            box('Rowboat | thwart grain', (x + dx, 0, rim - .0188), (.00055, 2 * (w - .018), .0004), wood, .0001)
for y in (-.048, -.024, 0, .024, .048):
    length = .54 if REVISION >= 3 else (.45 if REVISION >= 2 else .57)
    box('Rowboat | floor plank', (-.04, y, .174 if REVISION >= 3 else .179), (length, .022, .006), wood, .001)
if REVISION >= 2:
    for x in ((-.42, -.33, -.22, -.11, .02, .14, .25, .33) if REVISION >= 3
              else (-.31, -.25, -.16, -.07, .08, .22, .29)):
        t = hull_parameter(x)
        _, w, top, bottom = hull_profile(t)
        arch = []
        for j in range(13):
            a = math.pi * j / 12
            arch.append((x, (w - .008) * math.cos(a), bottom + (top - bottom) * (1 - math.sin(a) ** .70) + .007))
        pipe('Rowboat | curved oak rib', arch, .002, light_wood, 1)

    # A fitted triangular foredeck supports the lantern and closes the sharp bow.
    x0, width0, z0, _ = hull_profile(.84)
    x1, width1, z1, _ = hull_profile(.985)
    deck_top = [(x0, -width0 + .004, z0 - .003), (x0, width0 - .004, z0 - .003),
                (x1, width1 - .004, z1 - .003), (x1, -width1 + .004, z1 - .003)]
    deck_bottom = [(x, y, z - .006) for x, y, z in deck_top]
    mesh('Rowboat | fitted foredeck', deck_top + deck_bottom,
         [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5),
          (2, 3, 7, 6), (3, 0, 4, 7)], [light_wood])

# Two oars are stowed lengthwise, with ivory paddle blades and teal markings.
for side, label in ((-1, 'port'), (1, 'starboard')):
    y = side * (.075 if REVISION >= 3 else .060)
    x0, x1 = ((-.36, .28) if REVISION >= 3 else (-.285, .235))
    between('Rowboat | oar ' + label, (x0, y, .246), (x1, y, .246), .004 if REVISION >= 3 else .0032, light_wood)
    blade = box('Rowboat | paddle ' + label, (x0 - .025, y, .246), (.14 if REVISION >= 3 else .125, .031 if REVISION >= 3 else .024, .006), ivory, .006)
    box('Rowboat | teal paddle band', (x0 - .002, y, .250), (.025, .0315 if REVISION >= 3 else .0245, .0015), teal, .001)
    if REVISION >= 2:
        between('Rowboat | brass oar collar', (.08, y, .246), (.105, y, .246), .004, brass)

# A little lantern is attached to a curved bow post, with actual frame and glass.
post_x = .325 if REVISION >= 3 else (.305 if REVISION >= 2 else .326)
lx = post_x + .030 if REVISION >= 2 else .355
foot_z = hull_profile(hull_parameter(post_x))[2] - .002 if REVISION >= 3 else (.270 if REVISION >= 2 else .274)
top_z = foot_z + (.103 if REVISION >= 3 else .080)
cylinder('Rowboat | lantern foot', (post_x, 0, foot_z), .012, .005, brass)
pipe('Rowboat | lantern post', [(post_x, 0, foot_z + .002), (post_x, 0, top_z),
     (post_x + .004, 0, top_z + .010), (post_x + .015, 0, top_z + .015),
     (lx - .003, 0, top_z + .012), (lx, 0, top_z + .004)], .0024, brass)
body_z = top_z - (.022 if REVISION >= 3 else .017)
body_radius = .015 if REVISION >= 3 else .012
body_depth = .036 if REVISION >= 3 else .028
cylinder('Rowboat | lantern body', (lx, 0, body_z), body_radius, body_depth, lantern_glow, 12)
cylinder('Rowboat | lantern base', (lx, 0, body_z - body_depth / 2 - .002), body_radius + .003, .004, brass, 16)
cylinder('Rowboat | lantern crown', (lx, 0, body_z + body_depth / 2 + .002), body_radius + .003, .004, brass, 16)
for angle in range(0, 360, 90):
    a = math.radians(angle + 45)
    x, y = lx + (body_radius - .001) * math.cos(a), (body_radius - .001) * math.sin(a)
    between('Rowboat | lantern frame', (x, y, body_z - body_depth / 2), (x, y, body_z + body_depth / 2), .0012, brass, 8)
if REVISION >= 3:
    # Small bright brass fasteners sit on the outside face of the hull.
    for side in (-1, 1):
        for i in range(1, 13):
            x, w, top, bottom = hull_profile(i / 13)
            if REVISION >= 4:
                bpy.ops.mesh.primitive_uv_sphere_add(segments=8, ring_count=4, radius=1,
                    location=(x, side * (w + .0005), top - .005))
                obj = bpy.context.object
                obj.name = 'Rowboat | brass hull fastener'
                obj.scale = (.0017, .0008, .0017)
                obj.data.materials.append(brass)
            else:
                obj = cylinder('Rowboat | brass hull fastener', (x, side * (w + .001), top - .005), .0016, .0018, brass, 8)
                obj.rotation_euler[0] = math.pi / 2

if REVISION >= 2:
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import bottle_collection_water as water
    if REVISION >= 5:
        # Stay above the helper's minimum waterline so waves remain inside the glass.
        water.height = lambda x, y: (.159 + .0034 * math.sin(20 * x + 9 * y)
                                     + .0026 * math.sin(31 * x - 22 * y)
                                     + .0015 * math.sin(57 * y + 6 * x))
    water.make_filled_water()
    if REVISION == 4:
        from bottle_collection_water import height as water_height, water_width
        for side in (-1, 1):
            for start, end in ((-.50, -.37), (-.29, -.16), (-.06, .08), (.18, .29), (.34, .43)):
                points = []
                for i in range(17):
                    x = start + (end - start) * i / 16
                    _, w, _, _ = hull_profile(hull_parameter(x))
                    y = side * min(w + .009 + .002 * math.sin(math.pi * i / 16), water_width(x) - .005)
                    points.append((x, y, water_height(x, y) + .0015))
                pipe('Ocean | little wake', points, .0008, ivory, 1)

# Export only the product; the studio is deliberately added afterwards.
asset = list(bpy.context.scene.objects)


def export_product(objects):
    temporary = []
    if REVISION >= 7:
        # Keep the editable source intact. Bake evaluated copies and combine static
        # opaque pieces; retain the transparent bottle as its own renderer.
        bpy.context.view_layer.update()
        depsgraph = bpy.context.evaluated_depsgraph_get()
        opaque = []
        glass_copy = None
        for obj in objects:
            if obj.type not in {'MESH', 'CURVE'}:
                continue
            evaluated = obj.evaluated_get(depsgraph)
            data = bpy.data.meshes.new_from_object(evaluated, preserve_all_data_layers=True, depsgraph=depsgraph)
            duplicate = bpy.data.objects.new('Export copy | ' + obj.name, data)
            bpy.context.scene.collection.objects.link(duplicate)
            duplicate.matrix_world = obj.matrix_world.copy()
            if obj.name.startswith('Bottle | thick transparent glass'):
                glass_copy = duplicate
            else:
                opaque.append(duplicate)
        if not glass_copy or not opaque:
            raise RuntimeError('Missing glass or static parts during export')
        bpy.ops.object.select_all(action='DESELECT')
        for obj in opaque:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = opaque[0]
        bpy.ops.object.join()
        combined = bpy.context.view_layer.objects.active
        combined.name = 'Rowboat | static opaque assembly'
        glass_copy.name = 'Bottle | thick transparent glass export'
        temporary = [combined, glass_copy]
        objects = temporary
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.export_scene.gltf(filepath=str(OUT / (STEM + '.glb')), export_format='GLB',
                              use_selection=True, export_apply=REVISION >= 6)
    bpy.ops.export_scene.fbx(filepath=str(OUT / (STEM + '.fbx')), use_selection=True,
                             apply_unit_scale=True, add_leaf_bones=False,
                             path_mode='COPY' if REVISION >= 9 else 'AUTO', embed_textures=REVISION >= 9)
    for obj in temporary:
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
bpy.ops.object.camera_add(location=(1.15, -4.5, 3.5 if REVISION >= 4 else 2.65))
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
if REVISION >= 5:
    scene.view_settings.look = 'AgX - Medium High Contrast'
scene.render.filepath = str(OUT / (STEM + '-blender.png'))
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / (STEM + '.blend')), compress=True)
bpy.ops.render.render(write_still=True)
glass = next(obj for obj in asset if obj.name.startswith('Bottle | thick transparent glass'))
glass.hide_render = True
camera.data.ortho_scale = 1.25
camera.rotation_euler = (Vector((-.01, 0, .26)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
scene.render.filepath = str(OUT / (STEM + '-cutaway.png'))
bpy.ops.render.render(write_still=True)
print('ROWBOAT_STUDY_OK', REVISION, len(asset), str(OUT), flush=True)
