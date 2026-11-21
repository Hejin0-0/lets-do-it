"""Catch obvious intersections between the moored skiff and shore rocks."""
import bpy
from mathutils import Vector


def bounds(obj):
    points=[obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    return [(min(p[i] for p in points),max(p[i] for p in points)) for i in range(3)]


boat=bpy.context.scene.objects.get('Village | fishing skiff hull')
if boat is None:
    raise SystemExit('FISHING_HARBOR_FAIL no skiff')
boat_bounds=bounds(boat)
for obj in bpy.context.scene.objects:
    if not obj.name.startswith('Village | shore rock '):
        continue
    rock_bounds=bounds(obj)
    if all(a[0] < b[1] and b[0] < a[1] for a,b in zip(boat_bounds,rock_bounds)):
        raise SystemExit('FISHING_HARBOR_FAIL skiff overlaps rock bounds: '+obj.name)
print('FISHING_HARBOR_OK skiff_clear_of_rock_bounds',flush=True)
