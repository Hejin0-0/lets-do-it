"""Compile delivered GLBs and route-fitted structures to this project's WebGPU vertex contract.
Run assets:map. No Unity dependency, no changes to source GLBs or the live Blender session.
"""
import bpy, array, json, math, hashlib
from pathlib import Path
from mathutils import Matrix, Vector

ROOT=Path(__file__).resolve().parents[1]
SRC=ROOT/'models/sampling'; OUT=ROOT/'public/props'; OUT.mkdir(parents=True,exist_ok=True)
L=json.loads((ROOT/'tools/map-layout.json').read_text())
bpy.ops.wm.read_factory_settings(use_empty=True)
verts=array.array('f'); indices=array.array('I'); table={}; provenance=[]

def classify(mat, source):
    name=mat.name.lower() if mat else ''
    if 'led_cool' in name:return 16
    if source=='art_wall':return 6 if 'ivory' in name else 11
    if source in ('palmfloat','beachball','lifebuoy'):return 0
    if any(s in name for s in ('brass','metal','steel','chrome')):return 2
    if any(s in name for s in ('glass','flame','candle')):return 9
    if any(s in name for s in ('wood','trunk','bark')):return 1
    if any(s in name for s in ('leaf','frond','foliage')):return 5
    if any(s in name for s in ('fabric','canvas','pillow','cushion','cream_pillow')):return 3
    if source.startswith('rocks_'):return 8
    return 4 if any(s in name for s in ('tile','teal','aqua')) else 6

