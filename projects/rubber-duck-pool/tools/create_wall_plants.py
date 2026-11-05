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


def clump(batch, center, radii, seed, segments=9, rings=4):
    """A rounded garden-style clump, with its own smooth normals and shade."""
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
    faces = [(0, 1+(i+1)%segments, 1+i) for i in range(segments)]
    for j in range(rings-1):
        a, b = 1+j*segments, 1+(j+1)*segments
        for i in range(segments):
            faces.append((a+i, a+(i+1)%segments, b+(i+1)%segments, b+i))
    last = 1+(rings-1)*segments
    faces.extend((top, last+i, last+(i+1)%segments) for i in range(segments))
    batch.add(vertices, faces)


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


def curved_stem(batch, points, radius):
    direction = normalize(tuple(points[-1][i]-points[0][i] for i in range(3)))
    u, v, _ = frame(direction)
    vertices = []
    for point in points:
        for i in range(4):
            a = math.tau*i/4
            vertices.append(local_point(point, u, v, direction, radius*math.cos(a), radius*math.sin(a), 0))
    faces = [(4*j+i, 4*j+(i+1)%4, 4*(j+1)+(i+1)%4, 4*(j+1)+i)
             for j in range(len(points)-1) for i in range(4)]
    last = len(vertices)-4
    faces += [(3,2,1,0), (last,last+1,last+2,last+3)]
    batch.add(vertices, faces)


def foliage_batches():
    shades = ('deep', 'garden', 'fresh', 'sunlit')
    return {shade: Batch('Foliage | ' + shade, 'Leaf | ' + shade + ' green') for shade in shades}


def finish_foliage(model, batches):
    for batch in batches.values():
        batch.finish(model)


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
    base = max(outer_surface(foliage, 2, x, y)-z for x, y, z in vertices) + .001
    if base-outer_surface(foliage, 2, *center) > .006:
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
        center = random_disc(rng, .079)
        if any(math.dist(center, other) < .045 for other in positions):
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


def potflower(model):
    pot(model)
    rng = random.Random(1701)
    batches = foliage_batches()
    # A recessed core joins the mound to the pot; the outline comes from the small clumps.
    clump(batches['deep'], (0, 0, .325), (.095, .095, .070), 0, segments=7, rings=2)
    for i in range(24):
        x, y = random_disc(rng, .105)
        radial = math.hypot(x, y)/.105
        z = .352 + .060*math.sqrt(1-radial*radial) + rng.uniform(-.014, .014)
        size = rng.uniform(.041, .058)
        radii = (size*rng.uniform(.9, 1.1), size*rng.uniform(.9, 1.1),
                 size*rng.uniform(.85, 1.1))
        shade = rng.choice(('garden', 'garden', 'fresh'))
        clump(batches[shade], (x, y, z), radii, i+1, segments=7, rings=3)
    finish_foliage(model, batches)
    scatter_flower_heads(model, batches, rng)


def potshrub(model):
    pot(model)
    rng = random.Random(1759)
    batches = foliage_batches()
    clump(batches['deep'], (0, 0, .365), (.070, .070, .105), 0, segments=7, rings=2)
    for i in range(31):
        vertical = rng.uniform(-1, 1)
        angle = rng.uniform(0, math.tau)
        radial = math.sqrt(1-vertical*vertical)
        distance = rng.uniform(.073, .112)
        center = (distance*radial*math.cos(angle), distance*radial*math.sin(angle),
                  .460+distance*vertical)
        size = rng.uniform(.043, .059)
        radii = tuple(size*rng.uniform(.9, 1.1) for _ in range(3))
        shade = rng.choice(('garden', 'fresh')) if center[2] > .465 else rng.choice(('deep', 'garden', 'garden'))
        clump(batches[shade], center, radii, i+1, segments=7, rings=3 if i < 9 else 2)
    finish_foliage(model, batches)


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


def wall_clump(batches, rng, y, z, size, rings=2):
    """Keep the full clump outside the wall and taper its depth towards the tips."""
    ry, rz = size*rng.uniform(.8, 1.15), size*rng.uniform(.8, 1.15)
    z = min(z, .061-rz)
    depth = .040 + .035*max(0, 1-max(0, rz-z)/.30)
    rx = depth*rng.uniform(.30, .45)
    clearance = rx*1.065
    x = rng.uniform(clearance, depth-clearance)
    center, radii = (x, y, z), (rx, ry, rz)
    shade = rng.choice(('deep', 'garden', 'garden', 'fresh'))
    clump(batches[shade], center, radii, rng.uniform(0, 100), segments=7, rings=rings)
    return center, radii


