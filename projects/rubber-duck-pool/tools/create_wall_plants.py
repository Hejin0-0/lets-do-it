"""Build original wall and potted plants, plus isolated review renders.

From any directory, with Blender 4.0 or newer:
    blender -b --factory-startup --python-exit-code 1 -P tools/create_wall_plants.py -- all
Replace ``all`` with bougain, potflower, or potshrub for one asset.  Geometry
uses ordinary Python; Blender is imported only when exporting and rendering.
The bougain origin is the wall's top edge: top at z=0, face at x=0, plant in +x.
"""
import json
import math
from pathlib import Path
import random
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from create_beach_props import Model as BeachModel, blender_material, box, cross, normalize
from create_garden_plants import clump

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/02_models/props'
SPECS = {'bougain': 2400, 'potflower': 1900, 'potshrub': 1500}
RENDER_SIZE = (800, 600)
LIGHTS = (
    ('Studio | key', (3,-3,4), 230, 3.0),
    ('Studio | fill', (-3,2,2.5), 65, 4.0),
)
COLORS = {
    'Plaster | terracotta': (.68, .34, .22),
    'Plaster | terracotta rim': (.59, .285, .18),
    'Plaster | pale wall': (.86, .84, .78),
    'Leaf | deep green': (.095, .245, .095),
    'Leaf | garden green': (.16, .34, .13),
    'Leaf | fresh green': (.22, .42, .17),
    'Leaf | sunlit green': (.30, .49, .22),
    # All petals and bracts share this neutral tintable base.
    'Leaf | bloom': (.97, .97, .96),
    'Leaf | bloom centre': (.92, .72, .34),
    'Wood | vine stem': (.31, .20, .10),
}


class Model(BeachModel):
    @property
    def materials(self):
        return {name: COLORS[name] for part in self.meshes for name in part.materials}


class Batch:
    """Keep many small, disconnected shapes in a single material mesh."""
    def __init__(self, name, material, smooth=True):
        self.name, self.material, self.smooth = name, material, smooth
        self.vertices, self.faces = [], []

    def add(self, vertices, faces):
        offset = len(self.vertices)
        self.vertices.extend(vertices)
        self.faces.extend(tuple(offset+i for i in face) for face in faces)

    def finish(self, model):
        if self.faces:
            model.add(self.name, self.vertices, self.faces, self.material, smooth=self.smooth)


def add(a, b):
    return tuple(a[i]+b[i] for i in range(3))


def scale(v, amount):
    return tuple(component*amount for component in v)


def frame(normal):
    normal = normalize(normal)
    reference = (0, 0, 1) if abs(normal[2]) < .9 else (0, 1, 0)
    u = normalize(cross(reference, normal))
    return u, cross(normal, u), normal


def local_point(origin, u, v, n, x, y, z):
    return tuple(origin[i] + u[i]*x + v[i]*y + n[i]*z for i in range(3))


def flower(batch, center, normal, radius, rotation):
    """Three closed, gently cupped bracts or petals meet inside the leaves."""
    u, v, n = frame(normal)
    vertices = [local_point(center, u, v, n, 0, 0, -.06*radius)]
    faces = []
    for petal in range(3):
        a = rotation + petal*math.tau/3
        radial = add(scale(u, math.cos(a)), scale(v, math.sin(a)))
        tangent = cross(n, radial)
        # The sides rise above the middle; the underside closes the thin cup.
        base = len(vertices)
        vertices.extend([
            local_point(center, radial, tangent, n, .52*radius, -.43*radius, .30*radius),
            local_point(center, radial, tangent, n, radius, 0, .42*radius),
            local_point(center, radial, tangent, n, .52*radius, .43*radius, .30*radius),
            local_point(center, radial, tangent, n, .53*radius, 0, .23*radius),
        ])
        a, b, c, middle = range(base, base+4)
        faces.extend([(middle,0,a), (middle,a,b), (middle,b,c), (middle,c,0),
                      (0,b,a), (0,c,b)])
    batch.add(vertices, faces)


