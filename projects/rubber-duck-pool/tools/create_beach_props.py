"""Build four original, low-poly beach props and their Blender review renders.

Run from any directory with Blender 4.0 or newer:
    blender -b --factory-startup --python-exit-code 1 -P tools/create_beach_props.py -- all
Replace ``all`` with sandcastle, shell, starfish, or driftwood for one prop.
The geometry builders use only Python, so their dimensions and triangle budgets
can also be checked without importing Blender.
"""
from dataclasses import dataclass
import json
import math
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/02_models/props'
SPECS = {
    'sandcastle': ((.36, .33, .33), 6000),
    'shell': ((.045, .075, .02), 600),
    'starfish': ((.11, .12, .028), 900),
    'driftwood': ((.71, .18, .07), 2500),
}
COLORS = {
    'Sand | damp golden sand': (.60, .43, .25),
    'Sand | dark wet sand': (.43, .29, .17),
    'Shell | warm peach': (.91, .60, .48),
    'Shell | pale peach': (.96, .76, .64),
    'Shell | soft cream': (.97, .89, .75),
    'Wood | flag stick': (.38, .28, .18),
    'Canvas | sea green flag': (.16, .55, .48),
    'Paint | coral orange': (.81, .30, .15),
    'Paint | sunlit coral': (.92, .43, .23),
    'Paint | pale coral underside': (.93, .65, .46),
    'Wood | silver grey driftwood': (.55, .54, .49),
    'Wood | pale weathered grain': (.66, .65, .59),
    'Wood | recessed grey grain': (.41, .40, .36),
    'Wood | warm exposed core': (.65, .49, .32),
}


@dataclass
class Part:
    name: str
    vertices: list
    faces: list
    materials: list
    face_materials: list
    smooth: bool = False


class Model:
    def __init__(self):
        self.meshes = []

    @property
    def materials(self):
        return {name: COLORS[name] for part in self.meshes for name in part.materials}

    def add(self, name, vertices, polygons, materials, indices=None, smooth=False):
        if isinstance(materials, str):
            materials = [materials]
        triangles, triangle_materials = [], []
        for i, polygon in enumerate(polygons):
            for j in range(1, len(polygon) - 1):
                triangles.append((polygon[0], polygon[j], polygon[j + 1]))
                triangle_materials.append(indices[i] if indices is not None else 0)
        self.meshes.append(Part(name, list(vertices), triangles, list(materials), triangle_materials, smooth))

    def triangle_count(self):
        return sum(len(part.faces) for part in self.meshes)

    def fit(self, dimensions):
        vertices = [v for part in self.meshes for v in part.vertices]
        lows = [min(v[i] for v in vertices) for i in range(3)]
        highs = [max(v[i] for v in vertices) for i in range(3)]
        centers = [(lows[i] + highs[i]) / 2 if i < 2 else lows[i] for i in range(3)]
        scales = [dimensions[i] / (highs[i] - lows[i]) for i in range(3)]
        for part in self.meshes:
            part.vertices = [tuple((v[i] - centers[i]) * scales[i] for i in range(3)) for v in part.vertices]


def box(model, name, center, size, material):
    x, y, z = center
    a, b, c = (v / 2 for v in size)
    vertices = [(x-a, y-b, z-c), (x+a, y-b, z-c), (x+a, y+b, z-c), (x-a, y+b, z-c),
                (x-a, y-b, z+c), (x+a, y-b, z+c), (x+a, y+b, z+c), (x-a, y+b, z+c)]
    faces = [(3, 2, 1, 0), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7), (4, 5, 6, 7)]
    model.add(name, vertices, faces, material)


def cylinder(model, name, center, profile, segments, materials, band_indices=None):
    """Stack circular rings; profile entries are (height, radius)."""
    x, y, z = center
    vertices = [(x + r * math.cos(math.tau*i/segments), y + r * math.sin(math.tau*i/segments), z + h)
                for h, r in profile for i in range(segments)]
    faces, indices = [], []
    for j in range(len(profile) - 1):
        for i in range(segments):
            k = (i + 1) % segments
            faces.append((j*segments+i, j*segments+k, (j+1)*segments+k, (j+1)*segments+i))
            indices.append(band_indices[j] if band_indices else 0)
    faces += [tuple(reversed(range(segments))), tuple((len(profile)-1)*segments+i for i in range(segments))]
    indices += [0, 0]
    model.add(name, vertices, faces, materials, indices, smooth=True)


