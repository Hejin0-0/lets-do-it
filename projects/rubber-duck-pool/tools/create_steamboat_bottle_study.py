"""Make the steamboat-bottle lookdev in a disposable background Blender process.

Usage: blender -b --python create_steamboat_bottle_study.py -- 1
The existing sailboat source is read only. Outputs are separate from the game's
collectible models. Never run this script in an interactive Blender session.
"""
import bpy
import math
import sys
from pathlib import Path
from mathutils import Vector

if not bpy.app.background:
    raise RuntimeError('Use a disposable background Blender process')
args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
if len(args) != 1 or args[0] not in ('1', '2', '3', '4', '5'):
    raise SystemExit('Usage: -- <revision 1, 2, 3, 4, or 5>')
revision = int(args[0])
ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets/02_models/props/sailboat-bottle-study/sailboat-bottle-v9.blend'
OUT = ROOT / 'assets/02_models/props/steamboat-bottle-study'
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)

# Reuse the authored bottle family, but no sailboat parts or studio objects.
with bpy.data.libraries.load(str(SOURCE), link=False) as (src, dst):
    keep = ('Bottle |', 'Cradle |', 'Ocean |')
    dst.objects = [name for name in src.objects if name.startswith(keep)]
for obj in dst.objects:
    if obj is not None:
        bpy.context.scene.collection.objects.link(obj)