def flower_centre(batch, center, normal, size):
    u, v, n = frame(normal)
    vertices = [add(center, scale(n, .28*size))]
    for i in range(3):
        angle = math.tau*i/3
        vertices.append(local_point(center, u, v, n, size*math.cos(angle), size*math.sin(angle), -.05*size))
    batch.add(vertices, [(0,1,2), (0,2,3), (0,3,1), (1,3,2)])


LEAF_MATERIALS = ('Leaf | deep green', 'Leaf | garden green', 'Leaf | fresh green')


def smoothstep(value):
    value = max(0, min(1, value))
    return value*value*(3-2*value)


def pot(model):
    """One shared, slightly flared terracotta profile with an integral rolled rim."""
    profile = [(0, .100), (.012, .112), (.237, .146), (.242, .158),
               (.248, .164), (.272, .165), (.280, .161), (.280, .146),
               (.273, .139), (.261, .138)]
    segments = 24
    vertices = [(r*math.cos(math.tau*i/segments), r*math.sin(math.tau*i/segments), z)
                for z, r in profile for i in range(segments)]
    faces, indices = [], []
    for row in range(len(profile)-1):
        for i in range(segments):
            j = (i+1)%segments
            faces.append((row*segments+i, row*segments+j, (row+1)*segments+j, (row+1)*segments+i))
            indices.append(0 if row < 2 else 1)
    faces.extend([tuple(reversed(range(segments))), tuple((len(profile)-1)*segments+i for i in range(segments))])
    indices.extend([0, 1])
    model.add('Pot | terracotta', vertices, faces,
              ['Plaster | terracotta', 'Plaster | terracotta rim'], indices, smooth=True)


def random_disc(rng, radius):
    angle = rng.uniform(0, math.tau)
    distance = radius*math.sqrt(rng.random())
    return distance*math.cos(angle), distance*math.sin(angle)


def flower_head(model, index, center, radius, rotation, centres, foliage):
    """Five broad cupped petals form one readable head on the actual leaves."""
    blooms = Batch('Bloom | head ' + str(index), 'Leaf | bloom')
    vertices = [(*center, .002)]
    faces = []
    for petal in range(5):
        angle = rotation + petal*math.tau/5
        radial = (math.cos(angle), math.sin(angle))
        side = (-radial[1], radial[0])

        def point(along, across, lift):
            x = center[0] + radius*(along*radial[0] + across*side[0])
            y = center[1] + radius*(along*radial[1] + across*side[1])
            return (x, y, lift)

        base = len(vertices)
        vertices.extend([point(.46, -.38, .004), point(.82, -.33, .007),
                         point(1, -.12, .008), point(1, .12, .008),
                         point(.82, .33, .007), point(.46, .38, .004)])
        middle = len(vertices)
        vertices.append(point(.64, 0, .005))
        outline = [0] + list(range(base, base+6))
        faces.extend((middle, outline[i], outline[(i+1)%len(outline)]) for i in range(len(outline)))
        faces.extend((0, base+i+1, base+i) for i in range(5))
    leaf_heights = [outer_surface(foliage, 2, x, y) for x, y, _ in vertices]
    base = max(height-point[2] for point, height in zip(vertices, leaf_heights)) + .001
    clearances = (base+point[2]-height for point, height in zip(vertices, leaf_heights))
    if base-leaf_heights[0] > .006 or max(clearances) > .018:
        raise ValueError('Flower head would float above the foliage')
    vertices = [(x, y, z+base) for x, y, z in vertices]
    blooms.add(vertices, faces)
    blooms.finish(model)
    flower_centre(centres, (*center, base+.003), (0, 0, 1), .003)


def scatter_flower_heads(model, foliage, rng):
    """Choose scattered heads only where the full flower can sit on leaves."""
    positions = []
    centres = Batch('Bloom | warm centres', 'Leaf | bloom centre')
    for _ in range(1000):
        center = random_disc(rng, .105)
        if any(math.dist(center, other) < .055 for other in positions):
            continue
        try:
            flower_head(model, len(positions)+1, center, rng.uniform(.032, .034),
                        rng.uniform(0, math.tau), centres, foliage)
        except ValueError as error:
            if str(error) not in ('Position missed the foliage surface',
                                  'Flower head would float above the foliage'):
                raise
            continue
        positions.append(center)
        if len(positions) == 6:
            centres.finish(model)
            return
    raise ValueError('Could not scatter six flower heads on the foliage')


