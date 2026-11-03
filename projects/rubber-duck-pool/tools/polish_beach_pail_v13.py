"""Replace the overly solid sand patch seen in the v13 close-up with grains."""
import math
import bpy

scene = bpy.data.scenes['Pail | v13 lookdev']
assert bpy.context.scene == scene and scene.get('beach_pail_v13_unity_review_applied')
if scene.get('beach_pail_v13_grains_polished'):
    raise RuntimeError('The v13 grains are already polished')

# The continuous deposit looked like a sticker in the close-up. The separately
# modelled grains give a softer transition to the clean plastic of the scoop.
grains = scene.objects['Spade | loose sand grains']
assert len(grains.data.vertices) == 4000 * 6
bed = scene.objects['Spade | fine sand bed']
bpy.data.objects.remove(bed, do_unlink=True)
center_x, center_y = .455, -.430 + .155 * -.35
for index in range(0, len(grains.data.vertices), 6):
    vertices = grains.data.vertices[index:index + 6]
    center = vertices[5].co
    ux = (center.x - center_x) / (.140 * .34 * 1.48)
    vy = (center.y - center_y) / (.155 * .20 * 1.42)
    r = min(1, math.sqrt(ux * ux + vy * vy))
    # Bring the grain bases down to the blade, retaining a tiny clearance.
    drop = .00007 + .0015 * (1 - r * r) ** 2
    for vertex in vertices:
        vertex.co.z -= drop
grains.data.update()
scene['beach_pail_v13_grains_polished'] = True
print({'stage': 'grain close-up polish', 'grains': 4000, 'continuous_patch_removed': True})
