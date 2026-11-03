"""Fit a rolled towel to its evaluated support surface in Blender."""
from bisect import bisect_right

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree


def fit_roll_contact(rolled, support):
    bpy.context.view_layer.update()
    dg=bpy.context.evaluated_depsgraph_get()
    upper=BVHTree.FromObject(support,dg)
    lower=BVHTree.FromObject(rolled,dg)
    samples=[]
    for i in range(21):
        x=-.19+.38*i/20
        top=upper.ray_cast(Vector((x,.012,.5)),Vector((0,0,-1)))[0]
        bottom=lower.ray_cast(Vector((x,.012,-.2)),Vector((0,0,1)))[0]
        if top is None or bottom is None:
            raise RuntimeError(f'Cannot establish roll contact at x={x:.3f}')
        gap=bottom.z-top.z
        samples.append((x,max(-.01,min(.01,gap-.0002))))
    xs=[p[0] for p in samples]
    for vertex in rolled.data.vertices:
        x=vertex.co.x
        idx=max(0,min(len(xs)-2,bisect_right(xs,x)-1))
        a,b=samples[idx],samples[idx+1]
        t=max(0.0,min(1.0,(x-a[0])/(b[0]-a[0])))
        vertex.co.z-=a[1]*(1-t)+b[1]*t
    rolled.data.update()
    bpy.context.view_layer.update()
    print('CONTACT_FIT applied_m',round(min(p[1] for p in samples),5),
          round(max(p[1] for p in samples),5),flush=True)
