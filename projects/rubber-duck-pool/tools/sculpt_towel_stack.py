"""Build an editable clay stack with deliberately shaped folded cloth.

Run in an isolated Blender background session; this clears only that session.
"""
from pathlib import Path
import math
import sys

import bpy

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import create_towel_hero as hero
import create_beach_towels as prior


def shape_fold(obj, width, depth, base, radius, phase, variant=9):
    """Large soft cloth masses and pressure, with independent layers.

    Geometry stays on the ordered continuous sheet: no random vertex jitter.
    """
    for vert in obj.data.vertices:
        x, y, z = vert.co
        top = max(0.0, min(1.0, (z-base)/(4*radius)))
        sx, sy = x/width, y/depth
        # Swell on the broad face, fall away at the outside edge.  At the
        # lower layers this is deliberately much subtler than on the top.
        swell = .010*math.exp(-((sx+.20)/.72)**2-((sy-.1)/.88)**2)
        shoulder = .004*math.exp(-((sx-.65)/.30)**2-((sy+.55)/.35)**2)
        pressure = .0055*math.exp(-((x-.012)/.18)**4-((y-.025)/.080)**4)
        fall = -.0035*(abs(sx)**4)*(.7+.3*top)
        # Layer offsets keep all returns from ending in a perfect vertical line.
        vert.co.y += top*.0045*math.sin(2.5*sx+phase)
        vert.co.z += (top**1.6)*(swell+shoulder-pressure)+fall
        if variant >= 9:
            # Round the corners in the cloth surface itself, not a pipe or bevel.
            corner=max(0.0,min(1.0,(abs(sy)-.68)/.32))
            vert.co.x *= 1-.12*corner**1.5*abs(sx)**4
            vert.co.z += .0035*top*math.exp(-((sx+.72)/.35)**2-((sy+.65)/.45)**2)
            vert.co.y += .0035*top*math.sin(3*sx+phase)*abs(sy)**5
        else:
            vert.co.x *= 1-.045*max(0.0,(abs(sy)-.68)/.32)**2*abs(sx)**4
    obj.data.update()
    obj.modifiers['Cotton cloth thickness'].thickness = .017 if variant >= 9 else .020
    obj.modifiers['Soft compressed folds'].width = .0035
    if variant >= 9:
        # The free end is thinner than the plush interior of the folds.
        across=88
        rows=len(obj.data.vertices)//(across+1)
        group=obj.vertex_groups.new(name='Taper | free cloth edge')
        for row in range(rows):
            distance=(rows-1-row)/(rows-1)
            weight=.48+.52*min(1.0,distance/.045)
            group.add(list(range(row*(across+1),(row+1)*(across+1))),weight,'REPLACE')
        solid=obj.modifiers['Cotton cloth thickness']
        solid.vertex_group=group.name
        solid.thickness_vertex_group=0.0


def add_roll(scene, clay, variant=9):
    center_z=.196 if variant >= 9 else .202
    obj=prior.roll('Towel | clay roll',(.004,.018,center_z),.205,.071,[clay],[],3)
    for index,vert in enumerate(obj.data.vertices):
        x,y,z=vert.co
        if variant >= 9:
            # A continuous eccentric spiral; the tight inner end closes naturally.
            t=(index//49)/600
            angle=4.75*2*math.pi*t+.10*math.sin(5*t)*(1-t)
            radius=.0018+(.071-.0018)*t+.0015*math.sin(11*t)*math.sin(math.pi*t)
            y=.018+1.015*radius*math.cos(angle)
            z=center_z+.94*radius*math.sin(angle)
            vert.co.y=y
            vert.co.z=z
        # Different degrees of compression along the roll avoid a rigid cylinder.
        yy=y-.018
        zz=z-center_z
        radial=math.hypot(yy,zz)/.071
        broad=math.sin(7*x+.5)*.0024+math.sin(13*x-.2)*.0011
        vert.co.y += broad*min(1,radial)
        vert.co.z += (.003*math.sin(9*x+.3))*min(1,radial)
        if zz < -.050:
            t=min(1.0,(-zz-.050)/.021)
            vert.co.z += (.003 if variant >= 9 else .004)*t*t
    obj.data.update()
    return obj


def main():
    variant=int(sys.argv[sys.argv.index('--')+1]) if '--' in sys.argv else 9
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    scene=bpy.context.scene
    blockout=hero.build_clay(scene)
    clay=blockout.data.materials[0]
    bpy.data.objects.remove(blockout,do_unlink=True)
    ivory=hero.make_towel(scene,'Towel | bottom folded clay',width=.24,depth=.145,
                         base=.010,radius=.0105,phase=.3,fabrics=[clay])
    shape_fold(ivory,.24,.145,.010,.0105,.3,variant)
    coral_base=.073 if variant >= 9 else .076
    coral=hero.make_towel(scene,'Towel | middle folded clay',width=.228,depth=.137,
                         base=coral_base,radius=.010,phase=1.2,fabrics=[clay])
    shape_fold(coral,.228,.137,coral_base,.010,1.2,variant)
    add_roll(scene,clay,variant)
    scene.name=f'Towel stack | clay v{variant}'
    camera=scene.camera
    hero.aim(camera,(0,0,.095))
    camera.data.ortho_scale=.72
    scene.cycles.samples=64
    scene.render.resolution_x=1440
    scene.render.resolution_y=1080
    scene.render.filepath=str(hero.ROOT/f'docs/evidence/beach-towels-hero-clay-v{variant}.png')
    bpy.ops.wm.save_as_mainfile(filepath=str(hero.ROOT/f'models/towel-stack-clay-v{variant}.blend'))
    bpy.ops.render.render(write_still=True)
    print('CLAY_DONE',scene.render.filepath,flush=True)


if __name__ == '__main__':
    main()
