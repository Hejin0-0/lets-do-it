"""Build original resort props and their Blender review renders.

From projects/rubber-duck-pool, with Blender 4.0 or newer:
    blender -b --factory-startup --python-exit-code 1 -P tools/create_resort_props.py -- all
Use poolhouse, noodles, torch, or lantern in place of all for one model.
The model builders are pure Python; Blender is imported only for export.
"""
import json
import math
from pathlib import Path
import sys

# Share the beach generator's triangulation, primitives, material and studio setup.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from create_beach_props import Model as BeachModel, add_studio, blender_material, box, cylinder, cross, normalize

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/02_models/props'
SPECS = {'poolhouse': 6000, 'noodles': 3000, 'torch': 900, 'lantern': 800}
COLORS = {
    'Plaster | warm white wall': (.90, .87, .80),
    'Plaster | soft ivory band': (.96, .92, .83),
    'Stone | warm beige limestone': (.67, .62, .53),
    'Paint | deep teal door': (.12, .40, .39),
    'Paint | sunlit teal door panel': (.19, .49, .47),
    'Paint | ivory window frame': (.98, .93, .82),
    'Paint | deep terracotta roof': (.52, .24, .15),
    'Paint | terracotta tile': (.69, .31, .20),
    'Paint | sunlit terracotta tile': (.76, .38, .25),
    'Paint | russet terracotta tile': (.62, .27, .18),
    'Metal | aged brass knob': (.66, .45, .18),
    'Canvas | awning stripe': (.18, .57, .49),
    'Canvas | awning cream': (.97, .91, .78),
    'Lamp | window amber cream': (1.0, .76, .46),
    'Wood | honey wicker': (.59, .42, .24),
    'Wood | pale honey wicker': (.66, .49, .29),
    'Wood | brown wicker binding': (.48, .32, .17),
    'Paint | noodle pink': (.96, .25, .51),
    'Paint | noodle green': (.32, .75, .30),
    'Paint | noodle yellow': (1.0, .76, .16),
    'Paint | noodle blue': (.19, .56, .91),
    'Paint | noodle orange': (.98, .43, .15),
    'Wood | golden honey bamboo': (.70, .53, .30),
    'Wood | toasted brown bamboo node': (.53, .38, .20),
    'Wood | chestnut brown cup weave': (.48, .32, .16),
    'Wood | light brown cup weave': (.57, .40, .21),
    'Wood | dark brown torch cord': (.39, .26, .14),
    'Lamp | torch flame': (1.0, .59, .14),
    'Lamp | torch flame core': (1.0, .29, .035),
    'Metal | dark iron': (.15, .15, .14),
    'Lamp | lantern amber cream': (1.0, .79, .51),
}

# Material, embedded lower axis point, exposed upper axis point, before XY centering.
NOODLE_LAYOUT = [
    ('Paint | noodle pink',   (-.045, 0, .045), (-.150, 0, .598)),
    ('Paint | noodle green',  ( .045, 0, .045), ( .150, 0, .581)),
    ('Paint | noodle yellow', (0, -.045, .045), (0, -.150, .624)),
    ('Paint | noodle blue',   (0,  .045, .045), (0,  .150, .571)),
    ('Paint | noodle orange', (0, 0, .045), (.016, .014, .607)),
]


class Model(BeachModel):
    @property
    def materials(self):
        return {name: COLORS[name] for part in self.meshes for name in part.materials}

    def center_xy(self):
        vertices = [v for part in self.meshes for v in part.vertices]
        center = [(min(v[i] for v in vertices)+max(v[i] for v in vertices))/2 for i in (0,1)]
        for part in self.meshes:
            part.vertices = [(x-center[0], y-center[1], z) for x,y,z in part.vertices]


def torus(model, name, z, major, minor, material, segments=24, sides=4):
    vertices = []
    for i in range(segments):
        a = math.tau*i/segments
        for j in range(sides):
            b = math.tau*j/sides
            radius = major + minor*math.cos(b)
            vertices.append((radius*math.cos(a), radius*math.sin(a), z+minor*math.sin(b)))
    faces = []
    for i in range(segments):
        for j in range(sides):
            faces.append((i*sides+j, ((i+1)%segments)*sides+j,
                          ((i+1)%segments)*sides+(j+1)%sides, i*sides+(j+1)%sides))
    model.add(name, vertices, faces, material, smooth=True)


