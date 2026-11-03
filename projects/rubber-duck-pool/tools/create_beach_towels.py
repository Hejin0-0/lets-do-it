"""Build an editable, standalone folded-and-rolled beach towel lookdev scene.

Blender 5.2: blender -b --factory-startup --python-exit-code 1 \
    -P tools/create_beach_towels.py -- 1
The integer selects a documented lookdev iteration. No game scene is changed.
"""
from pathlib import Path
import math
import sys

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
MODELS = ROOT / 'models'
EVIDENCE = ROOT / 'docs' / 'evidence'


def terry(name, color, round_number, roughness=.92):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    shader = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Sheen Weight'].default_value = .30
    shader.inputs['Sheen Roughness'].default_value = .7
    noise = nodes.new('ShaderNodeTexNoise')
    # The original 710-cycle texture fell below pixel size in the hero view.
    # Larger, subtly irregular fibers survive the render and read as fabric.
    noise.inputs['Scale'].default_value = 710 if round_number == 1 else (185 if round_number == 2 else 145)
    noise.inputs['Detail'].default_value = 2.0
    noise.inputs['Roughness'].default_value = .72
    ramp = nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = .18
    ramp.color_ramp.elements[0].color = tuple(c*(.77 if round_number == 1 else .65) for c in color) + (1,)
    ramp.color_ramp.elements[1].position = .83
    ramp.color_ramp.elements[1].color = tuple(min(1, c*(1.14 if round_number == 1 else 1.32)) for c in color) + (1,)
    bump = nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = .34 if round_number == 1 else .62
    bump.inputs['Distance'].default_value = .00055 if round_number == 1 else .0014
    if round_number >= 4:
        # CC0 Poly Haven terry cloth scan, shared with the Unity lookdev shader.
        image = bpy.data.images.load(str(ROOT / 'art-source/textures/terry_cloth_disp_2k.jpg'), check_existing=True)
        image.colorspace_settings.name = 'Non-Color'
        image.pack()
        coords = nodes.new('ShaderNodeTexCoord')
        scale = nodes.new('ShaderNodeVectorMath')
        scale.operation = 'SCALE'
        scale.inputs[3].default_value = 3.5 if round_number >= 5 else 1.5
        texture = nodes.new('ShaderNodeTexImage')
        texture.image = image
        texture.projection = 'BOX'
        texture.projection_blend = .18
        mat.node_tree.links.new(coords.outputs['Object'], scale.inputs[0])
        mat.node_tree.links.new(scale.outputs['Vector'], texture.inputs['Vector'])
        height = texture.outputs['Color']
        ramp.color_ramp.elements[0].position = .20 if round_number >= 5 else .30
        ramp.color_ramp.elements[1].position = .80 if round_number >= 5 else .70
        if round_number >= 5:
            ramp.color_ramp.elements[0].color = tuple(c*.84 for c in color) + (1,)
            ramp.color_ramp.elements[1].color = tuple(min(1,c*1.15) for c in color) + (1,)
        bump.inputs['Strength'].default_value = .55 if round_number >= 5 else .85
        bump.inputs['Distance'].default_value = .0010 if round_number >= 5 else .0018
    else:
        height = noise.outputs['Fac']
    mat.node_tree.links.new(height, ramp.inputs['Fac'])
    mat.node_tree.links.new(ramp.outputs['Color'], shader.inputs['Base Color'])
    mat.node_tree.links.new(height, bump.inputs['Height'])
    mat.node_tree.links.new(bump.outputs['Normal'], shader.inputs['Normal'])
    return mat


def flat_material(name, color, roughness=.9):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    shader = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Roughness'].default_value = roughness
    return mat