def potted_foliage(model, seed, flowering):
    """A rim-filling lower ring and overlapping, lighter upper clumps."""
    rng = random.Random(seed)
    start = len(model.meshes)
    for i in range(8):
        angle = math.tau*i/8 + rng.uniform(-.09, .09)
        reach = rng.uniform(.080, .083)
        radius = rng.uniform(.076, .079)
        height = rng.uniform(.093, .096)
        center = (reach*math.cos(angle), reach*math.sin(angle), .315+rng.uniform(-.002, .002))
        clump(model, center, (radius, radius*.96, height), LEAF_MATERIALS, i,
              segments=10, rings=3, shade=0 if i in (1, 5) else 1)
    upper_count = 5 if flowering else 6
    for i in range(upper_count):
        angle = math.tau*i/upper_count + .25+rng.uniform(-.10, .10)
        reach = rng.uniform(.098, .102)
        radius = rng.uniform(.080, .083)
        center = (reach*math.cos(angle), reach*math.sin(angle),
                  (.367 if flowering else .381)+rng.uniform(-.004, .004))
        clump(model, center, (radius, radius*.96, .078), LEAF_MATERIALS, i+8,
              segments=9, rings=4, shade=1 if i == 1 else 2)
    center_z, height = (.398, .067) if flowering else (.423, .077)
    clump(model, (0, 0, center_z), (.076, .073, height), LEAF_MATERIALS, 20,
          segments=9, rings=4, shade=2)
    return {str(i): part for i, part in enumerate(model.meshes[start:])}


def potflower(model):
    pot(model)
    foliage = potted_foliage(model, 1701, True)
    scatter_flower_heads(model, foliage, random.Random(1701))


def potshrub(model):
    pot(model)
    potted_foliage(model, 1759, False)


def outer_hit(batches, axis, a, b):
    """Return the outermost projected foliage surface and its face normal."""
    other = [i for i in range(3) if i != axis]
    hits = []
    for batch in batches.values():
        for face in batch.faces:
            for j in range(1, len(face)-1):
                p, q, r = (batch.vertices[i] for i in (face[0], face[j], face[j+1]))
                qx, qy = q[other[0]]-p[other[0]], q[other[1]]-p[other[1]]
                rx, ry = r[other[0]]-p[other[0]], r[other[1]]-p[other[1]]
                determinant = qx*ry-qy*rx
                if abs(determinant) < 1e-12:
                    continue
                px, py = a-p[other[0]], b-p[other[1]]
                u, v = (px*ry-py*rx)/determinant, (qx*py-qy*px)/determinant
                if u >= -1e-9 and v >= -1e-9 and u+v <= 1+1e-9:
                    normal = normalize(cross(tuple(q[i]-p[i] for i in range(3)),
                                             tuple(r[i]-p[i] for i in range(3))))
                    if normal[axis] > 1e-9:
                        hits.append((p[axis]+u*(q[axis]-p[axis])+v*(r[axis]-p[axis]), normal))
    if not hits:
        raise ValueError('Position missed the foliage surface')
    return max(hits, key=lambda hit: hit[0])


def outer_surface(batches, axis, a, b):
    return outer_hit(batches, axis, a, b)[0]


def wall_depth(y, tongues, phases):
    base = .105 + .008*math.sin(9*y+phases[0]) + .006*math.sin(18*y+phases[1])
    depth = base
    for center, half_width, length in tongues:
        distance = abs(y-center)/half_width
        if distance < 1:
            depth = max(depth, base+(length-base)*(1-smoothstep((distance-.28)/.72)))
    return depth


