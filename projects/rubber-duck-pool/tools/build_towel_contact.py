"""Rebuild towel folds around shared, contacting surfaces in Blender.

This standalone study opens in a factory-startup background session. The two
folded objects each consist of a single two-ply sheet with a rounded return;
the upper and lower ply use the same displacement field to preserve contact.
"""
from pathlib import Path
import math
from bisect import bisect_right
import sys
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
import create_towel_hero as hero
import create_beach_towels as prior


def fold_section(depth, base, radius, steps=88, bends=32):
    section=[]
    for i in range(steps+1):
        section.append((-depth+2*depth*i/steps,base,0.0))
    for i in range(1,bends+1):
        a=-math.pi/2+math.pi*i/bends
        section.append((depth+radius*math.cos(a),base+radius+radius*math.sin(a),i/bends))
    for i in range(1,steps+1):
        section.append((depth-2*depth*i/steps,base+2*radius,1.0))
    return section


def folded_cloth(scene,name,width,depth,base,radius,phase,clay):
    section=fold_section(depth,base,radius)
    across=108
    path=[0.0]
    for a,b in zip(section,section[1:]):
        path.append(path[-1]+math.hypot(b[0]-a[0],b[1]-a[1]))
    verts=[]
    uvs=[]
    faces=[]
    for row,(raw_y,raw_z,upper) in enumerate(section):
        for j in range(across+1):
            sx=2*j/across-1
            x=width*sx
            sy=raw_y/depth
            corner=min(1.0,max(0.0,(abs(sy)-.68)/.32))
            x*=1-.11*corner**1.6*abs(sx)**4
            # Same broad displacement at each layer keeps their contact.
            shared=(.0030*math.sin(7*x+phase)*math.cos(4*raw_y)
                    +.0024*math.exp(-((x+.045)/.13)**2-((raw_y+.02)/.095)**2))
            free=max(0.0,min(1.0,(-sy-.62)/.38))*upper
            y=raw_y-.007*free**1.4+.0015*math.sin(6*x+phase)*abs(sy)**3
            # The free edge overlaps the lower sheet; the top remains gently full.
            z=raw_z+shared+.003*upper*math.exp(-(x/.20)**2-(raw_y/.12)**2)-.0045*free**1.5
            verts.append((x,y,z))
            uvs.append(((x+width)/.40,path[row]/.40))
    for i in range(len(section)-1):
        for j in range(across):
            p=i*(across+1)+j
            faces.append((p,p+across+1,p+across+2,p+1))
    mesh=bpy.data.meshes.new(name)
    mesh.from_pydata(verts,[],faces)
    mesh.update()
    mesh.materials.append(clay)
    uv=mesh.uv_layers.new(name='UVMap')
    for poly in mesh.polygons:
        poly.use_smooth=True
        for loop in poly.loop_indices:
            uv.data[loop].uv=uvs[mesh.loops[loop].vertex_index]
    obj=bpy.data.objects.new(name,mesh)
    scene.collection.objects.link(obj)
    solid=obj.modifiers.new('Plush cloth thickness','SOLIDIFY')
    solid.thickness=.0195
    solid.offset=0
    solid.use_even_offset=True
    bevel=obj.modifiers.new('Soft free edges','BEVEL')
    bevel.width=.004
    bevel.segments=3
    return obj


def roll(scene,clay):
    zc=.150
    obj=prior.roll('Towel | clay roll',(.003,.012,zc),.202,.069,[clay],[],3)
    obj.modifiers['Real folded cloth thickness'].thickness=.0115
    obj.modifiers['Soft towel edges'].width=.001
    for index,vert in enumerate(obj.data.vertices):
        x=vert.co.x
        t=(index//49)/600
        theta=4.75*2*math.pi*t+.055*math.sin(6*t)*(1-t)
        radius=.006+(.069-.006)*t+.0003*math.sin(13*t)*math.sin(math.pi*t)
        yy=radius*math.cos(theta)
        zz=.96*radius*math.sin(theta)
        if zz < -.050:
            d=min(1.0,(-zz-.050)/.0163)
            zz+=.007*d*d
        vert.co.y=.012+yy+.0015*math.sin(7*x+.6)*t
        vert.co.z=zc+zz+.0013*math.sin(8*x+.2)*t
    obj.data.update()
    return obj


def fit_roll_contact(rolled,support):
    """Conform the roll axis to measured contact, with a small clearance.

    Rays intersect the evaluated mesh (including thickness), not the source
    mid-surface, so the measurement matches what is actually rendered.
    """
    bpy.context.view_layer.update()
    dg=bpy.context.evaluated_depsgraph_get()
    upper=BVHTree.FromObject(support,dg)
    lower=BVHTree.FromObject(rolled,dg)
    samples=[]
    for i in range(21):
        x=-.19+.38*i/20
        top=upper.ray_cast(Vector((x,.012,.5)),Vector((0,0,-1)))[0]
        bottom=lower.ray_cast(Vector((x,.012,-.2)),Vector((0,0,1)))[0]
        if top is None or bottom is None:
            raise RuntimeError(f'Cannot establish roll contact at x={x:.3f}')
        gap=bottom.z-top.z
        samples.append((x,max(-.01,min(.01,gap-.0002))))
    xs=[p[0] for p in samples]
    for vertex in rolled.data.vertices:
        x=vertex.co.x
        idx=max(0,min(len(xs)-2,bisect_right(xs,x)-1))
        a,b=samples[idx],samples[idx+1]
        t=max(0.0,min(1.0,(x-a[0])/(b[0]-a[0])))
        vertex.co.z-=a[1]*(1-t)+b[1]*t
    rolled.data.update()
    bpy.context.view_layer.update()
    print('CONTACT_FIT applied_m',round(min(p[1] for p in samples),5),
          round(max(p[1] for p in samples),5),flush=True)


def main():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    scene=bpy.context.scene
    block=hero.build_clay(scene)
    clay=block.data.materials[0]
    bpy.data.objects.remove(block,do_unlink=True)
    folded_cloth(scene,'Towel | bottom folded clay',.24,.145,.011,.010,.4,clay)
    middle=folded_cloth(scene,'Towel | middle folded clay',.227,.137,.052,.010,1.1,clay)
    rolled=roll(scene,clay)
    fit_roll_contact(rolled,middle)
    hero.aim(scene.camera,(0,0,.078))
    scene.camera.data.ortho_scale=.70
    scene.name='Towel stack | contacting clay v13'
    scene.cycles.samples=64
    scene.render.resolution_x=1440
    scene.render.resolution_y=1080
    scene.render.filepath=str(hero.ROOT/'docs/evidence/beach-towels-hero-clay-v13.png')
    bpy.ops.wm.save_as_mainfile(filepath=str(hero.ROOT/'models/towel-stack-clay-v13.blend'))
    bpy.ops.render.render(write_still=True)
    print('CLAY_V13_DONE',scene.render.filepath,flush=True)


if __name__=='__main__':
    main()