def make_mesh(name, verts, faces, materials, indices):
    data = bpy.data.meshes.new(name)
    data.from_pydata(verts, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    for mat in materials:
        data.materials.append(mat)
    for face, material_index in zip(data.polygons, indices):
        face.material_index = material_index
        face.use_smooth = True
    return obj


def surface_modifiers(obj, thickness, round_number):
    solid = obj.modifiers.new('Real folded cloth thickness', 'SOLIDIFY')
    solid.thickness = thickness
    solid.offset = 0
    solid.use_even_offset = True
    bevel = obj.modifiers.new('Soft towel edges', 'BEVEL')
    bevel.width = .0018 if round_number == 1 else (.0075 if round_number >= 5 else .004)
    bevel.segments = 2 if round_number == 1 else 3


def fold_profile(half_length, base, radius):
    points = []
    line_steps, turn_steps = 110, 28
    for i in range(line_steps + 1):
        points.append((-half_length + 2*half_length*i/line_steps, base))
    for i in range(1, turn_steps + 1):
        a = -math.pi/2 + math.pi*i/turn_steps
        points.append((half_length + radius*math.cos(a), base + radius + radius*math.sin(a)))
    for i in range(1, line_steps + 1):
        points.append((half_length - 2*half_length*i/line_steps, base + 2*radius))
    for i in range(1, turn_steps + 1):
        a = -math.pi/2 - math.pi*i/turn_steps
        points.append((-half_length + radius*math.cos(a), base + 3*radius + radius*math.sin(a)))
    for i in range(1, line_steps + 1):
        points.append((-half_length + 2*half_length*i/line_steps, base + 4*radius))
    return points


def stripe(x, bands):
    return next((slot for lo, hi, slot in bands if lo <= x < hi), 0)


def wrinkle(x, y, phase, intensity):
    return intensity*(.55*math.sin(22*x + 5*y + phase) + .30*math.sin(36*y - 7*x + phase))


def folded_towel(name, center_x, center_y, half_length, half_depth, base, radius, materials, bands, phase, round_number):
    # Round 3 folds across the depth: the front reads as a soft continuous
    # edge and the layered cut ends appear on the side, like the concept.
    profile = fold_profile(half_depth if round_number >= 3 else half_length, base, radius)
    across = 100 if round_number >= 3 else 40
    verts, faces, indices = [], [], []
    intensity = .0018 if round_number == 1 else (.004 if round_number >= 4 else .0028)
    for fold_x, z in profile:
        for j in range(across + 1):
            v = j/across*2 - 1
            x, y = (half_length*v, fold_x) if round_number >= 3 else (fold_x, half_depth*v)
            if round_number >= 5:
                # Pull corners in progressively; the sides are not perfect rectangles.
                corner = min(1, max(0, (abs(y) - half_depth + .035) / .035))
                x -= math.copysign(.010 * corner * abs(v)**6, x)
            edge = .0013 * math.sin(17*x + 3*v + phase) * abs(v)**4
            wave = wrinkle(x, y, phase, intensity)
            if round_number >= 5:
                wave += .0035*math.sin(10*x+phase)*math.cos(8*y-phase)
            puff = .0025*(1-v*v) if round_number >= 3 else 0
            # Very shallow pressure under the roll, only on the upper fold.
            pressure = ((.006 if round_number >= 5 else .003) * math.exp(-((x/.19)**6 + ((y-.008)/.08)**4))
                        if round_number >= 4 and name.startswith('Towel | coral') and z > base+3*radius else 0)
            verts.append((center_x+x, center_y+y+edge, z+wave+puff-pressure))
    for i in range(len(profile) - 1):
        for j in range(across):
            p = i*(across+1)+j
            faces.append((p, p+1, p+across+2, p+across+1))
            stripe_position = (-half_length + 2*half_length*(j+.5)/across
                               if round_number >= 3 else (profile[i][0]+profile[i+1][0])/2)
            index = stripe(stripe_position, bands)
            indices.append(index)
    obj = make_mesh(name, verts, faces, materials, indices)
    # Three nearly touching, thick layers create an actual plush fold.
    thickness = .006 if round_number == 1 else (.019 if round_number == 2 else .021)
    surface_modifiers(obj, thickness, round_number)
    return obj


def folded_binding(name, towel, material, across=100):
    # Small smooth cotton piping traces each side of the folded cloth profile.
    rows = len(towel.data.vertices) // (across+1)
    for side, j in ((-1,0), (1,across)):
        curve = bpy.data.curves.new(name, 'CURVE')
        curve.dimensions = '3D'
        curve.bevel_depth = .0013
        curve.bevel_resolution = 3
        spline = curve.splines.new('POLY')
        spline.points.add(rows-1)
        for i, point in enumerate(spline.points):
            co = towel.data.vertices[i*(across+1)+j].co
            point.co = (co.x + side*.0005, co.y, co.z, 1)
        obj = bpy.data.objects.new(name + (' left' if side < 0 else ' right'), curve)
        bpy.context.collection.objects.link(obj)
        obj.data.materials.append(material)


def roll(name, center, half_width, outer_radius, materials, bands, round_number):
    turns, segments, across = (5 if round_number < 3 else 4.75), 600, 48
    inner_radius = .008
    verts, faces, indices = [], [], []
    for i in range(segments + 1):
        t = i/segments
        angle = turns * 2*math.pi*t
        r = inner_radius + (outer_radius-inner_radius)*t
        for j in range(across + 1):
            x = -half_width + 2*half_width*j/across
            wobble = (.0009 if round_number < 3 else (.0024 if round_number >= 4 else .0016))*math.sin(20*x + 3*angle) * (r/outer_radius)
            y = center[1] + (r+wobble)*math.cos(angle)
            z = center[2] + (r+wobble)*math.sin(angle)
            verts.append((center[0]+x, y, z))
    for i in range(segments):
        for j in range(across):
            p = i*(across+1)+j
            faces.append((p, p+across+1, p+across+2, p+1))
            xmid = -half_width + 2*half_width*(j+.5)/across
            indices.append(stripe(xmid, bands))
    obj = make_mesh(name, verts, faces, materials, indices)
    surface_modifiers(obj, .010 if round_number < 3 else .0125, round_number)
    return obj


def hem(name, center_x, center_y, half_length, half_depth, z, phase, material):
    # Fine stitched seams, inset from the long free edges of the topmost fold.
    for sign in (-1, 1):
        curve = bpy.data.curves.new(name, 'CURVE')
        curve.dimensions = '3D'
        curve.resolution_u = 2
        curve.bevel_depth = .00045
        curve.bevel_resolution = 2
        spline = curve.splines.new('POLY')
        steps = 90
        spline.points.add(steps)
        y = sign*(half_depth-.007)
        for i, point in enumerate(spline.points):
            x = -half_length + 2*half_length*i/steps
            point.co = (center_x+x, center_y+y, z + wrinkle(x,y,phase,.0018) + .0036, 1)
        obj = bpy.data.objects.new(name + (' front' if sign == -1 else ' back'), curve)
        bpy.context.collection.objects.link(obj)
        obj.data.materials.append(material)


def aim(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()


def light(name, position, power, size, color):
    data = bpy.data.lights.new(name, 'AREA')
    data.energy = power
    data.shape = 'DISK'
    data.size = size
    data.color = color
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = position
    aim(obj, (0, 0, .10))


def studio(round_number):
    mat = flat_material('Studio | warm sand backdrop', (.68,.60,.51))
    bpy.ops.mesh.primitive_plane_add(size=200, location=(0,0,-.001))
    bpy.context.object.name = 'Studio | ground'
    bpy.context.object.data.materials.append(mat)
    world = bpy.data.worlds.new('Studio | ambient daylight')
    bpy.context.scene.world = world
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (.88,.92,1,1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = .30
    light('Studio | warm key', (-.9,-1.4,1.8), 105, 1.25, (1,.87,.75))
    light('Studio | cool fill', (1.4,-.4,1.1), 45, 1.0, (.8,.91,1))
    light('Studio | warm rim', (.4,1.4,1.5), 78, .9, (1,.90,.78))
    camera_data = bpy.data.cameras.new('Studio | hero camera')
    camera = bpy.data.objects.new('Studio | hero camera', camera_data)
    bpy.context.collection.objects.link(camera)
    camera.location = (1.65,-2.25,1.16)
    aim(camera, (0,0,.105))
    camera_data.type = 'ORTHO'
    camera_data.ortho_scale = .82 if round_number == 1 else .86
    bpy.context.scene.camera = camera


def main():
    round_number = int(sys.argv[sys.argv.index('--')+1]) if '--' in sys.argv else 1
    if round_number not in (1,2,3,4,5):
        raise ValueError('Expected a lookdev round from 1 to 5')
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    ivory = terry('Terry | warm ivory', (.76,.67,.54), round_number)
    coral_color = (.62,.23,.17) if round_number == 1 else ((.62,.19,.13) if round_number == 2 else (.62,.115,.065))
    teal_color = (.12,.37,.30) if round_number == 1 else ((.10,.36,.28) if round_number == 2 else (.045,.27,.19))
    coral = terry('Terry | sun-faded coral', coral_color, round_number)
    teal = terry('Terry | quiet sea glass', teal_color, round_number)
    gold = terry('Terry | mellow sunshine band', (.85,.45,.055) if round_number > 1 else (.75,.48,.12), round_number)
    stitch = flat_material('Hem | soft cotton thread', (.64,.54,.42))
    ivory_base = .004 if round_number == 1 else (.0105 if round_number == 2 else .0115)
    coral_base = .054 if round_number == 1 else (.076 if round_number == 2 else .0795)
    roll_height = .177 if round_number == 1 else (.209 if round_number == 2 else .214)
    ivory_towel = folded_towel('Towel | ivory folded', 0, .008, .244, .155, ivory_base, .0115,
                               [ivory, teal], [(-.145,-.128,1),(-.113,-.099,1)], .2, round_number)
    coral_towel = folded_towel('Towel | coral folded', -.008, -.004, .228, .144, coral_base, .0115,
                               [coral, ivory, gold], [(-.141,-.131,1),(-.123,-.109,2),(-.100,-.090,1)], 1.1, round_number)
    if round_number >= 5:
        folded_binding('Hem | ivory cotton', ivory_towel, flat_material('Hem | ivory cotton', (.76,.67,.54)))
        folded_binding('Hem | coral cotton', coral_towel, flat_material('Hem | coral cotton', coral_color))
    roll('Towel | sea glass roll', (0,.008,roll_height), .205, .077,
         [teal, ivory, gold], [(-.132,-.117,1),(-.107,-.089,2),(-.080,-.065,1),(.075,.130,1)], round_number)
    hem_offset = 0 if round_number == 1 else (.0065 if round_number == 2 else .0075)
    hem('Hem | ivory', 0,.008,.232,.155,ivory_base+4*.0115+hem_offset,.2,stitch)
    hem('Hem | coral', -.008,-.004,.216,.144,coral_base+4*.0115+hem_offset,1.1,stitch)
    studio(round_number)
    scene = bpy.context.scene
    scene.name = 'Towels | studio lookdev'
    scene['lookdev_round'] = round_number
    scene['asset_role'] = 'Standalone folded-and-rolled towels; not integrated into the game.'
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 72 if round_number == 1 else 96
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 1440
    scene.render.resolution_y = 1080
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.view_settings.view_transform = 'AgX'
    MODELS.mkdir(exist_ok=True)
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    scene.render.filepath = str(EVIDENCE / f'beach-towels-r{round_number}-blender.png')
    bpy.ops.wm.save_as_mainfile(filepath=str(MODELS / f'beach-towels-r{round_number}.blend'))
    bpy.ops.render.render(write_still=True)
    print('TOWEL_LOOKDEV=' + scene.render.filepath)


if __name__ == '__main__':
    main()