def wall_foliage(model, rng):
    """A dark, closed core wraps over the edge and behind the foliage."""
    tongues = [(-.31+rng.uniform(-.01, .01), .095, .42),
               (-.035+rng.uniform(-.01, .01), .070, .34),
               (.26+rng.uniform(-.01, .01), .105, .44)]
    phases = [rng.uniform(0, math.tau) for _ in range(4)]
    columns, rows = 27, 7
    vertices, faces = [], []
    for column in range(columns):
        y = -.5+column/(columns-1)
        end = .01+.99*smoothstep((.5-abs(y))/.1)
        depth = end*wall_depth(y, tongues, phases)
        for row in range(rows):
            across = row/(rows-1)
            ripple = .008*math.sin(15*y+5*across+phases[2])
            ripple += .006*math.sin(27*y-5*across+phases[3])
            if row <= 2:
                t = row/2
                x = -.10+.10*t
                z = end*(.045*smoothstep(t) + ripple*math.sin(math.pi*t)**2)
            elif row <= 4:
                t = (row-2)/2
                angle = math.pi*t/2
                x = end*.069*math.sin(angle)
                z = end*(.045*math.cos(angle) + ripple*math.sin(angle)*math.cos(angle))
            else:
                t = (row-4)/2
                curl = 1-smoothstep((t-.76)/.24)
                thickness = .069-.039*t + ripple*math.sin(math.pi*t)
                x = end*thickness*curl
                z = -depth*t
            vertices.append((x, y, z))
    corners = len(vertices)
    vertices.extend((0, -.5+column/(columns-1), 0) for column in range(columns))
    for column in range(columns-1):
        for row in range(rows-1):
            a, b = column*rows+row, (column+1)*rows+row
            faces.append((a, a+1, b+1, b))
        start, next_start = column*rows, (column+1)*rows
        c, next_c = corners+column, corners+column+1
        faces.extend(((start, next_start, next_c, c),
                      (start+rows-1, c, next_c, next_start+rows-1)))
    for row in range(rows-1):
        faces.extend(((corners, row+1, row),
                      (corners+columns-1, (columns-1)*rows+row,
                       (columns-1)*rows+row+1)))
    model.add('Foliage | wall drape core', vertices, faces, LEAF_MATERIALS[0], smooth=True)
    return {'core': model.meshes[-1]}, tongues, phases


def wall_clumps(model, core, tongues, phases, rng):
    """Overlap garden-style clumps with the core, crest first and then face."""
    start = len(model.meshes)
    for i in range(11):
        y = -.435+i*.087+rng.uniform(-.008, .008)
        radius = rng.uniform(.050, .060) * (.83 if abs(y) > .40 else 1)
        clump(model, (-.050+rng.uniform(-.003, .003), y, .034),
              (.052, radius, .026), LEAF_MATERIALS, i,
              segments=8, rings=2, shade=2 if i%4 else 1)

    def face_clump(y, z, radius, seed, shade):
        y = max(-.5+1.07*radius, min(.5-1.07*radius, y))
        depth = (.01+.99*smoothstep((.5-abs(y))/.1))*wall_depth(y, tongues, phases)
        z = max(z, -depth+.68*radius)
        x = outer_surface(core, 0, y, z)
        rx = .6*radius
        clump(model, (max(rx*1.07, x-.25*rx), y, z),
              (rx, radius, radius), LEAF_MATERIALS, seed,
              segments=8, rings=2, shade=shade)

    for i in range(11):
        y = -.43+i*.086+rng.uniform(-.008, .008)
        radius = rng.uniform(.060, .066) * (.84 if abs(y) > .40 else 1)
        face_clump(y, -.035+rng.uniform(-.008, .008), radius, 20+i, 2 if i%3 else 1)
    for i in range(9):
        y = -.40+i*.10+rng.uniform(-.010, .010)
        face_clump(y, -.135+rng.uniform(-.012, .012), rng.uniform(.058, .066), 40+i, 1 if i%3 else 0)
    for tongue, count in zip(tongues, (3, 2, 3)):
        center, _, length = tongue
        for i in range(count):
            fraction = .53 + .36*i/(count-1)
            radius = rng.uniform(.050, .063)
            face_clump(center+(-.014 if i%2 else .014)+rng.uniform(-.005, .005), -length*fraction,
                       radius, 60+len(model.meshes)-start, 0 if i == count-1 else 1)
    return {str(i): part for i, part in enumerate(model.meshes[start:])}


