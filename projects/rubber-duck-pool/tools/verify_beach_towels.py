"""Check the standalone towel study's visible pieces and basic physical scale."""
import bpy

scene = bpy.data.scenes.get('Towels | studio lookdev')
assert scene is not None, 'standalone towel scene is missing'
expected = ('Towel | ivory folded', 'Towel | coral folded', 'Towel | sea glass roll')
objects = [scene.objects.get(name) for name in expected]
assert all(obj is not None and obj.type == 'MESH' for obj in objects), 'three towel meshes are required'
assert all(len(obj.data.polygons) > 100 for obj in objects), 'a towel has no meaningful surface'
assert all(len(obj.data.materials) >= 2 for obj in objects), 'woven stripe materials are missing'
assert all(.35 < obj.dimensions.x < .70 for obj in objects), 'towel width is outside its intended scale'
assert all(.15 < obj.dimensions.y < .42 for obj in objects), 'towel depth is outside its intended scale'
print('TOWEL_STUDY_CHECK=PASS pieces=3')
