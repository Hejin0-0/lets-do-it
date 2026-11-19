"""Build floating collectible models in a disposable Blender process."""
import bpy, math, sys, json
from pathlib import Path
from mathutils import Vector
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT/'assets/02_models/props/collectibles'
STUDY = ROOT/'assets/02_models/props/sailboat-bottle-study/sailboat-bottle-v9.blend'
IDS=['bottle-first','bottle-second','bottle-third','diorama-first','diorama-second','diorama-third',
     'bottle-fourth','bottle-fifth','bottle-sixth','diorama-fourth','diorama-fifth','diorama-sixth']
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

def shelf2_palette(p):
 # These extra colors are created only for shelf 2, preserving the first shelf.
 p.update({k:mat(*v) for k,v in {
  'lamp':('Lamp | warm glow',(1.0,.62,.19)),
  'teal':('Paint | submarine teal',(.035,.31,.30)),
  'white':('Paint | lighthouse ivory',(.91,.85,.72)),
  'sailcream':('Canvas | bright warm cream',(.99,.93,.78)),
  'houseblue':('Paint | cottage blue',(.25,.48,.53)),
  'houseyellow':('Paint | cottage ochre',(.74,.55,.26)),
  'housepink':('Paint | cottage coral',(.68,.33,.25)),
  'coralpink':('Paint | reef coral',(.78,.34,.29)),
  'coralgold':('Paint | reef gold',(.83,.54,.25)),
  'coralrose':('Paint | reef rose',(.66,.25,.32)),
 }.items()})
 shader=p['lamp'].node_tree.nodes.get('Principled BSDF')
 shader.inputs['Emission Color'].default_value=(1,.42,.08,1)
 shader.inputs['Emission Strength'].default_value=.7

def small_boat(name,center,length,width,p):
 # Open clinker hull, tapering to raised ends, no filled deck.
 cx,cy,cz=center
 outline=[(-.5,0),(-.40,-.30),(-.20,-.48),(.20,-.48),(.40,-.30),(.5,0),(.40,.30),(.20,.48),(-.20,.48),(-.40,.30)]
 n=len(outline); rings=[]
 for t in (0,.25,.5,.75,1):
  rings.extend([(cx+x*length*(.88+.12*t),cy+y*width*(.48+.52*t),cz+length*(.08*t+.09*abs(x)**3)) for x,y in outline])
 faces=[(j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i) for j in range(4) for i in range(n)]
 mesh(name+' | clinker hull',rings,faces,p['wood'])
 for j in (1,2,3,4):
  for i in range(n):
   a=Vector(rings[j*n+i]); b=Vector(rings[j*n+(i+1)%n]); a.y+=.001 if a.y>cy else -.001; b.y+=.001 if b.y>cy else -.001
   line(name+' | plank seam',a,b,length*.0025,p['dark'],5)
 return rings

def rowboat(p):
 # These offsets are in the unscaled bottle frame.  The exterior sea line is
 # z=.195 here; after make() scales the model it becomes z=-.012.
 existing=set(bpy.context.scene.objects)
 sea=next(o for o in existing if o.name.startswith('Ocean | resin sea'))
 sea.location.z+=.065
 # A transom at -x and pointed bow at +x; nested rings leave the top open.
 outline=[(-.36,-.065),(-.29,-.106),(-.10,-.125),(.12,-.115),(.28,-.075),(.37,0),(.28,.075),(.12,.115),(-.10,.125),(-.29,.106),(-.36,.065)]
 n=len(outline); v=[]
 for t in (0,.33,.66,1):
  for x,y in outline:
   v.append((x*(.90+.10*t),y*(.52+.48*t),.155+.115*t+.035*(max(x,0)/.37)**2))
 faces=[(j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i) for j in range(3) for i in range(n)]
 mesh('Rowboat | raised straked hull',v,faces,p['wood'])
 # Bottom is visible between thwarts, and gunwales outline the open interior.
 mesh('Rowboat | inner floor',v[:n],[tuple(range(n))],p['dark'])
 for j in (1,2,3):
  for i in range(n):
   a=Vector(v[j*n+i]); b=Vector(v[j*n+(i+1)%n])
   a.y+=.0015 if a.y>0 else -.0015; b.y+=.0015 if b.y>0 else -.0015
   line('Rowboat | plank strake',a,b,.003 if j<3 else .006,p['dark'] if j<3 else p['wood'],6)
 for x in (-.16,.10): box('Rowboat | thwart',(x,0,.269),(.052,.215,.014),p['wood'])
 for y in (-.045,.045):
  line('Rowboat | shipped oar',(-.31,y,.282),(.27,y,.282),.006,p['wood'],6)
  box('Rowboat | oar blade',(-.30,y,.283),(.12,.025,.009),p['wood'])
 line('Lantern | post',(.27,0,.29),(.27,0,.34),.007,p['dark'])
 box('Lantern | base',(.27,0,.34),(.075,.065,.012),p['brass'])
 box('Lantern | warm core',(.27,0,.385),(.044,.038,.07),p['lamp'])
 for y in (-.028,.028): box('Lantern | glass pane',(.27,y,.385),(.062,.002,.075),p['glass'])
 for x in (.237,.303):
  for y in (-.03,.03): line('Lantern | upright',(x,y,.34),(x,y,.43),.003,p['brass'],6)
 box('Lantern | roof',(.27,0,.433),(.08,.07,.012),p['brass'])
 for o in bpy.context.scene.objects:
  if o not in existing: o.location.z+=.07

