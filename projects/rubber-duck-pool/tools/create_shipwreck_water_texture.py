"""Create a small deterministic, tileable shallow-water base-color PNG."""
import math
import struct
import zlib
from pathlib import Path

out=Path(__file__).resolve().parents[1]/'assets/02_models/props/shipwreck-reef-study/shipwreck-water.png'
out.parent.mkdir(parents=True,exist_ok=True)
size=256


def chunk(kind,data):
    return struct.pack('!I',len(data))+kind+data+struct.pack('!I',zlib.crc32(kind+data)&0xffffffff)


def srgb(linear):
    value=max(0,min(1,linear))
    return round(255*(12.92*value if value <= .0031308 else 1.055*value**(1/2.4)-.055))


rows=[]
for y in range(size):
    row=bytearray([0])
    v=y/size*math.tau
    for x in range(size):
        u=x/size*math.tau
        swell=(.055*math.sin(3*u+math.sin(2*v))
               +.025*math.cos(4*v-2*u)+.012*math.sin(7*u+3*v))
        row.extend(srgb(channel*(1+swell)) for channel in (.055,.34,.33))
    rows.append(bytes(row))
png=(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('!IIBBBBB',size,size,8,2,0,0,0))+
     chunk(b'IDAT',zlib.compress(b''.join(rows),9))+chunk(b'IEND',b''))
out.write_bytes(png)
print('SHIPWRECK_WATER_TEXTURE_OK size=256x256',flush=True)
