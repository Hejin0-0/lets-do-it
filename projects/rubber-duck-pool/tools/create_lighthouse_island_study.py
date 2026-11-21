"""Make an independent lighthouse-island collectible in background Blender.

Usage: Blender -b --python-exit-code 1 --python this_file -- 1
The named revision has its own files; the existing game assets are not touched.
"""
import math
import random
import sys
from pathlib import Path

import bpy
from mathutils import Vector

if not bpy.app.background:
    raise RuntimeError('Use a disposable background Blender process')
args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
if len(args) != 1 or args[0] not in {'1', '2', '3', '4', '5', '6'}:
    raise SystemExit('Usage: -- <revision 1 through 6>')
revision = int(args[0])
root = Path(__file__).resolve().parents[1]
out = root / 'assets/02_models/props/lighthouse-island-study'
out.mkdir(parents=True, exist_ok=True)
stem = f'lighthouse-island-v{revision}'
rng = random.Random(601028)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def material(name, color, roughness, emission=0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = roughness
    if emission:
        bsdf.inputs['Emission Color'].default_value = (*color, 1)
        bsdf.inputs['Emission Strength'].default_value = emission
    return mat


ivory = material('Paint | ivory', (.85, .79, .64), .73)
coral = material('Paint | coral', (.62, .17, .11), .72)
sea = material('Sea | turquoise', (.068, .39, .38), .25)
foam = material('Sea | foam', (.61, .81, .73), .62)
rock = material('Rock | warm slate', (.14, .18, .16) if revision >= 3 else (.24, .275, .24), .88)
rock_light = material('Rock | pale slate', (.27, .30, .26) if revision >= 3 else (.35, .37, .31), .87)
land = material('Ground | dune', (.68, .57, .37), .88)
grass = material('Ground | grass', (.25, .35, .20), .92)
metal = material('Metal | aged bronze', (.20, .15, .11), .49)
wood = material('Wood | door', (.29, .14, .065), .77)
lamp = material('Lamp | warm glow', (1.0, .30, .055) if revision >= 3 else (1.0, .53, .14), .28,
                .7 if revision >= 3 else 1.4)
floor_mat = material('STUDIO | backdrop', (.68, .57, .46) if revision >= 6 else (.65, .61, .54), .9)


def bump(mat, scale, strength, distance):
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    noise = nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = scale
    noise.inputs['Detail'].default_value = 2
    b = nodes.new('ShaderNodeBump')
    b.inputs['Strength'].default_value = strength
    b.inputs['Distance'].default_value = distance
    shader = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
    links.new(noise.outputs['Fac'], b.inputs['Height'])
    links.new(b.outputs['Normal'], shader.inputs['Normal'])


for mat, scale, strength, distance in ((ivory, 130, .13, .003),
                                       (coral, 110, .10, .003),
                                       (rock, 27, .20, .008),
                                       (land, 100, .17, .004)):
    bump(mat, scale, strength, distance)

if revision >= 4:
    textured=[(ivory,'lighthouse-plaster-ivory.png'),(coral,'lighthouse-plaster-coral.png')]
    if revision >= 6:
        textured.extend(((land,'lighthouse-sand.png'),(rock,'lighthouse-stone-dark.png'),
                         (rock_light,'lighthouse-stone-light.png')))
    for mat, filename in textured:
        image=bpy.data.images.load(str(out/filename),check_existing=True)
        image.pack()
        tex=mat.node_tree.nodes.new('ShaderNodeTexImage')
        tex.image=image
        tex.extension='REPEAT'
        shader=next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
        mat.node_tree.links.new(tex.outputs['Color'],shader.inputs['Base Color'])


def mesh(name, vertices, faces, mats, indices=None, smooth=True):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    for mat in mats:
        data.materials.append(mat)
    for i, poly in enumerate(data.polygons):
        poly.use_smooth = smooth
        if indices is not None:
            poly.material_index = indices[i]
    return obj


def island_layer(name, rings, mat, phase, yscale=.88):
    n = 64
    vertices = []
    for radius, z in rings:
        for i in range(n):
            a = math.tau * i / n
            wobble = 1 + .045*math.sin(3*a+phase) + .022*math.cos(7*a+.3)
            vertices.append((radius*wobble*math.cos(a), radius*wobble*yscale*math.sin(a), z))
    faces = [tuple(reversed(range(n)))]
    for j in range(len(rings)-1):
        for i in range(n):
            k = (i+1) % n
            faces.append((j*n+i, j*n+k, (j+1)*n+k, (j+1)*n+i))
    faces.append(tuple((len(rings)-1)*n+i for i in range(n)))
    return mesh(name, vertices, faces, [mat])


def stone(name, location, scale, mat, subdivision=2):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivision, radius=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    obj.rotation_euler = (rng.uniform(-.22, .22), rng.uniform(-.22, .22), rng.uniform(0, math.tau))
    for vertex in obj.data.vertices:
        vertex.co *= rng.uniform(.88, 1.10)
    obj.data.materials.append(mat)
    for face in obj.data.polygons:
        face.use_smooth = True
    return obj


def cylinder(name, loc, radius, depth, mat, radius2=None, vertices=40):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius,
        radius2=radius if radius2 is None else radius2, depth=depth, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    for face in obj.data.polygons:
        face.use_smooth = len(face.vertices) == 4
    return obj


def cube(name, location, scale, mat, bevel=.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    if bevel:
        mod = obj.modifiers.new('Rounded edges', 'BEVEL')
        mod.width = bevel
        mod.segments = 3
        obj.modifiers.new('Weighted normals', 'WEIGHTED_NORMAL')
    return obj


def rod(name, a, b, radius, mat, vertices=10):
    a, b = Vector(a), Vector(b)
    obj = cylinder(name, (a+b)/2, radius, (b-a).length, mat, vertices=vertices)
    obj.rotation_euler = (b-a).to_track_quat('Z', 'Y').to_euler()
    return obj


def ring(name, z, radius, thickness, mat):
    bpy.ops.mesh.primitive_torus_add(major_segments=32 if revision >= 3 else 48, minor_segments=6 if revision >= 3 else 8,
        major_radius=radius, minor_radius=thickness, location=(0, 0, z))
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    for face in obj.data.polygons:
        face.use_smooth = True
    return obj


def arch_panel(name, y, width, bottom, top, depth, mat):
    """Closed arched panel facing the negative Y direction."""
    r=width/2
    spring=top-r
    outline=[(-r,bottom),(r,bottom),(r,spring)]
    outline.extend((r*math.cos(math.pi*i/10),spring+r*math.sin(math.pi*i/10)) for i in range(1,11))
    count=len(outline)
    vertices=[(x,y,z) for x,z in outline]+[(x,y+depth,z) for x,z in outline]
    faces=[tuple(range(count)),tuple(reversed(range(count,count*2)))]
    faces.extend((i,(i+1)%count,(i+1)%count+count,i+count) for i in range(count))
    return mesh(name,vertices,faces,[mat],smooth=False)


# One thin water base, a sloping land mass, and irregular shore rocks.
island_layer('Island | sea', ([(.70,-.06),(.83,-.05),(.86,-.025),(.84,.015)] if revision >= 4 else
    [(.63,-.06 if revision >= 3 else -.09),(.76,-.05 if revision >= 3 else -.075),(.78,-.025),(.76,.015)]), sea, .2)
island_layer('Island | ground', [(.45,-.018),(.59,.025),(.57,.075),(.48,.14),(.28,.19),(.03,.205)], land, .5, .83)
for i, (x,y,s) in enumerate([(-.53,-.16,.13),(-.47,.27,.11),(-.18,.43,.10),(.20,.42,.11),(.52,.19,.12),(.52,-.20,.10),(.19,-.41,.09),(-.17,-.44,.09)]):
    stone(f'Island | shore rock {i+1:02}', (x,y,.035), (s*1.18,s*.85,s*.70), rock_light if i%3 == 0 else rock,
          subdivision=1 if revision >= 2 else 2)
if revision >= 2:
    # Broken outer ledge, with water still visible between rock and island.
    rock_count=20 if revision >= 5 else (24 if revision >= 3 else 18)
    for i in range(rock_count):
        a=math.tau*i/rock_count + rng.uniform(-.08,.08) if revision >= 5 else math.tau*i/rock_count + rng.uniform(-.025,.025)
        jitter=.045 if revision >= 5 else .035
        r=(.815 if revision >= 4 else .735)+rng.uniform(-jitter,jitter)
        s=rng.uniform(.085,.132) if revision >= 5 else (rng.uniform(.095,.117) if revision >= 3 else rng.uniform(.073,.105))
        stone(f'Island | outer rock {i+1:02}',(r*math.cos(a),.88*r*math.sin(a),.015 if revision >= 3 else -.012),
              (s*1.22,s*.92,s*.66),rock_light if i%4 == 0 else rock,2 if revision >= 5 and i%3 == 0 else 1)
    # Narrow foam ribbons run along the shore; they don't cover the water.
    for j,(start,stop) in enumerate(((3.30,4.05),(4.45,5.15),(5.45,6.00))):
        vertices=[]
        for i in range(25):
            t=i/24
            a=start+(stop-start)*t
            radius=.628+.012*math.sin(4*a+j)
            half=.0018+.0017*math.sin(math.pi*t)
            for d in (-half,half):
                vertices.append(((radius+d)*math.cos(a),.86*(radius+d)*math.sin(a),.016))
        faces=[(2*i,2*i+1,2*i+3,2*i+2) for i in range(24)]
        mesh(f'Island | foam trace {j+1}',vertices,faces,[foam])

if revision >= 3:
    def ground_height(x,y):
        radius=math.hypot(x,y/.83)
        points=((.03,.205),(.28,.19),(.48,.14),(.57,.075))
        for (r0,z0),(r1,z1) in zip(points,points[1:]):
            if radius <= r1:
                t=max(0,min(1,(radius-r0)/(r1-r0)))
                return z0+(z1-z0)*t
        return .075

    # A few broad, tapered grass blades read at miniature scale without cards or alpha.
    for group,(x,y) in enumerate(((-.32,-.20),(.33,-.18),(-.40,.08),(.40,.04),
                                   (-.22,.30),(.24,.30),(-.37,-.06),(.18,-.34))):
        z=ground_height(x,y)-.004
        count=3 if revision >= 5 else 4
        for leaf in range(count):
            a=math.tau*leaf/count+group*.69
            spread=.048+.010*(leaf%2)
            height=.068+.012*((group+leaf)%3)
            side=Vector((-math.sin(a),math.cos(a),0))
            forward=Vector((math.cos(a),math.sin(a),0))
            base=Vector((x,y,z))
            tip=base+forward*spread+Vector((0,0,height))
            middle=base+forward*(spread*.36)+Vector((0,0,height*.55))
            w=.009
            outline=[base-side*w,base+side*w,middle+side*w*.65,tip,middle-side*w*.65]
            if revision >= 5:
                # Thin closed blades: duplicated reversed polygons are removed by glTF export.
                normal=side.cross(tip-base).normalized()*.0008
                vertices=[p+normal for p in outline]+[p-normal for p in outline]
                faces=[(0,1,2,3,4),(9,8,7,6,5)]+[(i,(i+1)%5,(i+1)%5+5,i+5) for i in range(5)]
            else:
                vertices=outline
                faces=[(0,1,2,3,4),(4,3,2,1,0)]
            mesh(f'Island | grass {group+1:02}-{leaf+1:02}',vertices,faces,[grass],smooth=False)
    if revision >= 6:
        for i,(x,y) in enumerate(((-.23,-.29),(-.31,-.25),(.20,-.30),(.30,-.28),
                                  (-.39,.15),(.39,.14),(-.24,.31),(.20,.33),(.35,-.04))):
            s=.010+.004*(i%3)
            stone(f'Island | small pebble {i+1:02}',(x,y,ground_height(x,y)+.003),
                  (s*1.3,s,s*.62),rock_light if i%3 == 0 else rock,1)

# One continuous tapered tower with deliberately broad face-assigned bands.
n = 64
tower_rings = ([ (.22,.18),(.214,.23),(.19,.42),(.172,.57),(.151,.74),(.132,.90),(.115,1.07),(.113,1.10)]
               if revision >= 2 else
               [(.175,.18),(.172,.23),(.157,.42),(.147,.57),(.136,.74),(.126,.90),(.115,1.07),(.113,1.10)])
verts = [(r*math.cos(math.tau*i/n),r*math.sin(math.tau*i/n),z) for r,z in tower_rings for i in range(n)]
faces = [tuple(reversed(range(n)))]
idx = [0]
for j in range(len(tower_rings)-1):
    for i in range(n):
        k=(i+1)%n
        faces.append((j*n+i,j*n+k,(j+1)*n+k,(j+1)*n+i))
        idx.append(1 if j in (1,4) else 0)
faces.append(tuple((len(tower_rings)-1)*n+i for i in range(n)))
idx.append(0)
tower=mesh('Lighthouse | tower shell', verts, faces, [ivory, coral], idx)
if revision >= 4:
    uv=tower.data.uv_layers.new(name='UVMap')
    for poly in tower.data.polygons:
        if len(poly.vertices) == 4:
            i=poly.vertices[0] % n
            coords=((i/n,verts[poly.vertices[0]][2]),((i+1)/n,verts[poly.vertices[1]][2]),
                    ((i+1)/n,verts[poly.vertices[2]][2]),(i/n,verts[poly.vertices[3]][2]))
            for loop,coord in zip(poly.loop_indices,coords):
                uv.data[loop].uv=coord
        else:
            for loop in poly.loop_indices:
                co=verts[tower.data.loops[loop].vertex_index]
                uv.data[loop].uv=(co[0]/.5+.5,co[1]/.5+.5)
cylinder('Lighthouse | footing', (0,0,.19), .242 if revision >= 2 else .202,.040, rock_light, vertices=48)
cylinder('Lighthouse | top molding', (0,0,1.105), .147,.036, ivory)
cylinder('Lighthouse | balcony floor', (0,0,1.132), .192,.025, metal)
cylinder('Lighthouse | lantern base', (0,0,1.155), .122,.022, coral)
cylinder('Lighthouse | lamp core', (0,0,1.235), .078,.145, lamp, vertices=32)
for i in range(8):
    a=math.tau*i/8
    x,y=.101*math.cos(a),.101*math.sin(a)
    rod(f'Lighthouse | lantern frame {i+1:02}',(x,y,1.16),(x,y,1.31),.006,metal)
cylinder('Lighthouse | roof lip', (0,0,1.314), .136,.018, metal)
cylinder('Lighthouse | roof', (0,0,1.365), .145,.090, coral, radius2=.024)
cylinder('Lighthouse | finial', (0,0,1.418), .014,.045, metal, radius2=.006, vertices=16)
if revision >= 3:
    for i in range(8):
        a=math.tau*i/8
        rod(f'Lighthouse | roof seam {i+1:02}',(.135*math.cos(a),.135*math.sin(a),1.327),
            (.026*math.cos(a),.026*math.sin(a),1.410),.0015,metal,6)
        cube(f'Lighthouse | balcony bracket {i+1:02}',(.123*math.cos(a),.123*math.sin(a),1.096),
             (.025,.025,.041),rock_light,.003)
if revision >= 5:
    for i,z in enumerate((1.195,1.235,1.275)):
        ring(f'Lighthouse | lens band {i+1}',z,.081,.0014,metal)
for i in range(12):
    a=math.tau*i/12
    x,y=.175*math.cos(a),.175*math.sin(a)
    rod(f'Lighthouse | rail post {i+1:02}',(x,y,1.14),(x,y,1.235),.004,metal,8)
ring('Lighthouse | upper railing',1.235,.175,.004,metal)
ring('Lighthouse | lower railing',1.185,.175,.0035,metal)

# The door and windows face the front camera and project just beyond the shell.
if revision >= 2:
    arch_panel('Lighthouse | doorway surround',-.224,.140,.193,.410,.018,rock_light)
    arch_panel('Lighthouse | entry door',-.232,.102,.198,.387,.014,wood)
    for i in (-1,0,1):
        x=i*.026
        rod(f'Lighthouse | door board {i+2}',(x,-.234,.210),(x,-.234,.339),.0018,metal,6)
    for z in (.24,.335):
        cube(f'Lighthouse | door strap {z:.2f}',(0,-.238,z),(.092,.005,.012),metal,.002)
    stone('Lighthouse | door knob',(.030,-.245,.288),(.007,.006,.007),metal,2)
    windows=((.52,.184),(.81,.148))
else:
    cube('Lighthouse | entry door', (0,-.177,.285), (.095,.018,.19), wood, .012)
    cube('Lighthouse | door lintel', (0,-.186,.387), (.116,.019,.018), ivory, .004)
    windows=((.52,.150),(.81,.132))
for z, radius in windows:
    if revision >= 2:
        arch_panel(f'Lighthouse | window frame {z:.2f}',-radius-.010,.064,z-.045,z+.050,.015,rock_light)
        arch_panel(f'Lighthouse | window pane {z:.2f}',-radius-.020,.042,z-.034,z+.037,.010,lamp)
    else:
        cube(f'Lighthouse | window frame {z:.2f}', (0,-radius-.008,z), (.057,.014,.080), metal, .004)
        cube(f'Lighthouse | window pane {z:.2f}', (0,-radius-.017,z), (.040,.009,.060), lamp, .003)
    rod(f'Lighthouse | window divider {z:.2f}',(0,-radius-.024,z-.03),(0,-radius-.024,z+.03),.0025,metal,6)
    if revision >= 6:
        rod(f'Lighthouse | window crossbar {z:.2f}',(-.019,-radius-.025,z),( .019,-radius-.025,z),.002,metal,6)
for i in range(3):
    cube(f'Island | entry step {i+1}',(0,-.27-.06*i,(.184-.022*i) if revision >= 2 else (.13-.025*i)),
         (.18+.035*i,.08,.027),rock_light,.009)

# Bake copies for export while keeping separate named objects in the source.
asset = [obj for obj in scene.objects if obj.type == 'MESH']
if revision >= 6:
    # Planar UVs for hand-built island/arch meshes; primitives already carry UVs.
    for obj in asset:
        if obj.data.uv_layers:
            continue
        uv=obj.data.uv_layers.new(name='UVMap')
        for poly in obj.data.polygons:
            normal=poly.normal
            axes=(0,2) if abs(normal.y)>max(abs(normal.x),abs(normal.z)) else (1,2) if abs(normal.x)>abs(normal.z) else (0,1)
            for loop in poly.loop_indices:
                co=obj.data.vertices[obj.data.loops[loop].vertex_index].co
                uv.data[loop].uv=(co[axes[0]]*2,co[axes[1]]*2)
depsgraph = bpy.context.evaluated_depsgraph_get()
copies=[]
for original in asset:
    evaluated=original.evaluated_get(depsgraph)
    data=bpy.data.meshes.new_from_object(evaluated,preserve_all_data_layers=True,depsgraph=depsgraph)
    copy=bpy.data.objects.new('EXPORT | '+original.name,data)
    scene.collection.objects.link(copy)
    copy.matrix_world=original.matrix_world.copy()
    copies.append(copy)
bpy.ops.object.select_all(action='DESELECT')
for obj in copies: obj.select_set(True)
bpy.context.view_layer.objects.active=copies[0]
bpy.ops.object.join()
merged=bpy.context.view_layer.objects.active
merged.name='Lighthouse | collectible export'
merged.data.calc_loop_triangles()
triangles=len(merged.data.loop_triangles)
bpy.ops.export_scene.gltf(filepath=str(out/(stem+'.glb')),export_format='GLB',use_selection=True)
bpy.ops.export_scene.fbx(filepath=str(out/(stem+'.fbx')),use_selection=True,apply_unit_scale=True,add_leaf_bones=False)
bpy.data.objects.remove(merged,do_unlink=True)

bottom=min((obj.matrix_world @ v.co).z for obj in asset for v in obj.data.vertices)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,bottom-.002))
floor=bpy.context.object
floor.name='STUDIO | floor'
floor.data.materials.append(floor_mat)
scene.world=bpy.data.worlds.new('STUDIO | sky')
scene.world.color=(.18,.18,.18) if revision >= 6 else (.24,.24,.24)


