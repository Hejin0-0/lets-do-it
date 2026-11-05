"""Build floating collectible models in a disposable Blender process."""
import bpy, math, sys, json
from pathlib import Path
from mathutils import Vector
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT/'assets/02_models/props/collectibles'
STUDY = ROOT/'assets/02_models/props/sailboat-bottle-study/sailboat-bottle-v9.blend'
IDS=['bottle-first','bottle-second','bottle-third','diorama-first','diorama-second','diorama-third']
arg=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
if len(arg)!=1 or arg[0] not in IDS+['all']: raise SystemExit('usage: -- <id|all>')
OUT.mkdir(parents=True,exist_ok=True)

def mat(name,c,rough=.5,metal=0,trans=0):
 m=bpy.data.materials.new(name); m.diffuse_color=(*c,1); m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*c,1); p.inputs['Roughness'].default_value=rough; p.inputs['Metallic'].default_value=metal; p.inputs['Transmission Weight'].default_value=trans
 return m

def mesh(name,v,f,m):
 d=bpy.data.meshes.new(name); d.from_pydata(v,[],f); d.update(); o=bpy.data.objects.new(name,d); bpy.context.collection.objects.link(o); o.data.materials.append(m); return o

def lathe(name,profile,m,n=32):
 v=[(x,r*math.cos(i*2*math.pi/n),.36+r*math.sin(i*2*math.pi/n)) for x,r in profile for i in range(n)]
 f=[(j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i) for j in range(len(profile)-1) for i in range(n)]
 return mesh(name,v,f,m)

def box(name,loc,dim,m):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc); o=bpy.context.object; o.name=name; o.dimensions=dim; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); o.data.materials.append(m); return o

def cone(name,loc,r1,r2,depth,m,n=12):
 bpy.ops.mesh.primitive_cone_add(vertices=n,radius1=r1,radius2=r2,depth=depth,location=loc); o=bpy.context.object; o.name=name; o.data.materials.append(m); return o

def line(name,a,b,r,m,n=8):
 a,b=Vector(a),Vector(b); o=cone(name,(a+b)/2,r,r,(b-a).length,m,n); o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler(); return o

def palette():
 return {k:mat(*v) for k,v in {
 'glass':('Glass | clear seafoam',(.88,.98,.94),.055,0,1), 'wood':('Wood | warm maple',(.48,.25,.105)), 'dark':('Wood | deep hull',(.17,.075,.038)), 'coral':('Paint | muted coral',(.68,.20,.13)), 'cream':('Canvas | warm ivory',(.88,.80,.64)), 'black':('Canvas | charcoal',(.045,.052,.057)), 'cork':('Cork | toasted honey',(.52,.31,.14)), 'brass':('Brass | aged champagne',(.54,.36,.13),.3,.65), 'ocean':('Ocean | turquoise resin',(.075,.36,.34)), 'rock':('Rock | warm slate',(.25,.24,.20)), 'stone':('Stone | volcanic ash',(.32,.28,.24)), 'sand':('Sand | warm shore',(.68,.55,.34)), 'leaf':('Leaf | palm green',(.08,.31,.15)), 'leaf2':('Leaf | sunlit green',(.16,.42,.20)), 'snow':('Snow | soft ivory',(.9,.94,.91)), 'smoke':('Smoke | warm grey',(.55,.55,.51)), 'lava':('Lava | ember',(.85,.17,.035)), 'metal':('Metal | charcoal',(.09,.1,.10)), 'red':('Paint | funnel red',(.8,.025,.018)), 'ochre':('Paint | ochre stripe',(.66,.39,.10)), 'foliage':('Leaf | deep foliage',(.055,.22,.095)), 'ice':('Snow | pale ice',(.67,.85,.84))}.items()}