def disc_y(name,x,y,z,r,depth,m,n=20):
 o=cone(name,(x,y,z),r,r,depth,m,n); o.rotation_euler[0]=math.pi/2; return o

def submarine(p):
 # Ellipsoid's long axis remains along bottle x.
 bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=16,radius=1,location=(-.03,0,.27))
 o=bpy.context.object; o.name='Submarine | teal cigar hull'; o.scale=(.43,.105,.10); o.data.materials.append(p['teal'])
 box('Submarine | conning tower',(-.03,0,.385),(.18,.12,.085),p['teal'])
 line('Submarine | periscope',(.01,0,.43),(.01,0,.53),.007,p['brass'])
 line('Submarine | periscope head',(.01,0,.53),(.07,0,.53),.007,p['brass'])
 for x in (-.23,-.04,.15):
  disc_y('Submarine | brass porthole rim',x,-.103,.285,.041,.009,p['brass'])
  disc_y('Submarine | porthole glass',x,-.110,.285,.029,.006,p['glass'])
 line('Submarine | propeller shaft',(-.43,0,.27),(-.49,0,.27),.008,p['metal'])
 for i in range(3):
  a=math.tau*i/3
  blade=box('Submarine | propeller blade',(-.49,.032*math.cos(a),.27+.032*math.sin(a)),(.009,.055,.018),p['brass']); blade.rotation_euler[0]=a
 for side in (-1,1):
  mesh('Submarine | tail fin',[(-.36,0,.27),(-.46,side*.14,.27),(-.30,side*.11,.27)],[(0,1,2)],p['teal'])
 mesh('Submarine | upper fin',[(-.38,0,.30),(-.43,0,.38),(-.29,0,.33)],[(0,1,2)],p['teal'])

def longship(p):
 small_boat('Longship',(-.03,0,.17),.90,.23,p)
 for sign in (-1,1):
  pts=[(sign*x,0,z) for x,z in [(.40,.24),(.46,.29),(.49,.36),(.47,.40),(.43,.405)]]
  for a,b in zip(pts,pts[1:]): line('Longship | curled end',a,b,.012,p['wood'],8)
 line('Longship | mast',(-.02,0,.24),(-.02,0,.59),.008,p['wood'])
 line('Longship | yard',(-.23,0,.56),(.19,0,.56),.006,p['wood'])
 # A single continuous subdivided sail: each front and back quad has the
 # same stripe material, with a shallow belly between its supported edges.
 nx=6; nz=5; v=[]; faces=[]
 for side in (-1,1):
  for j in range(nz+1):
   t=j/nz
   for i in range(nx+1):
    u=i/nx; belly=-.022*math.sin(math.pi*u)*math.sin(math.pi*t)
    v.append((-.22+.402*u,belly+side*.0007,.55-.22*t))
  start=(0 if side==-1 else (nx+1)*(nz+1))
  for j in range(nz):
   for i in range(nx):
    a=start+j*(nx+1)+i; q=(a,a+1,a+nx+2,a+nx+1)
    faces.append((q if side==-1 else tuple(reversed(q)),i))
 sail=mesh('Longship | continuous striped sail',v,[face for face,_ in faces],p['red'])
 sail.data.materials.append(p['sailcream'])
 for poly,(_,stripe) in zip(sail.data.polygons,faces): poly.material_index=stripe%2

 for i in range(6):
  x=-.32+i*.115
  disc_y('Longship | shield',x,-.118,.235,.043,.012,p['red'] if i%2==0 else p['ochre'],16)
  disc_y('Longship | shield boss',x,-.127,.235,.009,.006,p['brass'],10)
 for x in (-.24,-.02,.20): line('Longship | oar',(x,-.06,.25),(x+.05,-.19,.20),.004,p['wood'],6)