def wall_blooms(core, clumps, blooms, centres, rng):
    """Put the unchanged bracts on the visible clump surface."""
    foliage = {**core, **clumps}
    placed = []
    groups = ((2, 6, lambda p: p[0] < -.015 and p[2] > .025),
              (0, 8, lambda p: p[2] > -.04),
              (0, 14, lambda p: -.16 < p[2] < -.02),
              (0, 4, lambda p: p[2] < -.16))
    for axis, count, region in groups:
        candidates = []
        for part in clumps.values():
            for face in part.faces:
                p, q, r = (part.vertices[i] for i in face)
                normal = normalize(cross(tuple(q[i]-p[i] for i in range(3)),
                                         tuple(r[i]-p[i] for i in range(3))))
                center = tuple((p[i]+q[i]+r[i])/3 for i in range(3))
                if normal[axis] > .55 and region(center):
                    candidates.append((p, q, r))
        made = 0
        for _ in range(4000):
            p, q, r = rng.choice(candidates)
            u, v = rng.random(), rng.random()
            if u+v > 1:
                u, v = 1-u, 1-v
            point = tuple(p[i]+u*(q[i]-p[i])+v*(r[i]-p[i]) for i in range(3))
            coords = [point[i] for i in range(3) if i != axis]
            height, normal = outer_hit(clumps, axis, *coords)
            if outer_surface(foliage, axis, *coords) > height+1e-6:
                continue
            point = tuple((height if i == axis else point[i])+.002*normal[i] for i in range(3))
            if any(math.dist(point, previous) < .038 for previous in placed):
                continue
            candidate = Batch('candidate', 'Leaf | bloom')
            flower(candidate, point, normal, rng.uniform(.026, .034), rng.uniform(0, math.tau))
            if any(abs(v[1]) > .5 or v[2] > .07 or (v[2] < 0 and v[0] < 0)
                   for v in candidate.vertices):
                continue
            blooms.add(candidate.vertices, candidate.faces)
            flower_centre(centres, point, normal, .0018)
            placed.append(point)
            made += 1
            if made == count:
                break
        if made != count:
            raise ValueError('Could not scatter bracts on the exposed wall foliage')


def bougain(model):
    rng = random.Random(581)
    blooms = Batch('Bloom | cupped bracts', 'Leaf | bloom')
    centres = Batch('Bloom | warm centres', 'Leaf | bloom centre')
    core, tongues, phases = wall_foliage(model, rng)
    clumps = wall_clumps(model, core, tongues, phases, rng)
    wall_blooms(core, clumps, blooms, centres, rng)
    blooms.finish(model)
    centres.finish(model)


def build_model(name):
    builders = {'bougain': bougain, 'potflower': potflower, 'potshrub': potshrub}
    if name not in builders:
        raise ValueError('Unknown wall plant: ' + name)
    model = Model()
    builders[name](model)
    triangles = model.triangle_count()
    if triangles > SPECS[name]:
        raise ValueError(f'{name}: triangle budget exceeded ({triangles} > {SPECS[name]})')
    return model


def create_objects(bpy, model):
    materials = {name: blender_material(bpy, name, rgb) for name, rgb in model.materials.items()}
    objects = []
    for part in model.meshes:
        data = bpy.data.meshes.new(part.name)
        data.from_pydata(part.vertices, [], part.faces)
        data.update()
        obj = bpy.data.objects.new(part.name, data)
        bpy.context.collection.objects.link(obj)
        for name in part.materials:
            data.materials.append(materials[name])
        for poly, index in zip(data.polygons, part.face_materials):
            poly.material_index = index
            poly.use_smooth = part.smooth
        objects.append(obj)
    return objects


def evaluated_geometry(bpy, objects):
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
    return coords, triangles


def studio_frame(projected):
    """Fit camera-space points inside 80% of each image dimension."""
    low = [min(p[i] for p in projected) for i in range(3)]
    high = [max(p[i] for p in projected) for i in range(3)]
    center = tuple((low[i]+high[i])/2 for i in range(3))
    span = max(high[i]-low[i] for i in range(3))
    aspect = RENDER_SIZE[0]/RENDER_SIZE[1]
    width = max(high[0]-low[0], (high[1]-low[1])*aspect)/.8
    return center, span, width


