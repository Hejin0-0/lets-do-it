"""Build original garden plants and their Blender review renders.

From projects/rubber-duck-pool, with Blender 4.0 or newer:
    blender -b --factory-startup --python-exit-code 1 -P tools/create_garden_plants.py -- all
Use shrub, shrub2, flowerbush or oleander in place of all for one model.
The model builders use only Python; Blender is imported only for export.
"""
import json
import math
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from create_beach_props import Model as BeachModel, add_studio, blender_material, cross, normalize

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/02_models/props'
SPECS = {
    'shrub': ((.50, .50, .37), 1150),
    'shrub2': ((.43, .43, .30), 950),
    'flowerbush': ((.48, .48, .39), 1850),
    'oleander': ((.40, .40, .52), 2000),
}
COLORS = {
    'Leaf | deep forest green': (.10, .24, .09),
    'Leaf | garden green': (.14, .31, .12),
    'Leaf | sunlit forest green': (.20, .39, .16),
    'Leaf | deep olive green': (.24, .32, .08),
    'Leaf | yellow green': (.36, .46, .12),
    'Leaf | sunlit yellow green': (.47, .55, .19),
    'Leaf | deep meadow green': (.12, .28, .10),
    'Leaf | meadow green': (.18, .36, .14),
    'Leaf | sunlit meadow green': (.25, .43, .19),
    'Leaf | dark olive green stem': (.19, .29, .10),
    'Leaf | oleander deep green': (.12, .29, .13),
    'Leaf | oleander green': (.19, .38, .18),
    'Leaf | oleander light green': (.27, .45, .22),
    'Leaf | bloom': (.96, .955, .93),
    'Leaf | bloom centre': (1.0, .70, .16),
}
FOREST = ['Leaf | deep forest green', 'Leaf | garden green', 'Leaf | sunlit forest green']
OLIVE = ['Leaf | deep olive green', 'Leaf | yellow green', 'Leaf | sunlit yellow green']
MEADOW = ['Leaf | deep meadow green', 'Leaf | meadow green', 'Leaf | sunlit meadow green']
OLEANDER = ['Leaf | oleander deep green', 'Leaf | oleander green', 'Leaf | oleander light green']
BLOOM = 'Leaf | bloom'
CENTRE = 'Leaf | bloom centre'


class Model(BeachModel):
    @property
    def materials(self):
        return {name: COLORS[name] for part in self.meshes for name in part.materials}


def add(a, b):
    return tuple(a[i] + b[i] for i in range(3))


def scale(v, amount):
    return tuple(x * amount for x in v)


def dot(a, b):
    return sum(a[i] * b[i] for i in range(3))


def frame(normal):
    normal = normalize(normal)
    reference = (0, 0, 1) if abs(normal[2]) < .9 else (0, 1, 0)
    across = normalize(cross(reference, normal))
    return across, cross(normal, across), normal


def clump(model, center, radii, colors, seed, segments=16, rings=4, shade=1):
    """A separate, smoothly shaded crown with gentle, irregular bumps."""
    cx, cy, cz = center
    rx, ry, rz = radii
    vertices = [(cx, cy, cz-rz)]
    for j in range(rings):
        latitude = -math.pi/2 + math.pi*(j+1)/(rings+1)
        for i in range(segments):
            angle = math.tau*i/segments + .11*seed
            ripple = 1 + .045*math.sin(3*angle + .7*seed + .25*latitude)
            ripple += .018*math.sin(2*angle - .5*seed - .4*latitude)
            radial = math.cos(latitude)*ripple
            vertices.append((cx + rx*radial*math.cos(angle), cy + ry*radial*math.sin(angle),
                             cz + rz*math.sin(latitude)))
    top = len(vertices)
    vertices.append((cx, cy, cz+rz))
    faces = []
    for i in range(segments):
        faces.append((0, 1+(i+1)%segments, 1+i))
    for j in range(rings-1):
        a, b = 1+j*segments, 1+(j+1)*segments
        for i in range(segments):
            faces.append((a+i, a+(i+1)%segments, b+(i+1)%segments, b+i))
    last = 1+(rings-1)*segments
    for i in range(segments):
        faces.append((top, last+i, last+(i+1)%segments))
    model.add('Foliage | scalloped leaf cluster', vertices, faces, colors[shade], smooth=True)