if revision >= 2:
    glass = next(obj for obj in dst.objects if obj and obj.name.startswith('Bottle | thick transparent glass'))
    glass_shader = next(n for n in glass.data.materials[0].node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    glass_shader.inputs['Base Color'].default_value = (.96,1.0,.985,1)
    glass_shader.inputs['Roughness'].default_value = .035
    glass_shader.inputs['IOR'].default_value = 1.45

def material(name, color, rough=.4, metal=0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    shader = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Roughness'].default_value = rough
    shader.inputs['Metallic'].default_value = metal
    return mat

teal = material('Steamer | deep teal painted wood', (.045,.25,.24), .32)
cream = material('Steamer | warm ivory', (.88,.78,.60), .5)
red = material('Steamer | faded vermilion', (.62,.12,.075), .36)
timber = material('Steamer | honey timber', (.50,.26,.095), .45)
dark = material('Steamer | dark window glass', (.045,.075,.07), .22)
metal = material('Steamer | antique brass', (.55,.34,.105), .28, .7)
smoke = material('Bottle | painted ivory smoke', (.91,.84,.68), .65)
floor = material('Studio | sand', (.48,.37,.27) if revision >= 2 else (.39,.30,.22), .84)
if revision >= 3:
    for mat, scale, strength in ((teal,130,.12),(timber,95,.17),(red,180,.08),(cream,220,.09)):
        nodes=mat.node_tree.nodes; links=mat.node_tree.links
        noise=nodes.new('ShaderNodeTexNoise'); noise.inputs['Scale'].default_value=scale
        bump=nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value=strength
        bump.inputs['Distance'].default_value=.002
        links.new(noise.outputs['Fac'],bump.inputs['Height'])
        links.new(bump.outputs['Normal'],next(n for n in nodes if n.type=='BSDF_PRINCIPLED').inputs['Normal'])

def mesh(name, vertices, faces, mat, smooth=False):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(mat)
    for face in data.polygons:
        face.use_smooth = smooth
    return obj

def box(name, location, size, mat, bevel=.002):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    if bevel:
        mod = obj.modifiers.new('Soft edges', 'BEVEL')
        mod.width = bevel
        mod.segments = 3
        obj.modifiers.new('Weighted normals', 'WEIGHTED_NORMAL')
    return obj

def pipe(name, points, radius, mat):
    data = bpy.data.curves.new(name, 'CURVE')
    data.dimensions = '3D'
    data.resolution_u = 12
    data.bevel_depth = radius
    data.bevel_resolution = 3
    spline = data.splines.new('POLY')
    spline.points.add(len(points) - 1)
    for point, xyz in zip(spline.points, points):
        point.co = (*xyz, 1)
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(mat)
    return obj

def cylinder(name, location, radius, depth, mat, axis='Z', vertices=32):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location)
    obj = bpy.context.object
    obj.name = name
    if axis == 'Y': obj.rotation_euler[0] = math.pi/2
    obj.data.materials.append(mat)
    bevel = obj.modifiers.new('Soft edge', 'BEVEL'); bevel.width = .0015; bevel.segments = 3
    obj.modifiers.new('Weighted normals', 'WEIGHTED_NORMAL')
    return obj

# A solid, slightly sheer hull; the top/bottom faces have opposite windings.
outline = [(-.47,-.045),(-.45,-.078),(-.36,-.101),(-.18,-.110),(.04,-.105),(.24,-.079),(.36,-.045),(.43,0),(.36,.045),(.24,.079),(.04,.105),(-.18,.110),(-.36,.101),(-.45,.078),(-.47,.045)]
n = len(outline)
top = [(x,y,.252 + .04*max(0, abs(x)-.25)) for x,y in outline]
bottom = [(x*.87-.006,y*.61,.164+.055*max(0,x-.14)) for x,y in outline]
faces = [tuple(range(n)), tuple(reversed(range(n,2*n)))]
faces += [((i+1)%n,i,i+n,(i+1)%n+n) for i in range(n)]
hull = mesh('Steamer | shaped teal hull', top+bottom, faces, teal)
bevel = hull.modifiers.new('Rounded hull edges','BEVEL'); bevel.width=.006; bevel.segments=3
hull.modifiers.new('Hull weighted normals','WEIGHTED_NORMAL')
deck = [(x*.96,y*.92,z+.002) for x,y,z in top]
mesh('Steamer | timber deck', deck, [tuple(range(n))], timber)

# Two bands follow the actual hull instead of hovering in front of it.
for low, high, mat, label in [(.08,.16,cream,'ivory sheer stripe'),(.66,.70,red,'red waterline')]:
    points = []
    for t in (low,high):
        for a,b in zip(top,bottom):
            p = Vector(a).lerp(Vector(b),t)
            p.y += .0012 if p.y > 0 else -.0012
            points.append(tuple(p))
    mesh('Steamer | '+label, points, [(i+n,(i+1)%n+n,(i+1)%n,i) for i in range(n)], mat)

# Low deckhouse, separate wheelhouse, and an unmistakable red funnel.
box('Steamer | main deckhouse',(-.11,0,.307),(.37,.125,.105),cream,.006)
box('Steamer | lower roof',(-.11,0,.363),(.40,.15,.012),timber,.004)
box('Steamer | upper wheelhouse',(.075,0,.398),(.135,.105,.066),cream,.005)
box('Steamer | upper roof',(.075,0,.435),(.157,.125,.010),timber,.004)
if revision >= 3:
    for y in (-.032,0,.032):
        box('Steamer | bridge bow window surround',(.143,y,.402),(.002,.028,.042),timber,.001)
        box('Steamer | bridge bow window',(.1445,y,.402),(.002,.023,.036),dark,.001)
for side in (-1,1):
    for x in (-.25,-.17,-.09,-.01):
        if revision >= 2:
            box('Steamer | lower window surround',(x,side*.063,.315),(.052,.002,.040),timber,.002)
        box('Steamer | lower dark window',(x,side*.064,.315),(.046,.002,.034),dark,.002)
    for x in (.033,.082,.128):
        if revision >= 2:
            box('Steamer | bridge window surround',(x,side*.053,.401),(.040,.002,.042),timber,.002)
        box('Steamer | bridge dark window',(x,side*.054,.401),(.034,.002,.036),dark,.0015)
    for i in range(5):
        x = -.36 + .16*i
        pipe('Steamer | rail post',[(x,side*.087,.259),(x,side*.087,.300)],.0019,metal)
    pipe('Steamer | continuous rail',[(-.37,side*.087,.300),(.30,side*.087,.300)],.002,metal)
    if revision >= 2:
        for x in (-.36,.20,.29):
            # Rings sit against the sloping outer hull, away from the paddle box.
            y=side*(.075 if x > .25 else .091)
            cylinder('Steamer | brass porthole rim',(x,y,.223),.008,.003,metal,'Y',20)
            cylinder('Steamer | dark porthole',(x,y+side*.002,.223),.005,.002,dark,'Y',20)

cylinder('Steamer | funnel foot',(-.18,0,.373),.037,.014,metal)
cylinder('Steamer | red funnel',(-.18,0,.439),.025,.132,red)
cylinder('Steamer | dark funnel lip',(-.18,0,.507),.028,.009,dark)
pipe('Steamer | forward mast',[(.29,0,.26),(.29,0,.525)],.0045,timber)
pipe('Steamer | mast rigging',[(.29,0,.51),(.15,0,.266)],.0009,metal)

# Paddle wheels on both sides with readable spokes and a half-round ivory guard.
for side in (-1,1):
    cx, cz, rad = -.075, .255, .084
    back_y, wheel_y = side*.118, side*.136
    arc = [(cx+rad*1.12*math.cos(math.pi*i/32),back_y,cz+rad*1.12*math.sin(math.pi*i/32)) for i in range(33)]
    guard_faces=[(0,i+1,i+2) if side < 0 else (0,i+2,i+1) for i in range(32)]
    mesh('Steamer | ivory paddle guard',[(cx,back_y,cz)]+arc,guard_faces,cream)
    pipe('Steamer | guard trim',arc,.003,timber)
    ring=[(cx+rad*math.cos(math.tau*i/64),wheel_y,cz+rad*math.sin(math.tau*i/64)) for i in range(65)]
    pipe('Steamer | red wheel rim',ring,.0035,red)
    for i in range(10):
        a = math.tau*i/10
        edge=(cx+rad*math.cos(a),wheel_y,cz+rad*math.sin(a))
        pipe('Steamer | paddle spoke',[(cx,wheel_y,cz),edge],.0028,red)
        blade=box('Steamer | paddle blade',edge,((.028 if revision >= 2 else .018),.016,.010),red,.002)
        blade.rotation_euler[1]=-(a+math.pi/2) if revision >= 2 else -a
        if revision >= 3:
            points=[]
            for radius, angle in ((.023,a-.07),(.071,a-.07),(.071,a+.07),(.023,a+.07)):
                points.append((cx+radius*math.cos(angle),wheel_y+side*.004,cz+radius*math.sin(angle)))
            mesh('Steamer | broad paddle vane',points,[(0,1,2,3) if side < 0 else (3,2,1,0)],red)
    cylinder('Steamer | wheel hub',(cx,wheel_y,cz),.012,.012,metal,'Y')

# Narrow painted ribbons follow the inside of the glass, not free-floating smoke.
def painted_smoke(side=-1):
    path=[]
    for i in range(33):
        t=i/32
        x=-.18-.23*t + .014*math.sin(math.tau*t)
        z=.518+.057*t+.009*math.sin(math.tau*t)
        path.append((x,z))
    vertices=[]
    for i,(x,z) in enumerate(path):
        width=.0015+.0032*math.sin(math.pi*i/(len(path)-1))
        for zz in (z-width,z+width):
            y=side*(math.sqrt(max(.0001,.257**2-(zz-.36)**2))-.001)
            vertices.append((x,y,zz))
    faces=[(2*i,2*i+1,2*i+3,2*i+2) if side < 0 else (2*i+2,2*i+3,2*i+1,2*i) for i in range(len(path)-1)]
    mesh('Bottle | painted smoke wisp',vertices,faces,smoke)
painted_smoke()
if revision >= 3:
    painted_smoke(1)

if revision >= 2:
    # A small lifering and boat details give the miniature a believable use.
    for side in (-1,1):
        ring=[(-.325+.023*math.cos(math.tau*i/36),side*.094,.312+.023*math.sin(math.tau*i/36)) for i in range(37)]
        pipe('Steamer | tiny ivory lifering',ring,.004,cream)
        for i in (0,9,18,27):
            pipe('Steamer | lifering coral tie',[ring[i],ring[i+1]],.0045,red)
    for y in (-.04,0,.04):
        pipe('Steamer | stern deck seam',[(-.445,y,.255),(-.315,y,.255)],.0007,dark)

if revision >= 4:
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from bottle_collection_water import make_filled_water, make_water
    make_filled_water() if revision >= 5 else make_water()

asset = list(bpy.context.scene.objects)
bpy.ops.object.select_all(action='DESELECT')
for obj in asset: obj.select_set(True)
bpy.context.view_layer.objects.active = asset[0]
stem = 'steamboat-bottle-v'+str(revision)
bpy.ops.export_scene.gltf(filepath=str(OUT/(stem+'.glb')),export_format='GLB',use_selection=True)
bpy.ops.export_scene.fbx(filepath=str(OUT/(stem+'.fbx')),use_selection=True,apply_unit_scale=True,add_leaf_bones=False)

box('STUDIO | floor',(0,0,-.015),(200,200,.02),floor,.001)
scene=bpy.context.scene
scene.world = bpy.data.worlds.new('STUDIO | world')
scene.world.color=(.22,.22,.22)
def area(name, loc, energy, size, target):
    data=bpy.data.lights.new(name,'AREA'); data.energy=energy; data.shape='DISK'; data.size=size
    obj=bpy.data.objects.new(name,data); scene.collection.objects.link(obj); obj.location=loc
    obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
area('STUDIO | key',(-2.5,-3,4),310 if revision >= 2 else 220,1.5,(0,0,.3))
area('STUDIO | rim',(1.3,1.8,3.1),240 if revision >= 2 else 180,2,(0,0,.3))
area('STUDIO | fill',(3,-2,2),100 if revision >= 2 else 70,2,(0,0,.3))
bpy.ops.object.camera_add(location=(1.25,-4.8,1.9))
cam=bpy.context.object
cam.rotation_euler=(Vector((.03,0,.34))-cam.location).to_track_quat('-Z','Y').to_euler()
cam.data.type='ORTHO'; cam.data.ortho_scale=2.45; scene.camera=cam
scene.render.engine='CYCLES'; scene.cycles.samples=72; scene.cycles.use_denoising=True
scene.render.resolution_x=1400; scene.render.resolution_y=1000; scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'; scene.render.filepath=str(OUT/(stem+'-blender.png'))
scene.view_settings.view_transform='AgX'
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/(stem+'.blend')),compress=True)
bpy.ops.render.render(write_still=True)
if revision >= 3:
    glass = next(obj for obj in asset if obj.name.startswith('Bottle | thick transparent glass'))
    glass.hide_render=True
    for obj in asset:
        if obj.name.startswith('Bottle | painted smoke'): obj.hide_render=True
    cam.data.ortho_scale=1.26
    cam.rotation_euler=(Vector((-.025,0,.31))-cam.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(OUT/(stem+'-cutaway.png'))
    bpy.ops.render.render(write_still=True)
print('STEAMBOAT_STUDY_OK', revision, len(asset), str(OUT), flush=True)
