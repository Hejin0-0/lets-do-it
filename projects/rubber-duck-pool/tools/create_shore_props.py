"""Build original tide-pool and wall-lantern props with review renders.

From projects/rubber-duck-pool, with Blender 4.0 or newer:
    blender -b --factory-startup --python-exit-code 1 -P tools/create_shore_props.py -- all
Replace ``all`` with ``rockpool`` or ``sconce`` for a single model. Geometry
builders are pure Python; Blender is imported only when writing the assets.
"""
import json
import math
from pathlib import Path
import random
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from create_beach_props import Model as BeachModel, add_studio, blender_material, box, cross, normalize
from create_resort_props import Model as ResortModel, lantern

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/02_models/props'
SPECS = {'rockpool': 2500, 'sconce': 500}
STONE = 'Stone | sea-worn grey'
WATER = 'Water | tide pool'
SEAWEED = 'Leaf | seaweed green'
IRON = 'Metal | dark iron'
LAMP = 'Lamp | lantern amber cream'
COLORS = {
    STONE: (.54, .56, .52),
    WATER: (.065, .26, .28),
    SEAWEED: (.15, .31, .17),
    IRON: (.15, .15, .14),
    LAMP: (1.0, .79, .51),
}


class Model(BeachModel):
    @property
    def materials(self):
        return {name: COLORS[name] for part in self.meshes for name in part.materials}


def fit_footprint(model, size):
    vertices = [vertex for part in model.meshes for vertex in part.vertices]
    low = [min(v[i] for v in vertices) for i in (0, 1)]
    high = [max(v[i] for v in vertices) for i in (0, 1)]
    center = [(low[i]+high[i])/2 for i in (0, 1)]
    scale = [size[i]/(high[i]-low[i]) for i in (0, 1)]
    for part in model.meshes:
        part.vertices = [((x-center[0])*scale[0], (y-center[1])*scale[1], z)
                         for x, y, z in part.vertices]


def water_outline():
    # The inset on the upper shore gives the pool its asymmetrical kidney shape.
    controls = [(-.175, -.090), (-.150, -.120), (-.095, -.137), (-.035, -.143),
                (.031, -.138), (.095, -.119), (.151, -.090), (.190, -.055),
                (.208, -.014), (.190, .018), (.149, .035), (.110, .037),
                (.071, .026), (.040, .025), (.015, .040), (-.008, .073),
                (-.048, .103), (-.098, .110), (-.145, .094), (-.176, .054),
                (-.190, .008), (-.194, -.045)]
    points = []
    for i, p1 in enumerate(controls):
        p0, p2, p3 = controls[i-1], controls[(i+1) % len(controls)], controls[(i+2) % len(controls)]
        for step in range(3):
            t = step/3
            points.append(tuple(.5*((2*p1[k]) + (-p0[k]+p2[k])*t +
                                     (2*p0[k]-5*p1[k]+4*p2[k]-p3[k])*t*t +
                                     (-p0[k]+3*p1[k]-3*p2[k]+p3[k])*t*t*t)
                                for k in range(2)))
    return points


def pool_water(model):
    outline = water_outline()
    vertices = [(0, 0, .008)] + [(x, y, .008) for x, y in outline]
    faces = [(0, i+1, (i+1) % len(outline)+1) for i in range(len(outline))]
    model.add('Pool | still kidney-shaped sea water', vertices, faces, WATER)