def bottle(p):
 outer=[(-.86,0),(-.86,.20),(-.85,.245),(-.82,.272),(-.77,.282),(.48,.282),(.55,.27),(.61,.22),(.68,.145),(.73,.108),(.89,.108),(.91,.116),(.94,.116),(.95,.108)]
 inner=[(.95,.086),(.91,.084),(.73,.084),(.68,.105),(.60,.20),(.53,.248),(.47,.258),(-.77,.258),(-.82,.245),(-.835,.20),(-.835,0)]
 lathe('Bottle | glass shell',outer+inner,p['glass']); lathe('Bottle | cork',[(.85,.082),(.87,.085),(1,.093),(1.02,.088),(1.02,0)],p['cork']); lathe('Bottle | collar',[(.805,.109),(.805,.113),(.826,.113),(.826,.109)],p['brass'])
 # Small flattened resin plinth within the shell.
 o=cone('Ocean | resin sea',(-.06,0,.155),1,1,.04,p['ocean'],32); o.scale=(.57,.18,1)

def shaped_hull(p, pirate):
 # Sheer rises at both ends, with a narrow bottom and pointed bow at +x.
 outline=[(-.47,-.045),(-.44,-.085),(-.34,-.105),(-.15,-.11),(.10,-.105),(.28,-.08),(.40,-.045),(.46,0),(.40,.045),(.28,.08),(.10,.105),(-.15,.11),(-.34,.105),(-.44,.085),(-.47,.045)]
 n=len(outline); top=[(x,y,.245+max(0,abs(x)-.24)*.10) for x,y in outline]
 bottom=[(x*.87-.015,y*.58,.16+max(0,x-.15)*.08) for x,y in outline]
 mesh('Ship | shaped hull',top+bottom,[tuple(range(n)),tuple(reversed(range(n,2*n)))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)],p['dark'] if pirate else p['coral'])
 mesh('Ship | deck',[(x*.94,y*.88,z+.002) for x,y,z in top],[tuple(range(n))],p['wood'])
 # Stripe lies just outside the sloping sides and follows the sheer.
 v=[]
 for t in (.38,.48):
  for i in range(n):
   x,y,z=Vector(top[i]).lerp(Vector(bottom[i]),t); v.append((x,y+(0.001 if y>0 else -0.001),z))
 mesh('Ship | hull stripe',v,[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)],p['ochre'] if pirate else p['cream'])

def rail(p, x1, x2, y, z):
 line('Railing | handrail',(x1,y,z+.045),(x2,y,z+.045),.003,p['cream'],6)
 for i in range(5):
  x=x1+(x2-x1)*i/4; line('Railing | post',(x,y,z),(x,y,z+.045),.0025,p['cream'],6)

def square_sail(x,z,width,height,p):
 # Grid with a shallow billow toward the viewer.
 v=[]; nx=6; nz=4
 for j in range(nz+1):
  t=j/nz
  for i in range(nx+1):
   u=i/nx; v.append((x+(u-.5)*width*(1-.12*t),-.005-.022*math.sin(math.pi*u)*math.sin(math.pi*t),z-height*t))
 f=[(j*(nx+1)+i,j*(nx+1)+i+1,(j+1)*(nx+1)+i+1,(j+1)*(nx+1)+i) for j in range(nz) for i in range(nx)]
 mesh('Pirate | billowed black sail',v,f,p['black'])
 line('Pirate | yard',(x-width*.53,0,z),(x+width*.53,0,z),.004,p['wood'],6)

def smoke_paint(p):
 # Paint strips track the inner wall of the cylindrical body (radius .258).
 for x0,z0,length in [(.08,.53,.20),(-.12,.565,.17),(-.31,.58,.12)]:
  verts=[]; steps=8
  for i in range(steps+1):
   t=i/steps; x=x0-length*t; z=z0+.013*math.sin(math.pi*t)
   w=.004+.010*math.sin(math.pi*t)
   for dz in (-w,w):
    zz=z+dz; y=-math.sqrt(max(.0001,.258**2-(zz-.36)**2))+.002
    verts.append((x,y,zz))
  mesh('Smoke | painted wisp',verts,[(2*i,2*i+1,2*i+3,2*i+2) for i in range(steps)],p['smoke'])

