"""Build the beach-ball studio in a new Blender scene, preserving open scenes.

The game ball uses a 0.165-unit collision radius. This study is independent of
runtime placement and has not been integrated or optimized for the web game.
"""
import math
from pathlib import Path
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
RADIUS = 0.165
SIDES = 72
RINGS = 48


def material(name, color, roughness=0.32):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    shader = next(node for node in mat.node_tree.nodes if node.type == 'BSDF_PRINCIPLED')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Coat Weight'].default_value = 0.18
    shader.inputs['Coat Roughness'].default_value = 0.3
    return mat


def radius_at(theta, phi):
    return RADIUS * (1 + 0.0035 * math.sin(3 * theta) * math.cos(3 * phi + 0.7)
                     - 0.0035 * math.cos(6 * phi) * math.sin(theta) ** 2)


def spherical(theta, phi, offset=0.0):
    r = radius_at(theta, phi) + offset
    return (r * math.sin(theta) * math.cos(phi),
            r * math.sin(theta) * math.sin(phi), r * math.cos(theta))


def mesh_obj(scene, name, verts, faces, materials, indices=None):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    for mat in materials:
        mesh.materials.append(mat)
    for p in mesh.polygons:
        p.use_smooth = True
        if indices is not None:
            p.material_index = indices[p.index]
    return obj


