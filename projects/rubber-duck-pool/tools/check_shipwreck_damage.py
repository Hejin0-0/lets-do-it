"""Check that the visible torn side is open and has separate broken planks."""
import bpy

objects = bpy.context.scene.objects
front_rails = [o for o in objects if o.name.startswith('Wreck | rim -1 ')]
splinters = [o for o in objects if o.name.startswith('Wreck | broken plank ')]
if not 3 <= len(front_rails) <= 6:
    raise SystemExit(f'SHIPWRECK_DAMAGE_FAIL expected a partly missing front rail, got {len(front_rails)}')
if len(splinters) < 2:
    raise SystemExit(f'SHIPWRECK_DAMAGE_FAIL expected separate broken planks, got {len(splinters)}')
print(f'SHIPWRECK_DAMAGE_OK remaining_rail_segments={len(front_rails)} broken_planks={len(splinters)}',flush=True)