def pitched_house(name,center,size,wall,roof,p):
 x,y,z=center; w,d,h=size
 box(name+' | walls',(x,y,z+h/2),(w,d,h),wall)
 v=[(x-w*.56,y-d*.57,z+h),(x+w*.56,y-d*.57,z+h),(x+w*.56,y+d*.57,z+h),(x-w*.56,y+d*.57,z+h),(x,y-d*.57,z+h+w*.30),(x,y+d*.57,z+h+w*.30)]
 mesh(name+' | pitched roof',v,[(0,1,4),(3,5,2),(0,4,5,3),(4,1,2,5)],roof)
 box(name+' | door',(x,y-d/2-.0008,z+h*.3),(w*.22,.0015,h*.6),p['dark'])

def lighthouse(p):
 # Stack frusta for genuine alternating material bands, with a gallery above.
 for i in range(6):
  z=.028+i*.023; r1=.027-i*.0018; r2=r1-.0018
  cone('Lighthouse | striped tower',(0,0,z+.0115),r1,r2,.023,p['coral'] if i%2 else p['white'],20)
 cone('Lighthouse | gallery floor',(0,0,.169),.025,.025,.006,p['dark'],20)
 for i in range(12):
  a=math.tau*i/12; b=math.tau*(i+1)/12
  x,y=.027*math.cos(a),.027*math.sin(a)
  line('Lighthouse | rail post',(x,y,.171),(x,y,.189),.0012,p['brass'],5)
  line('Lighthouse | rail',(x,y,.189),(.027*math.cos(b),.027*math.sin(b),.189),.0012,p['brass'],5)
 cone('Lighthouse | lamp core',(0,0,.188),.011,.011,.025,p['lamp'],12)
 # Thin clear panes around the lamp, not a filled opaque housing.
 for i in range(8):
  a=math.tau*i/8; b=math.tau*(i+1)/8; r=.016
  mesh('Lighthouse | glazing',[(r*math.cos(a),r*math.sin(a),.175),(r*math.cos(b),r*math.sin(b),.175),(r*math.cos(b),r*math.sin(b),.201),(r*math.cos(a),r*math.sin(a),.201)],[(0,1,2,3)],p['glass'])
 cone('Lighthouse | roof',(0,0,.205),.024,0,.016,p['coral'],16)
 pitched_house('Keeper hut',(-.052,.024,.024),(.045,.034,.034),p['white'],p['dark'],p)
 for i,(x,y) in enumerate([(-.048,-.03),(.042,.03),(.04,-.045)]): blob('Lighthouse | base rock',(x,y,.027),(.015,.012,.012),p['rock'],i,1)