def color(mat):
    if mat and mat.use_nodes:
        node=next((n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
        if node:return list(node.inputs['Base Color'].default_value[:3])
    return list(mat.diffuse_color[:3]) if mat else [.8,.8,.8]

def emit(name,objs,transform=Matrix.Identity(4),source='',forced_kind=None):
    v0=len(verts)//10;i0=len(indices);lo=[math.inf]*3;hi=[-math.inf]*3
    dg=bpy.context.evaluated_depsgraph_get()
    for ob in objs:
        if ob.type!='MESH':continue
        me=bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
        me.transform(transform@ob.matrix_world);me.calc_loop_triangles();seen={}
        for tri in me.loop_triangles:
            if tri.area<1e-10:continue
            mat=me.materials[tri.material_index] if len(me.materials)>tri.material_index else None
            c=color(mat);kind=forced_kind if forced_kind is not None else classify(mat,source)
            for li in tri.loops:
                vi=me.loops[li].vertex_index;n=me.corner_normals[li].vector
                n=(n if n.length>.0001 else tri.normal).normalized()
                key=(vi,*(round(x,5) for x in n),*c,kind)
                if key not in seen:
                    seen[key]=len(verts)//10-v0;p=me.vertices[vi].co
                    q=[p.x,p.z,-p.y]
                    verts.extend([*q,n.x,n.z,-n.y,*c,kind])
                    lo=[min(a,b) for a,b in zip(lo,q)];hi=[max(a,b) for a,b in zip(hi,q)]
                indices.append(seen[key])
        bpy.data.meshes.remove(me)
    table[name]={'vertex':v0,'vertices':len(verts)//10-v0,'index':i0,'indices':len(indices)-i0,'bounds':[lo,hi]}
    assert all(math.isfinite(n) for n in lo+hi) and table[name]['indices']>0

def load(source):
    before=set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(SRC/(source+'.glb')))
    return list(set(bpy.data.objects)-before)

def pose(scale=.5,yaw=0,offset=(0,0,0)):
    ss=[scale]*3 if isinstance(scale,(int,float)) else scale
    return Matrix.Translation(Vector(offset))@Matrix.Rotation(yaw,4,'Z')@Matrix.Diagonal(Vector([*ss,1]))

# Runtime names stay stable so picking, floating toy dimensions and light emitters keep their contracts.
SPECS=[('palmring','palmfloat',.433333,math.pi/2,(0,0,0)),('ball','beachball',.55,0,(0,0,-.165)),
 ('radio','boombox',.8,0,(0,0,.01)),('chair','lounger',.5,-math.pi/2,(0,0,0)),
 ('lounger','lounger',.5,-math.pi/2,(0,0,0)),('parasol','parasol',.5,0,(0,0,0)),
 ('palm','palm',.5,0,(0,0,0)),('daybed','daybed',.5,0,(0,0,0)),
 ('hanglamp','hanglamp',1.1,0,(0,0,0)),('cabana','cabana',.5,0,(0,0,0)),
 ('boat','boat',.5,math.pi/2,(0,0,0)),('potpalm','potplant',.6,0,(0,0,0)),
 ('rock','rocks_tall',.5,0,(0,0,-.20)),('rock2','rocks_small',.5,0,(0,0,-.02)),
 ('ledge','rocks_flat',.5,0,(0,0,-.06)),('lifebuoy','lifebuoy',.5,0,(0,0,0)),
 ('pier_dock','pier_dock',(.5,.55,.5),math.pi/2,(0,0,0)),
 ('art_wall','art_wall',(.96,.5,.40),math.pi/2,(0,0,0))]
for runtime,source,scale,yaw,offset in SPECS:
    objs=load(source);emit(runtime,objs,pose(scale,yaw,offset),source)
    provenance.append({'model':runtime,'source':source+'.glb','sha256':hashlib.sha256((SRC/(source+'.glb')).read_bytes()).hexdigest(),'scale':scale,'yaw':yaw})
    for o in objs:bpy.data.objects.remove(o,do_unlink=True)

# Fitted basin. Cut the slide port through its rim instead of moving ducks through a solid wall.
objs=load('pool_structure');p=L['pool'];sx,sy,sz=p['scale'];at=p['at']
poolM=Matrix.Translation(Vector((at[0],-at[2],at[1])))@Matrix.Diagonal(Vector((sx,sz,sy,1)))
for o in objs:
    if o.type!='MESH':continue
    o.data.transform(poolM@o.matrix_world);o.matrix_world=Matrix.Identity(4)
bpy.ops.mesh.primitive_cube_add(size=1,location=(L['mouth'][0],-(L['main'][3]+.17),1.35))
cutter=bpy.context.object;cutter.scale=(.32,.7,1.3)
bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
for o in objs:
    if o.type!='MESH':continue
    bpy.context.view_layer.objects.active=o
    mod=o.modifiers.new('Slide port','BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=cutter
    bpy.ops.object.modifier_apply(modifier=mod.name)
    # The terrain is the collision/water floor; shift only visible floor tiles above it to avoid z fighting.
    if 'Checker_Floor' in o.name:o.location.z+=.002
emit('pool_structure',objs,source='pool_structure')
for o in objs+[cutter]:
    if o.name in bpy.data.objects:bpy.data.objects.remove(o,do_unlink=True)
objs=load('whirlpool_bowl');at=L['bowl']['at']
# Open a receiving port through the raised bowl lip, aligned with the flume's final approach.
bpy.ops.mesh.primitive_cube_add(size=1,location=(.1,-L['slide'][-1][2],1.28))
cutter=bpy.context.object;cutter.scale=(.62,.29,.58)
bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
for o in objs:
    if o.type!='MESH':continue
    o.data.transform(pose(.5,0,(at[0],-at[2],at[1]+.002))@o.matrix_world);o.matrix_world=Matrix.Identity(4)
    bpy.context.view_layer.objects.active=o
    mod=o.modifiers.new('Flume receiving port','BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=cutter
    bpy.ops.object.modifier_apply(modifier=mod.name)
emit('whirlpool_bowl',objs,source='whirlpool_bowl')
for o in objs+[cutter]:bpy.data.objects.remove(o,do_unlink=True)

def mesh(name,vs,fs,col):
    me=bpy.data.meshes.new(name);me.from_pydata(vs,[],fs);me.update()
    ob=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(ob)
    mat=bpy.data.materials.new(name);mat.diffuse_color=(*col,1);me.materials.append(mat)
    for f in me.polygons:f.use_smooth=True
    return ob

def section(points):
    vs=[];frames=[]
    for i,p in enumerate(points):
        t=(Vector(points[min(i+1,len(points)-1)])-Vector(points[max(i-1,0)])).normalized()
        u=t.cross(Vector((0,1,0)) if abs(t.y)<.9 else Vector((1,0,0))).normalized();v=t.cross(u).normalized()
        frames.append((Vector(p),u,v))
    return frames

def sweep(name,points,radius,col,half=False):
    frames=section(points);vs=[];fs=[];n=16 if half else (8 if name.startswith('LED_') else 24)
    for p,u,v in frames:
        for j in range(n+1):
            a=math.pi*j/n if half else math.tau*j/n
            q=p+radius*(u*math.cos(a)+(Vector((0,-1,0)) if half else v)*math.sin(a))
            vs.append((q.x,-q.z,q.y))
    for i in range(len(points)-1):
        for j in range(n):a=i*(n+1)+j;fs.append((a,a+1,a+n+2,a+n+1))
    # Surface normals face out for the full bore, inward for the open flume.
    ob=mesh(name,vs,fs,col)
    import bmesh
    bm=bmesh.new();bm.from_mesh(ob.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(ob.data);bm.free()
    return ob,frames

# A route-fitted derivative of the tube samples: single visible acrylic skin, open ports, teal hoops.
obs=[];tube,frames=sweep('Return_acrylic',L['tube'],L['tubeRadius'],(.35,.70,.72));obs.append(tube)
emit('return_glass',[tube],forced_kind=13)
def hoop(p,u,v,r):
    pts=[p+r*(u*math.cos(j*math.tau/32)+v*math.sin(j*math.tau/32)) for j in range(33)]
    ob,_=sweep('LED_Cool_collar',pts,.012,(.82,.91,.90));return ob
for i in sorted(set([0,len(frames)-1]+list(range(7,len(frames)-1,11)))):
    p,u,v=frames[i];obs.append(hoop(p,u,v,L['tubeRadius']+.008))
def support(x,z,low,high,width=.035):
    if high<=low+.04:return
    vs=[(x+sx*width,-z+sz*width,y) for y in (low,high) for sz in (-1,1) for sx in (-1,1)]
    fs=[(0,1,3,2),(4,6,7,5),(0,4,5,1),(2,3,7,6),(0,2,6,4),(1,5,7,3)]
    obs.append(mesh('Ivory_support',vs,fs,(.83,.79,.67)))
for x,y,z,ground in L['supports']:
    support(x,z,ground,y-L['tubeRadius'])
emit('return_fittings',obs[1:])
flume,frames=sweep('Slide_flume',L['slide'],.11,(.78,.84,.82),half=True)
obs=[flume]
for x,y,z,ground in L['slideSupports']:
    support(x,z,ground,y-.11,.025)
emit('slide_flume',obs,forced_kind=4)
# A thin flowing sheet follows the flume rather than relying on the pools' horizontal water grid.
vs=[];fs=[];cross=8
for p,u,v in section(L['slide']):
    for j in range(cross+1):
        side=j/cross*2-1
        q=p+u*.096*side+Vector((0,-.043+.003*side*side,0));vs.append((q.x,-q.z,q.y))
for i in range(len(L['slide'])-1):
    for j in range(cross):a=i*(cross+1)+j;fs.append((a,a+1,a+cross+2,a+cross+1))
sheet=mesh('Flume_flowing_water',vs,fs,(.04,.55,.62));emit('flume_water',[sheet],forced_kind=14)
# Slim porcelain / cool LED edges, white by day and emissive after sunset.
led=[]
for side in (-1,1):
    pts=[]
    for p,u,v in section(L['slide']):
        q=p+u*.112*side+Vector((0,.002,0));pts.append(tuple(q))
    ob,_=sweep('LED_Cool_flume_edge',pts,.009,(.85,.94,.95));led.append(ob)
pool=L['pool'];cx,_,cz=pool['at'];sx,_,sz=pool['scale'];rim=[]
for x,z,start in [(3.35,1.85,0),(-3.35,1.85,90),(-3.35,-1.85,180),(3.35,-1.85,270)]:
    for j in range(9):
        a=math.radians(start+j*90/8);rim.append((cx+(x+.34*math.cos(a))*sx,1.235,cz+(z+.34*math.sin(a))*sz))
rim.append(rim[0])
def lit_runs(name,points,radius,blocked):
    # Leave real gaps at slide ports instead of placing a luminous bar across the opening.
    run=[]
    for p in points:
        if blocked(p):
            if len(run)>1:led.append(sweep(name,run,radius,(.85,.94,.95))[0])
            run=[]
        else:run.append(p)
    if len(run)>1:led.append(sweep(name,run,radius,(.85,.94,.95))[0])
dense=[]
for a,b in zip(rim,rim[1:]):
    count=max(1,math.ceil((Vector(b)-Vector(a)).length/.025))
    dense.extend(tuple(Vector(a).lerp(Vector(b),j/count)) for j in range(count))
dense.append(rim[-1])
lit_runs('LED_Cool_under_coping',dense,.009,lambda p:p[2]>L['main'][3]-.04 and abs(p[0]-L['mouth'][0])<.18)
pts=[(L['bowl']['at'][0]+.915*math.cos(i*math.tau/96),1.19,L['bowl']['at'][2]+.915*math.sin(i*math.tau/96)) for i in range(97)]
lit_runs('LED_Cool_bowl_lip',pts,.008,lambda p:p[0]>L['bowl']['at'][0]+.78 and abs(p[2]-L['bowl']['at'][2])<.18)
for x,y,z,power in L['poolLights']:
    # Lens set just proud of the inside face; its housing remains hidden in the shell.
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8,radius=1,location=(x,-z,y))
    ob=bpy.context.object;ob.name='LED_Cool_pool_lens'
    round_pool=math.hypot(x-L['bowl']['at'][0],z-L['bowl']['at'][2])<1
    if round_pool:
        ob.scale=(.038,.038,.012)
        radial=Vector((x-L['bowl']['at'][0],-(z-L['bowl']['at'][2]),0)).normalized()
        normal=Vector((-radial.x*.755,-radial.y*.755,1)).normalized()
        ob.rotation_euler=Vector((0,0,1)).rotation_difference(normal).to_euler()
    elif abs(x-L['main'][0])<.1 or abs(x-L['main'][2])<.1:ob.scale=(.016,.065,.032)
    else:ob.scale=(.065,.016,.032)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    for poly in ob.data.polygons:poly.use_smooth=True
    mat=bpy.data.materials.new('LED_Cool_lens');mat.diffuse_color=(.8,.94,1,1);ob.data.materials.append(mat);led.append(ob)
emit('architecture_lights',led,forced_kind=16)
# Save the actual fitted models as editable Blender source, separate from original standalone samples.
bpy.ops.wm.save_as_mainfile(filepath=str(SRC/'map-fitted.blend'))
assert len(verts)%10==0 and len(indices)%3==0
with (OUT/'sampling.bin').open('wb') as f:verts.tofile(f);indices.tofile(f)
data={'vertices':len(verts)//10,'indices':len(indices),'models':table}
(ROOT/'src/pool/sampling-shapes.js').write_text('// Generated by tools/build_sampling.py; linear vertex colours, Y-up, one unit = 2m.\nexport const SAMPLING_SHAPES = '+json.dumps(data,indent=2)+';\n')
(OUT/'sampling-manifest.json').write_text(json.dumps({'generator':'tools/build_sampling.py','vertex_stride':40,'units':'one runtime unit = 2 metres','models':table,'sources':provenance,'routes':'tools/map-layout.json','transparent_skin':'single layer, alpha-to-coverage, no shadow'},indent=2)+'\n')
print('SAMPLING',len(table),'models',len(verts)//10,'vertices',len(indices)//3,'triangles')
