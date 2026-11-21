"""Create a new, self-contained shipwreck reef collectible in background Blender.

Usage: blender -b --python-exit-code 1 --python this_file -- <revision>
No existing game model is edited. Each revision is written to its own files.
"""
import math
import random
import runpy
import shutil
import sys
from pathlib import Path

import bpy
from mathutils import Vector

if not bpy.app.background:
    raise RuntimeError('Use a disposable background Blender process')
args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
if len(args) != 1 or args[0] not in {'1', '2', '3', '4', '5'}:
    raise SystemExit('Usage: -- <revision 1 through 5>')
revision = int(args[0])
root = Path(__file__).resolve().parents[1]
out = root / 'assets/02_models/props/shipwreck-reef-study'
out.mkdir(parents=True, exist_ok=True)
stem = f'shipwreck-reef-v{revision}'
rng = random.Random(130541)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def material(name, color, roughness):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    shader = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Roughness'].default_value = roughness
    return mat


sea = material('Sea | shallow turquoise', (.055, .34, .33), .24)
foam = material('Sea | foam ivory', (.66, .83, .74), .66)
sand = material('Reef | warm sand', (.67, .53, .34), .90)
rock = material('Reef | dark stone', (.19, .23, .20), .86)
rock_light = material('Reef | warm stone', (.34, .34, .27), .88)
wood = material('Wreck | sun-worn wood', (.32, .16, .075), .78)
wood_light = material('Wreck | exposed edges', (.47, .27, .12), .77)
wood_dark = material('Wreck | aged seams', (.18, .085, .036), .85)
coral_colors = [material('Coral | terracotta', (.68, .27, .19), .77),
                material('Coral | peach', (.76, .41, .28), .78),
                material('Coral | dusty plum', (.38, .24, .29), .81)]
floor_mat = material('STUDIO | backdrop', (.68, .57, .46), .90)