def ship(p,pirate=False):
 shaped_hull(p,pirate)
 if pirate:
  box('Pirate | stern castle',(-.34,0,.285),(.20,.16,.08),p['dark'])
  box('Pirate | castle deck',(-.34,0,.33),(.22,.18,.012),p['wood'])
  for x,h,w in [(-.26,.52,.18),(-.02,.59,.22),(.20,.53,.17)]:
   line('Pirate | mast',(x,0,.25),(x,0,h),.007,p['wood'],8)
   square_sail(x,h-.035,w,.085,p); square_sail(x,h-.14,w*1.12,.085,p)
  line('Pirate | bowsprit',(.26,0,.26),(.49,0,.30),.006,p['wood'])
  cone('Pirate | crow nest',(-.02,0,.515),.03,.038,.025,p['dark'],10)
  mesh('Pirate | plain flag',[(-.02,0,.59),(-.13,0,.58),(-.12,0,.55),(-.02,0,.56)],[(0,1,2,3)],p['black'])
 else:
  box('Steamer | lower cabin',(-.12,0,.295),(.39,.145,.095),p['cream'])
  box('Steamer | lower roof',(-.12,0,.345),(.42,.17,.015),p['wood'])
  box('Steamer | upper cabin',(-.16,0,.385),(.23,.115,.07),p['cream'])
  box('Steamer | upper roof',(-.16,0,.425),(.26,.14,.015),p['dark'])
  for y in (-.074,.074):
   for x in (-.26,-.17,-.08,.01): box('Steamer | lower window',(x,y,.30),(.045,.004,.035),p['metal'])
  for y in (-.059,.059):
   for x in (-.23,-.16,-.09): box('Steamer | upper window',(x,y,.39),(.04,.004,.03),p['metal'])
  for y in (-.088,.088): rail(p,-.30,.05,y,.355)
  cone('Steamer | red funnel',(.14,0,.405),.031,.027,.23,p['red'],12)
  cone('Steamer | black funnel band',(.14,0,.52),.03,.03,.018,p['metal'],12)
  # Keep the far wheel; move the near wheel out from the hull and in front
  # of an open half-round paddle box, still inside the glass wall.
  for side in (-1,1):
   y=side*.185; rear=side*.165; cx=-.06; cz=.245; radius=.075
   arc=[(cx+radius*math.cos(math.pi*i/12),rear,cz+radius*math.sin(math.pi*i/12)) for i in range(13)]
   mesh('Steamer | half-round paddle box',[(cx,rear,cz)]+arc,[(0,i+1,i+2) for i in range(12)],p['coral'])
   for i in range(12): line('Steamer | box rim',arc[i],arc[i+1],.005,p['wood'],6)
   for i in range(8):
    a=math.tau*i/8; x=cx+radius*math.cos(a); z=cz+radius*math.sin(a)
    line('Steamer | paddle spoke',(cx,y,cz),(x,y,z),.005,p['cream'],6)
    paddle=box('Steamer | paddle',(x,y,z),(.027,.018,.015),p['wood']); paddle.rotation_euler[1]=-a
   wheel=cone('Steamer | wheel hub',(cx,y,cz),.015,.015,.012,p['brass'],10); wheel.rotation_euler[0]=math.pi/2
  smoke_paint(p)

def blob(name,loc,scale,material,seed=0,sub=2):
 bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub,radius=1,location=loc); o=bpy.context.object; o.name=name
 for v in o.data.vertices:
  x,y,z=v.co; k=1+.10*math.sin(9*x+seed)*math.sin(8*y-2*seed)+.065*math.sin(13*z+5*y+seed); v.co.x*=scale[0]*k; v.co.y*=scale[1]*k; v.co.z*=scale[2]*k
 o.data.materials.append(material); return o

def shoreline(a): return .103*(1+.075*math.sin(3*a+.3)+.055*math.sin(7*a-.5)+.025*math.sin(11*a))