def stone(model, center, size, rng, name):
    """A slightly asymmetric, broad-footed sea-worn stone, resting at z=0."""
    x, y = center
    rx, ry, height = size
    x += rng.uniform(-.002, .002)
    y += rng.uniform(-.002, .002)
    rx *= rng.uniform(.97, 1.03)
    ry *= rng.uniform(.97, 1.03)
    height *= rng.uniform(.98, 1.02)
    angle, phase = rng.uniform(-.45, .45), rng.uniform(0, math.tau)
    cosine, sine = math.cos(angle), math.sin(angle)
    segments = 14
    profile = [(0, .72), (.10, .91), (.32, 1), (.60, .91), (.83, .68), (.97, .30)]
    vertices = [(x, y, 0)]
    for level, radius in profile:
        for i in range(segments):
            a = math.tau*i/segments
            ripple = 1 + .045*math.sin(3*a+phase+.5*level) + .018*math.cos(5*a-phase)
            u, v = rx*radius*ripple*math.cos(a), ry*radius*ripple*math.sin(a)
            vertices.append((x+u*cosine-v*sine, y+u*sine+v*cosine, height*level))
    top = len(vertices)
    vertices.append((x+.025*rx*math.sin(phase), y+.025*ry*math.cos(phase), height))
    faces = [(0, 1+(i+1) % segments, 1+i) for i in range(segments)]
    for row in range(len(profile)-1):
        a, b = 1+row*segments, 1+(row+1)*segments
        faces.extend((a+i, a+(i+1) % segments, b+(i+1) % segments, b+i)
                     for i in range(segments))
    last = 1+(len(profile)-1)*segments
    faces.extend((top, last+i, last+(i+1) % segments) for i in range(segments))
    model.add(name, vertices, faces, STONE, smooth=True)


def seaweed_blade(model, root, tip, width, angle):
    """A tapered, gently folded blade with an enclosed, thin underside."""
    dx, dy, dz = (tip[i]-root[i] for i in range(3))
    side = (math.cos(angle), math.sin(angle), 0)
    normal = normalize(cross((dx, dy, dz), side))

    def at(t, spread=0, depth=0):
        return tuple(root[k] + t*(tip[k]-root[k]) + spread*side[k] + depth*normal[k] for k in range(3))

    vertices = [root, at(.30, width), at(.72, width*.67), tip,
                at(.72, -width*.67), at(.30, -width),
                at(.52, depth=width*.15), at(.52, depth=-width*.10)]
    faces = [(6, (i+1) % 6, i) for i in range(6)]
    faces.extend((7, i, (i+1) % 6) for i in range(6))
    model.add('Seaweed | folded blade', vertices, faces, SEAWEED, smooth=True)


def seaweed(model, rng):
    root_x, root_y = .026, -.018
    for lean_x, lean_y, height, width in [(-.014, -.003, .048, .0040),
                                         (-.006, .013, .056, .0045),
                                         (.006, -.012, .042, .0040),
                                         (.014, .008, .051, .0048),
                                         (.003, .003, .063, .0042)]:
        root = (root_x+rng.uniform(-.002, .002), root_y+rng.uniform(-.002, .002), .004)
        tip = (root[0]+lean_x+rng.uniform(-.002, .002),
               root[1]+lean_y+rng.uniform(-.002, .002), height+rng.uniform(-.002, .002))
        seaweed_blade(model, root, tip, width*rng.uniform(.92, 1.08), rng.uniform(0, math.tau))


def rockpool(model):
    rng = random.Random(5271)
    pool_water(model)
    # Unequal, hand-composed clusters follow the shore; the +x inlet stays open.
    shore = [((-.137, .082), (.090, .076, .140)),
             ((-.181, -.045), (.056, .056, .074)),
             ((-.126, -.112), (.067, .038, .052)),
             ((.028, -.128), (.057, .034, .048)),
             ((.134, -.090), (.026, .024, .030)),
             ((.068, .053), (.039, .030, .046)),
             ((.030, .041), (.037, .030, .038)),
             ((-.050, .104), (.037, .027, .028))]
    for center, size in shore:
        stone(model, center, size, rng, 'Pool | sea-worn shore rock')
    for center, size in [((-.052, -.047), (.014, .011, .019)),
                         ((.068, -.064), (.018, .013, .022))]:
        stone(model, center, size, rng, 'Pool | pebble in water')
    seaweed(model, rng)
    fit_footprint(model, (.48, .36))


def tube(model, name, points, radius, material, segments=6):
    """A capped, smooth tube in the xz plane, following a curved arm."""
    vertices = []
    for i, point in enumerate(points):
        previous, following = points[max(0, i-1)], points[min(len(points)-1, i+1)]
        tangent = normalize(tuple(following[k]-previous[k] for k in range(3)))
        across = (0, 1, 0)
        outward = cross(tangent, across)
        for j in range(segments):
            angle = math.tau*j/segments
            vertices.append(tuple(point[k]+radius*(across[k]*math.cos(angle)+outward[k]*math.sin(angle))
                                  for k in range(3)))
    faces = []
    for i in range(len(points)-1):
        faces.extend((i*segments+j, i*segments+(j+1) % segments,
                      (i+1)*segments+(j+1) % segments, (i+1)*segments+j)
                     for j in range(segments))
    faces.extend([tuple(reversed(range(segments))), tuple((len(points)-1)*segments+j for j in range(segments))])
    model.add(name, vertices, faces, material, smooth=True)