def wall_foliage(batches, stems, rng):
    crest, edge, tips = [], [], []
    for _ in range(7):
        rx, ry, rz = rng.uniform(.025, .040), rng.uniform(.032, .060), rng.uniform(.017, .025)
        center = (rng.uniform(-.12, -.035), rng.uniform(-.39, .39), rz+rng.uniform(.002, .006))
        radii = (rx, ry, rz)
        clump(batches[rng.choice(('garden', 'fresh'))], center, radii,
              rng.uniform(0, 100), segments=7, rings=2)
        crest.append((center, radii))
    for i in range(16):
        edge.append(wall_clump(batches, rng, rng.uniform(-.40, .40),
                               rng.triangular(-.10, .025, -.025), rng.uniform(.045, .070),
                               rings=3 if i < 11 else 2))
    for side in (-1, 1):
        for _ in range(2):
            wall_clump(batches, rng, side*rng.uniform(.49, .52),
                       rng.uniform(-.09, .005), rng.uniform(.028, .038))
    lengths = [2, 3, 3, 4, 4, 5]
    rng.shuffle(lengths)
    upper = []
    for root, length in zip(rng.sample(edge, len(lengths)), lengths):
        parent = root
        root_center, _ = root
        y, z = root_center[1], root_center[2]
        drift = rng.uniform(-.8, .8)
        for j in range(length):
            drop = rng.uniform(.065, .095) if length == 5 else rng.uniform(.045, .075)
            y = max(-.50, min(.50, y+drift*drop+rng.uniform(-.025, .025)))
            z -= drop
            size = rng.uniform(.045, .068)*(1-.28*j/(length-1))
            tip = wall_clump(batches, rng, y, z, size)
            a, ar = parent
            b, br = tip
            if abs(a[1]-b[1]) > .8*(ar[1]+br[1]) or abs(a[2]-b[2]) > ar[2]+br[2]-.01:
                curved_stem(stems, [a, b], .0012)
            parent = tip
            if z > -.20:
                upper.append(tip)
        tips.append(tip)
    return crest, edge+upper, tips


def sprig(stems, leaves, tip, rng):
    center, radii = tip
    x = min(.028, center[0]+radii[0]*.3)
    y, z = center[1], center[2]-radii[2]*.55
    drift = rng.uniform(-.035, .035)
    points = [(x, y, z), (x, y+drift*.45, z-.020), (x, y+drift, z-.045)]
    curved_stem(stems, points, .0014)
    for side in (-1, 1):
        start = points[1] if side < 0 else points[2]
        dy, dz = side*rng.uniform(.014, .027), -rng.uniform(.012, .027)
        vertices = [start, (x, start[1]+dy*.5-.004, start[2]+dz*.5),
                    (x, start[1]+dy, start[2]+dz),
                    (x, start[1]+dy*.5+.004, start[2]+dz*.5),
                    (x+.002, start[1]+dy*.5, start[2]+dz*.5)]
        leaves.add(vertices, [(4,0,1), (4,1,2), (4,2,3), (4,3,0), (0,2,1), (0,3,2)])


def wall_blooms(batches, crest, front, blooms, centres, rng):
    placed = []
    for axis, sites, count in ((0, front, 26), (2, crest, 4)):
        made = 0
        for _ in range(2000):
            center, radii = rng.choice(sites)
            if axis == 0:
                a = center[1]+rng.uniform(-.65, .65)*radii[1]
                b = center[2]+rng.uniform(-.65, .65)*radii[2]
            else:
                a = center[0]+rng.uniform(-.65, .65)*radii[0]
                b = center[1]+rng.uniform(-.65, .65)*radii[1]
            try:
                surface, normal = outer_hit(batches, axis, a, b)
            except ValueError:
                continue
            point = (surface, a, b) if axis == 0 else (a, b, surface)
            point = add(point, scale(normal, .001))
            if any(math.dist(point, previous) < .032 for previous in placed):
                continue
            candidate = Batch('candidate', 'Leaf | bloom')
            flower(candidate, point, normal, rng.uniform(.019, .024), rng.uniform(0, math.tau))
            if any((v[2] < 0 and (v[0] < 0 or v[0] > .10)) or v[2] > .08
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
    batches = foliage_batches()
    blooms = Batch('Bloom | cupped bracts', 'Leaf | bloom')
    centres = Batch('Bloom | warm centres', 'Leaf | bloom centre')
    stems = Batch('Vine | showing stems', 'Wood | vine stem')
    leaves = Batch('Vine | sprig leaves', 'Leaf | fresh green', smooth=False)
    crest, front, tips = wall_foliage(batches, stems, rng)
    wall_blooms(batches, crest, front, blooms, centres, rng)
    for tip in tips:
        sprig(stems, leaves, tip, rng)
    finish_foliage(model, batches)
    blooms.finish(model)
    centres.finish(model)
    stems.finish(model)
    leaves.finish(model)


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
