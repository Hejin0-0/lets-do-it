"""Check an opened beach-pail duck scene, including contact with its supports."""
from pathlib import Path
import sys

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
from compose_beach_pail_ducks import surface_height

scene = bpy.data.scenes.get('Pail | ducks lookdev')
assert scene is not None, 'duck composition scene is missing'
bucket = [obj for obj in scene.objects if obj.type == 'EMPTY' and obj.name.startswith('Duck | bucket ')]
spade = [obj for obj in scene.objects if obj.type == 'EMPTY' and obj.name == 'Duck | spade']
assert 3 <= len(bucket) <= 5, f'expected 3–5 bucket ducks, found {len(bucket)}'
assert len(spade) == 1, f'expected one scoop duck, found {len(spade)}'
assert all(len(obj.children) == 4 for obj in bucket + spade), 'duck parts are missing'
assert spade[0].scale.x > max(obj.scale.x for obj in bucket), 'scoop duck must be larger'
for obj in bucket:
    assert obj.location.xy.length < .23, f'bucket duck outside sand area: {obj.name}'
    z = surface_height(scene.objects['Pail | gently heaped sand'], obj.location.x, obj.location.y)
    assert abs(obj.location.z - z) < .003, f'bucket duck is not on the sand: {obj.name}'
obj = spade[0]
assert .30 < obj.location.x < .60 and -.60 < obj.location.y < -.30, 'scoop duck outside blade'
z = surface_height(scene.objects['Spade | rounded cupped blade and moulded neck'], obj.location.x, obj.location.y)
assert abs(obj.location.z - z) < .003, 'scoop duck is not on the blade'
assert bpy.data.images.get('duck-01-classic-albedo.png'), 'classic game duck atlas missing'
print('PAIL_DUCKS_CHECK=PASS bucket=%d spade=%d' % (len(bucket), len(spade)))
