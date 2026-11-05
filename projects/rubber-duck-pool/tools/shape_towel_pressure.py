"""Try a broader load-and-drape pass on the R22 editable towel meshes.

The load is shared between the two towels; top layers get gentle independent
wrinkles. The roll is then fitted against the evaluated support surface.
"""
from pathlib import Path
import math
import sys

import bpy

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from towel_contact import fit_roll_contact


def clamp01(value):
    return max(0.0, min(1.0, value))


def sculpt_load(obj, base, phase, coral):
    for vertex in obj.data.vertices:
        x, y, z = vertex.co
        # Weight transfers through both textiles instead of making the roll
        # float above an artificially painted contact shadow.
        pressure = math.exp(-((y-.008)/.061)**2 - (x/.208)**8)
        upper = clamp01((z-base-.012)/.033)
        carried = 1.0 if coral else upper
        vertex.co.z -= .0045 * pressure * carried

        # Large, soft wrinkles radiate from the load towards the front edge.
        front = math.exp(-((y+.080)/.060)**2)
        wrinkle = (.0038*math.sin(19*x+13*y+phase)
                   + .0017*math.sin(31*x-10*y+phase*.7)) * front
        vertex.co.z += upper * wrinkle

        # Unequal corners keep the folded cloth from reading as a rigid slab.
        side = clamp01((abs(x)-.14)/.09)**2
        end = clamp01((abs(y)-.09)/.06)**2
        vertex.co.y += .0035*side*math.sin(13*y+phase)
        vertex.co.x += .0030*end*math.sin(10*x+phase*.8)
    obj.data.update()


def main():
    scene = bpy.context.scene
    ivory = scene.objects['Towel | ivory folded']
    coral = scene.objects['Towel | coral folded']
    roll = scene.objects['Towel | sea glass roll']
    sculpt_load(ivory, .0115, .2, False)
    sculpt_load(coral, .0795, 1.1, True)
    fit_roll_contact(roll, coral)
    scene.name = 'Towels | R24 pressure and drape study'
    scene['lookdev_round'] = 24
    scene.cycles.samples = 48
    scene.render.resolution_x = 1440
    scene.render.resolution_y = 1080
    scene.render.filepath = str(ROOT/'docs/evidence/beach-towels-r24-blender.png')
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/02_models/props/beach-towels/beach-towels-r24.blend'))
    bpy.ops.render.render(write_still=True)
    print('TOWEL_R24_DONE', scene.render.filepath, flush=True)


if __name__ == '__main__':
    main()