def wreck(p):
 # A curved half-shell lies over on one side. Every plank, rib, and the keel
 # shares this frame; the narrowing bow converges instead of ending as a wall.
 angle=math.radians(-35); ca=math.cos(angle); sa=math.sin(angle)
 def pos(x,y,z): return (x,y*ca-z*sa,.030+y*sa+z*ca)
 def rise(t): return .75*math.sin(abs(t)*math.pi/2)+.30*(1-math.cos(abs(t)*math.pi/2))
 sections=[(-.085,.035,.006),(-.065,.043,.004),(-.040,.049,.003),(-.010,.050,.003),
           (.020,.046,.004),(.050,.037,.006),(.075,.023,.010),(.093,.001,.017)]
 n=len(sections); v=[]
 for j in range(5):
  t=j/4
  for i,(x,w,z) in enumerate(sections):
   # Unequal plank ends leave a visibly broken stern at -x.
   if i==0: x+=(-.004,.002,-.002,.004,-.001)[j]
   h=.050*(.04+.96*w/.05)
   v.append(pos(x,w*math.sin(t*math.pi/2),z+h*rise(t)))
 for j in range(4):
  mesh('Wreck | curved hull plank',v[j*n:(j+2)*n],[(i,i+1,n+i+1,n+i) for i in range(n-1)],p['wood'] if j%2 else p['dark'])
  a,b=v[j*n],v[(j+1)*n]
  tip=(min(a[0],b[0])-.008,a[1]*.6+b[1]*.4,a[2]*.6+b[2]*.4)
  mesh('Wreck | split stern plank',[a,b,tip],[(0,1,2)],p['wood'] if j%2 else p['dark'])
 for j in range(1,5):
  for i in range(n-1): line('Wreck | plank seam',v[j*n+i],v[j*n+i+1],.0014,p['dark'],5)
 for a,b in zip(sections,sections[1:]): line('Wreck | keel',pos(a[0],0,a[2]),pos(b[0],0,b[2]),.0035,p['dark'],8)
 for x,w,z in sections[1:-1]:
  h=.050*(.04+.96*w/.05)
  pts=[pos(x,w*math.sin(t*math.pi/2),z+h*rise(t)) for t in (-.55,-.30,0,.25,.5,.75,1)]
  for a,b in zip(pts,pts[1:]): line('Wreck | curved exposed rib',a,b,.0027,p['wood'],6)
 line('Wreck | snapped mast',pos(-.01,0,.01),pos(.025,.008,.105),.0045,p['dark'])
 for i,(x,y) in enumerate([(-.07,-.048),(-.025,-.07),(.03,-.065),(.075,-.035),(.075,.045),(-.07,.045)]):
  color=[p['coralpink'],p['coralgold'],p['coralrose']][i%3]
  blob('Reef | coral clump',(x,y,.022),(.014,.012,.011),color,i,1)
  for j in range(3): line('Reef | coral branch',(x,y,.024),(x+(j-1)*.008,y+.004*(j%2),.043+.004*(j%2)),.003,color,6)

def village(p):
 for name,center,color in [('Blue',(-.045,.025,.03),p['houseblue']),('Ochre',(.005,.045,.03),p['houseyellow']),('Coral',(.045,.01,.03),p['housepink'])]:
  pitched_house('Village | '+name,center,(.038,.03,.034),color,p['dark'],p)
 box('Village | chimney',(-.045,.03,.079),(.008,.008,.024),p['rock'])
 # Join overlapping rounded puffs and voxel-remesh into a single soft wisp.
 puffs=[]
 for i in range(4):
  r=.006+.002*i
  puffs.append(blob('Smoke | chimney puff',(-.045+.004*i,.03,.093+.009*i),(r,r*.8,r),p['smoke'],i,2))
 bpy.ops.object.select_all(action='DESELECT')
 for o in puffs: o.select_set(True)
 bpy.context.view_layer.objects.active=puffs[0]; bpy.ops.object.join(); plume=puffs[0]; plume.name='Smoke | village wisp'
 mod=plume.modifiers.new('Blend wisp','REMESH'); mod.mode='VOXEL'; mod.voxel_size=.002; mod.use_smooth_shade=True
 bpy.ops.object.modifier_apply(modifier=mod.name)
 mod=plume.modifiers.new('Simplify wisp','DECIMATE'); mod.ratio=.40; bpy.ops.object.modifier_apply(modifier=mod.name)
 # Jetty runs to the +x front over the shared ocean skirt.
 box('Village | jetty deck',(.095,-.038,.026),(.09,.024,.006),p['wood'])
 for x in (.060,.09,.125):
  for y in (-.048,-.028): line('Village | jetty stilt',(x,y,-.005),(x,y,.025),.0025,p['dark'],6)
 small_boat('Village | tied boat',(.11,-.080,.012),.065,.026,p)
 line('Village | mooring rope',(.09,-.067,.025),(.09,-.048,.029),.001,p['wood'],5)


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
  p=palette(); bottle(p)
  if id in ('bottle-second','bottle-third'): ship(p,id=='bottle-third')
  else:
   shelf2_palette(p); {'bottle-fourth':rowboat,'bottle-fifth':submarine,'bottle-sixth':longship}[id](p)
  for o in bpy.context.scene.objects: o.location.z-=.27; o.location*=.16; o.scale*=.16
 else:
  p=palette()
  if id in ('diorama-first','diorama-second','diorama-third'): island(p,id)
  else:
   shelf2_palette(p); island_base(p); {'diorama-fourth':lighthouse,'diorama-fifth':wreck,'diorama-sixth':village}[id](p)
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
