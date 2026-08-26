import struct
import os

path = r"C:\LaserCAD\AWCCfg\_Temp"
if os.path.exists(path):
    size = os.path.getsize(path)
    print(f"File size: {size} bytes")
    with open(path, "rb") as f:
        data = f.read()

    # Search for floats/doubles in header or data
    print("Searching for float pairs in first 1000 bytes:")
    for offset in range(0, min(1000, size - 8), 4):
        try:
            val_f = struct.unpack_from("<f", data, offset)[0]
            val_d = struct.unpack_from("<d", data, offset)[0]
            if 10.0 <= val_f <= 3000.0:
                print(f"  Offset {offset:4d} (float32): {val_f:.3f}")
            if 10.0 <= val_d <= 3000.0:
                print(f"  Offset {offset:4d} (float64): {val_d:.3f}")
        except Exception:
            pass
