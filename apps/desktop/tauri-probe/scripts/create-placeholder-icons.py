"""Minimal placeholder icon for Desktop build experiments, not final branding."""
from pathlib import Path
import struct
import zlib

size=128
rows=[
    "0011100",
    "0100010",
    "1000001",
    "1111111",
    "1000001",
    "1000001",
    "1000001",
]
def draw(x,y):
    col=(x-29)//10
    row=(y-29)//10
    if 0<=col<7 and 0<=row<7 and rows[row][col]=="1":
        return bytes((249,252,249,255))
    return bytes((32,83,59,255))
raw=b"".join(b"\x00"+b"".join(draw(x,y) for x in range(size)) for y in range(size))
def chunk(tag,payload):
    return struct.pack(">I",len(payload))+tag+payload+struct.pack(">I",zlib.crc32(tag+payload)&0xffffffff)
png=b"\x89PNG\r\n\x1a\n"+chunk(b"IHDR",struct.pack(">IIBBBBB",size,size,8,6,0,0,0))+chunk(b"IDAT",zlib.compress(raw,9))+chunk(b"IEND",b"")
dest=Path(__file__).resolve().parent.parent/"src-tauri"/"icons"
dest.mkdir(parents=True,exist_ok=True)
(dest/"icon.png").write_bytes(png)
# PNG payload inside ICO is accepted by Windows for high-resolution icons.
ico=struct.pack("<HHH",0,1,1)+struct.pack("<BBBBHHII",size,size,0,0,1,32,len(png),22)+png
(dest/"icon.ico").write_bytes(ico)
print(f"Generated local placeholder icons, {len(png)} PNG bytes")