def stem(model, name, points, radii, material, segments=6):
    """Tapered, closed rings on an upright stem."""
    vertices = [(x+r*math.cos(math.tau*i/segments), y+r*math.sin(math.tau*i/segments), z)
                for (x, y, z), r in zip(points, radii) for i in range(segments)]
    faces = []
    for j in range(len(points)-1):
        for i in range(segments):
            k = (i+1)%segments
            faces.append((j*segments+i, j*segments+k, (j+1)*segments+k, (j+1)*segments+i))
    faces.extend([tuple(reversed(range(segments))),
                  tuple((len(points)-1)*segments+i for i in range(segments))])
    model.add(name, vertices, faces, material, smooth=True)


def leaf(model, start, end, width, material):
    """A narrow, gently folded closed leaf, with a visible underside."""
    direction = tuple(end[i]-start[i] for i in range(3))
    side, normal, _ = frame(direction)
    vertices = [start]
    for along, across in ((.32, 1), (.72, .70)):
        vertices.append(add(add(start, scale(direction, along)), scale(side, width*across)))
    vertices.append(add(end, scale(normal, width*.10)))
    for along, across in ((.72, -.70), (.32, -1)):
        vertices.append(add(add(start, scale(direction, along)), scale(side, width*across)))
    middle = add(start, scale(direction, .52))
    vertices.extend([add(middle, scale(normal, width*.18)), add(middle, scale(normal, -width*.12))])
    faces = [(6, (i+1)%6, i) for i in range(6)]
    faces.extend((7, i, (i+1)%6) for i in range(6))
    model.add('Foliage | folded leaf', vertices, faces, material, smooth=True)


def flower(model, center, normal, radius, twist=0, *, simple=False):
    """Five petals with one shared tint material; simple flowers use fewer triangles."""
    u, v, n = frame(normal)

    def point(radial, lateral, height, angle):
        r = add(scale(u, math.cos(angle)), scale(v, math.sin(angle)))
        t = add(scale(u, -math.sin(angle)), scale(v, math.cos(angle)))
        return add(center, add(scale(r, radial*radius), add(scale(t, lateral*radius), scale(n, height*radius))))

    vertices, faces = [], []
    outline = ((.12, 0, -.05), (.48, -.30, .02), (.82, -.24, .14),
               (1, 0, .21), (.82, .24, .14), (.48, .30, .02))
    if simple:
        outline = ((.12, 0, -.07), (.62, -.34, .03), (.97, -.20, .17),
                   (.97, .20, .17), (.62, .34, .03))
    for i in range(5):
        angle = twist + math.tau*i/5
        base = len(vertices)
        vertices.extend(point(*p, angle) for p in outline)
        if simple:
            faces.append(tuple(base+j for j in range(len(outline))))
        else:
            vertices.append(point(.56, 0, .055, angle))
            faces.extend((base+6, base+j, base+(j+1)%6) for j in range(6))
    model.add('Flower | five broad petals' if simple else 'Flower | five cupped petals',
              vertices, faces, BLOOM, smooth=True)
    vertices = [] if simple else [add(center, scale(n, radius*.045))]
    vertices.extend(point(.16, 0, .045, twist + math.tau*i/5) for i in range(5))
    faces = [(0, 1, 2), (0, 2, 3), (0, 3, 4)] if simple else [
        (0, 1+i, 1+(i+1)%5) for i in range(5)]
    model.add('Flower | warm centre', vertices, faces, CENTRE)


def bud(model, center, normal, width, height):
    u, v, n = frame(normal)
    vertices = [add(center, scale(n, -height*.12))]
    vertices.extend(add(add(center, scale(n, height*.35)),
                        add(scale(u, width*math.cos(math.tau*i/4)),
                            scale(v, width*math.sin(math.tau*i/4)))) for i in range(4))
    vertices.append(add(center, scale(n, height)))
    faces = [(0, 1+(i+1)%4, 1+i) for i in range(4)]
    faces.extend((5, 1+i, 1+(i+1)%4) for i in range(4))
    model.add('Flower | unopened bud', vertices, faces, BLOOM, smooth=True)


def ray_triangle(origin, direction, a, b, c):
    """Distance to a triangle along a ray, or None."""
    edge1 = tuple(b[i]-a[i] for i in range(3))
    edge2 = tuple(c[i]-a[i] for i in range(3))
    p = cross(direction, edge2)
    determinant = dot(edge1, p)
    if abs(determinant) < 1e-12:
        return None
    offset = tuple(origin[i]-a[i] for i in range(3))
    x = dot(offset, p)/determinant
    if x < 0 or x > 1:
        return None
    q = cross(offset, edge1)
    y = dot(direction, q)/determinant
    if y < 0 or x+y > 1:
        return None
    distance = dot(edge2, q)/determinant
    return distance if distance > 0 else None