def island_base(p):
 raft=blob('Island | lumpy rock raft',(0,0,-.018),(.11,.105,.048),p['rock'],2,3)
 bpy.context.view_layer.objects.active=raft; mod=raft.modifiers.new('Simplify rock','DECIMATE'); mod.ratio=.7; bpy.ops.object.modifier_apply(modifier=mod.name)
 n=64; v=[]
 for i in range(n):
  a=math.tau*i/n; r=shoreline(a)
  for mul in (.87,1.22): v.append((r*mul*math.cos(a),r*mul*math.sin(a),.001))
 mesh('Ocean | irregular shore skirt',v,[(2*i,2*((i+1)%n),2*((i+1)%n)+1,2*i+1) for i in range(n)],p['ocean'])
 blob('Sand | small beach',(.073,-.035,.018),(.035,.041,.009),p['sand'],4)
 for i,(x,y) in enumerate([(.075,.047),(-.085,-.035),(.085,-.07)]): blob('Rock | loose shore stone',(x,y,.014),(.015,.011,.01),p['rock'],i)

def volcano(p):
 n=48; levels=10; verts=[]
 for j in range(levels+1):
  t=j/levels
  for i in range(n):
   a=math.tau*i/n; ridge=1+.12*math.sin(7*a+.3)+.065*math.sin(13*a+2*t); r=(.088*(1-t)+.023*t)*ridge
   verts.append((r*math.cos(a),r*math.sin(a),.025+.115*t+.003*math.sin(11*a+4*t)))
 f=[(j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i) for j in range(levels) for i in range(n)]
 o=mesh('Volcano | craggy ridges',verts,f,p['stone']); o.data.materials.append(p['rock'])
 for poly in o.data.polygons:
  if poly.center.z>.115: poly.material_index=1
 # Irregular broken crater rim segments and dark inner well.
 for i in range(12):
  if i in (2,7): continue
  a=math.tau*i/12; blob('Volcano | broken rim',(.023*math.cos(a),.023*math.sin(a),.14),(.009,.007,.007),p['rock'],i,1)
 cone('Volcano | crater lava',(0,0,.137),.018,.018,.003,p['lava'],16)
 for a in (3.7,4.3,5.0):
  v=[]
  for j in range(9):
   t=j/8; r=.026+.055*t; ang=a+.05*math.sin(t*10+a); z=.139-.10*t+.004
   for offset in (-.004,.004): v.append((r*math.cos(ang)+offset,r*math.sin(ang),z))
  mesh('Lava | winding streak',v,[(2*j,2*j+1,2*j+3,2*j+2) for j in range(8)],p['lava'])
 # Overlapping, intersecting puffs form one object; voxel remesh blends the silhouette.
 puffs=[]
 for x,y,z,r in [(0,0,.154,.017),(.008,0,.17,.022),(.022,.002,.188,.026),(.042,.004,.204,.025),(.057,.003,.213,.018)]: puffs.append(blob('Smoke | plume puff',(x,y,z),(r,r*.8,r),p['smoke'],x*50,2))
 bpy.ops.object.select_all(action='DESELECT')
 for o in puffs: o.select_set(True)
 bpy.context.view_layer.objects.active=puffs[0]; bpy.ops.object.join(); o=puffs[0]; o.name='Smoke | billowing plume'
 mod=o.modifiers.new('Blend plume','REMESH'); mod.mode='VOXEL'; mod.voxel_size=.004; mod.use_smooth_shade=True
 bpy.ops.object.modifier_apply(modifier=mod.name)
 mod=o.modifiers.new('Simplify plume','DECIMATE'); mod.ratio=.35; bpy.ops.object.modifier_apply(modifier=mod.name)