def render_studio(bpy, coords, output, direction):
    from mathutils import Vector
    scene = bpy.context.scene
    if scene.world is None:
        scene.world = bpy.data.worlds.new('Studio world')
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes.get('Background')
    background.inputs['Color'].default_value = (.20, .17, .15, 1)
    background.inputs['Strength'].default_value = .8
    direction = Vector(direction).normalized()
    rotation = (-direction).to_track_quat('-Z', 'Y')
    projected = [rotation.inverted() @ Vector(point) for point in coords]
    projected_center, span, width = studio_frame(projected)
    center = rotation @ Vector(projected_center)
    for name, offset, intensity, size in LIGHTS:
        obj = bpy.data.objects.get(name)
        if obj is None:
            data = bpy.data.lights.new(name, 'AREA')
            obj = bpy.data.objects.new(name, data)
            bpy.context.collection.objects.link(obj)
        obj.data.energy = intensity*span*span
        obj.data.shape = 'DISK'
        obj.data.size = size*span
        obj.location = center+Vector(offset)*span
        obj.rotation_euler = (center-obj.location).to_track_quat('-Z','Y').to_euler()
    camera = bpy.data.objects.get('Studio | camera')
    if camera is None:
        data = bpy.data.cameras.new('Studio | camera')
        camera = bpy.data.objects.new('Studio | camera', data)
        bpy.context.collection.objects.link(camera)
    camera.location = center+direction*span*5
    camera.rotation_euler = rotation.to_euler()
    camera.data.type = 'ORTHO'
    camera.data.clip_start = max(.00001, span/1000)
    camera.data.clip_end = span*30
    camera.data.ortho_scale = width
    scene.camera = camera
    scene.view_settings.view_transform = 'AgX'
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 32
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = RENDER_SIZE
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = False
    scene.render.image_settings.file_format = 'PNG'
    scene.render.filepath = str(output)
    bpy.ops.render.render(write_still=True)


def render_wall_context(bpy, coords, target):
    wall = Model()
    # Its front face and top meet at the model origin; it is review-only.
    box(wall, 'Review | plain plaster wall', (-.14,0,-.32), (.28,1.32,.64), 'Plaster | pale wall')
    objects = create_objects(bpy, wall)
    wall_coords, _ = evaluated_geometry(bpy, objects)
    render_studio(bpy, coords+wall_coords, target, (1,-.20,.58))


def write_model(name):
    import bpy
    model = build_model(name)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    objects = create_objects(bpy, model)
    coords, triangles = evaluated_geometry(bpy, objects)
    bounds = [[min(v[i] for v in coords), max(v[i] for v in coords)] for i in range(3)]
    print('MODEL_STATS ' + json.dumps(dict(id=name, triangles=triangles, bounds=bounds,
                                          materials={key: [*rgb,1] for key,rgb in model.materials.items()})), flush=True)
    if triangles != model.triangle_count() or triangles > SPECS[name]:
        raise RuntimeError(f'{name}: evaluated triangle count does not match the budgeted mesh')
    target = OUT / name
    target.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    # The wall, studio, and cameras are created only after both game files.
    bpy.ops.wm.save_as_mainfile(filepath=str(target / (name+'.blend')), compress=True)
    bpy.ops.export_scene.gltf(filepath=str(target / (name+'.glb')), export_format='GLB',
                              use_selection=True, export_apply=True)
    direction = (1,-.20,.58) if name == 'bougain' else (1,-1.5,1.15)
    render_studio(bpy, coords, target / (name+'.png'), direction)
    if name == 'bougain':
        render_wall_context(bpy, coords, target / (name+'-wall.png'))


def main():
    args = sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
    if len(args) != 1 or args[0] not in (*SPECS, 'all'):
        raise SystemExit('usage: -- <bougain|potflower|potshrub|all>')
    for name in (SPECS if args[0] == 'all' else args):
        write_model(name)


if __name__ == '__main__':
    main()
