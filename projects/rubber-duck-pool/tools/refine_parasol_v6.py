"""Raise the v5 canvas crown and its frame together for the v6 study."""
import bpy
import math
from mathutils import Vector
from pathlib import Path

root = Path('/Users/rels/Documents/github-repo/lets-do-it/projects/rubber-duck-pool')
def lift(x,y):
    r = math.hypot(x,y)
    return .17*max(0,1-(r/1.28)**1.3)

for ob in bpy.context.scene.objects:
    if ob.type == 'MESH' and (ob.name.startswith('Canopy |') or ob.name.startswith('Frame |')):
        inverse = ob.matrix_world.inverted()
        for vertex in ob.data.vertices:
            world = ob.matrix_world @ vertex.co
            if world.z > 2.14:
                world.z += lift(world.x,world.y)
                vertex.co = inverse @ world
        ob.data.update()
    elif ob.type == 'CURVE' and (ob.name.startswith('Tailoring |') or ob.name.startswith('Canvas |')):
        inverse = ob.matrix_world.inverted()
        for spline in ob.data.splines:
            for point in spline.points:
                world = ob.matrix_world @ Vector(point.co[:3])
                if world.z > 2.14:
                    world.z += lift(world.x,world.y)
                    point.co = (*tuple(inverse @ world),1)
    elif ob.name.startswith('Finial |'):
        ob.location.z += .17

pole=bpy.data.objects['Pole | timber']
# Keep the lower pole end fixed as the upper end reaches the raised crown.
pole.location.z += .085
pole.scale.z *= (2.57+.17)/2.57
bpy.data.objects['Mechanism | runner'].location.z += .17
camera=bpy.context.scene.camera
camera.location=(4,-7,.55)
camera.rotation_euler=(Vector((0,0,1.42))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.lens=78
scene=bpy.context.scene
scene.render.filepath=str(root/'docs/evidence/parasol-cream-v6.png')
bpy.ops.wm.save_as_mainfile(filepath=str(root/'models/parasol-cream-v6.blend'))
print('V6_READY')