def palm_frond(x,y,h,a,p,idx):
 dx,dy=math.cos(a),math.sin(a); v=[]
 for j in range(7):
  t=j/6; r=.063*t; z=h+.012*math.sin(math.pi*t)-.037*t*t; width=.014*math.sin(math.pi*t)**.7
  for side in (-1,1): v.append((x+dx*r-dy*width*side,y+dy*r+dx*width*side,z))
 mesh('Palm | drooping frond',v,[(2*j,2*j+1,2*j+3,2*j+2) for j in range(6)],p['leaf2'] if idx%2 else p['leaf'])

def jungle(p):
 for i in range(19):
  a=i*2.4; r=.067*math.sqrt((i+.5)/19); x,y=r*math.cos(a),r*math.sin(a); z=.043+.031*(1-r/.08)
  blob('Jungle | foliage clump',(x,y,z),(.032,.03,.029),[p['leaf'],p['leaf2'],p['foliage']][i%3],i,1)
 for i,(x,y,h) in enumerate([(-.045,-.025,.145),(.03,.025,.16),(-.04,.04,.13),(.047,-.035,.14),(0,0,.18)]):
  pts=[(x+.012*(t/4)**2,y+.005*math.sin(t/4*math.pi),.025+(h-.025)*t/4) for t in range(5)]
  for a,b in zip(pts,pts[1:]): line('Palm | curved trunk',a,b,.006,p['wood'],7)
  for j in range(7): palm_frond(pts[-1][0],pts[-1][1],h,math.tau*j/7+i*.35,p,j)
 for i in range(9):
  a=math.tau*i/9; pts=[]
  for j in range(6):
   t=j/5; r=.067+.045*t; pts.append((r*math.cos(a+.05*math.sin(t*4)),r*math.sin(a+.05*math.sin(t*4)),.065-.075*t))
  for a1,b1 in zip(pts,pts[1:]): line('Jungle | hanging vine',a1,b1,.0015,p['leaf'],5)

def pine_tier(p,z,r):
 n=20; v=[(0,0,z+.05)]
 for i in range(n):
  a=math.tau*i/n; rr=r*(1+.12*math.sin(i*7)); v.append((rr*math.cos(a),rr*math.sin(a),z-.008*(i%2)))
 mesh('Pine | drooping tier',v,[(0,i+1,(i+1)%n+1) for i in range(n)],p['leaf'])
 # Follow the slope of the leaf tier: merely shrinking the ring would
 # bury the snow below the conical surface.
 peak=z+.05; fraction=.94
 v=[(0,0,peak+.002)]+[(x*fraction,y*fraction,peak+fraction*(zz-peak)+.002) for x,y,zz in v[1:]]
 mesh('Snow | branch mantle',v,[(0,i+1,(i+1)%n+1) for i in range(n)],p['snow'])

def snowy(p):
 for x,y,s in [(-.03,0,.052),(.035,.025,.045),(.015,-.042,.04)]: blob('Snow | rock drift',(x,y,.026),(s,s*.8,.014),p['snow'],x*40,2)
 cone('Pine | trunk',(0,0,.08),.009,.007,.11,p['wood'])
 for z,r in [(.065,.063),(.088,.056),(.11,.048),(.132,.039),(.151,.031),(.17,.022)]: pine_tier(p,z,r)
 for x,y in [(.095,.045),(-.09,-.07)]: blob('Snow | ice floe',(x,y,.004),(.014,.009,.002),p['ice'],3,1)

def island(p,kind):
 island_base(p)
 if kind=='diorama-first': volcano(p)
 elif kind=='diorama-second': jungle(p)
 else: snowy(p)

def apply_all():
 bpy.ops.object.select_all(action='SELECT')
 for o in list(bpy.context.selected_objects):
  bpy.context.view_layer.objects.active=o
  if o.type in {'CURVE','MESH'}:
   bpy.ops.object.convert(target='MESH'); bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)