def uv_sphere(scene, materials):
    verts = [(0.0, 0.0, RADIUS)]
    for i in range(1, RINGS):
        theta = math.pi * i / RINGS
        verts.extend(spherical(theta, math.tau * j / SIDES) for j in range(SIDES))
    bottom = len(verts)
    verts.append((0.0, 0.0, -RADIUS))
    faces, indices = [], []
    palette = [0, 1, 2, 0, 1, 2]
    for j in range(SIDES):
        k = (j + 1) % SIDES
        faces.append((0, 1 + j, 1 + k))
        indices.append(palette[j // (SIDES // 6)])
    for i in range(RINGS - 2):
        a, b = 1 + i * SIDES, 1 + (i + 1) * SIDES
        for j in range(SIDES):
            k = (j + 1) % SIDES
            faces.append((a + j, b + j, b + k, a + k))
            indices.append(palette[j // (SIDES // 6)])
    start = 1 + (RINGS - 2) * SIDES
    for j in range(SIDES):
        faces.append((start + j, bottom, start + (j + 1) % SIDES))
        indices.append(palette[j // (SIDES // 6)])
    obj = mesh_obj(scene, 'Ball | six inflated panels', verts, faces, materials, indices)
    uv = obj.data.uv_layers.new(name='UVMap')
    for face in obj.data.polygons:
        points = []
        for loop in face.loop_indices:
            p = obj.data.vertices[obj.data.loops[loop].vertex_index].co
            u = (math.atan2(p.y, p.x) % math.tau) / math.tau
            v = math.acos(max(-1.0, min(1.0, p.z / max(p.length, 1e-9)))) / math.pi
            points.append([u, v, abs(p.x) + abs(p.y) < 1e-8])
        ordinary = [q[0] for q in points if not q[2]]
        if ordinary and max(ordinary) - min(ordinary) > .5:
            for q in points:
                if not q[2] and q[0] < .5:
                    q[0] += 1
        ordinary = [q[0] for q in points if not q[2]]
        for loop, q in zip(face.loop_indices, points):
            uv.data[loop].uv = (sum(ordinary) / len(ordinary) if q[2] else q[0], q[1])
    return obj


def cap(scene, name, mat, top=True):
    # Spherical patch follows the inflated shell; no large flat lid.
    verts = [(0.0, 0.0, (RADIUS + .00035) * (1 if top else -1))]
    steps, sides = 8, 72
    for i in range(1, steps + 1):
        t = .205 * i / steps
        theta = t if top else math.pi - t
        verts.extend(spherical(theta, math.tau * j / sides, .00035) for j in range(sides))
    faces = []
    for j in range(sides):
        k = (j + 1) % sides
        faces.append((0, 1 + j, 1 + k) if top else (0, 1 + k, 1 + j))
    for i in range(steps - 1):
        a, b = 1 + i * sides, 1 + (i + 1) * sides
        for j in range(sides):
            k = (j + 1) % sides
            faces.append((a + j, b + j, b + k, a + k) if top else (a + k, b + k, b + j, a + j))
    return mesh_obj(scene, name, verts, faces, [mat])


def welds(scene, mat):
    curve = bpy.data.curves.new('Ball | heat-weld lines', 'CURVE')
    curve.dimensions = '3D'
    curve.resolution_u = 1
    curve.bevel_depth = .00023
    curve.bevel_resolution = 3
    for j in range(6):
        line = curve.splines.new('POLY')
        line.points.add(96)
        phi = math.tau * j / 6
        for i, p in enumerate(line.points):
            p.co = (*spherical(.205 + (math.pi - .41) * i / 96, phi, .00016), 1.0)
    obj = bpy.data.objects.new('Ball | six slim welds', curve)
    scene.collection.objects.link(obj)
    obj.data.materials.append(mat)
    return obj


def round_disc(name, radius, depth, z, mat):
    bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=radius, depth=depth, location=(0, 0, z))
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    bevel = obj.modifiers.new('Rounded molded edge', 'BEVEL')
    bevel.width = min(depth * .4, .0005)
    bevel.segments = 3
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return obj


def aim(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()


def area_light(scene, name, location, power, size, target=(0, 0, 0)):
    data = bpy.data.lights.new(name, 'AREA')
    data.energy, data.shape, data.size = power, 'DISK', size
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    obj.location = location
    aim(obj, target)


def create():
    if bpy.data.scenes.get('Beach Ball | v1 studio'):
        raise RuntimeError('The beach-ball studio scene already exists; use a fresh file for regeneration.')
    scene = bpy.data.scenes.new('Beach Ball | v1 studio')
    if bpy.context.window:
        bpy.context.window.scene = scene
    teal = material('MAT_Vinyl_SeaGlass', (.075, .38, .31))
    cream = material('MAT_Vinyl_Ivory', (.94, .80, .62))
    coral = material('MAT_Vinyl_Coral', (.82, .245, .17))
    gold = material('MAT_Vinyl_Butter', (.98, .61, .19))
    seam = material('MAT_Vinyl_Weld', (.55, .52, .41), .4)
    valve = material('MAT_Valve_Ivory', (.82, .75, .62), .42)
    uv_sphere(scene, [teal, cream, coral])
    cap(scene, 'Ball | upper yellow pole patch', gold)
    cap(scene, 'Ball | lower ivory pole patch', cream, top=False)
    welds(scene, seam)
    round_disc('Ball | valve rim', .0085, .0011, RADIUS + .001, valve)
    round_disc('Ball | valve plug', .0054, .0012, RADIUS + .0017, gold)
    # A separate studio floor makes no claim about the game environment.
    floor = mesh_obj(scene, 'Studio | ground', [(-4, -4, -RADIUS-.0004), (4, -4, -RADIUS-.0004),
                     (4, 4, -RADIUS-.0004), (-4, 4, -RADIUS-.0004)], [(0, 1, 2, 3)],
                     [material('MAT_Studio_Sand', (.78, .70, .61), .8)])
    floor.data.polygons[0].use_smooth = False
    world = bpy.data.worlds.new('Studio | warm soft ambient')
    world.use_nodes = True
    bg = next(n for n in world.node_tree.nodes if n.type == 'BACKGROUND')
    bg.inputs['Color'].default_value = (.83, .77, .70, 1)
    bg.inputs['Strength'].default_value = .35
    scene.world = world
    area_light(scene, 'Studio | large key', (1.0, -1.35, 1.7), 150, 1.35)
    area_light(scene, 'Studio | soft fill', (-1.3, -.3, .8), 70, 1.2)
    area_light(scene, 'Studio | rim', (.4, 1.3, 1.2), 100, 1.0)
    camera_data = bpy.data.cameras.new('Studio | camera')
    camera = bpy.data.objects.new('Studio | camera', camera_data)
    scene.collection.objects.link(camera)
    camera.location = (.76, -1.05, .78)
    aim(camera, (0, 0, -.005))
    camera_data.type = 'ORTHO'
    camera_data.ortho_scale = .52
    scene.camera = camera
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 64
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = 1440, 1080
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.filepath = str(ROOT / 'docs/evidence/beach-ball-v1-blender.png')
    scene['asset_note'] = 'Standalone lookdev. Origin at ball center; no game integration.'
    target = ROOT / 'art-source/beach-ball/beach-ball-v1.blend'
    target.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(target))
    print('BEACH_BALL_V1_SAVED', target, flush=True)


if __name__ == '__main__':
    create()
