"""Build six study assets into an isolated, disposable WebGPU preview copy.

This is an experiment for the fc77131 working tree, not a production exporter.
Create the preview copy first and pass its absolute path after Blender's --.
No path outside /private/tmp is accepted as a destination.
"""
import collections
import hashlib
import json
import math
import pathlib
import shutil
import struct
import sys
from array import array

ROOT = pathlib.Path(__file__).resolve().parents[2]
args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
if len(args) != 1:
    raise ValueError('Pass the absolute path to an existing disposable preview after --')
PREVIEW = pathlib.Path(args[0]).resolve(strict=True)
tmp_root = pathlib.Path('/private/tmp').resolve(strict=True)
if PREVIEW == tmp_root or not PREVIEW.is_relative_to(tmp_root):
    raise ValueError('Preview destination must be a subdirectory of /private/tmp')
if not (PREVIEW / 'preview-summary.json').resolve().is_relative_to(PREVIEW):
    raise ValueError('Preview summary would be written outside the preview')
for rel in ('src/pool/lookdev-shapes.js', 'public/props/lookdev.bin'):
    destination = PREVIEW / rel
    if not destination.resolve().is_relative_to(PREVIEW) or not destination.is_file():
        raise ValueError(f'Expected an isolated preview file: {destination}')
    shutil.copy2(ROOT / rel, destination)
source = ROOT / 'tools/export_lookdev_props.py'
code = source.read_text(encoding='utf-8')
marker = '\nverts, inds, models = [], [], {}\n'
if code.count(marker) != 1:
    raise RuntimeError('Exporter boundary changed; refusing to execute writing code')
namespace = {'__file__': str(source), '__name__': 'lookdev_preview'}
exec(compile(code.split(marker)[0], str(source), 'exec'), namespace)
original_cut = namespace['cut']
depth_limit = 1
def shallow_cut(corners, tex, depth=3):
    return original_cut(corners, tex, min(depth, depth_limit))
namespace['cut'] = shallow_cut

shape_path = PREVIEW / 'src/pool/lookdev-shapes.js'
shape_src = shape_path.read_text(encoding='utf-8')
prefix = shape_src.split('export const LOOKDEV_SHAPES = ', 1)[0] + 'export const LOOKDEV_SHAPES = '
shapes = json.loads(shape_src.split('export const LOOKDEV_SHAPES = ', 1)[1].rsplit(';', 1)[0])
raw = (PREVIEW / 'public/props/lookdev.bin').read_bytes()
stride = (len(raw) - shapes['indices'] * 4) // shapes['vertices']
if stride != 20 or len(raw) != shapes['vertices'] * stride + shapes['indices'] * 4:
    raise ValueError('Unexpected original mesh layout; preview was not written')
orig_hash = hashlib.sha256((ROOT / 'public/props/lookdev.bin').read_bytes()).hexdigest()
original_v = raw[:shapes['vertices'] * stride]
original_i = raw[shapes['vertices'] * stride:]
models = [
    ('bottle-fourth', 'rowboat-bottle-study/rowboat-bottle-v9-game-preview-v2.glb'),
    ('bottle-fifth', 'submarine-bottle-study/submarine-bottle-v6-game-preview-v2.glb'),
    ('bottle-sixth', 'longship-bottle-study/longship-bottle-v5-game-preview-v2.glb'),
    ('diorama-fourth', 'lighthouse-island-study/lighthouse-island-v6-lod.glb'),
    ('diorama-fifth', 'shipwreck-reef-study/shipwreck-reef-v5-lod.glb'),
    ('diorama-sixth', 'fishing-village-study/fishing-village-v4-lod.glb'),
]
kinds = {
    'ocean | turquoise resin': 10,
    'sea | turquoise': 10, 'sea | shallow turquoise': 10,
    'ground | dune': 3, 'ground | grass': 5,
    'island | sand': 3, 'island | soft grass': 5,
    'reef | warm sand': 3, 'reef | warm stone': 8, 'reef | dark stone': 8,
    'island | pale stone': 8, 'island | slate': 8,
    'rowboat | honey oak': 1, 'rowboat | fresh cut oak': 1,
    'rowboat | textured oak thwarts': 1, 'rowboat | oak seams': 1,
    'longship | honey oak': 1, 'longship | fresh cut oak': 1,
    'longship | oak seams': 1,
    'wreck | exposed edges': 1, 'wreck | aged seams': 1,
    'village | smoke': 3,
}

