import bpy
obs=bpy.data.objects
assert len([o for o in obs if o.name.startswith('Duck ') and 'body' in o.name])==7
assert obs.get('Water sparkle'), 'water sparkles absent'
assert obs.get('Fish tail'), 'fish silhouette absent'
assert obs.get('Side starfish'), 'side starfish absent'
assert len(obs['Lid hinge'].children)>=9
print('COOLER_REFERENCE_DETAIL_OK')
angles={round(o.rotation_euler.z,2) for o in obs if o.name.startswith('Duck ') and 'body' in o.name}
assert len(angles)>=4, f'ducks lack varied directions: {angles}'
print('DUCK_DIRECTIONS_OK', sorted(angles))
for o in obs:
    if o.name.startswith('Duck ') and 'body' in o.name:
        assert max(o.dimensions)<.06, f'{o.name} is oversized: {o.dimensions[:]}'
print('DUCK_SIZES_OK')
for o in obs:
    if o.name.startswith('Duck ') and o.type=='MESH':
        assert max(o.dimensions)<.06, f'{o.name} oversized: {o.dimensions[:]}'
print('ALL_DUCK_PART_SIZES_OK')