def make(id):
 bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
 if id=='bottle-first':
  with bpy.data.libraries.load(str(STUDY),link=False) as (src,dst): dst.objects=[n for n in src.objects if not n.startswith(('STUDIO','Cradle')) and n not in ('Camera',)]
  for o in dst.objects:
   if o and o.type in {'MESH','CURVE'}: bpy.context.collection.objects.link(o)
  # Decimate evaluated geometry, retaining the same design and separate materials.
  for o in list(bpy.context.scene.objects):
   bpy.context.view_layer.objects.active=o; o.select_set(True); bpy.ops.object.convert(target='MESH'); o.select_set(False)
   if len(o.data.polygons)>100:
    mod=o.modifiers.new('Game budget','DECIMATE'); mod.ratio=.48; bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=mod.name)
   o.location.z-=.27; o.location*=.16; o.scale*=.16
 elif id.startswith('bottle'):
  p=palette(); bottle(p); ship(p,id=='bottle-third')
  for o in bpy.context.scene.objects: o.location.z-=.27; o.location*=.16; o.scale*=.16
 else: p=palette(); island(p,id)
 apply_all()
 asset=list(bpy.context.scene.objects); deps=bpy.context.evaluated_depsgraph_get(); tris=0; coords=[]; materials={}
 for o in asset:
  if o.type!='MESH': continue
  ob=o.evaluated_get(deps); m=ob.to_mesh(); m.calc_loop_triangles(); tris+=len(m.loop_triangles); coords.extend([tuple(o.matrix_world@v.co) for v in m.vertices]); ob.to_mesh_clear()
  for m in o.data.materials:
   if m: materials[m.name]=list(m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value)
 bounds=[[min(c[i] for c in coords),max(c[i] for c in coords)] for i in range(3)]
 print('MODEL_STATS '+json.dumps(dict(id=id,triangles=tris,bounds=bounds,materials=materials)),flush=True)
 if tris>8000: raise RuntimeError('triangle budget exceeded')
 bpy.ops.wm.save_as_mainfile(filepath=str(OUT/(id+'.blend')),compress=True)
 bpy.ops.export_scene.gltf(filepath=str(OUT/(id+'.glb')),export_format='GLB',export_apply=True)
 # Studio is created only after saving/exporting the model.
 world=bpy.context.scene.world; world.color=(.8,.8,.8); world.use_nodes=True; world.node_tree.nodes['Background'].inputs['Color'].default_value=(.20,.17,.15,1); world.node_tree.nodes['Background'].inputs['Strength'].default_value=.8
 def area(loc,energy,size):
  d=bpy.data.lights.new('Studio','AREA'); d.energy=energy; d.shape='DISK'; d.size=size; o=bpy.data.objects.new('Studio',d); bpy.context.collection.objects.link(o); o.location=loc; o.rotation_euler=(-o.location).to_track_quat('-Z','Y').to_euler()
 area((-.6,.9,1.5),40,1.0); area((.8,-.5,1.4),8,1.3)
 # Fit all evaluated vertices in camera space with 10% margin on each side.
 direction=Vector((.38,-1.1,.44)).normalized()
 rotation=(-direction).to_track_quat('-Z','Y'); inv=rotation.inverted()
 projected=[inv @ Vector(c) for c in coords]
 xmin=min(v.x for v in projected); xmax=max(v.x for v in projected)
 ymin=min(v.y for v in projected); ymax=max(v.y for v in projected)
 center=rotation @ Vector(((xmin+xmax)/2,(ymin+ymax)/2,0))
 bpy.ops.object.camera_add(location=center+direction*1.3); cam=bpy.context.object
 cam.rotation_euler=rotation.to_euler(); cam.data.type='ORTHO'
 cam.data.ortho_scale=max(xmax-xmin,(ymax-ymin)*800/600)/.8
 s=bpy.context.scene; s.camera=cam; s.view_settings.view_transform='AgX'
 s.render.engine='CYCLES'; s.cycles.samples=24; s.cycles.use_denoising=True; s.render.resolution_x=800; s.render.resolution_y=600; s.render.resolution_percentage=100; s.render.image_settings.file_format='PNG'; s.render.filepath=str(OUT/(id+'.png')); bpy.ops.render.render(write_still=True)
for id in (IDS if arg[0]=='all' else arg): make(id)