def mound(model):
    n = 40
    # The low middle ring is the scraped moat; the raised lip is outside it.
    rings = [(.52, .020), (.79, .020), (.83, .017), (.86, .006),
             (.90, .007), (.94, .015), (.97, .010), (1, .002)]
    vertices = [(0, 0, .020)]
    for radius, height in rings:
        for i in range(n):
            a = math.tau*i/n
            wave = 1 + .012*math.sin(3*a+.2) + .008*math.sin(7*a)
            vertices.append((.18*radius*wave*math.cos(a), .165*radius*wave*math.sin(a), height))
    bottom = len(vertices)
    vertices += [(vertices[1+(len(rings)-1)*n+i][0], vertices[1+(len(rings)-1)*n+i][1], 0) for i in range(n)]
    center = len(vertices)
    vertices.append((0, 0, 0))
    faces = [(0, 1+i, 1+(i+1)%n) for i in range(n)]
    for j in range(len(rings)-1):
        a, b = 1+j*n, 1+(j+1)*n
        faces += [(a+i, b+i, b+(i+1)%n, a+(i+1)%n) for i in range(n)]
    outer = 1+(len(rings)-1)*n
    faces += [(outer+i, bottom+i, bottom+(i+1)%n, outer+(i+1)%n) for i in range(n)]
    faces += [(center, bottom+(i+1)%n, bottom+i) for i in range(n)]
    model.add('Castle | moat and mound', vertices, faces, 'Sand | dark wet sand', smooth=True)


def merlon(model, name, x, y, radius, angle, z, height, width):
    # Each roughly hand-cut merlon is an annular wedge, not a perfect cube.
    vertices = []
    for h in (0, height):
        for r, a in ((radius*.68, angle-width), (radius, angle-width),
                     (radius, angle+width), (radius*.68, angle+width)):
            vertices.append((x+r*math.cos(a), y+r*math.sin(a), z+h))
    faces = [(3, 2, 1, 0), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7), (4, 5, 6, 7)]
    model.add(name, vertices, faces, 'Sand | damp golden sand')


def tower(model, name, x, y, radius, height, number):
    base = .017
    profile = [(0, radius*1.04), (.006, radius*1.04), (.009, radius*.98),
               (.013, radius*1.02), (.017, radius*.96),
               (height-.008, radius*.90), (height-.004, radius*.94), (height, radius*.94)]
    cylinder(model, name + ' | tapered pail imprint', (x, y, base), profile, 24,
             ['Sand | damp golden sand', 'Sand | dark wet sand'], [1, 1, 1, 0, 0, 0, 0])
    for i in range(number):
        angle = math.tau*i/number + .025*math.sin(i*2.3+x*40)
        h = .014 + .004*(.5 + .5*math.sin(i*2.1+y*23))
        merlon(model, name + ' | uneven merlon', x, y, radius*.91, angle,
               base+height-.001, h, .27 + .025*math.sin(i*1.7))


def gate_wall(model):
    # Piers and the voussoirs above a semicircular opening are genuine geometry;
    # there is no dark painted rectangle pretending to be a doorway.
    y0, y1, z0, top = -.091, -.073, .019, .125
    radius, spring = .022, .070
    vertices, faces = [], []
    def prism(x0, x1, low0, low1):
        i = len(vertices)
        vertices.extend([(x0,y0,low0), (x1,y0,low1), (x1,y0,top), (x0,y0,top),
                         (x0,y1,low0), (x1,y1,low1), (x1,y1,top), (x0,y1,top)])
        faces.extend([tuple(i+k for k in f) for f in
                     ((0,1,2,3), (7,6,5,4), (0,4,5,1), (3,2,6,7), (0,3,7,4), (1,5,6,2))])
    prism(-.10, -radius, z0, z0)
    prism(radius, .10, z0, z0)
    # Equal x steps keep the arch smooth without a Boolean modifier.
    xs = [-radius + 2*radius*i/10 for i in range(11)]
    for a, b in zip(xs, xs[1:]):
        za = spring + math.sqrt(max(0, radius*radius-a*a))
        zb = spring + math.sqrt(max(0, radius*radius-b*b))
        prism(a, b, za, zb)
    model.add('Castle | gate arch', vertices, faces, 'Sand | damp golden sand')


def pressed_shell(model, x, z):
    vertices = [(x, -.0915, z)]
    for i in range(11):
        angle = -math.pi/2 + math.pi*i/10
        vertices.append((x+.012*math.sin(angle), -.0918-.001*(i%2), z+.013*math.cos(angle)))
    model.add('Castle | pressed shell', vertices, [(0, i+1, i+2) for i in range(10)], 'Shell | soft cream')


