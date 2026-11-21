"""Validate the independently modeled shipwreck in the open Blender file."""
import bpy


def require(ok, message):
    if not ok:
        raise SystemExit('SHIPWRECK_CHECK_FAIL '+message)


objects=bpy.context.scene.objects
for name in ('Reef | sea','Wreck | hull shell','Wreck | broken mast'):
    require(name in objects,'missing '+name)
require(sum(o.name.startswith('Wreck | rib ') for o in objects)>=5,'missing hull ribs')
require(sum(o.name.startswith('Reef | coral ') for o in objects)>=3,'missing coral')
sea=objects['Reef | sea']
require(any(p.normal.z > .9 for p in sea.data.polygons),'sea has no upward-facing surface')
parts=[o for o in objects if o.type == 'MESH' and not o.name.startswith('STUDIO |')]
for obj in parts:
    require(all(poly.area > 1e-12 for poly in obj.data.polygons),'degenerate face '+obj.name)
print('SHIPWRECK_CHECK_OK objects='+str(len(parts)),flush=True)
