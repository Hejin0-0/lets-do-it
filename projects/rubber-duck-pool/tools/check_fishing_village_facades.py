"""Check that the three cottages have visible openings on both sides."""
import bpy

objects=bpy.context.scene.objects
for i in range(1,4):
    for label in ('door','window pane -1','window pane 1','rear window pane'):
        name=f'Village | house {i:02} {label}'
        if name not in objects:
            raise SystemExit('FISHING_FACADES_FAIL missing '+name)
    body=objects[f'Village | house {i:02} body']
    rear=objects[f'Village | house {i:02} rear window pane']
    ys=[(body.matrix_world @ vertex.co).y for vertex in body.data.vertices]
    if rear.location.y <= (min(ys)+max(ys))/2:
        raise SystemExit(f'FISHING_FACADES_FAIL house {i} rear window is not behind its center')
print('FISHING_FACADES_OK houses=3 front_and_rear=6',flush=True)
