"""Apply the Unity review to the live v13 Blender look-development scene.

The wider sand deposit follows the curved shovel surface. It stays independent
of the studio lights so the same geometry can be inspected in both renderers.
"""
import math
import bpy

scene = bpy.data.scenes['Pail | v13 lookdev']
assert bpy.context.scene == scene and scene.get('beach_pail_v13_refined')
if scene.get('beach_pail_v13_unity_review_applied'):
    raise RuntimeError('The v13 Unity review has already been applied')

power = 4.4
center_x, center_y = .455, -.430 + .155 * -.35

def surface(x, y):
    u, v = (x - .455) / .140, (y + .430) / .155
    r = (abs(u) ** power + abs(v) ** power) ** (1 / power)
    blend = min(1, max(0, v + .1))
    blend = blend * blend * (3 - 2 * blend)
    return (.018 + .039 * r ** 4 + .051 * blend * math.exp(-((u / .30) ** 2))
            + .008 * min(1, r) ** 5)

# The previous deposit read as a tiny isolated patch in Unity. Expand it
# while moving every vertex along the bowl, rather than lifting a flat decal.
for name in ('Spade | fine sand bed', 'Spade | loose sand grains'):
    obj = scene.objects[name]
    for vertex in obj.data.vertices:
        x, y = vertex.co.x, vertex.co.y
        nx = center_x + (x - center_x) * 1.48
        ny = center_y + (y - center_y) * 1.42
        vertex.co.z += surface(nx, ny) - surface(x, y)
        vertex.co.x, vertex.co.y = nx, ny
    obj.data.update()

scene['beach_pail_v13_unity_review_applied'] = True
print({'stage': 'Unity review applied', 'sand_width_factor': 1.48,
       'sand_depth_factor': 1.42})
