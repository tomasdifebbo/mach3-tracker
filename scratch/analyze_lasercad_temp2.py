import struct
import os

path = r"C:\LaserCAD\AWCCfg\_Temp2"
if os.path.exists(path):
    size = os.path.getsize(path)
    with open(path, "rb") as f:
        data = f.read()

    print(f"=== ANALYZING C:\\LaserCAD\\AWCCfg\\_Temp2 ({size} bytes) ===")
    
    # Dump entire _Temp2 file (352 bytes) with float32/float64/int32 unpacks
    for offset in range(0, size - 4, 4):
        val_i = struct.unpack_from("<i", data, offset)[0]
        val_f = struct.unpack_from("<f", data, offset)[0]
        val_d = struct.unpack_from("<d", data, offset)[0] if offset <= size - 8 else 0.0
        
        info = []
        if 0.1 <= abs(val_f) <= 5000.0: info.append(f"float32={val_f:.3f}")
        if 0.1 <= abs(val_d) <= 5000.0: info.append(f"float64={val_d:.3f}")
        if 1 <= abs(val_i) <= 50000: info.append(f"int32={val_i}")
        
        if info:
            print(f"  Offset {offset:3d} ({offset:02x}): {', '.join(info)}")
