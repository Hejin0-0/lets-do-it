"""Give the roll a slightly irregular cross-section and re-fit contact."""
from pathlib import Path
import math
import sys

import bpy

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(Path(__file__).resolve().parent))
from towel_contact import fit_roll_contact


def shape_roll(obj):
    vertices=obj.data.vertices
    min_x=min(v.co.x for v in vertices)
    max_x=max(v.co.x for v in vertices)
    bins=48
    bounds=[[math.inf,-math.inf,math.inf,-math.inf] for _ in range(bins+1)]
    for v in vertices:
        i=max(0,min(bins,round((v.co.x-min_x)/(max_x-min_x)*bins)))
        b=bounds[i]
        b[0]=min(b[0],v.co.y); b[1]=max(b[1],v.co.y)
        b[2]=min(b[2],v.co.z); b[3]=max(b[3],v.co.z)
    for v in vertices:
        x,y,z=v.co
        i=max(0,min(bins,round((x-min_x)/(max_x-min_x)*bins)))
        b=bounds[i]
        cy=(b[0]+b[1])*.5
        cz=(b[2]+b[3])*.5
        dy,dz=y-cy,z-cz
        angle=math.atan2(dz,dy)
        scale=1+.028*math.cos(2*angle+.4)+.018*math.sin(3*angle+6*x)
        v.co.y=cy+dy*scale
        v.co.z=cz+dz*scale-.003
        # Only the underside flattens where the roll bears weight.
        flatten=max(0.0,min(1.0,(-dz-.045)/.035))
        v.co.z+=.002*flatten*flatten
    obj.data.update()


def main():
    scene=bpy.context.scene
    roll=scene.objects['Towel | sea glass roll']
    shape_roll(roll)
    fit_roll_contact(roll,scene.objects['Towel | coral folded'])
    scene.name='Towels | R32 shaped roll'
    scene['lookdev_round']=32
    scene.cycles.samples=48
    scene.render.filepath=str(ROOT/'docs/evidence/beach-towels-r32-blender.png')
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/02_models/props/beach-towels/beach-towels-r32.blend'))
    bpy.ops.render.render(write_still=True)
    print('TOWEL_R32_DONE',scene.render.filepath,flush=True)


if __name__=='__main__':
    main()
