"""Build two original low-poly resort palms and their Blender review renders.

From projects/rubber-duck-pool, with Blender 4.0 or newer:
    blender -b --factory-startup --python-exit-code 1 -P tools/create_palms.py -- all
Use palm or palm2 in place of all for one model. Geometry construction is pure
Python; Blender is imported only for export and rendering. Blender uses Z up.
"""
import json
import math
from pathlib import Path
import random
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from create_beach_props import Model as BeachModel, add_studio, blender_material, cross, normalize

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/02_models/props'
SPECS = {
    'palm': dict(budget=2400, trunk=3.10, lean=(.60, .01), bands=24, seed=91831,
                 reach=1.33, leaf=.40, lift=1.38, drop=1.92, mature=10,
                 young_lift=1.84, young_drop=1.20, drift=(-.05, 0), crown_offset=(0, 0), coconuts=4),
    'palm2': dict(budget=1600, trunk=1.15, lean=(-.055, -.035), bands=9, seed=11927,
                  reach=.69, leaf=.23, lift=.78, drop=1.08, mature=9,
                  young_lift=1.27, young_drop=.82, drift=(-.02, -.02), crown_offset=(-.039, -.055), coconuts=0),
}


def srgb(value):
    """Convert the requested display colors to Blender's linear Base Color."""
    rgb = [int(value[i:i+2], 16)/255 for i in (0, 2, 4)]
    return tuple(c/12.92 if c <= .04045 else ((c+.055)/1.055)**2.4 for c in rgb)


WOOD = 'Wood | palm trunk'
WOOD_LIGHT = 'Wood | palm trunk light'
GROOVE = 'Wood | trunk groove'
LEAVES = ('Leaf | frond green', 'Leaf | frond light', 'Leaf | frond bright')
LEAF_SHADES = {name: name+' shade' for name in LEAVES}
HUSK = 'Husk | green coconut'
COLORS = {WOOD: srgb('a6764a'), WOOD_LIGHT: srgb('ba895b'), GROOVE: srgb('6e4a2c'),
          LEAVES[0]: srgb('4f9438'), LEAVES[1]: srgb('8ab045'),
          LEAVES[2]: srgb('6fab40'), HUSK: srgb('8aa13f')}
COLORS.update({shade: tuple(channel*.88 for channel in COLORS[base])
               for base, shade in LEAF_SHADES.items()})


class Model(BeachModel):
    @property
    def materials(self):
        return {name: COLORS[name] for part in self.meshes for name in part.materials}


def add(a, b):
    return tuple(x+y for x, y in zip(a, b))


def mul(v, scalar):
    return tuple(x*scalar for x in v)


def dot(a, b):
    return sum(x*y for x, y in zip(a, b))


def trunk_center(spec, height):
    t = height/spec['trunk']
    # A gentle S lean: vertical at the ground and turning upward at the crown.
    ease = t*t*(3-2*t)
    return (spec['lean'][0]*ease, spec['lean'][1]*ease, height)


def trunk(model, spec):
    segments, count, height = 8, spec['bands'], spec['trunk']
    vertices, faces, indices = [], [], []
    levels = []
    for band in range(count):
        levels.extend(((band/count, .96), ((band+.13)/count, 1.065)))
    levels.append((1, .96))
    for t, flare in levels:
        center = trunk_center(spec, t*height)
        radius = .12*(1-.30*t)*flare
        for i in range(segments):
            angle = math.tau*i/segments
            vertices.append((center[0]+radius*math.cos(angle),
                             center[1]+radius*math.sin(angle), center[2]))
    for row in range(len(levels)-1):
        # The short recessed-to-flared face makes the darker groove physical.
        material = 1 if row % 2 == 0 else (2 if row/(len(levels)-1) >= .72 else 0)
        for i in range(segments):
            j = (i+1) % segments
            faces.append((row*segments+i, row*segments+j, (row+1)*segments+j, (row+1)*segments+i))
            indices.append(material)
    faces.extend((tuple(reversed(range(segments))),
                  tuple((len(levels)-1)*segments+i for i in range(segments))))
    indices.extend((0, 2))
    model.add('Trunk | banded', vertices, faces, [WOOD, GROOVE, WOOD_LIGHT], indices, smooth=True)


def midrib(model, name, points, radius, material):
    """Three-sided, closed taper around the sampled arch; the first ring is embedded."""
    segments = 3
    vertices, faces = [], []
    for i, point in enumerate(points):
        before, after = points[max(0, i-1)], points[min(len(points)-1, i+1)]
        tangent = normalize(tuple(after[k]-before[k] for k in range(3)))
        side = normalize(cross(tangent, (0, 0, 1)))
        normal = cross(tangent, side)
        width = radius*(1-.78*i/(len(points)-1))
        for j in range(segments):
            angle = math.tau*j/segments
            vertices.append(add(point, add(mul(side, width*math.cos(angle)),
                                           mul(normal, width*math.sin(angle)))))
    for row in range(len(points)-1):
        for i in range(segments):
            j = (i+1) % segments
            faces.append((row*segments+i, row*segments+j,
                          (row+1)*segments+j, (row+1)*segments+i))
    faces.extend((tuple(reversed(range(segments))),
                  tuple((len(points)-1)*segments+i for i in range(segments))))
    model.add(name+' midrib', vertices, faces, material, smooth=True)


