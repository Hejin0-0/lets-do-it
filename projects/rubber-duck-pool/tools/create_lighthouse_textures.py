"""Write deterministic, tileable RGB plaster textures with only the standard library."""
import math
import random
import struct
import zlib
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / 'assets/02_models/props/lighthouse-island-study'
OUT.mkdir(parents=True, exist_ok=True)
SIZE = 256


def chunk(kind, data):
    return struct.pack('!I',len(data))+kind+data+struct.pack('!I',zlib.crc32(kind+data)&0xffffffff)


def srgb(linear):
    value=max(0,min(1,linear))
    return round(255*(12.92*value if value <= .0031308 else 1.055*value**(1/2.4)-.055))


def write_texture(path, base, seed, intensity=1):
    rng=random.Random(seed)
    rows=[]
    for y in range(SIZE):
        row=bytearray([0])
        for x in range(SIZE):
            u=x/SIZE*math.tau
            v=y/SIZE*math.tau
            cloud=(.030*math.sin(3*u+2*v)*math.sin(2*u-3*v)
                   +.014*math.cos(7*u+5*v)+.008*math.sin(17*u-13*v))
            grain=rng.uniform(-.012,.012)*intensity
            pore=-.07*intensity if rng.random() < .002*intensity else 0
            row.extend(srgb(channel*(1+cloud*intensity+grain+pore)) for channel in base)
        rows.append(bytes(row))
    png=(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('!IIBBBBB',SIZE,SIZE,8,2,0,0,0))+
         chunk(b'IDAT',zlib.compress(b''.join(rows),9))+chunk(b'IEND',b''))
    path.write_bytes(png)


write_texture(OUT/'lighthouse-plaster-ivory.png',(.85,.79,.64),541)
write_texture(OUT/'lighthouse-plaster-coral.png',(.62,.17,.11),542)
write_texture(OUT/'lighthouse-sand.png',(.68,.57,.37),543,2)
write_texture(OUT/'lighthouse-stone-dark.png',(.14,.18,.16),544,3)
write_texture(OUT/'lighthouse-stone-light.png',(.27,.30,.26),545,2)
print('LIGHTHOUSE_TEXTURES_OK size=256x256 textures=5')