def sandcastle(model):
    mound(model)
    castle_start = len(model.meshes)
    for x, y in ((-.10,-.080), (.10,-.080), (-.10,.080), (.10,.080)):
        tower(model, 'Castle | corner tower', x, y, .039, .128, 7)
    tower(model, 'Castle | central keep', 0, 0, .047, .182, 8)
    gate_wall(model)
    box(model, 'Castle | rear wall', (0,.080,.071), (.20,.018,.108), 'Sand | damp golden sand')
    for x in (-.10,.10):
        box(model, 'Castle | side wall', (x,0,.071), (.018,.16,.108), 'Sand | damp golden sand')
    for x in (-.069,-.045,.045,.069):
        box(model, 'Castle | wall battlement', (x,-.082,.132), (.014,.018,.015), 'Sand | damp golden sand')
        box(model, 'Castle | wall battlement', (x,.080,.132), (.014,.018,.015), 'Sand | damp golden sand')
    for x in (-.10,.10):
        for y in (-.05,-.025,0,.025,.05):
            box(model, 'Castle | wall battlement', (x,y,.132), (.018,.014,.015), 'Sand | damp golden sand')
    pressed_shell(model, -.059, .075)
    pressed_shell(model, .060, .075)
    cylinder(model, 'Castle | flag stick', (0,0,.196), [(0,.002), (.134,.0018)], 8, 'Wood | flag stick')
    vertices = []
    for j in range(4):
        for i in range(7):
            t, u = i/6, j/3
            vertices.append((.001+.054*t, -.001+.003*math.sin(math.pi*t)*math.sin(math.pi*u),
                             .326-.032*u-.004*t*t))
    faces = [(j*7+i, j*7+i+1, (j+1)*7+i+1, (j+1)*7+i) for j in range(3) for i in range(6)]
    model.add('Castle | cloth flag', vertices, faces, 'Canvas | sea green flag')
    # Leave a visible, continuous scraped moat around even the corner towers.
    for part in model.meshes[castle_start:]:
        part.vertices = [(x*.78, y*.78, z) for x,y,z in part.vertices]


def shell(model):
    segments, ribs = 64, 16
    radii = (.13, .36, .63, 1.0)
    hinge, half_angle = -.0375, 1.12
    vertices = [(0, hinge, 0)]
    for t in radii:
        for i in range(segments+1):
            angle = half_angle*(-1+2*i/segments)
            rib = math.cos(math.tau*ribs*i/segments-math.pi)
            radius = t*(1+.0035*t*t*rib)
            x = .0225*radius*math.sin(angle)/math.sin(half_angle)
            y = hinge+.075*radius*math.cos(angle)
            if i in (0, segments) or t == 1:
                z = 0
            else:
                dome = math.sin(math.pi*t**1.25)**.8
                across = math.sin(math.pi*i/segments)**.35
                z = .016*dome*across*(1+.12*rib)
            vertices.append((x, y, z))
    faces = [(0, i+2, i+1) for i in range(segments)]
    bands = [0]*segments
    for j in range(len(radii)-1):
        inner, outer = 1+j*(segments+1), 1+(j+1)*(segments+1)
        for i in range(segments):
            faces.append((inner+i, inner+i+1, outer+i+1, outer+i))
            bands.append((1, 0, 2)[j])
    colors = ['Shell | warm peach', 'Shell | pale peach', 'Shell | soft cream']
    model.add('Shell | domed ribbed fan', vertices, faces, colors, bands, smooth=True)

    outer = 1+(len(radii)-1)*(segments+1)
    perimeter = ([0] + [1+j*(segments+1) for j in range(len(radii))] +
                 [outer+i for i in range(1, segments+1)] +
                 [1+j*(segments+1)+segments for j in range(len(radii)-2, -1, -1)])
    underside = [(0, hinge+.024, 0)] + [vertices[i] for i in perimeter]
    faces = [(0, i+1, (i+1)%len(perimeter)+1) for i in range(len(perimeter))]
    model.add('Shell | flat underside', underside, faces, 'Shell | soft cream')

    for sign in (-1, 1):
        outline = [(0, hinge), (sign*.006, hinge+.001), (sign*.0045, hinge+.009)]
        ear = [(x, y, z) for z in (0, .00045) for x, y in outline]
        faces = [(2, 1, 0), (3, 4, 5), (0, 1, 4, 3), (1, 2, 5, 4), (2, 0, 3, 5)]
        if sign < 0:
            faces = [tuple(reversed(face)) for face in faces]
        model.add('Shell | triangular hinge ear', ear, faces, 'Shell | pale peach')


