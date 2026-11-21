"""Check the visible essentials of the independent fishing-village study."""
import bpy


def require(ok,message):
    if not ok:
        raise SystemExit('FISHING_VILLAGE_FAIL '+message)


objects=bpy.context.scene.objects
for i in range(1,4):
    require(f'Village | house {i:02} body' in objects,f'missing house {i}')
require('Village | sea' in objects,'missing sea')
require('Village | chimney' in objects,'missing chimney')
require(sum(o.name.startswith('Village | jetty plank ') for o in objects) >= 6,'missing jetty')
smoke=[o for o in objects if o.name.startswith('Village | smoke ')]
require(len(smoke)>=3,'missing smoke puffs')
chimney=objects['Village | chimney']
require(max(o.location.z for o in smoke) > chimney.location.z,'smoke is not above chimney')
asset=[o for o in objects if o.type=='MESH' and not o.name.startswith('STUDIO |')]
for obj in asset:
    require(all(poly.area>1e-12 for poly in obj.data.polygons),'degenerate face '+obj.name)
print('FISHING_VILLAGE_OK objects='+str(len(asset))+' smoke_puffs='+str(len(smoke)),flush=True)