def srgb(c):
    c = c * 12.92 if c <= 0.0031308 else 1.055 * max(c, 0.0) ** (1/2.4) - 0.055
    return max(0, min(255, math.floor(c * 255 + 0.5)))
def snorm(c):
    return max(-127, min(127, math.floor(c * 127 + 0.5)))
def pack_vertex(v):
    return struct.pack('<fffbbbBBBBB', *v[:3], *(snorm(c) for c in v[3:6]), int(v[9]), *(srgb(c) for c in v[6:9]), 0)

replacement = {}
for cid, src in models:
    name = 'collectible-' + cid
    old = shapes['models'][name]
    old_lo, old_hi = old['bounds']
    width = old_hi[0] - old_lo[0]
    spec = dict(namespace['MODELS'][name], src=src, fit=('x', width), lift=0, kinds=kinds)
    if cid.startswith('bottle'):
        spec['drop'] = ('Wood | warm maple',)
    depth_limit = 0 if cid in ('diorama-fourth', 'diorama-fifth') else 1
    print('PREVIEW_START', cid, 'texture_cut_depth', depth_limit, flush=True)
    vertices, indices, bounds = namespace['export']('preview-' + cid, spec)
    shift = [(old_lo[k] + old_hi[k] - bounds[0][k] - bounds[1][k]) / 2 for k in range(3)]
    if cid.startswith('diorama'):
        shift[1] = old_lo[1] - bounds[0][1]
    vertices = [tuple(v[k] + shift[k] if k < 3 else v[k] for k in range(10)) for v in vertices]
    b = [[min(v[k] for v in vertices) for k in range(3)], [max(v[k] for v in vertices) for k in range(3)]]
    if abs((b[1][0]-b[0][0])-width)>1e-6:
        raise ValueError(f'{cid}: fitted width does not match')
    if not indices or max(indices) >= len(vertices):
        raise ValueError(f'{cid}: invalid triangle indices')
    if len(indices) // 3 > 8000:
        raise ValueError(f'{cid}: converted preview exceeds 8000 triangles')
    counts = collections.Counter(int(vertices[i][9]) for i in indices[::3])
    replacement[name] = {'v':b''.join(pack_vertex(v) for v in vertices), 'i':array('I',indices).tobytes(),
                         'vertices':len(vertices),'indices':len(indices),'bounds':[[round(x,4) for x in q] for q in b],
                         'kinds':dict(counts)}
    print('PREVIEW_RESULT', cid, 'triangles',len(indices)//3,'bounds',replacement[name]['bounds'],'kinds',counts, flush=True)

out_v, out_i, out_models = [], [], {}
vcount = icount = 0
for name, m in shapes['models'].items():
    if name in replacement:
        part = replacement[name]
        v, i = part['v'], part['i']
        updated = {'vertices':part['vertices'], 'indices':part['indices'], 'bounds':part['bounds']}
    else:
        v=original_v[m['vertex']*stride:(m['vertex']+m['vertices'])*stride]
        i=original_i[m['index']*4:(m['index']+m['indices'])*4]
        updated = {k:val for k,val in m.items() if k not in ('vertex','index')}
    if len(v) != updated['vertices'] * stride or len(i) != updated['indices'] * 4:
        raise ValueError(f'{name}: invalid copied buffer size')
    out_models[name] = dict(vertex=vcount, index=icount, **updated)
    out_v.append(v); out_i.append(i)
    vcount+=updated['vertices']; icount+=updated['indices']
if hashlib.sha256((ROOT / 'public/props/lookdev.bin').read_bytes()).hexdigest() != orig_hash:
    raise RuntimeError('Original binary changed while building preview')
result={'vertices':vcount, 'indices':icount, 'models':out_models}
(PREVIEW / 'public/props/lookdev.bin').write_bytes(b''.join(out_v+out_i))
shape_path.write_text(prefix+json.dumps(result)+';\n',encoding='utf-8')
(PREVIEW / 'preview-summary.json').write_text(json.dumps({k:{x:y for x,y in v.items() if x not in ('v','i')} for k,v in replacement.items()},indent=2))
print('PREVIEW_DONE', PREVIEW, 'models',len(replacement), 'original_sha256',orig_hash, flush=True)