def at_midrib(points, t):
    pos = t*(len(points)-1)
    i = min(int(pos), len(points)-2)
    return add(mul(points[i], 1-(pos-i)), mul(points[i+1], pos-i))


def orient_xy(a, b, c):
    return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])


def triangulate_blade(vertices, polygon):
    """Triangulate one concave, XY-monotone section without filling its teeth."""
    polygon = list(polygon)
    area = sum(vertices[a][0]*vertices[b][1]-vertices[b][0]*vertices[a][1]
               for a, b in zip(polygon, polygon[1:]+polygon[:1]))
    if area < 0:
        polygon.reverse()
    faces = []
    while len(polygon) > 3:
        for index, middle in enumerate(polygon):
            before, after = polygon[index-1], polygon[(index+1) % len(polygon)]
            a, b, c = (vertices[i] for i in (before, middle, after))
            if orient_xy(a, b, c) <= 1e-12:
                continue
            if any(all(orient_xy(x, y, vertices[p]) >= -1e-12
                       for x, y in ((a, b), (b, c), (c, a)))
                   for p in polygon if p not in (before, middle, after)):
                continue
            faces.append((before, middle, after))
            del polygon[index]
            break
        else:
            raise ValueError('Cannot triangulate palm blade section')
    if orient_xy(*(vertices[i] for i in polygon)) <= 1e-12:
        raise ValueError('Invalid palm blade section winding')
    faces.append(tuple(polygon))
    return faces


def leaflets(model, name, points, angle, twist, teeth, blade_length, material):
    """Two continuous folded combs, with a tip and valley for every tooth."""
    radial = (math.cos(angle), math.sin(angle), 0)
    sideways = (-math.sin(angle), math.cos(angle), 0)
    vertices, faces, indices = [], [], []
    for material_index, sign in enumerate((-1, 1)):
        first = len(vertices)
        vertices.extend(points)
        fold = math.radians(35)+sign*twist
        sweep = math.radians(42)+twist*.5
        for index in range(2*teeth+1):
            t = index/(2*teeth)
            length = blade_length*(.20+.80*math.sin(math.pi*t)**.75)
            edge = 1 if index % 2 else .64
            root = at_midrib(points, t)
            forward = length*math.cos(fold)*math.sin(sweep)
            width = length*math.cos(fold)*math.cos(sweep)*edge
            vertices.append(add(root, add(mul(radial, forward),
                                         add(mul(sideways, sign*width),
                                             (0, 0, -length*math.sin(fold)*edge)))))
        outer = first+len(points)
        for row in range(len(points)-1):
            start = round(teeth*row/(len(points)-1))
            end = round(teeth*(row+1)/(len(points)-1))
            edge = range(outer+2*start, outer+2*end+1)
            polygon = [first+row, first+row+1, *reversed(list(edge))]
            section_faces = triangulate_blade(vertices, polygon)
            faces.extend(section_faces)
            indices.extend([material_index]*len(section_faces))
    model.add(name+' leaflets', vertices, faces, [material, LEAF_SHADES[material]], indices)


def fronds(model, spec):
    rng = random.Random(spec['seed'])
    root = add(trunk_center(spec, spec['trunk']-.045), (*spec['crown_offset'], 0))
    for index in range(spec['mature']+2):
        young = index >= spec['mature']
        direction = math.pi*(index-spec['mature'])+1.15 if young else math.tau*index/spec['mature']
        angle = direction+.13+rng.uniform(-.055, .055)
        reach = spec['reach']*rng.uniform(.97, 1.03)*(.70 if young else 1)
        lift = (spec['young_lift'] if young else spec['lift'])*rng.uniform(.98, 1.02)
        drop = (spec['young_drop'] if young else spec['drop'])*rng.uniform(.98, 1.02)
        if not young:
            drop *= (1.10, 1.00, .86)[index % 3]
        twist = rng.uniform(-math.radians(4), math.radians(4))
        teeth = 22
        arc_side = rng.uniform(-.035, .035)*spec['reach']
        points = []
        for t in (0, 1/3, 2/3, 1):
            along = reach*t
            side = arc_side*math.sin(math.pi*t)
            points.append((root[0]+along*math.cos(angle)-side*math.sin(angle)+spec['drift'][0]*t,
                           root[1]+along*math.sin(angle)+side*math.cos(angle)+spec['drift'][1]*t,
                           root[2]+lift*t-drop*t*t))
        name = f'Frond | {index+1:02d}'
        material = LEAVES[index % len(LEAVES)]
        midrib(model, name, points, .018 if spec['trunk'] > 2 else .013, material)
        leaflets(model, name, points, angle, twist, teeth, spec['leaf']*(.85 if young else 1), material)