def lantern_head(model):
    """Use the post lantern's actual head, scaled about its pane centre."""
    original = ResortModel()
    lantern(original)
    post_parts = {'Lantern | square foot', 'Lantern | foot collar', 'Lantern | slim post'}
    for part in original.meshes:
        if part.name in post_parts:
            continue
        part.vertices = [(.11+.8*x, .8*y, .05+.8*(z-.56)) for x, y, z in part.vertices]
        model.meshes.append(part)


def sconce(model):
    box(model, 'Bracket | back plate', (.010, 0, -.005), (.020, .070, .140), IRON)
    tube(model, 'Bracket | curved hanging arm',
         [(.018, 0, .035), (.027, 0, .039), (.032, 0, .052), (.031, 0, .070),
          (.034, 0, .094), (.043, 0, .122), (.059, 0, .148), (.079, 0, .169),
          (.098, 0, .182), (.110, 0, .1852)], .004, IRON)
    tube(model, 'Bracket | small curled end',
         [(.031, 0, .070), (.039, 0, .063), (.047, 0, .063), (.053, 0, .069),
          (.053, 0, .076), (.047, 0, .080), (.041, 0, .077)], .003, IRON)
    lantern_head(model)


def build_model(name):
    if name not in SPECS:
        raise ValueError('Unknown shore prop: ' + name)
    model = Model()
    {'rockpool': rockpool, 'sconce': sconce}[name](model)
    if model.triangle_count() > SPECS[name]:
        raise ValueError(f'{name}: triangle budget exceeded ({model.triangle_count()})')
    return model


def write_model(name):
    import bpy
    model = build_model(name)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    materials = {key: blender_material(bpy, key, rgb) for key, rgb in model.materials.items()}
    if WATER in materials:
        water_shader = materials[WATER].node_tree.nodes.get('Principled BSDF')
        water_shader.inputs['Roughness'].default_value = .15
    objects = []
    for part in model.meshes:
        data = bpy.data.meshes.new(part.name)
        data.from_pydata(part.vertices, [], part.faces)
        data.update()
        obj = bpy.data.objects.new(part.name, data)
        bpy.context.collection.objects.link(obj)
        for material in part.materials:
            data.materials.append(materials[material])
        for polygon, index in zip(data.polygons, part.face_materials):
            polygon.material_index = index
            polygon.use_smooth = part.smooth
        objects.append(obj)
    bpy.context.view_layer.update()
    depsgraph = bpy.context.evaluated_depsgraph_get()
    coords, triangles = [], 0
    for obj in objects:
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        mesh.calc_loop_triangles()
        triangles += len(mesh.loop_triangles)
        coords.extend(tuple(obj.matrix_world @ vertex.co) for vertex in mesh.vertices)
        evaluated.to_mesh_clear()
    bounds = [[min(v[i] for v in coords), max(v[i] for v in coords)] for i in range(3)]
    print('MODEL_STATS ' + json.dumps(dict(id=name, triangles=triangles, bounds=bounds,
                                          materials={key: [*rgb, 1] for key, rgb in model.materials.items()})), flush=True)
    if triangles != model.triangle_count() or triangles > SPECS[name]:
        raise RuntimeError(f'{name}: evaluated triangle count does not match the budgeted mesh')
    target = OUT / name
    target.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.wm.save_as_mainfile(filepath=str(target / (name+'.blend')), compress=True)
    bpy.ops.export_scene.gltf(filepath=str(target / (name+'.glb')), export_format='GLB',
                              use_selection=True, export_apply=True)
    add_studio(bpy, coords, target / (name+'.png'))


def main():
    args = sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
    if len(args) != 1 or args[0] not in (*SPECS, 'all'):
        raise SystemExit('usage: -- <rockpool|sconce|all>')
    for name in (SPECS if args[0] == 'all' else args):
        write_model(name)


if __name__ == '__main__':
    main()
