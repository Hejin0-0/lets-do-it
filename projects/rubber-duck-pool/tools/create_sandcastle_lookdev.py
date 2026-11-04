"""Make a standalone, editable sandcastle look-development scene in Blender.

Run with Blender 5.2: blender -b --factory-startup --python-exit-code 1 \
    -P tools/create_sandcastle_lookdev.py
The resulting studio scene is a design study, not the optimized in-game asset.
"""
from pathlib import Path
import math
import random

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
MODELS = ROOT / 'models'
EVIDENCE = ROOT / 'docs' / 'evidence'


def material(name, color, roughness=.8, sand=False):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = roughness
    if sand:
        noise = nodes.new('ShaderNodeTexNoise')
        noise.inputs['Scale'].default_value = 165
        noise.inputs['Detail'].default_value = 2
        noise.inputs['Roughness'].default_value = .7
        ramp = nodes.new('ShaderNodeValToRGB')
        ramp.color_ramp.elements[0].position = .22
        ramp.color_ramp.elements[0].color = (.38, .23, .105, 1)
        ramp.color_ramp.elements[1].position = .8
        ramp.color_ramp.elements[1].color = (.72, .52, .29, 1)
        bump = nodes.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value = .27
        bump.inputs['Distance'].default_value = .0013
        links = mat.node_tree.links
        links.new(noise.outputs['Fac'], ramp.inputs['Fac'])
        links.new(ramp.outputs['Color'], bsdf.inputs['Base Color'])
        links.new(noise.outputs['Fac'], bump.inputs['Height'])
        links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    return mat


def smooth(obj):
    if obj.type == 'MESH':
        for poly in obj.data.polygons:
            poly.use_smooth = True
    return obj


def bevel(obj, amount, segments=3):
    mod = obj.modifiers.new('Soft, compacted sand edges', 'BEVEL')
    mod.width = amount
    mod.segments = segments
    mod.affect = 'EDGES'
    mod = obj.modifiers.new('Weighted corner normals', 'WEIGHTED_NORMAL')
    mod.keep_sharp = True
    return obj


def mesh(name, verts, faces, mat):
    data = bpy.data.meshes.new(name)
    data.from_pydata(verts, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    return obj


def box(name, location, size, mat, radius=.004):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    return bevel(obj, radius)


def tower(name, xy, radius, base, height, mat):
    # A bucket-moulded tower: wider at the foot, with shallow softened bands.
    sides = 64
    rings = ((0, 1.035), (.025, 1.035), (.045, 1), (.88, .958), (.925, .99), (1, .99))
    verts = []
    for t, r in rings:
        for i in range(sides):
            angle = 2 * math.pi * i / sides
            # Pressed sand keeps the bucket silhouette but has small imperfect edges.
            irregular = 1 + .011 * math.sin(3*angle + xy[0]*12) + .006 * math.sin(7*angle + xy[1]*20)
            z = base + height*t + .0012*math.sin(5*angle + xy[0]*17)*t
            verts.append((xy[0] + radius*r*irregular*math.cos(angle),
                          xy[1] + radius*r*irregular*math.sin(angle), z))
    faces = []
    for row in range(len(rings) - 1):
        for i in range(sides):
            j = (i + 1) % sides
            faces.append((row*sides+i, row*sides+j, (row+1)*sides+j, (row+1)*sides+i))
    faces.append(tuple(reversed(range(sides))))
    faces.append(tuple((len(rings)-1)*sides + i for i in range(sides)))
    obj = mesh(name, verts, faces, mat)
    smooth(obj)
    bevel(obj, .0022, 3)
    return obj


def battlements(prefix, xy, radius, z, count, mat):
    rng = random.Random(prefix)
    for i in range(count):
        angle = 2 * math.pi * i / count + rng.uniform(-.025, .025)
        r = radius * rng.uniform(.755, .79)
        width = 2 * math.pi * r / count * rng.uniform(.54, .59)
        h = rng.uniform(.019, .023)
        block = box(f'{prefix} | merlon {i+1:02}',
                    (xy[0] + r * math.cos(angle), xy[1] + r * math.sin(angle), z + h/2 - .002),
                    (width, radius * rng.uniform(.22, .25), h), mat, .0024)
        block.rotation_euler.z = angle + math.pi / 2 + rng.uniform(-.04, .04)


def apply_boolean(target, cutter):
    bpy.context.view_layer.objects.active = target
    mod = target.modifiers.new('Pressed arch cut', 'BOOLEAN')
    mod.operation = 'DIFFERENCE'
    mod.solver = 'EXACT'
    mod.object = cutter
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cutter, do_unlink=True)


