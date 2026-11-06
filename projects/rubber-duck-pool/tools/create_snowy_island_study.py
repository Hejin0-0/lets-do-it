"""Create a separate snowy-island lookdev study without touching the game.

Run only in a disposable background Blender process:
  Blender -b --python-exit-code 1 --python create_snowy_island_study.py -- 1
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
if len(args) != 1 or args[0] not in {str(i) for i in range(1, 12)}:
    raise SystemExit('Usage: -- <revision 1 through 11>')
revision = int(args[0])
root = Path(__file__).resolve().parents[1]
out = root / 'assets/02_models/props/snowy-island-study'
out.mkdir(parents=True, exist_ok=True)
stem = f'snowy-island-v{revision}'
rng = random.Random(379617)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def material(name, color, roughness):
    result = bpy.data.materials.new(name)
    result.diffuse_color = (*color, 1)
    result.use_nodes = True
    bsdf = next(n for n in result.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = roughness
    return result


snow = material('Snow | soft', (.83, .91, .87), .82)
pine = material('Pine | needles', (.038, .155, .095) if revision >= 2 else (.065, .20, .14), .78)
pine_light = material('Pine | sunlit needles', (.075, .235, .14) if revision >= 2 else (.105, .29, .19), .76)
bark = material('Pine | bark', (.34, .19, .10), .85)
sea = material('Sea | icy turquoise', (.105, .44, .47), .25)
ice = material('Ice | pale blue', (.46, .73, .75), .34)
rock = material('Rock | blue grey', (.24, .32, .32), .88)
foam = material('Sea | frost line', (.69, .86, .82), .72)
floor_mat = material('STUDIO | backdrop', (.64, .62, .57) if revision >= 2 else (.57, .59, .56), .9)
twig_atlas = None
frost_atlas = None
if revision >= 7:
    twig_atlas=material('Pine | twig atlas',(.20,.32,.16),.8)
    twig_atlas.surface_render_method='DITHERED'
    twig_atlas.use_backface_culling=False
    tex=twig_atlas.node_tree.nodes.new('ShaderNodeTexImage')
    texture_name='polyhaven-fir-twig-rgba-lifted-1k.png' if revision >= 8 else 'polyhaven-fir-twig-rgba-1k.png'
    tex.image=bpy.data.images.load(str(out/texture_name),check_existing=True)
    tex.image.pack()
    tex.extension='CLIP'
    shader=next(n for n in twig_atlas.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    twig_atlas.node_tree.links.new(tex.outputs['Color'],shader.inputs['Base Color'])
    twig_atlas.node_tree.links.new(tex.outputs['Alpha'],shader.inputs['Alpha'])
    if revision >= 9:
        frost_atlas=material('Pine | frost atlas',(.55,.65,.58),.84)
        frost_atlas.surface_render_method='DITHERED'
        frost_atlas.use_backface_culling=False
        frost_tex=frost_atlas.node_tree.nodes.new('ShaderNodeTexImage')
        frost_name='polyhaven-fir-twig-rgba-snow-1k.png' if revision >= 10 else 'polyhaven-fir-twig-rgba-frosted-1k.png'
        frost_tex.image=bpy.data.images.load(str(out/frost_name),check_existing=True)
        frost_tex.image.pack()
        frost_tex.extension='CLIP'
        frost_shader=next(n for n in frost_atlas.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
        frost_atlas.node_tree.links.new(frost_tex.outputs['Color'],frost_shader.inputs['Base Color'])
        frost_atlas.node_tree.links.new(frost_tex.outputs['Alpha'],frost_shader.inputs['Alpha'])

# Fine texture remains Blender-only; the GLB and Unity use the plain material colors.
def surface_bump(mat, scale, strength, distance):
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
    noise = nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = scale
    noise.inputs['Detail'].default_value = 2
    bump = nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = strength
    bump.inputs['Distance'].default_value = distance
    links.new(noise.outputs['Fac'], bump.inputs['Height'])
    links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])


surface_bump(snow, 125, .16, .004)
surface_bump(rock, 25, .18, .007)
surface_bump(bark, 48, .15, .006)


def mesh(name, vertices, faces, mat, smooth=True):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    data.materials.append(mat)
    for face in data.polygons:
        face.use_smooth = smooth
    return obj


def island_layer(name, rings, mat, phase=0, y_scale=1):
    n = 48 if revision >= 2 else 64
    vertices = []
    for r, z in rings:
        for i in range(n):
            a = math.tau * i / n
            wobble = 1 + .055*math.sin(3*a+phase) + .028*math.sin(7*a+.8+phase)
            wobble += .013*math.sin(13*a+1.2)
            dz = .012*math.sin(5*a+phase) + .006*math.cos(9*a)
            if revision >= 4 and name.startswith('Sea'):
                # The water's top n-gon must be planar; varying its height
                # produces triangular intersections with the submerged rock.
                dz = 0
            if revision >= 2 and name.startswith('Rock'):
                dz += .022*math.sin(3*a+.7) + .013*math.sin(11*a+z*7)
            vertices.append((r*wobble*math.cos(a), r*wobble*y_scale*math.sin(a), z + dz))
    faces = [tuple(reversed(range(n)))]
    for j in range(len(rings)-1):
        for i in range(n):
            k = (i+1) % n
            faces.append((j*n+i, j*n+k, (j+1)*n+k, (j+1)*n+i))
    faces.append(tuple((len(rings)-1)*n+i for i in range(n)))
    return mesh(name, vertices, faces, mat)


def stone(name, location, scale, mat, subdivisions=2):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivisions, radius=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    obj.rotation_euler = (rng.uniform(-.25,.25), rng.uniform(-.25,.25), rng.uniform(0, math.tau))
    for v in obj.data.vertices:
        v.co *= rng.uniform(.90, 1.08)
    obj.data.materials.append(mat)
    for face in obj.data.polygons:
        face.use_smooth = True
    return obj


# The asymmetrical thin island carries an open sea shelf and a single snow mound.
foundation_bottom = -.10 if revision >= 11 else -.14
island_layer('Rock | island foundation',[(.49,foundation_bottom),(.72,foundation_bottom+.02),(.79,-.055),(.78,.015),(.71,.04 if revision >= 4 else .075)],rock,.2,.90)
island_layer('Sea | winter water',[(.70,.070),(.75,.084),(.735,.095)],sea,.4,.90)
island_layer('Snow | island ground',[(.48,.091),(.56,.105),(.58,.13),(.54,.17),(.41,.20),(.20,.215),(.002,.22)],snow,1.0,.79)
for i,(x,y,s) in enumerate([(-.55,-.13,.11),(-.50,.26,.12),(-.22,.43,.10),(.24,.42,.12),(.55,.20,.10),(.53,-.20,.08),(-.10,-.45,.065)]):
    stone(f'Rock | shoreline {i+1:02}',(x,y,.105),(s*1.25,s*.85,s*.62),rock,1 if revision >= 2 else 2)
    stone(f'Snow | shoreline cap {i+1:02}',(x,y,.105+s*.42),(s*.95,s*.67,s*.22),snow,2 if revision >= 2 else 1)
for i,(x,y,s) in enumerate([(-.42,-.36,.10),(-.18,-.52,.085),(.20,-.47,.12),(.47,-.32,.095),(.61,.03,.07)]):
    stone(f'Ice | floe {i+1:02}',(x,y,.095),(s*1.3,s*.8,.014),ice,1)
if revision >= 2:
    for i,(a,s) in enumerate(((3.4,.16),(3.9,.13),(4.35,.17),(4.85,.14),(5.35,.18),(5.9,.13))):
        stone(f'Rock | coastal outcrop {i+1:02}',((.64 if revision >= 3 else .68)*math.cos(a),(.58 if revision >= 3 else .61)*math.sin(a),-.02),
              (s*(.80 if revision >= 3 else 1.2),s*.8,s*.7),rock,2 if revision >= 3 else 1)
if revision >= 4:
    # Two broken traces, rather than a uniform circular outline, describe a
    # gentle current across the otherwise smooth shallow water.
    for index,(start,stop) in enumerate(((3.48,4.10),(4.78,5.42))):
        verts=[]
        count=19
        for j in range(count):
            t=j/(count-1)
            a=start+(stop-start)*t
            r=.665 + .007*math.sin(5*a+index)
            half_width=.001 + .0022*math.sin(math.pi*t)
            for offset in (-half_width,half_width):
                verts.append(((r+offset)*math.cos(a),.90*(r+offset)*math.sin(a),.0958))
        faces=[(2*j,2*j+1,2*j+3,2*j+2) for j in range(count-1)]
        mesh(f'Sea | frost trace {index+1}',verts,faces,foam)


def trunk():
    n = 12
    vertices = []
    for z, radius in ((.19,.055),(.40,.050),(.70,.040),(1.0,.029),((1.27 if revision >= 11 else 1.33),.012)):
        for i in range(n):
            a = math.tau*i/n
            vertices.append((.018*z + radius*math.cos(a), .012*z + radius*math.sin(a),z))
    faces = [tuple(reversed(range(n)))]
    for j in range(4):
        for i in range(n):
            k=(i+1)%n
            faces.append((j*n+i,j*n+k,(j+1)*n+k,(j+1)*n+i))
    faces.append(tuple(4*n+i for i in range(n)))
    mesh('Pine | visible trunk',vertices,faces,bark)


def bough(name, height, angle, length, width, mat):
    direction = Vector((math.cos(angle), math.sin(angle), 0))
    side = Vector((-math.sin(angle), math.cos(angle), 0))
    origin = Vector((.018*height,.012*height,height))
    steps, radial = (6 if revision >= 3 else 7), 8
    rings = []
    vertices = []
    for j in range(steps+1):
        t = j/steps
        center = origin + direction*(.018+length*t)
        center.z += .045*math.sin(math.pi*t) - .075*t*t
        w = max(.004, width*math.sin(math.pi*t)**.7)
        if revision >= 4 and 0 < j < steps:
            w *= (1.09 if j % 2 else .88)
        h = w*.54
        ring=[]
        for k in range(radial):
            a = math.tau*k/radial
            point = center + side*(w*math.sin(a)) + Vector((0,0,h*math.cos(a)))
            ring.append(point)
            vertices.append(point)
        rings.append(ring)
    faces=[tuple(reversed(range(radial)))]
    for j in range(steps):
        for k in range(radial):
            n=(k+1)%radial
            faces.append((j*radial+k,j*radial+n,(j+1)*radial+n,(j+1)*radial+k))
    faces.append(tuple(steps*radial+k for k in range(radial)))
    if revision >= 2:
        # Ring winding must face outward; Unity culls the back side of a mesh.
        faces = [tuple(reversed(face)) for face in faces]
    if revision >= 2:
        # A few tapered side shoots break the smooth, leaf-like silhouette.
        for j in (2,3,4,5):
            for k,sign in ((2,1),(6,-1)):
                point=(rings[j][k]+rings[j+1][k])*.5
                point += side*(sign*width*(.14 if revision >= 3 else .28)) + direction*(length*.025)
                vertices.append(point)
                faces.append((j*radial+k,(j+1)*radial+k,len(vertices)-1))
    mesh(name,vertices,faces,mat)
    # Snow samples the actual top vertices: all four borders touch the foliage.
    if revision >= 4:
        # A short rounded accumulation leaves green branch tips exposed.
        snow_vertices=[rings[1][0]+Vector((0,0,.001))]
        start,end_row=1,steps-1
        for j in range(start+1,end_row):
            t=(j-start)/(end_row-start)
            width_factor=math.sin(math.pi*t)**.55
            for q in (-1,-.5,0,.5,1):
                fraction=abs(q)*width_factor
                edge=rings[j][1 if q>=0 else 7]
                p=rings[j][0].lerp(edge,fraction)
                p.z += .001 + .030*width_factor*(1-abs(q))
                snow_vertices.append(p)
        end=len(snow_vertices)
        snow_vertices.append(rings[end_row][0]+Vector((0,0,.001)))
        snow_faces=[(0,1+q,2+q) for q in range(4)]
        for j in range(end_row-start-2):
            for q in range(4):
                a=1+j*5+q
                snow_faces.append((a,a+5,a+6,a+1))
        for q in range(4):
            a=1+(end_row-start-2)*5+q
            snow_faces.append((a,end,a+1))
        mesh(name.replace('Needles','Snow'),snow_vertices,snow_faces,snow)
        return
    if revision >= 3:
        snow_vertices=[rings[0][0]+Vector((0,0,.001))]
        for j in range(1,steps):
            t=j/steps
            width_factor=math.sin(math.pi*t)**.55
            for q in (-1,-.5,0,.5,1):
                fraction=abs(q)*width_factor
                edge=rings[j][1 if q>=0 else 7]
                p=rings[j][0].lerp(edge,fraction)
                p.z += .001 + .014*width_factor*(1-abs(q))
                snow_vertices.append(p)
        end=len(snow_vertices)
        snow_vertices.append(rings[steps][0]+Vector((0,0,.001)))
        snow_faces=[]
        for q in range(4):
            snow_faces.append((0,1+q,2+q))
        for j in range(steps-2):
            for q in range(4):
                a=1+j*5+q
                snow_faces.append((a,a+5,a+6,a+1))
        for q in range(4):
            a=1+(steps-2)*5+q
            snow_faces.append((a,end,a+1))
        mesh(name.replace('Needles','Snow'),snow_vertices,snow_faces,snow)
        return
    snow_vertices=[]
    for j in range(1,steps):
        t=j/steps
        snow_sections = (7,0,1) if revision >= 2 else (6,7,0,1,2)
        for q,k in enumerate(snow_sections):
            p=rings[j][k].copy()
            if 0 < q < len(snow_sections)-1 and 1 < j < steps-1:
                p.z += .026*math.sin(math.pi*(j-1)/(steps-2))*math.sin(math.pi*q/(len(snow_sections)-1))
            else:
                p.z += .0008
            snow_vertices.append(p)
    snow_faces=[]
    columns=3 if revision >= 2 else 5
    for j in range(steps-2):
        for q in range(columns-1):
            a=j*columns+q
            face=(a,a+1,a+1+columns,a+columns)
            snow_faces.append(tuple(reversed(face)) if revision >= 2 else face)
    mesh(name.replace('Needles','Snow'),snow_vertices,snow_faces,snow)


def fir_bough(name, height, angle, length, width, mat, snow_amount):
    """A ridged, notched spray with snow that follows its actual top mesh."""
    direction=Vector((math.cos(angle),math.sin(angle),0))
    side=Vector((-math.sin(angle),math.cos(angle),0))
    origin=Vector((.018*height,.012*height,height))
    steps=6 if revision >= 6 else 8
    rows=[]
    vertices=[]
    for j in range(steps+1):
        t=j/steps
        center=origin+direction*(.018+length*t)
        center.z += .045*math.sin(math.pi*t)-.075*t*t
        # Alternating shallow notches describe needle sprays at the silhouette.
        w=max(.002,width*math.sin(math.pi*t)**.65*(1 if j%2 else .68))
        ridge=center+Vector((0,0,.016*math.sin(math.pi*t)))
        left=center-side*w-Vector((0,0,.009))
        right=center+side*w-Vector((0,0,.009))
        rows.append((ridge,left,right))
        vertices.extend((ridge,left,right))
    top=len(vertices)
    vertices += [p-Vector((0,0,.012)) for p in vertices]
    faces=[]
    for j in range(steps):
        a=j*3; b=(j+1)*3
        upper=((a,a+1,b+1,b),(a,b,b+2,a+2))
        faces.extend(upper)
        faces.extend(tuple(top+k for k in reversed(f)) for f in upper)
        faces.extend(((a+1,top+a+1,top+b+1,b+1),(a+2,b+2,top+b+2,top+a+2)))
    last=steps*3
    faces.extend(((0,top,top+1,1),(0,2,top+2,top),
                  (last,last+1,top+last+1,top+last),
                  (last,top+last,top+last+2,last+2)))
    mesh(name,vertices,faces,mat)
    if snow_amount <= 0:
        return
    start=1 if snow_amount > .55 else 2
    end=steps-1 if snow_amount > .55 else steps-2
    points=[rows[start][0]+Vector((0,0,.001))]
    for j in range(start+1,end):
        t=(j-start)/(end-start)
        profile=math.sin(math.pi*t)**.6
        ridge,left,right=rows[j]
        for q in (-1,-.5,0,.5,1):
            edge=right if q>=0 else left
            p=ridge.lerp(edge,abs(q)*profile*snow_amount)
            p.z += .001+.024*profile*(1-abs(q))
            points.append(p)
    tip=len(points)
    points.append(rows[end][0]+Vector((0,0,.001)))
    cap=[(0,1+q,2+q) for q in range(4)]
    for j in range(end-start-2):
        for q in range(4):
            a=1+j*5+q
            cap.append((a,a+5,a+6,a+1))
    for q in range(4):
        a=1+(end-start-2)*5+q
        cap.append((a,tip,a+1))
    mesh(name.replace('Needles','Snow'),points,cap,snow)


def textured_bough(name,height,angle,length,width,snow_amount,frosted=False):
    """Two lightly crossed twig cards plus a snow crown over the center stem."""
    direction=Vector((math.cos(angle),math.sin(angle),0))
    side=Vector((-math.sin(angle),math.cos(angle),0))
    origin=Vector((.018*height,.012*height,height))
    # The central-lower branch in the CC0 atlas; UVs crop away neighboring twigs.
    u0,u1,v0,v1=.285,.66,.18,.60
    for plane,tilt in enumerate((-.26,.30)):
        across=side*math.cos(tilt)+Vector((0,0,math.sin(tilt)))
        vertices=[]
        for j in range(3):
            t=j/2
            center=origin+direction*(.018+length*t)
            center.z += .04*math.sin(math.pi*t)-.065*t*t+plane*.001
            vertices.extend((center-across*width,center+across*width))
        card_material=frost_atlas if revision >= 9 and frosted and (plane == 1 or revision >= 10) else twig_atlas
        obj=mesh(name+f' | card {plane+1}',vertices,[(0,2,3,1),(2,4,5,3)],card_material,False)
        uv=obj.data.uv_layers.new(name='UVMap')
        coords=((u0,v0),(u1,v0),(u0,(v0+v1)/2),(u1,(v0+v1)/2),(u0,v1),(u1,v1))
        for face in obj.data.polygons:
            for loop in face.loop_indices:
                uv.data[loop].uv=coords[obj.data.loops[loop].vertex_index]
    if snow_amount <= 0:
        return
    if revision >= 8:
        # A pair of small, soft mounds sit along the twig instead of one
        # large teardrop that reads as a separate white leaf.
        centers=(.45,) if revision >= 9 else ((.34,.64) if snow_amount > .54 else (.48,))
        for n,center_t in enumerate(centers):
            radius_x=length*rng.uniform(.105,.15)
            radius_y=width*rng.uniform(.105,.15)
            base_z=height+.04*math.sin(math.pi*center_t)-.065*center_t*center_t+.010
            center=origin+direction*(.018+length*center_t)
            center.z=base_z
            verts=[]
            sides=8
            for radius,height_offset in ((1.0,0),(.63,.012)):
                for k in range(sides):
                    a=math.tau*k/sides
                    x=radius_x*radius*math.cos(a)
                    p=center+direction*x+side*(radius_y*radius*math.sin(a))
                    t=max(0,min(1,center_t+x/length))
                    p.z += (.04*math.sin(math.pi*t)-.065*t*t)-(.04*math.sin(math.pi*center_t)-.065*center_t*center_t)+height_offset
                    verts.append(p)
            verts.append(center+Vector((0,0,.017)))
            faces=[]
            for k in range(sides):
                q=(k+1)%sides
                faces.append((k,q,sides+q,sides+k))
                faces.append((sides+k,sides+q,2*sides))
            mesh(name.replace('Needles','Snow')+f' | mound {n+1}',verts,faces,snow)
        return
    start,end=.22,.76
    def point(t,q,profile):
        p=origin+direction*(.018+length*t)+side*(q*width*.34*profile)
        p.z += .04*math.sin(math.pi*t)-.065*t*t+.012+.022*profile*(1-abs(q))
        return p
    verts=[point(start,0,0)]
    steps=5
    for j in range(1,steps):
        s=j/steps
        for q in (-1,-.5,0,.5,1):
            verts.append(point(start+(end-start)*s,q,math.sin(math.pi*s)**.6))
    tip=len(verts)
    verts.append(point(end,0,0))
    faces=[(0,1+q,2+q) for q in range(4)]
    for j in range(steps-2):
        for q in range(4):
            a=1+j*5+q
            faces.append((a,a+5,a+6,a+1))
    for q in range(4):
        a=1+(steps-2)*5+q
        faces.append((a,tip,a+1))
    mesh(name.replace('Needles','Snow'),verts,faces,snow)


trunk()
tiers = ([(.48,.48,.102,8),(.61,.45,.096,8),(.74,.41,.086,7),(.87,.36,.078,7),
          (1.00,.31,.067,7),(1.10,.27,.062,7),(1.19,.22,.053,7),
          (1.27,.17,.046,6),(1.34,.10,.035,5)] if revision >= 11 else
         [(.48,.48,.102,8),(.61,.45,.096,8),(.74,.41,.086,7),(.87,.36,.078,7),
          (1.00,.31,.067,6),(1.13,.25,.055,6),(1.25,.19,.046,5),(1.34,.105,.032,4)]
         if revision >= 6 else
         [(.48,.48,.122,6),(.68,.41,.112,6),(.86,.34,.095,5),(1.03,.27,.078,5),(1.18,.20,.058,5),(1.30,.12,.040,4)])
for tier,(height,length,width,count) in enumerate(tiers):
    for j in range(count):
        angle = math.tau*j/count + tier*.57 + rng.uniform(-.12,.12)
        name=f'Pine | Needles {tier+1:02}-{j+1:02}'
        color=pine if (j+tier)%3 else pine_light
        if revision >= 7:
            if revision >= 9:
                snow_amount=rng.uniform(.46,.72) if (j+2*tier)%4 == 0 else 0
            else:
                snow_amount=0 if (j+2*tier)%7 == 0 else rng.uniform(.46,.72)
            textured_bough(name,height+rng.uniform(-.035,.035),angle,length*rng.uniform(.78,1.15),
                           width*rng.uniform(1.8,2.25)*(1.25 if revision >= 9 and height>1.05 else 1),
                           snow_amount,((j*11+tier*7)%13 < 5 if revision >= 10 else (j+tier)%4 != 0))
        elif revision >= 5:
            snow_amount=0 if (j+2*tier)%9 == 0 else rng.uniform(.46,.72)
            fir_bough(name,height+rng.uniform(-.035,.035),angle,length*rng.uniform(.78,1.15),
                      width*rng.uniform(.86,1.08),color,snow_amount)
        else:
            bough(name,height+rng.uniform(-.018,.018),angle,length*rng.uniform(.89,1.08),
                  width*rng.uniform(.91,1.06),color)
if revision >= 2 and revision < 11:
    bpy.ops.mesh.primitive_cone_add(vertices=10,radius1=(.025 if revision >= 8 else (.055 if revision >= 4 else .075)),radius2=0,
                                    depth=.12 if revision >= 8 else (.15 if revision >= 4 else .22),location=(.024,.016,1.345 if revision >= 4 else 1.37))
    leader=bpy.context.object
    leader.name='Pine | upright leader'
    leader.data.materials.append(pine)
    for face in leader.data.polygons: face.use_smooth=True
    if revision == 2:
        stone('Snow | leader cap',(.024,.016,1.425),(.047,.047,.047),snow,2)
if revision >= 11:
    # Crossed upright sprays form a leafy leader instead of a geometric cone.
    # Their alpha and UVs use the same twig atlas as the rest of the crown.
    u0,u1,v0,v1=.285,.66,.18,.60
    for i in range(3):
        angle=math.pi*i/3
        axis=Vector((math.cos(angle),math.sin(angle),0))
        center=Vector((.024,.016,1.30))
        width=.072
        vertices=[center-axis*width,center+axis*width,
                  center+axis*width+Vector((0,0,.15)),center-axis*width+Vector((0,0,.15))]
        obj=mesh(f'Pine | upright twig {i+1}',vertices,[(0,1,2,3)],twig_atlas,False)
        uv=obj.data.uv_layers.new(name='UVMap')
        coords=((u0,v0),(u1,v0),(u1,v1),(u0,v1))
        for loop in obj.data.loops:
            uv.data[loop.index].uv=coords[loop.vertex_index]

# Export evaluated copies grouped by material; keep the editable originals in the blend.
asset = list(scene.objects)
depsgraph = bpy.context.evaluated_depsgraph_get()
groups = {}
for original in asset:
    evaluated = original.evaluated_get(depsgraph)
    data = bpy.data.meshes.new_from_object(evaluated, preserve_all_data_layers=True, depsgraph=depsgraph)
    if len(data.materials) != 1 or not data.materials[0]:
        raise RuntimeError('Expected one material: '+original.name)
    copy = bpy.data.objects.new('EXPORT | '+original.name, data)
    scene.collection.objects.link(copy)
    copy.matrix_world = original.matrix_world.copy()
    groups.setdefault(data.materials[0].name, []).append(copy)
exported=[]
for name, objects in groups.items():
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects: obj.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    if len(objects)>1: bpy.ops.object.join()
    merged=bpy.context.view_layer.objects.active
    merged.name='Snowy | '+name
    exported.append(merged)
bpy.ops.object.select_all(action='DESELECT')
for obj in exported: obj.select_set(True)
bpy.context.view_layer.objects.active=exported[0]
bpy.ops.export_scene.gltf(filepath=str(out/(stem+'.glb')),export_format='GLB',use_selection=True)
bpy.ops.export_scene.fbx(filepath=str(out/(stem+'.fbx')),use_selection=True,apply_unit_scale=True,add_leaf_bones=False)
triangles=0
for obj in exported:
    obj.data.calc_loop_triangles()
    triangles+=len(obj.data.loop_triangles)
for obj in exported:
    data=obj.data
    bpy.data.objects.remove(obj,do_unlink=True)
    if not data.users: bpy.data.meshes.remove(data)

# The studio is deliberately excluded from both interchange files. Ground the
# latest revision against the real lowest vertex, including shoreline rocks.
floor_z = (min((obj.matrix_world @ vertex.co).z for obj in asset
               if obj.type == 'MESH' for vertex in obj.data.vertices) - .001
           if revision >= 11 else foundation_bottom - .005)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,floor_z))
floor=bpy.context.object
floor.name='STUDIO | floor'
floor.data.materials.append(floor_mat)
scene.world=bpy.data.worlds.new('STUDIO | sky')
scene.world.color=(.24,.24,.24)
def light(name,location,energy,size,target):
    data=bpy.data.lights.new(name,'AREA')
    data.energy=energy
    data.shape='DISK'
    data.size=size
    obj=bpy.data.objects.new(name,data)
    scene.collection.objects.link(obj)
    obj.location=location
    obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
light('STUDIO | broad sun',(-3,-4,5),300,3,(0,0,.55))
light('STUDIO | cool fill',(3,-1,3),125,3,(0,0,.55))
light('STUDIO | soft rim',(1,3,4),210,2.4,(0,0,.65))
bpy.ops.object.camera_add(location=(2.8,-4,3.0))
camera=bpy.context.object
camera.name='STUDIO | camera'
camera.rotation_euler=(Vector((0,0,.58))-camera.location).to_track_quat('-Z','Y').to_euler()
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
scene.view_settings.exposure=.10 if revision >= 4 else (-.15 if revision >= 2 else -.25)
scene.render.image_settings.file_format='PNG'
scene.render.filepath=str(out/(stem+'-blender.png'))
bpy.ops.wm.save_as_mainfile(filepath=str(out/(stem+'.blend')),compress=True)
bpy.ops.render.render(write_still=True)
if revision >= 3:
    camera.location=(-3.4,3.2,2.8)
    camera.rotation_euler=(Vector((0,0,.58))-camera.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(out/(stem+'-blender-back.png'))
    bpy.ops.render.render(write_still=True)
print('SNOWY_STUDY_OK',revision,'triangles',triangles,'renderer_groups',len(exported),'source_objects',len(asset),flush=True)