def foliage_surface(parts, direction):
    """Last ray hit on the actual foliage keeps flowers on the outside of the bush."""
    origin = (0, 0, .14)
    hits = (ray_triangle(origin, direction, *(part.vertices[i] for i in face))
            for part in parts for face in part.faces)
    distance = max((hit for hit in hits if hit is not None), default=0)
    if not distance:
        raise ValueError('Flower direction did not intersect foliage')
    return add(origin, scale(direction, distance))


def shrub(model):
    for i in range(9):
        angle = math.tau*i/9 + .13 + .05*math.sin(i*2.1)
        reach = .140 + .010*math.sin(i*2.3)
        radius = .071 + .010*math.sin(i*1.7)
        height = .069 + .008*math.cos(i*1.9)
        clump(model, (reach*math.cos(angle), reach*math.sin(angle), height),
              (radius, radius*(.92+.06*math.cos(i)), height), FOREST, i,
              segments=10, rings=3)
    for i in range(7):
        angle = math.tau*i/7 + .37
        reach = .078 + .012*math.sin(i*1.8)
        radius = .071 + .009*math.cos(i*2.0)
        height = .069 + .008*math.sin(i*2.4)
        clump(model, (reach*math.cos(angle), reach*math.sin(angle), .16+.01*math.cos(i)),
              (radius, radius*(.91+.06*math.sin(i)), height), FOREST, i+9,
              segments=9, rings=4, shade=2)
    clump(model, (0, 0, .185), (.075, .070, .075), FOREST, 16,
          segments=9, rings=4, shade=2)


def shrub2(model):
    for i in range(8):
        angle = math.tau*i/8 + .22 + .04*math.sin(i*1.7)
        reach = .125 + .006*math.sin(i*2.3)
        radius = .064 + .004*math.sin(i*1.9)
        height = .060 + .005*math.cos(i*2.1)
        clump(model, (reach*math.cos(angle), reach*math.sin(angle), height),
              (radius, radius*(.90+.08*math.cos(i)), height), OLIVE, i,
              segments=9, rings=3)
    for i in range(3):
        angle = math.tau*i/3 + .42
        radius = .070 + .004*math.sin(i*2.0)
        clump(model, (.040*math.cos(angle), .040*math.sin(angle), .090+.004*math.cos(i)),
              (radius, radius*.92, .083+.004*math.sin(i)), OLIVE, i+8,
              segments=10, rings=4, shade=2)
    for i in range(4):
        angle = math.tau*i/4 + .73
        radial = (math.cos(angle), math.sin(angle), 0)
        start = (.070*radial[0], .070*radial[1], .115)
        end = (.174*radial[0], .174*radial[1], .205+.009*math.sin(i))
        stem(model, 'Sprig | short green stem', [start, end], [.004, .0025], OLIVE[0], segments=5)
        for j in range(3):
            p = add(start, scale(tuple(end[k]-start[k] for k in range(3)), .50+.20*j))
            a = angle + (j-1)*.80
            tip = add(p, (.045*math.cos(a), .045*math.sin(a), .028+.005*j))
            leaf(model, p, tip, .010, OLIVE[1+(i+j)%2])


def blossom_direction(azimuth, elevation, x, y):
    a, e = math.radians(azimuth), math.radians(elevation)
    out = (math.cos(e)*math.cos(a), math.cos(e)*math.sin(a), math.sin(e))
    across = (-math.sin(a), math.cos(a), 0)
    up = (-math.sin(e)*math.cos(a), -math.sin(e)*math.sin(a), math.cos(e))
    return normalize(add(out, add(scale(across, x), scale(up, y))))