def doorway(target, mat):
    # Remove material from the front only, then place a dark recessed back.
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -.085, .083))
    lower = bpy.context.object
    lower.dimensions = (.070, .20, .092)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    apply_boolean(target, lower)
    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=.035, depth=.20,
                                         location=(0, -.085, .129), rotation=(math.pi/2, 0, 0))
    apply_boolean(target, bpy.context.object)
    for index in reversed(range(len(target.data.materials))):
        if target.data.materials[index] is None:
            target.data.materials.pop(index=index)
    verts = [(-.034, -.010, .037), (.034, -.010, .037), (.034, -.010, .129)]
    verts += [(.034 * math.cos(t), -.010, .129 + .034 * math.sin(t))
              for t in [math.pi * i / 24 for i in range(1, 25)]]
    obj = mesh('Keep | recessed arched opening', verts, [tuple(range(len(verts)))], mat)
    solid = obj.modifiers.new('Recess back', 'SOLIDIFY')
    solid.thickness = .001


def mound(mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=96, ring_count=40, location=(0, 0, -.014))
    obj = bpy.context.object
    obj.name = 'Castle | low swept sand mound'
    obj.scale = (.31, .24, .064)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    smooth(obj)
    obj.data.materials.append(mat)


def mound_height(x, y):
    r2 = (x/.31)**2 + (y/.24)**2
    return -.014 + .064*math.sqrt(max(0, 1 - r2))


def grains(mat):
    rng = random.Random(30941)
    verts, faces = [], []
    for _ in range(2200):
        r = math.sqrt(rng.random())
        a = rng.random() * 2 * math.pi
        x, y = .30 * r * math.cos(a), .23 * r * math.sin(a)
        # Match the flattened spheroid surface, leaving the middle to the castle.
        z = -.014 + .064 * math.sqrt(max(0, 1 - r*r))
        if z < .0005:
            continue
        size = rng.uniform(.00045, .0011)
        n = len(verts)
        verts.extend(((x-size, y, z), (x+size, y, z), (x, y+size, z), (x, y, z+size*1.2)))
        faces.extend(((n,n+2,n+1),(n,n+1,n+3),(n+1,n+2,n+3),(n+2,n,n+3)))
    mesh('Sand | individual grains on mound', verts, faces, mat)


def shell(mat):
    # A small fan shell, with radial ridges that catch the same light as the sand.
    origin = Vector((-.11, -.176, 0))
    origin.z = mound_height(origin.x, origin.y) + .0006
    verts = [tuple(origin)]
    sides, rings = 40, 12
    for row in range(1, rings + 1):
        r = .023 * row / rings
        for i in range(sides + 1):
            angle = -1.16 + 2.32*i/sides
            ripple = .0012 * math.cos(angle*12) * math.sin(math.pi*row/rings)
            x, y = origin.x + r*math.sin(angle), origin.y-r*math.cos(angle)
            verts.append((x, y, mound_height(x, y) + .0006 + .0025*math.sin(math.pi*row/rings) + ripple))
    faces = [(0, 1+i, 2+i) for i in range(sides)]
    for row in range(rings - 1):
        for i in range(sides):
            a = 1 + row*(sides+1) + i
            faces.append((a, a+sides+1, a+sides+2, a+1))
    obj = mesh('Beach | tiny ivory fan shell', verts, faces, mat)
    smooth(obj)
    solid = obj.modifiers.new('Shell thickness', 'SOLIDIFY')
    solid.thickness = .0008