def beam(model, name, start, end, radius, material, segments=10):
    direction = normalize(tuple(end[i]-start[i] for i in range(3)))
    reference = (0, 0, 1) if abs(direction[2]) < .9 else (0, 1, 0)
    across = normalize(cross(reference, direction))
    other = cross(direction, across)
    vertices = []
    for point in (start, end):
        for i in range(segments):
            a = math.tau*i/segments
            vertices.append(tuple(point[k] + radius*(across[k]*math.cos(a)+other[k]*math.sin(a)) for k in range(3)))
    faces = [(i, (i+1)%segments, segments+(i+1)%segments, segments+i) for i in range(segments)]
    faces.extend([tuple(reversed(range(segments))), tuple(segments+i for i in range(segments))])
    model.add(name, vertices, faces, material, smooth=True)


def pointed_shape(model, name, bottom, rings, top, material, segments=12):
    """A closed surface with single, non-degenerate poles and horizontal rings."""
    vertices = [bottom]
    for x, y, z, radius in rings:
        vertices.extend((x+radius*math.cos(math.tau*i/segments), y+radius*math.sin(math.tau*i/segments), z)
                        for i in range(segments))
    top_index = len(vertices)
    vertices.append(top)
    faces = [(0, 1+(i+1)%segments, 1+i) for i in range(segments)]
    for row in range(len(rings)-1):
        a, b = 1+row*segments, 1+(row+1)*segments
        faces.extend((a+i, a+(i+1)%segments, b+(i+1)%segments, b+i) for i in range(segments))
    last = 1+(len(rings)-1)*segments
    faces.extend((top_index, last+i, last+(i+1)%segments) for i in range(segments))
    model.add(name, vertices, faces, material, smooth=True)


def wall_point(axis, normal, u, z):
    return (normal, u, z) if axis == 'x' else (u, normal, z)


def wall_plane(model, name, axis, normal, rectangles, positive):
    vertices, faces = [], []
    for low, high, bottom, top in rectangles:
        first = len(vertices)
        vertices.extend(wall_point(axis, normal, u, z) for u, z in
                        ((low, bottom), (high, bottom), (high, top), (low, top)))
        face = tuple(first+i for i in range(4))
        faces.append(face if positive else tuple(reversed(face)))
    model.add(name, vertices, faces, 'Plaster | warm white wall')


def ring_on_wall(model, name, axis, outside, inside, center, inner_radius, outer_radius,
                 material, segments=16, square_outer=False):
    """Extruded wall ring; a square outer edge connects a window opening to its wall."""
    vertices = []
    for normal, outer in ((outside, True), (outside, False), (inside, True), (inside, False)):
        for i in range(segments):
            a = math.tau*i/segments
            c, s = math.cos(a), math.sin(a)
            radius = outer_radius/max(abs(c), abs(s)) if outer and square_outer else (outer_radius if outer else inner_radius)
            vertices.append(wall_point(axis, normal, center[0]+radius*c, center[1]+radius*s))
    positive = (outside > inside) if axis == 'x' else (outside < inside)
    faces = []
    for i in range(segments):
        j = (i+1)%segments
        quads = [(i, j, segments+j, segments+i),
                 (2*segments+j, 2*segments+i, 3*segments+i, 3*segments+j),
                 (segments+i, segments+j, 3*segments+j, 3*segments+i)]
        if not square_outer:
            quads.append((j, i, 2*segments+i, 2*segments+j))
        faces.extend(q if positive else tuple(reversed(q)) for q in quads)
    model.add(name, vertices, faces, material)