def flowerbush(model):
    clump(model, (0, 0, .14), (.135, .135, .14), MEADOW, 0, segments=12, rings=5)
    for i in range(7):
        angle = math.tau*i/7 + .1
        rz = .115+.008*math.sin(i*1.9)
        clump(model, (.104*math.cos(angle), .104*math.sin(angle), rz),
              (.122, .120, rz), MEADOW, i+1, segments=12, rings=5)
    for i in range(2):
        sign = 1 if i else -1
        clump(model, (sign*.055, -sign*.018, .205), (.115, .115, .14),
              MEADOW, i+8, segments=12, rings=5, shade=2)
    foliage = list(model.meshes)
    groups = [(-150, 36), (-90, 38), (-30, 36), (30, 38), (90, 36), (150, 38), (0, 88)]
    for group, (azimuth, elevation) in enumerate(groups):
        count = 5 if group in (1, 4) else 4
        for i in range(count):
            angle = math.tau*i/count + .2*group
            x, y = .18*math.cos(angle), .18*math.sin(angle)
            direction = blossom_direction(azimuth, elevation, x, y)
            center = add(foliage_surface(foliage, direction), scale(direction, .010))
            flower(model, center, direction, .0364 + .00025*((group+i)%3),
                   .27*group+.14*i, simple=True)


def oleander(model):
    for i in range(6):
        angle = math.tau*(i-1)/5 + .24 if i else .50
        reach = .104 if i else .008
        height = .400 + .016*math.sin(i*2.3)
        radial = (math.cos(angle), math.sin(angle), 0)
        root = (.008*radial[0], .008*radial[1], 0)
        middle = (reach*.43*radial[0], reach*.43*radial[1], height*.52)
        tip = (reach*radial[0], reach*radial[1], height)
        stem(model, 'Oleander | upright green stem', [root, middle, tip], [.006, .0045, .003],
             'Leaf | dark olive green stem')
        for level in range(4):
            t = .18 + .17*level
            base = (reach*t*radial[0], reach*t*radial[1], height*t)
            for j in range(3):
                a = angle + math.tau*j/3 + level*.58 + i*.15
                distance = .063 + .008*math.sin(i*1.7+level+j)
                end = add(base, (distance*math.cos(a), distance*math.sin(a), .066+.010*((level+j)%3)))
                leaf(model, base, end, .0105+.001*((i+j)%3), OLEANDER[(i+level+j)%3])
        flower(model, add(tip, (0, 0, .012)), (0, 0, 1), .021, i*.37)
        for j in range(3):
            a = angle + math.tau*j/3
            normal = normalize((.63*math.cos(a), .63*math.sin(a), .78))
            center = add(tip, (.022*math.cos(a), .022*math.sin(a), .006))
            flower(model, center, normal, .020, .3*j+.2*i)
        a = angle + 1.05
        normal = normalize((.45*math.cos(a), .45*math.sin(a), .89))
        bud(model, add(tip, (.024*math.cos(a), .024*math.sin(a), -.002)), normal, .0045, .013)


def flower_triangle_count(model):
    return sum(1 for part in model.meshes for index in part.face_materials
               if part.materials[index] in (BLOOM, CENTRE))


def build_model(name):
    builders = {'shrub': shrub, 'shrub2': shrub2, 'flowerbush': flowerbush, 'oleander': oleander}
    if name not in builders:
        raise ValueError('Unknown garden plant: ' + name)
    model = Model()
    builders[name](model)
    dimensions, budget = SPECS[name]
    model.fit(dimensions)
    triangles = model.triangle_count()
    if triangles > budget:
        raise ValueError(f'{name}: triangle budget exceeded ({triangles} > {budget})')
    if name == 'flowerbush' and 5*flower_triangle_count(model) > 2*triangles:
        raise ValueError('flowerbush: flower triangles exceed 40% of the model')
    return model


def write_model(name):
    import bpy
    model = build_model(name)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    materials = {key: blender_material(bpy, key, rgb) for key, rgb in model.materials.items()}
    objects = []
    for part in model.meshes:
        data = bpy.data.meshes.new(part.name)
        data.from_pydata(part.vertices, [], part.faces)
        data.update()
        obj = bpy.data.objects.new(part.name, data)
        bpy.context.collection.objects.link(obj)
        for material in part.materials:
            data.materials.append(materials[material])
        for poly, index in zip(data.polygons, part.face_materials):
            poly.material_index = index
            poly.use_smooth = part.smooth
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
    print('MODEL_STATS ' + json.dumps(dict(id=name, triangles=triangles, triangle_limit=SPECS[name][1],
                                          flower_triangles=flower_triangle_count(model), bounds=bounds,
                                          materials={key: [*rgb, 1] for key, rgb in model.materials.items()})), flush=True)
    if triangles != model.triangle_count() or triangles > SPECS[name][1]:
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
        raise SystemExit('usage: -- <shrub|shrub2|flowerbush|oleander|all>')
    for name in (SPECS if args[0] == 'all' else args):
        write_model(name)


if __name__ == '__main__':
    main()