def flag(pole_mat, cloth):
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=.0022, depth=.105, location=(.006, .025, .346))
    pole = bpy.context.object
    pole.name = 'Flag | short natural wooden pole'
    pole.data.materials.append(pole_mat)
    smooth(pole)
    bevel(pole, .0008, 2)
    # Slightly curved cloth, with the pole edge attached rather than floating.
    verts, faces = [], []
    columns, rows = 16, 6
    for i in range(columns + 1):
        u = i / columns
        for j in range(rows + 1):
            v = j / rows
            x = .006 + .076 * u
            y = .025 + .0028 * math.sin(u * math.pi * 1.5) * u
            z = .394 - .037 * v * (1 - .48*u) - .006*u*u
            verts.append((x, y, z))
    for i in range(columns):
        for j in range(rows):
            n = i*(rows+1)+j
            faces.append((n, n+rows+1, n+rows+2, n+1))
    pennant = mesh('Flag | sun-softened mint cloth', verts, faces, cloth)
    smooth(pennant)
    solid = pennant.modifiers.new('Fine canvas thickness', 'SOLIDIFY')
    solid.thickness = .0006


def point_camera(camera, target):
    camera.rotation_euler = (Vector(target) - camera.location).to_track_quat('-Z', 'Y').to_euler()


def area(name, location, power, size, color, target):
    data = bpy.data.lights.new(name, 'AREA')
    data.energy = power
    data.shape = 'DISK'
    data.size = size
    data.color = color
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    point_camera(obj, target)


def studio():
    floor = material('Studio | warm ivory backdrop', (.72, .65, .55), .9)
    bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, -.001))
    plane = bpy.context.object
    plane.name = 'Studio | ground'
    plane.data.materials.append(floor)
    world = bpy.data.worlds.new('Studio | soft ambient')
    bpy.context.scene.world = world
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (.83, .88, 1, 1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = .28
    area('Studio | warm key', (-.8, -1.2, 1.8), 90, 1.35, (1, .86, .70), (0,0,.14))
    area('Studio | cool fill', (1.5, -.4, 1.0), 45, 1.2, (.78,.9,1), (0,0,.14))
    area('Studio | warm edge', (.4, 1.4, 1.5), 70, 1.0, (1,.88,.72), (0,0,.15))
    data = bpy.data.cameras.new('Studio | hero camera')
    camera = bpy.data.objects.new('Studio | hero camera', data)
    bpy.context.collection.objects.link(camera)
    camera.location = (.80, -1.55, 1.02)
    point_camera(camera, (0, 0, .18))
    data.type = 'ORTHO'
    data.ortho_scale = .81
    bpy.context.scene.camera = camera


def main():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    sand = material('Sand | softly compacted beach sand', (.68,.51,.31), sand=True)
    dark = material('Door | shaded sand interior', (.20,.12,.065), .97)
    wood = material('Flag | sun-warmed pale wood', (.52,.31,.14), .7)
    cloth = material('Flag | faded sea glass mint', (.24,.57,.46), .8)
    shell_mat = material('Beach | warm ivory shell', (.78,.69,.54), .74)
    mound(sand)
    central = tower('Keep | pressed sand cylinder', (0,.025), .125, .038, .252, sand)
    doorway(central, dark)
    battlements('Keep', (0,.025), .125, .290, 10, sand)
    for side, x in (('left', -.185), ('right', .185)):
        tower(f'Turret | {side} front', (x,-.055), .072, .001, .212, sand)
        battlements(f'Turret | {side} front', (x,-.055), .072, .213, 8, sand)
    for side, x in (('left', -.155), ('right', .155)):
        tower(f'Turret | {side} rear', (x,.095), .061, .001, .225, sand)
        battlements(f'Turret | {side} rear', (x,.095), .061, .226, 8, sand)
    grains(sand)
    shell(shell_mat)
    flag(wood, cloth)
    studio()
    scene = bpy.context.scene
    scene.name = 'Sandcastle | atelier lookdev v4'
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 96
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 1440
    scene.render.resolution_y = 1080
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.view_settings.view_transform = 'AgX'
    MODELS.mkdir(exist_ok=True)
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    scene.render.filepath = str(EVIDENCE / 'sandcastle-atelier-v4-blender.png')
    bpy.ops.wm.save_as_mainfile(filepath=str(MODELS / 'sandcastle-atelier-v4.blend'))
    bpy.ops.render.render(write_still=True)
    print('SANDCASTLE_LOOKDEV=' + scene.render.filepath)


if __name__ == '__main__':
    main()