def star_radius(a):
    arm = (.5+.5*math.cos(5*a))**1.65
    return .020+.040*arm*(1+.06*math.sin(3*a+.3))


def star_height(fraction, a):
    arm = max(0, math.cos(5*a))
    distance = fraction*star_radius(a)
    disc = .014*math.exp(-(distance/.021)**2)
    ridge = .0065*arm**2*math.sqrt(max(0, math.sin(math.pi*fraction)))
    curl = .007*arm**8*fraction**8
    return .0015+disc+ridge+curl


def rounded_nub(model, center, radius, height):
    x, y, z = center
    segments = 5
    vertices = [(x, y, z-height*.5)]
    vertices += [(x+radius*math.cos(math.tau*i/segments), y+radius*math.sin(math.tau*i/segments), z)
                 for i in range(segments)]
    vertices.append((x, y, z+height))
    faces = ([(0, 1+(i+1)%segments, 1+i) for i in range(segments)] +
             [(segments+1, 1+i, 1+(i+1)%segments) for i in range(segments)])
    model.add('Starfish | rounded nub', vertices, faces, 'Paint | sunlit coral', smooth=True)


def starfish(model):
    n, rings = 50, 4
    vertices = [(0,0,star_height(0,0))]
    for j in range(1,rings+1):
        t = j/rings
        for i in range(n):
            a = math.tau*i/n
            r = t*star_radius(a)
            vertices.append((r*math.cos(a), r*math.sin(a), star_height(t,a)))
    faces = [(0,1+i,1+(i+1)%n) for i in range(n)]
    for j in range(rings-1):
        a, b = 1+j*n, 1+(j+1)*n
        faces += [(a+i,b+i,b+(i+1)%n,a+(i+1)%n) for i in range(n)]
    top_count = len(faces)
    outer = 1+(rings-1)*n
    lower = len(vertices)
    for i in range(n):
        x, y, _ = vertices[outer+i]
        arm = max(0, math.cos(5*math.tau*i/n))
        vertices.append((.90*x, .90*y, .0003+.0035*arm**8))
    bottom = len(vertices)
    vertices.append((0, 0, 0))
    faces += [(outer+i, lower+i, lower+(i+1)%n, outer+(i+1)%n) for i in range(n)]
    faces += [(bottom, lower+(i+1)%n, lower+i) for i in range(n)]
    materials = ['Paint | coral orange', 'Paint | pale coral underside']
    model.add('Starfish | rounded body and underside', vertices, faces, materials,
              [0]*top_count+[1]*(2*n), smooth=True)

    for arm in range(5):
        angle = math.tau*arm/5
        for i in range(7):
            fraction = .32+.09*i
            r = fraction*star_radius(angle)
            low = int(fraction*rings)
            blend = fraction*rings-low
            z = (1-blend)*star_height(low/rings, angle)+blend*star_height((low+1)/rings, angle)
            rounded_nub(model, (r*math.cos(angle), r*math.sin(angle), z),
                        .0014*(1-.35*i/6), .0011*(1-.35*i/6))


def normalize(v):
    length = math.sqrt(sum(x*x for x in v))
    return tuple(x/length for x in v)


def cross(a, b):
    return (a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0])


def wood_limb(model, name, points, radii, fork_side=0):
    # Long shallow radial grooves run continuously with the curved limb.
    n = 16
    vertices = []
    for j, point in enumerate(points):
        prev, after = points[max(0,j-1)], points[min(len(points)-1,j+1)]
        tangent = normalize(tuple(after[k]-prev[k] for k in range(3)))
        across = normalize(cross((0,0,1), tangent))
        up = cross(tangent, across)
        for i in range(n):
            angle = math.tau*i/n
            groove = .93+.07*math.cos(5*angle+.25*math.sin(point[0]*13))
            vertices.append(tuple(point[k]+radii[j]*groove*(across[k]*math.cos(angle)+up[k]*math.sin(angle)) for k in range(3)))
    faces, indices = [], []
    for j in range(len(points)-1):
        for i in range(n):
            faces.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
            mid = math.tau*(i+.5)/n
            if fork_side and fork_side*math.cos(mid) < -.38:
                indices.append(3)
            else:
                indices.append(2 if i in (1,4,7,10,13) else (1 if i in (2,8) else 0))
    faces.extend([tuple(reversed(range(n))), tuple((len(points)-1)*n+i for i in range(n))])
    indices.extend([3,3])
    model.add(name, vertices, faces,
              ['Wood | silver grey driftwood', 'Wood | pale weathered grain',
               'Wood | recessed grey grain', 'Wood | warm exposed core'], indices, smooth=True)