def window_pane(model, axis, normal, center, radius):
    n = 16
    vertices = [wall_point(axis, normal, *center)]
    for i in range(n):
        a = math.tau*i/n
        vertices.append(wall_point(axis, normal, center[0]+radius*math.cos(a), center[1]+radius*math.sin(a)))
    positive = (normal > 0) if axis == 'x' else (normal < 0)
    faces = [(0, 1+i, 1+(i+1)%n) for i in range(n)]
    model.add('Window | inset glowing pane', vertices,
              faces if positive else [tuple(reversed(f)) for f in faces], 'Lamp | window amber cream')


def windowed_wall(model, name, axis, sign, outer, thickness, low, high, window_centers):
    bottom, top, half, radius = .60, 1.0, .20, .16
    positive = (sign > 0) == (axis == 'x')
    # The outer and inner planes meet their neighbours at the outside and
    # inside corners respectively; no wall box or internal join face is needed.
    for normal, lo, hi, facing in ((sign*outer, low, high, positive),
                                   (sign*(outer-thickness), low+thickness, high-thickness, not positive)):
        rectangles = [(lo, hi, 0, bottom), (lo, hi, top, 1.32)]
        edge = lo
        for u in window_centers:
            if u-half > edge:
                rectangles.append((edge, u-half, bottom, top))
            edge = u+half
        if edge < hi:
            rectangles.append((edge, hi, bottom, top))
        wall_plane(model, name, axis, normal, rectangles, facing)
    for u in window_centers:
        ring_on_wall(model, 'Window | wall around opening', axis, sign*outer, sign*(outer-thickness),
                     (u, .8), radius, half, 'Plaster | warm white wall', square_outer=True)
        ring_on_wall(model, 'Window | painted round frame', axis, sign*(outer+.012), sign*(outer-.004),
                     (u, .8), .155, .20, 'Paint | ivory window frame')
        window_pane(model, axis, sign*(outer-.022), (u, .8), .157)


def wall_caps(model):
    outer = [(-.7,-1), (.7,-1), (.7,1), (-.7,1)]
    inner = [(-.6,-.9), (.6,-.9), (.6,.9), (-.6,.9)]
    vertices, faces = [], []

    def cap(points, z, upward):
        first = len(vertices)
        vertices.extend((x, y, z) for x, y in points)
        face = tuple(first+i for i in range(4))
        faces.append(face if upward else tuple(reversed(face)))

    for i in range(4):
        j = (i+1) % 4
        points = (outer[i], outer[j], inner[j], inner[i])
        cap(points, 1.32, True)
        if i == 1:
            # Leave the threshold open across the doorway.
            cap(((.7,-1), (.7,-.3), (.6,-.3), (.6,-.9)), 0, False)
            cap(((.7,.3), (.7,1), (.6,.9), (.6,.3)), 0, False)
        else:
            cap(points, 0, False)
    model.add('House | wall caps', vertices, faces, 'Plaster | warm white wall')


def doorway_reveal(model):
    vertices = [(.6,-.3,0), (.6,-.3,1.16), (.7,-.3,1.16), (.7,-.3,0),
                (.7,.3,0), (.7,.3,1.16), (.6,.3,1.16), (.6,.3,0),
                (.6,-.3,1.16), (.6,.3,1.16), (.7,.3,1.16), (.7,-.3,1.16)]
    model.add('House | doorway reveal', vertices,
              [(0,1,2,3), (4,5,6,7), (8,9,10,11)], 'Plaster | warm white wall')


def corner_quoins(model):
    for sx in (-1, 1):
        for sy in (-1, 1):
            for course in range(6):
                length, depth = (.14 if course % 2 == 0 else .18), .008
                bottom, top = .09+.2*course, .245+.2*course
                # Two rectangles form an L outside the wall; its back is open
                # so the decorative block does not duplicate the wall faces.
                rectangles = [((-length,0), (0,0), (0,depth), (-length,depth)),
                              ((0,-length), (depth,-length), (depth,depth), (0,depth))]
                perimeter = [(0,-length), (depth,-length), (depth,depth), (-length,depth), (-length,0)]
                vertices, faces = [], []

                def quad(points, reverse=False):
                    first = len(vertices)
                    vertices.extend((sx*(.7+x), sy*(1+y), z) for x, y, z in points)
                    face = tuple(first+i for i in range(4))
                    faces.append(tuple(reversed(face)) if reverse != (sx*sy < 0) else face)

                for rect in rectangles:
                    quad([(x,y,top) for x,y in rect])
                    quad([(x,y,bottom) for x,y in rect], reverse=True)
                for a, b in zip(perimeter, perimeter[1:]):
                    quad([(a[0],a[1],bottom), (b[0],b[1],bottom),
                          (b[0],b[1],top), (a[0],a[1],top)])
                model.add('House | corner quoin', vertices, faces, 'Plaster | soft ivory band')