def light(name,location,energy,size,target):
    data=bpy.data.lights.new(name,'AREA')
    data.energy=energy
    data.shape='DISK'
    data.size=size
    obj=bpy.data.objects.new(name,data)
    scene.collection.objects.link(obj)
    obj.location=location
    obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()


light('STUDIO | broad sun',(-3,-4,5),300,2.5 if revision >= 6 else 3,(0,0,.65))
light('STUDIO | cool fill',(3,-1,3),85 if revision >= 6 else 125,3,(0,0,.65))
light('STUDIO | soft rim',(1,3,4),175 if revision >= 6 else 210,2.4,(0,0,.65))
bpy.ops.object.camera_add(location=(2.8,-4,3.0))
camera=bpy.context.object
camera.name='STUDIO | camera'
camera.rotation_euler=(Vector((0,0,.65))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO'
camera.data.ortho_scale=2.15
scene.camera=camera
scene.render.engine='CYCLES'
scene.cycles.samples=48
scene.cycles.use_denoising=True
scene.render.resolution_x=1000
scene.render.resolution_y=1000
scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'
scene.view_settings.exposure=.1
scene.render.image_settings.file_format='PNG'
scene.render.filepath=str(out/(stem+'-blender.png'))
bpy.ops.wm.save_as_mainfile(filepath=str(out/(stem+'.blend')),compress=True)
bpy.ops.render.render(write_still=True)
if revision >= 3:
    camera.location=(-3.4,3.2,2.8)
    camera.rotation_euler=(Vector((0,0,.65))-camera.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(out/(stem+'-blender-back.png'))
    bpy.ops.render.render(write_still=True)
print('LIGHTHOUSE_STUDY_OK', revision, 'triangles='+str(triangles), 'objects='+str(len(asset)), flush=True)