def driftwood(model):
    points = [(-.35,0,.032),(-.31,-.001,.034),(-.23,.003,.035),(-.14,.001,.034),
              (-.05,-.002,.035),(.04,0,.036),(.13,.002,.035),(.22,0,.034),(.29,0,.034)]
    wood_limb(model, 'Driftwood | grooved main limb', points, [.015,.022,.027,.029,.030,.029,.027,.025,.020])
    wood_limb(model, 'Driftwood | broken side stub',
              [(-.17,.012,.036),(-.14,.035,.039),(-.105,.068,.043),(-.095,.078,.043)], [.018,.015,.011,.009])
    wood_limb(model, 'Driftwood | short side stub',
              [(.075,-.012,.035),(.09,-.035,.039),(.11,-.060,.042)], [.015,.011,.008])
    for sign in (-1,1):
        wood_limb(model, 'Driftwood | split prong',
                  [(.25,sign*.009,.035),(.29,sign*.011,.035),(.325,sign*.015,.036),(.355,sign*.018,.036)],
                  [.013,.012,.010,.007], fork_side=sign)


def build_model(name):
    if name not in SPECS:
        raise ValueError('Unknown beach prop: ' + name)
    model = Model()
    {'sandcastle': sandcastle, 'shell': shell, 'starfish': starfish, 'driftwood': driftwood}[name](model)
    model.fit(SPECS[name][0])
    if model.triangle_count() > SPECS[name][1]:
        raise ValueError(f'{name}: triangle budget exceeded ({model.triangle_count()})')
    return model


def blender_material(bpy, name, rgb):
    material = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    material.diffuse_color = (*rgb, 1)
    material.use_nodes = True
    shader = material.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*rgb, 1)
    shader.inputs['Roughness'].default_value = .83 if name.startswith(('Sand |', 'Wood |', 'Canvas |')) else .57
    return material


def add_studio(bpy, coords, output):
    from mathutils import Vector
    scene = bpy.context.scene
    if scene.world is None:
        scene.world = bpy.data.worlds.new('Studio world')
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes.get('Background')
    background.inputs['Color'].default_value = (.20,.17,.15,1)
    background.inputs['Strength'].default_value = .8
    direction = Vector((1,-1.5,1.15)).normalized()
    rotation = (-direction).to_track_quat('-Z','Y')
    inverse = rotation.inverted()
    projected = [inverse @ Vector(c) for c in coords]
    low = [min(v[i] for v in projected) for i in range(3)]
    high = [max(v[i] for v in projected) for i in range(3)]
    center = rotation @ Vector(tuple((low[i]+high[i])/2 for i in range(3)))
    span = max(high[i]-low[i] for i in range(3))
    for name, offset, intensity, size in (
        ('Studio | key', (-2,-3,4), 230, 3.0),
        ('Studio | fill', (3,2,2.5), 65, 4.0),
    ):
        data = bpy.data.lights.new(name, 'AREA')
        data.energy = intensity*span*span
        data.shape = 'DISK'
        data.size = size*span
        obj = bpy.data.objects.new(name, data)
        bpy.context.collection.objects.link(obj)
        obj.location = center + Vector(offset)*span
        obj.rotation_euler = (center-obj.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.object.camera_add(location=center+direction*span*5)
    camera = bpy.context.object
    camera.name = 'Studio | camera'
    camera.rotation_euler = rotation.to_euler()
    camera.data.type = 'ORTHO'
    camera.data.clip_start = max(.00001, span/1000)
    camera.data.clip_end = span*30
    camera.data.ortho_scale = max(high[0]-low[0], (high[1]-low[1])*800/600)/.8
    scene.camera = camera
    scene.view_settings.view_transform = 'AgX'
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 32
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = 800, 600
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.filepath = str(output)
    bpy.ops.render.render(write_still=True)


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
        for name_in_part in part.materials:
            data.materials.append(materials[name_in_part])
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
        coords.extend(tuple(obj.matrix_world @ v.co) for v in mesh.vertices)
        evaluated.to_mesh_clear()
    bounds = [[min(v[i] for v in coords), max(v[i] for v in coords)] for i in range(3)]
    print('MODEL_STATS ' + json.dumps(dict(id=name, triangles=triangles, bounds=bounds,
                                          materials={key: [*rgb,1] for key,rgb in model.materials.items()})), flush=True)
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
        raise SystemExit('usage: -- <sandcastle|shell|starfish|driftwood|all>')
    for name in (SPECS if args[0] == 'all' else args):
        write_model(name)


if __name__ == '__main__':
    main()