if revision >= 2:
    # Reuse our own previous study's grain image, packed into the editable file
    # and exported with the GLB, rather than relying on Blender-only nodes.
    grain_file = out/'shipwreck-wood.png'
    shutil.copyfile(root/'assets/02_models/props/longship-bottle-study/longship-wood.png',grain_file)
    image = bpy.data.images.load(str(grain_file),check_existing=True)
    image.pack()
    tex = wood.node_tree.nodes.new('ShaderNodeTexImage')
    tex.image = image
    tex.extension = 'REPEAT'
    shader = next(n for n in wood.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    wood.node_tree.links.new(tex.outputs['Color'],shader.inputs['Base Color'])
    noise=sea.node_tree.nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value=48
    noise.inputs['Detail'].default_value=2
    bump=sea.node_tree.nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value=.12
    bump.inputs['Distance'].default_value=.003
    sea_shader=next(n for n in sea.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    sea.node_tree.links.new(noise.outputs['Fac'],bump.inputs['Height'])
    sea.node_tree.links.new(bump.outputs['Normal'],sea_shader.inputs['Normal'])
if revision >= 4:
    texture_dir=root/'assets/02_models/props/lighthouse-island-study'
    for mat,filename in ((sand,'lighthouse-sand.png'),(rock,'lighthouse-stone-dark.png'),
                         (rock_light,'lighthouse-stone-light.png')):
        dest=out/filename.replace('lighthouse-','shipwreck-')
        shutil.copyfile(texture_dir/filename,dest)
        texture=bpy.data.images.load(str(dest),check_existing=True)
        texture.pack()
        node=mat.node_tree.nodes.new('ShaderNodeTexImage')
        node.image=texture
        node.extension='REPEAT'
        shader=next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
        mat.node_tree.links.new(node.outputs['Color'],shader.inputs['Base Color'])
if revision >= 5:
    runpy.run_path(str(root/'tools/create_shipwreck_water_texture.py'))
    image=bpy.data.images.load(str(out/'shipwreck-water.png'),check_existing=True)
    image.pack()
    node=sea.node_tree.nodes.new('ShaderNodeTexImage')
    node.image=image
    node.extension='REPEAT'
    shader=next(n for n in sea.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    sea.node_tree.links.new(node.outputs['Color'],shader.inputs['Base Color'])


def mesh(name, vertices, faces, materials, indices=None, smooth=True):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    for mat in materials:
        data.materials.append(mat)
    for i, poly in enumerate(data.polygons):
        poly.use_smooth = smooth
        if indices is not None:
            poly.material_index = indices[i]
    return obj


def island_layer(name, rings, mat, phase, yscale=.85):
    n = 64
    vertices = []
    for radius, z in rings:
        for i in range(n):
            a = math.tau*i/n
            wobble = 1 + .04*math.sin(3*a+phase) + .019*math.cos(7*a+.4)
            vertices.append((radius*wobble*math.cos(a),radius*wobble*yscale*math.sin(a),z))
    faces = [tuple(reversed(range(n)))]
    for j in range(len(rings)-1):
        for i in range(n):
            k = (i+1) % n
            faces.append((j*n+i,j*n+k,(j+1)*n+k,(j+1)*n+i))
    faces.append(tuple((len(rings)-1)*n+i for i in range(n)))
    return mesh(name, vertices, faces, [mat])


def stone(name, location, scale, mat, subdivisions=1):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivisions, radius=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    obj.rotation_euler = (rng.uniform(-.15,.15),rng.uniform(-.15,.15),rng.uniform(0,math.tau))
    for vertex in obj.data.vertices:
        vertex.co *= rng.uniform(.88,1.1)
    obj.data.materials.append(mat)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return obj


def rod(name, a, b, radius, mat, vertices=10, radius2=None):
    a, b = Vector(a), Vector(b)
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius,
        radius2=radius if radius2 is None else radius2, depth=(b-a).length, location=(a+b)/2)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = (b-a).to_track_quat('Z','Y').to_euler()
    obj.data.materials.append(mat)
    for poly in obj.data.polygons:
        poly.use_smooth = len(poly.vertices) == 4
    return obj


def ribbon(name, points, width, z, mat):
    verts = []
    for i, (x,y) in enumerate(points):
        before = Vector(points[max(0,i-1)])
        after = Vector(points[min(len(points)-1,i+1)])
        tangent = (after-before).normalized()
        side = Vector((-tangent.y,tangent.x))
        w = width*(.35+.65*math.sin(math.pi*i/(len(points)-1)))
        verts.extend([(x+side.x*w,y+side.y*w,z),(x-side.x*w,y-side.y*w,z)])
    return mesh(name, verts, [(i*2,i*2+1,i*2+3,i*2+2) for i in range(len(points)-1)], [mat])


# Shallow water with a restrained, irregular reef edge and a sand shoal.
island_layer('Reef | sea', [(.69,-.075),(.81,-.065),(.84,-.035),(.82,.025)], sea, .35)
sandbar=island_layer('Reef | sandbar', [(.11,.016),(.37,.025),(.41,.045),(.36,.075),(.13,.105)], sand, .8, .72)
if revision >= 2:
    sandbar.scale=(.72,.72,1)
    sandbar.location=(.27,.18,-.05)
rock_count=15 if revision >= 2 else 19
for i in range(rock_count):
    angle = math.tau*i/rock_count + rng.uniform(-.18,.18) if revision >= 3 else math.tau*i/rock_count + rng.uniform(-.10,.10)
    radius = .75 + rng.uniform(-.085,.035) if revision >= 3 else .75 + rng.uniform(-.035,.035)
    size = rng.uniform(.055,.105) if revision >= 2 else rng.uniform(.07,.12)
    stone(f'Reef | perimeter rock {i+1:02}', (radius*math.cos(angle),.85*radius*math.sin(angle),.02),
          (size*1.25,size,size*.7), rock_light if i%4 == 0 else rock, 2 if revision >= 3 else (1 if i%3 else 2))
for i, (x,y,s) in enumerate(((-.5,-.10,.12),(-.37,.38,.11),(.36,.32,.10),(.52,.07,.10),
                               (.35,-.35,.11),(-.20,-.42,.08))):
    stone(f'Reef | inner rock {i+1:02}',(x,y,.045),(s*1.2,s,s*.73),rock_light if i%2 else rock,2)
arcs=((3.65,3.99),(4.65,5.00),(5.54,5.85),(.20,.46)) if revision >= 3 else ((3.4,4.13),(4.5,5.1),(5.38,6.04),(.15,.65))
for i, (start,stop) in enumerate(arcs):
    points = []
    for j in range(24):
        a = start+(stop-start)*j/23
        r = .64+.014*math.sin(6*a+i)
        points.append((r*math.cos(a),.84*r*math.sin(a)))
    ribbon(f'Reef | foam {i+1}',points,.0033 if revision >= 3 else .0045,.027,foam)
if revision >= 3:
    for i in range(20):
        angle=rng.uniform(0,math.tau)
        radius=rng.uniform(.40,.75)
        size=rng.uniform(.012,.026)
        stone(f'Reef | pebble {i+1:02}',(radius*math.cos(angle),.85*radius*math.sin(angle),.028),
              (size*1.4,size,size*.65),rock_light if i%3 == 0 else rock,1)


# A tilted, hollow shell: the end toward negative X is deliberately jagged.
tilt = math.radians(-16)
def boat_point(x,y,z):
    base=.085 if revision >= 5 else .15
    return (x,y*math.cos(tilt)-z*math.sin(tilt),base+y*math.sin(tilt)+z*math.cos(tilt))


sections = [(-.52,.14),(-.45,.19),(-.34,.23),(-.22,.25),(-.09,.26),(.04,.25),
            (.17,.23),(.29,.20),(.40,.15),(.49,.09),(.55,.025)]
cross = 12
damage = ((.18,.235,.14,.21,.12,.13,.035,0,0,0,0) if revision >= 3 else
          (.14,.105,.16,.12,.11,.045,.015,0,0,0,0))


def hull_height(k,j):
    height=-.13+.25*(1-math.sin(math.pi*j/cross))
    if revision >= 2:
        height-=damage[k]*(max(0,(j-7)/5)**1.5)
    return height


vertices = []
for inner in (False,True):
    for k,(x,width) in enumerate(sections):
        for j in range(cross+1):
            a = math.pi*j/cross
            jag = .018*math.sin(j*2.4) if k == 0 else 0
            y = (width-(.012 if inner else 0))*math.cos(a)
            z = hull_height(k,j)+(.014 if inner else 0)
            vertices.append(boat_point(x+jag,y,z))
count = len(sections)*(cross+1)
faces, indices = [], []
for inner in (0,1):
    for k in range(len(sections)-1):
        for j in range(cross):
            a=inner*count+k*(cross+1)+j
            b=a+cross+1
            faces.append((a,a+1,b+1,b) if not inner else (a,b,b+1,a+1))
            indices.append((0 if revision >= 2 else (0 if (j+k)%4 else 1)))
for k in range(len(sections)-1):
    for j in (0,cross):
        a=k*(cross+1)+j
        b=(k+1)*(cross+1)+j
        faces.append((a,b,b+count,a+count))
        indices.append(1)
for k in (0,len(sections)-1):
    for j in range(cross):
        a=k*(cross+1)+j
        faces.append((a,a+count,a+count+1,a+1))
        indices.append(1)
hull = mesh('Wreck | hull shell',vertices,faces,[wood,wood_light],indices)
if revision >= 2:
    uv=hull.data.uv_layers.new(name='UVMap')
    for poly in hull.data.polygons:
        for loop in poly.loop_indices:
            index=hull.data.loops[loop].vertex_index % count
            k,j=divmod(index,cross+1)
            uv.data[loop].uv=(k/(len(sections)-1)*2,j/cross)
if revision >= 5:
    # Trace the actual shell/sea-plane intersections rather than drawing a
    # decorative ring that can float away from the waterline.
    sea_level=.025
    for side in (-1,1):
        points=[]
        for k in range(len(sections)):
            row=vertices[k*(cross+1):(k+1)*(cross+1)]
            steps=range(cross//2,cross) if side == -1 else range(cross//2,0,-1)
            for j in steps:
                other=j+1 if side == -1 else j-1
                a,b=Vector(row[j]),Vector(row[other])
                if a.z <= sea_level < b.z:
                    t=(sea_level-a.z)/(b.z-a.z)
                    hit=a.lerp(b,t)
                    points.append((hit.x,hit.y+side*.004))
                    break
        if len(points) >= 2:
            ribbon(f'Reef | hull wash {side}',points,.0023,sea_level+.001,foam)

# Crosswise ribs and the long rims reveal the structure at a close angle.
for k in (1,3,5,7,9):
    x,width = sections[k]
    for j in range(cross):
        def rib_point(step):
            a=math.pi*step/cross
            return boat_point(x,(width-.018)*math.cos(a),hull_height(k,step)+.021)
        rod(f'Wreck | rib {k:02}-{j:02}',rib_point(j),rib_point(j+1),.0065,wood_light,8)
for side in (-1,1):
    for k in range(len(sections)-1):
        if revision >= 3 and side == -1 and k < 5:
            continue
        x,w=sections[k]
        nx,nw=sections[k+1]
        edge=0 if side == 1 else cross
        rod(f'Wreck | rim {side} {k:02}',boat_point(x,side*w,hull_height(k,edge)),
            boat_point(nx,side*nw,hull_height(k+1,edge)),
            .009,wood_light,8)
for j in (2,4,8,10):
    a=math.pi*j/cross
    for k in range(len(sections)-1):
        x,w=sections[k]
        nx,nw=sections[k+1]
        rod(f'Wreck | plank seam {j:02}-{k:02}',boat_point(x,w*math.cos(a),hull_height(k,j)),
            boat_point(nx,nw*math.cos(a),hull_height(k+1,j)),.0025,wood_dark,6)
if revision >= 4:
    for j in (3,5,7,9):
        a=math.pi*j/cross
        for k in range(len(sections)-1):
            x,w=sections[k]
            nx,nw=sections[k+1]
            rod(f'Wreck | inner seam {j:02}-{k:02}',
                boat_point(x,(w-.013)*math.cos(a),hull_height(k,j)+.016),
                boat_point(nx,(nw-.013)*math.cos(a),hull_height(k+1,j)+.016),
                .0017,wood_dark,6)
if revision >= 2:
    mast_end=boat_point(-.38,-.22,.39) if revision >= 3 else boat_point(-.32,.13,.43)
    rod('Wreck | broken mast',boat_point(-.03,0,-.06),mast_end,.026,wood,14,.014)
    if revision >= 3:
        rod('Wreck | broken yard',boat_point(-.24,-.12,.19),boat_point(.12,-.26,.015),.013,wood_light,10,.008)
    else:
        rod('Wreck | broken yard',boat_point(-.25,.11,.30),boat_point(.12,-.20,.02),.013,wood_light,10,.008)
else:
    rod('Wreck | broken mast',boat_point(-.03,0,-.06),boat_point(-.24,.03,.52),.026,wood,14,.014)
    rod('Wreck | broken yard',boat_point(-.26,-.20,.39),boat_point(.10,.17,.25),.013,wood_light,10,.008)

if revision >= 3:
    def broken_board(name,start,end,width,thickness):
        """A closed board with a deliberately uneven broken end."""
        start,end=Vector(start),Vector(end)
        direction=(end-start).normalized()
        side=Vector((-direction.y,direction.x,0)).normalized()
        outline=[start-side*width/2,start+side*width/2,end+side*width/2-direction*.035,
                 end+side*width*.22+direction*.006,end-direction*.030,
                 end-side*width*.27+direction*.002,end-side*width/2-direction*.018]
        n=len(outline)
        points=[p+Vector((0,0,thickness/2)) for p in outline]+[p-Vector((0,0,thickness/2)) for p in outline]
        faces=[tuple(range(n)),tuple(reversed(range(n,2*n)))]
        faces.extend((i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n))
        return mesh(name,points,faces,[wood],smooth=False)
    broken_board('Wreck | broken plank 01',(-.55,-.25,.035),(-.29,-.34,.038),.040,.010)
    broken_board('Wreck | broken plank 02',(-.37,-.28,.036),(-.16,-.36,.039),.031,.009)
    broken_board('Wreck | broken plank 03',(.07,.03,.050),(-.19,.08,.052),.035,.009)
    if revision >= 4:
        for i,(x,y,z) in enumerate(((-.33,-.18,.12),(-.08,-.25,.15),(.28,-.20,.24),
                                    (-.34,.17,.23),(.05,.24,.22),(.36,.17,.20))):
            point=boat_point(x,y,z-.15)
            stone(f'Wreck | small fastening {i+1:02}',point,(.004,.004,.004),wood_dark,1)

# Branching coral is sculpted as rounded tapered pieces, with the base submerged.
for group,(x,y,z,scale) in enumerate(((-.46,-.27,.055,.15),(.43,-.24,.055,.14),
                                      (-.35,.29,.06,.13),(.37,.27,.05,.12))):
    mat=coral_colors[group%len(coral_colors)]
    root_pt=Vector((x,y,z))
    if revision >= 2:
        scale*=1.25
    for branch in range(5):
        angle=math.tau*branch/5+group*.47
        end=root_pt+Vector((math.cos(angle)*scale*.44,math.sin(angle)*scale*.44,scale*(.55+.18*(branch%3))))
        middle=root_pt.lerp(end,.58)+Vector((0,0,.015))
        rod(f'Reef | coral {group+1:02} branch {branch+1:02}a',root_pt,middle,.012,mat,8,.009)
        rod(f'Reef | coral {group+1:02} branch {branch+1:02}b',middle,end,.009,mat,8,.005)
        stone(f'Reef | coral {group+1:02} tip {branch+1:02}',end,(.006,.006,.006),mat,1)
        if revision >= 3:
            fork=middle+Vector((math.cos(angle+.8)*scale*.19,math.sin(angle+.8)*scale*.19,scale*.27))
            rod(f'Reef | coral {group+1:02} fork {branch+1:02}',middle,fork,.0065,mat,8,.0035)
            stone(f'Reef | coral {group+1:02} fork tip {branch+1:02}',fork,(.004,.004,.004),mat,1)
if revision >= 4:
    for group,(x,y) in enumerate(((-.49,.10),(.22,-.42),(.51,.16))):
        for i in range(4):
            a=math.tau*i/4
            r=.018 if i else 0
            s=.030 if i else .045
            stone(f'Reef | coral cushion {group+1:02}-{i+1:02}',
                  (x+r*math.cos(a),y+r*math.sin(a),.045),
                  (s,s*.9,s*.62),coral_colors[(group+1)%len(coral_colors)],2)

# Bake evaluated copies into one export mesh while retaining named editable source objects.
asset = [obj for obj in scene.objects if obj.type == 'MESH']
if revision >= 2:
    # Cylinders carry primitive UVs; any hand-built surfaces get planar UVs.
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
for obj in copies:
    obj.select_set(True)
bpy.context.view_layer.objects.active=copies[0]
bpy.ops.object.join()
merged=bpy.context.view_layer.objects.active
merged.name='Shipwreck | collectible export'
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
scene.world.color=(.18,.18,.18)


def light(name,location,energy,size,target):
    data=bpy.data.lights.new(name,'AREA')
    data.energy=energy
    data.shape='DISK'
    data.size=size
    obj=bpy.data.objects.new(name,data)
    scene.collection.objects.link(obj)
    obj.location=location
    obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()


light('STUDIO | broad sun',(-3,-4,5),300,2.5,(0,0,.25))
light('STUDIO | cool fill',(3,-1,3),85,3,(0,0,.25))
light('STUDIO | soft rim',(1,3,4),175,2.4,(0,0,.25))
bpy.ops.object.camera_add(location=(2.8,-4,3))
camera=bpy.context.object
camera.name='STUDIO | camera'
camera.rotation_euler=(Vector((0,0,.22))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO'
camera.data.ortho_scale=1.92 if revision >= 4 else 2.05
scene.camera=camera
scene.render.engine='CYCLES'
scene.cycles.samples=40
scene.cycles.use_denoising=True
scene.render.resolution_x=1000
scene.render.resolution_y=1000
scene.view_settings.view_transform='AgX'
scene.view_settings.exposure=.1
scene.render.image_settings.file_format='PNG'
scene.render.filepath=str(out/(stem+'-blender.png'))
bpy.ops.wm.save_as_mainfile(filepath=str(out/(stem+'.blend')),compress=True)
bpy.ops.render.render(write_still=True)
camera.location=(-3.4,3.2,2.8)
camera.rotation_euler=(Vector((0,0,.22))-camera.location).to_track_quat('-Z','Y').to_euler()
scene.render.filepath=str(out/(stem+'-blender-back.png'))
bpy.ops.render.render(write_still=True)
print('SHIPWRECK_STUDY_OK',revision,'triangles='+str(triangles),'objects='+str(len(asset)),flush=True)
