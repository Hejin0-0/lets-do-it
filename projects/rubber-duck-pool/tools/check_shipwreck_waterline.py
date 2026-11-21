"""Check that the wreck crosses the sea plane and has local waterline wash."""
import bpy

objects=bpy.context.scene.objects
sea=objects['Reef | sea']
hull=objects['Wreck | hull shell']
sea_top=max((sea.matrix_world @ vertex.co).z for vertex in sea.data.vertices)
heights=[(hull.matrix_world @ vertex.co).z for vertex in hull.data.vertices]
if not (min(heights) < sea_top-.025 and max(heights) > sea_top+.10):
    raise SystemExit(f'SHIPWRECK_WATERLINE_FAIL sea={sea_top:.4f} hull=({min(heights):.4f},{max(heights):.4f})')
wash=[obj for obj in objects if obj.name.startswith('Reef | hull wash ')]
if len(wash) < 2:
    raise SystemExit(f'SHIPWRECK_WATERLINE_FAIL expected wash along both sides, got {len(wash)}')
print(f'SHIPWRECK_WATERLINE_OK sea={sea_top:.4f} hull_min={min(heights):.4f} wash={len(wash)}',flush=True)