def roof_underlay(model):
    vertices = [(-.82,-1.12,1.32), (.82,-1.12,1.32), (.82,1.12,1.32), (-.82,1.12,1.32),
                (0,-.55,1.78), (0,.55,1.78)]
    faces = [(0,1,4), (2,3,5), (1,2,5,4), (3,0,4,5), (3,2,1,0)]
    model.add('Roof | dark terracotta underlay', vertices, faces, 'Paint | deep terracotta roof')


def roof_tiles(model, axis, sign):
    """Six courses of gently crowned, separated tiles follow each hip slope."""
    vertices, faces, indices = [], [], []
    columns = 12 if axis == 'x' else 7
    for row in range(6):
        start, stop = row/6, min((row+1)/6-.008, .96)
        for col in range(columns):
            first = len(vertices)
            for t in (start, stop):
                for j in range(5):
                    fraction = (col+(j/4)*.96+.02)/columns
                    raised = .004 + .007*math.sin(math.pi*j/4)
                    z = 1.32+.46*t+raised
                    if axis == 'x':
                        point = (sign*.82*(1-t), (2*fraction-1)*(1.12-.57*t), z)
                    else:
                        point = ((2*fraction-1)*.82*(1-t), sign*(1.12-.57*t), z)
                    vertices.append(point)
            for j in range(4):
                quad = (first+j, first+j+1, first+5+j+1, first+5+j)
                # Parameter winding differs for each slope.
                upward = (axis == 'x' and sign > 0) or (axis == 'y' and sign < 0)
                faces.append(quad if upward else tuple(reversed(quad)))
                indices.append((row*7+col*5+col//3+(1 if sign > 0 else 0)) % 3)
    side = ('front' if sign > 0 else 'back') if axis == 'x' else ('right' if sign > 0 else 'left')
    model.add('Roof | tile courses ' + side, vertices, faces,
              ['Paint | terracotta tile', 'Paint | sunlit terracotta tile', 'Paint | russet terracotta tile'], indices)


def awning(model):
    for i in range(6):
        y0, y1 = -.42+i*.14, -.42+(i+1)*.14
        material = 'Canvas | awning cream' if i % 2 == 0 else 'Canvas | awning stripe'
        vertices = [(.70,y0,1.30), (.70,y1,1.30), (1.04,y1,1.12), (1.04,y0,1.12),
                    (.70,y0,1.292), (.70,y1,1.292), (1.04,y1,1.112), (1.04,y0,1.112)]
        faces = [(0,3,2,1), (4,5,6,7), (0,1,5,4), (1,2,6,5), (2,3,7,6), (3,0,4,7)]
        model.add('Awning | striped canopy', vertices, faces, material)
        # The little scallop hangs from the leading edge and stays inside the sconce clearance.
        vertices = [(1.04,y0,1.12), (1.04,y1,1.12), (1.04,y1,1.09),
                    (1.04,(y0+y1)/2,1.08), (1.04,y0,1.09)]
        model.add('Awning | scalloped valance', vertices, [(0,4,3,2,1)], material)


def poolhouse(model):
    windowed_wall(model, 'House | side wall', 'y', -1, 1.0, .10, -.70, .70, [0])
    windowed_wall(model, 'House | side wall', 'y', 1, 1.0, .10, -.70, .70, [0])
    windowed_wall(model, 'House | back wall', 'x', -1, .70, .10, -1.0, 1.0, [-.45, .45])
    for normal, limit, positive in ((.7, 1.0, True), (.6, .9, False)):
        wall_plane(model, 'House | front wall', 'x', normal,
                   [(-limit,-.3,0,1.32), (.3,limit,0,1.32), (-.3,.3,1.16,1.32)], positive)
    doorway_reveal(model)
    wall_caps(model)
    corner_quoins(model)
    box(model, 'House | low plinth', (0,0,.03), (1.50,2.10,.06), 'Stone | warm beige limestone')
    box(model, 'House | front step', (.85,0,.04), (.30,.78,.08), 'Stone | warm beige limestone')
    box(model, 'Door | inset panel', (.625,0,.57), (.05,.59,1.14), 'Paint | deep teal door')
    for z in (.30,.82):
        box(model, 'Door | raised panel', (.653,0,z), (.006,.49,.34), 'Paint | sunlit teal door panel')
    for y in (-.313,.313):
        box(model, 'Door | upright trim', (.704,y,.58), (.012,.026,1.16), 'Paint | ivory window frame')
    box(model, 'Door | lintel trim', (.704,0,1.17), (.012,.65,.025), 'Paint | ivory window frame')
    pointed_shape(model, 'Door | brass knob', (.672,-.22,.553),
                  [(.672,-.22,.561,.014), (.672,-.22,.570,.017), (.672,-.22,.579,.014)],
                  (.672,-.22,.587), 'Metal | aged brass knob', segments=10)
    # A shallow band adds definition without approaching the wall-sconce patch.
    box(model, 'House | front eaves band', (.706,0,1.285), (.012,2.0,.07), 'Plaster | soft ivory band')
    for y in (-.998,.998):
        box(model, 'House | side eaves band', (0,y,1.285), (1.4,.012,.07), 'Plaster | soft ivory band')
    roof_underlay(model)
    for axis in ('x','y'):
        for sign in (-1,1):
            roof_tiles(model, axis, sign)
    beam(model, 'Roof | rounded ridge cap', (0,-.56,1.79), (0,.56,1.79), .027,
         'Paint | terracotta tile', segments=10)
    for x in (-.82,.82):
        for sign in (-1,1):
            beam(model, 'Roof | hip cap', (x,sign*1.12,1.33), (0,sign*.55,1.79), .012,
                 'Paint | terracotta tile', segments=8)
    awning(model)


def basket(model):
    n, rows = 24, 10
    vertices = []
    for row in range(rows+1):
        z = .15*row/rows
        base_radius = .096 + .017*row/rows
        for i in range(n):
            a = math.tau*i/n
            radius = base_radius + .0014*(-1 if (i+row)%2 else 1)
            vertices.append((radius*math.cos(a), radius*math.sin(a), z))
    # The inner wall and floor make the basket visibly open under the noodles.
    for z, radius in ((.15,.104), (.012,.088)):
        vertices.extend((radius*math.cos(math.tau*i/n),radius*math.sin(math.tau*i/n),z) for i in range(n))
    faces, indices = [], []
    for row in range(rows):
        for i in range(n):
            faces.append((row*n+i,row*n+(i+1)%n,(row+1)*n+(i+1)%n,(row+1)*n+i))
            indices.append((i+row)%2)
    outside, inner_top, inner_bottom = rows*n, (rows+1)*n, (rows+2)*n
    for i in range(n):
        j = (i+1)%n
        faces.extend([(outside+i,outside+j,inner_top+j,inner_top+i),
                      (inner_top+i,inner_top+j,inner_bottom+j,inner_bottom+i)])
        indices.extend([0,0])
    faces.extend([tuple(reversed(range(n))), tuple(inner_bottom+i for i in range(n))])
    indices.extend([0,0])
    model.add('Basket | alternating wicker weave', vertices, faces,
              ['Wood | honey wicker', 'Wood | pale honey wicker'], indices, smooth=True)
    for z in (.034,.071,.108,.143):
        torus(model, 'Basket | woven binding', z, .096+.017*z/.15, .0026, 'Wood | brown wicker binding')
    torus(model, 'Basket | rolled rim', .151, .111, .006, 'Wood | honey wicker', sides=5)


def noodle(model, material, start, end):
    n = 20
    axis = normalize(tuple(end[k]-start[k] for k in range(3)))
    across = normalize(cross((0,1,0), axis))
    other = cross(axis, across)
    length = math.sqrt(sum((end[k]-start[k])**2 for k in range(3)))
    # Turn inwards at the upper rim and end the inner bore below the surface.
    profile = [(0,.021), (length*.52,.023), (length,.023), (length,.010), (length-.060,.010)]
    vertices = []
    for distance, radius in profile:
        for i in range(n):
            a = math.tau*i/n
            rib = 1+.045*math.cos(5*a) if radius > .02 else 1
            vertices.append(tuple(start[k]+axis[k]*distance+radius*rib*(across[k]*math.cos(a)+other[k]*math.sin(a))
                                  for k in range(3)))
    faces = []
    for row in range(len(profile)-1):
        for i in range(n):
            faces.append((row*n+i,row*n+(i+1)%n,(row+1)*n+(i+1)%n,(row+1)*n+i))
    faces.extend([tuple(reversed(range(n))), tuple((len(profile)-1)*n+i for i in range(n))])
    model.add('Noodle | ' + material.split(' | ')[1], vertices, faces, material, smooth=True)


def noodles(model):
    basket(model)
    for material, start, end in NOODLE_LAYOUT:
        noodle(model, material, start, end)
    model.center_xy()


def torch_flame(model):
    segments = 16
    rings = [(0,0,.943,.030), (0,0,.952,.038), (0,0,.968,.035),
             (.001,0,.983,.027), (.003,0,1.002,.017), (.006,0,1.020,.008)]
    vertices = [(0,0,.934)]
    for x, y, z, radius in rings:
        vertices.extend((x+radius*math.cos(math.tau*i/segments), y+radius*math.sin(math.tau*i/segments), z)
                        for i in range(segments))
    tip = len(vertices)
    vertices.append((.004,0,1.04))
    faces = [(0, 1+(i+1)%segments, 1+i) for i in range(segments)]
    indices = [0]*len(faces)
    for row in range(len(rings)-1):
        for i in range(segments):
            a = 1+row*segments+i
            b = 1+row*segments+(i+1)%segments
            c, d = b+segments, a+segments
            side = i % 4
            # Four tapered color inlays are part of the outer surface, so an
            # opaque yellow shell cannot hide the orange core from the camera.
            if row == 0 and side == 3:
                faces.extend([(a,b,d), (b,c,d)])
                indices.extend([0,1])
            elif row == 0 and side == 0:
                faces.extend([(a,b,c), (a,c,d)])
                indices.extend([0,1])
            elif row == 2 and side == 3:
                faces.extend([(a,b,c), (a,c,d)])
                indices.extend([1,0])
            elif row == 2 and side == 0:
                faces.extend([(a,b,d), (b,c,d)])
                indices.extend([1,0])
            else:
                faces.append((a,b,c,d))
                indices.append(1 if row == 1 and side in (0,3) else 0)
    last = 1+(len(rings)-1)*segments
    faces.extend((tip, last+i, last+(i+1)%segments) for i in range(segments))
    indices.extend([0]*segments)
    model.add('Torch | soft flame', vertices, faces,
              ['Lamp | torch flame', 'Lamp | torch flame core'], indices, smooth=True)


def torch(model):
    cylinder(model, 'Torch | bamboo pole', (0,0,0), [(0,.017),(.86,.017)], 12, 'Wood | golden honey bamboo')
    for z in (.20,.42,.64):
        torus(model, 'Torch | bamboo node', z, .017, .0024, 'Wood | toasted brown bamboo node', segments=12)
    cylinder(model, 'Torch | woven fuel cup', (0,0,0),
             [(.845,.026),(.86,.033),(.90,.041),(.925,.038),(.935,.032)], 12,
             ['Wood | chestnut brown cup weave', 'Wood | light brown cup weave'], [0,1,0,1])
    for z, radius in ((.872,.036),(.915,.040)):
        torus(model, 'Torch | wrapped cord', z, radius, .0025, 'Wood | dark brown torch cord', segments=12)
    torch_flame(model)


def pyramid(model):
    vertices = [(-.065,-.065,.63),(.065,-.065,.63),(.065,.065,.63),(-.065,.065,.63),(0,0,.692)]
    model.add('Lantern | pyramid cap', vertices,
              [(0,1,4),(1,2,4),(2,3,4),(3,0,4),(3,2,1,0)], 'Metal | dark iron')


def lantern(model):
    iron, glow = 'Metal | dark iron', 'Lamp | lantern amber cream'
    box(model, 'Lantern | square foot', (0,0,.02), (.10,.10,.04), iron)
    box(model, 'Lantern | foot collar', (0,0,.051), (.065,.065,.022), iron)
    box(model, 'Lantern | slim post', (0,0,.263), (.034,.034,.402), iron)
    box(model, 'Lantern | head bottom', (0,0,.487), (.12,.12,.018), iron)
    for sign in (-1,1):
        box(model, 'Lantern | glowing x pane', (sign*.048,0,.56), (.004,.09,.12), glow)
        box(model, 'Lantern | glowing y pane', (0,sign*.048,.56), (.09,.004,.12), glow)
    for x in (-.052,.052):
        for y in (-.052,.052):
            box(model, 'Lantern | corner upright', (x,y,.56), (.014,.014,.14), iron)
    box(model, 'Lantern | head top', (0,0,.629), (.12,.12,.012), iron)
    pyramid(model)
    pointed_shape(model, 'Lantern | rounded finial', (0,0,.689),
                  [(0,0,.697,.010), (0,0,.708,.017), (0,0,.719,.010)],
                  (0,0,.729), iron, segments=10)


def build_model(name):
    builders = {'poolhouse': poolhouse, 'noodles': noodles, 'torch': torch, 'lantern': lantern}
    if name not in builders:
        raise ValueError('Unknown resort prop: ' + name)
    model = Model()
    builders[name](model)
    if model.triangle_count() > SPECS[name]:
        raise ValueError(f'{name}: triangle budget exceeded ({model.triangle_count()})')
    return model


def write_model(name):
    import bpy
    model = build_model(name)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    materials = {key: blender_material(bpy, key, rgb) for key, rgb in model.materials.items()}
    objects = []
    for part in model.meshes:
        data = bpy.data.meshes.new(part.name)
        data.from_pydata(part.vertices, [], part.faces)
        data.update()
        obj = bpy.data.objects.new(part.name, data)
        bpy.context.collection.objects.link(obj)
        for material in part.materials:
            data.materials.append(materials[material])
        for poly, index in zip(data.polygons, part.face_materials):
            poly.material_index = index
            poly.use_smooth = part.smooth
        objects.append(obj)
    bpy.context.view_layer.update()
    depsgraph = bpy.context.evaluated_depsgraph_get()
    coords, triangles = [], 0
    for obj in objects:
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        mesh.calc_loop_triangles()
        triangles += len(mesh.loop_triangles)
        coords.extend(tuple(obj.matrix_world @ vertex.co) for vertex in mesh.vertices)
        evaluated.to_mesh_clear()
    bounds = [[min(v[i] for v in coords), max(v[i] for v in coords)] for i in range(3)]
    print('MODEL_STATS ' + json.dumps(dict(id=name, triangles=triangles, bounds=bounds,
                                          materials={key: [*rgb,1] for key,rgb in model.materials.items()})), flush=True)
    if triangles != model.triangle_count() or triangles > SPECS[name]:
        raise RuntimeError(f'{name}: evaluated triangle count does not match the budgeted mesh')
    target = OUT / name
    target.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.wm.save_as_mainfile(filepath=str(target / (name+'.blend')), compress=True)
    bpy.ops.export_scene.gltf(filepath=str(target / (name+'.glb')), export_format='GLB',
                              use_selection=True, export_apply=True)
    add_studio(bpy, coords, target / (name+'.png'))


def main():
    args = sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
    if len(args) != 1 or args[0] not in (*SPECS, 'all'):
        raise SystemExit('usage: -- <poolhouse|noodles|torch|lantern|all>')
    for name in (SPECS if args[0] == 'all' else args):
        write_model(name)


if __name__ == '__main__':
    main()
