"""Compare packed collectible mesh footprints to a supplied collision radius.

This measures referenced vertices in their unrotated model pose. It does not
simulate physics or guarantee clearance for arbitrary rotations.
"""
import argparse
import json
import math
import struct
from pathlib import Path


IDS = ('bottle-fourth', 'bottle-fifth', 'bottle-sixth',
       'diorama-fourth', 'diorama-fifth', 'diorama-sixth')


def audit(root, scale, collision_radius):
    source = (root / 'src/pool/lookdev-shapes.js').read_text()
    marker = 'export const LOOKDEV_SHAPES = '
    if source.count(marker) != 1:
        raise ValueError('Unexpected shape metadata')
    shapes = json.loads(source.split(marker, 1)[1].rsplit(';', 1)[0])
    data = (root / 'public/props/lookdev.bin').read_bytes()
    vertex_bytes = len(data) - 4 * shapes['indices']
    if vertex_bytes != 20 * shapes['vertices']:
        raise ValueError('Expected packed 20-byte vertices and 32-bit indices')
    results = {}
    for cid in IDS:
        model = shapes['models']['collectible-' + cid]
        if (model['index'] < 0 or not model['indices'] or model['indices'] % 3 or
                model['index'] + model['indices'] > shapes['indices'] or
                model['vertex'] < 0 or not model['vertices'] or
                model['vertex'] + model['vertices'] > shapes['vertices']):
            raise ValueError(f'{cid}: invalid model ranges')
        radius = 0.0
        for i in range(model['index'], model['index'] + model['indices']):
            index = struct.unpack_from('<I', data, vertex_bytes + 4 * i)[0]
            if index >= model['vertices']:
                raise ValueError(f'{cid}: local vertex index out of range')
            offset = 20 * (model['vertex'] + index)
            x, _, z = struct.unpack_from('<fff', data, offset)
            if not math.isfinite(x) or not math.isfinite(z):
                raise ValueError(f'{cid}: non-finite vertex position')
            radius = max(radius, scale * math.hypot(x, z))
        results[cid] = {'radius': round(radius, 4), 'collision_radius': collision_radius,
                        'protrusion': round(max(0, radius - collision_radius), 4)}
    return results


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('root', type=Path, help='project or isolated preview directory')
    parser.add_argument('--scale', type=float, required=True, help='summoned model scale')
    parser.add_argument('--radius', type=float, required=True, help='summoned collision radius')
    args = parser.parse_args()
    if not all(math.isfinite(n) and n > 0 for n in (args.scale, args.radius)):
        parser.error('scale and radius must be finite positive values')
    print(json.dumps(audit(args.root, args.scale, args.radius), indent=2))


if __name__ == '__main__':
    main()