def coconut(model, name, center, radius):
    """A low-poly, softly oval fruit; poles and intermediate rings share edges."""
    segments = 8
    vertices = [add(center, (0, 0, -radius*1.15))]
    for latitude in (-math.pi/4, 0, math.pi/4):
        for i in range(segments):
            angle = math.tau*i/segments
            vertices.append(add(center, (radius*math.cos(latitude)*math.cos(angle),
                                         radius*math.cos(latitude)*math.sin(angle),
                                         radius*1.15*math.sin(latitude))))
    vertices.append(add(center, (0, 0, radius*1.15)))
    faces = [(0, 1+(i+1) % segments, 1+i) for i in range(segments)]
    for row in range(2):
        a, b = 1+row*segments, 1+(row+1)*segments
        faces.extend((a+i, a+(i+1) % segments, b+(i+1) % segments, b+i) for i in range(segments))
    last, top = 1+2*segments, len(vertices)-1
    faces.extend((last+i, last+(i+1) % segments, top) for i in range(segments))
    model.add(name, vertices, faces, HUSK, smooth=True)


def coconuts(model, spec):
    for i in range(spec['coconuts']):
        angle = math.tau*i/spec['coconuts']
        center = trunk_center(spec, spec['trunk']-.115-.012*(i % 2))
        center = add(center, (.125*math.cos(angle), .125*math.sin(angle), 0))
        coconut(model, f'Coconut | {i+1:02d}', center, .09)


def build_model(name):
    if name not in SPECS:
        raise ValueError('Unknown palm: '+name)
    spec = SPECS[name]
    model = Model()
    trunk(model, spec)
    fronds(model, spec)
    coconuts(model, spec)
    if model.triangle_count() > spec['budget']:
        raise ValueError(f"{name}: triangle budget exceeded ({model.triangle_count()})")
    return model


def low_view(model):
    """Return a chair-height camera and a lens fitting the actual crown vertices."""
    trunk_part = next(part for part in model.meshes if part.name == 'Trunk | banded')
    top = tuple(sum(v[i] for v in trunk_part.vertices[-8:])/8 for i in range(3))
    crown = [v for part in model.meshes if part.name.startswith(('Frond |', 'Coconut |')) for v in part.vertices]
    span = max(max(v[i] for v in crown)-min(v[i] for v in crown) for i in (0, 1))
    eye = (top[0]+.72*span, top[1]-.96*span, min(.70, top[2]-.25))
    target = (top[0], top[1], top[2]+.06)
    forward = normalize(tuple(target[i]-eye[i] for i in range(3)))
    right = normalize(cross(forward, (0, 0, 1)))
    up = cross(right, forward)
    ratios = []
    for vertex in crown:
        relative = tuple(vertex[i]-eye[i] for i in range(3))
        depth = dot(relative, forward)
        ratios.append(max(abs(dot(relative, right))/depth, 4*abs(dot(relative, up))/(3*depth)))
    return eye, target, .4*36/max(ratios)


def render_low_view(bpy, model, output):
    from mathutils import Vector
    eye, target, lens = low_view(model)
    scene = bpy.context.scene
    camera = scene.camera
    camera.name = 'Studio | chair height camera'
    camera.location = eye
    camera.rotation_euler = (Vector(target)-Vector(eye)).to_track_quat('-Z', 'Y').to_euler()
    camera.data.type = 'PERSP'
    camera.data.sensor_fit = 'HORIZONTAL'
    camera.data.sensor_width = 36
    camera.data.lens = lens
    scene.render.filepath = str(output)
    bpy.ops.render.render(write_still=True)


def write_model(name):
    import bpy
    model = build_model(name)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    materials = {key: blender_material(bpy, key, rgb) for key, rgb in model.materials.items()}
    for material_name, material in materials.items():
        if material_name.startswith('Leaf |'):
            material.use_backface_culling = False  # glTF exports these surfaces as double-sided.
    if HUSK in materials:
        materials[HUSK].node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value = .83
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
        coords.extend(tuple(obj.matrix_world @ v.co) for v in mesh.vertices)
        evaluated.to_mesh_clear()
    bounds = [[min(v[i] for v in coords), max(v[i] for v in coords)] for i in range(3)]
    print('MODEL_STATS '+json.dumps(dict(id=name, triangles=triangles, bounds=bounds,
                                         materials={key: [*rgb, 1] for key, rgb in model.materials.items()})), flush=True)
    if triangles != model.triangle_count() or triangles > SPECS[name]['budget']:
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
    render_low_view(bpy, model, target / (name+'-low.png'))


def main():
    args = sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
    if len(args) != 1 or args[0] not in (*SPECS, 'all'):
        raise SystemExit('usage: -- <palm|palm2|all>')
    for name in (SPECS if args[0] == 'all' else args):
        write_model(name)


if __name__ == '__main__':
    main()
