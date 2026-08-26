import struct
import os

path = r"C:\LaserCAD\AWCCfg\_Temp"
if os.path.exists(path):
    size = os.path.getsize(path)
    with open(path, "rb") as f:
        data = f.read()

    print(f"=== ANALYZING C:\\LaserCAD\\AWCCfg\\_Temp ({size} bytes) ===")
    
    # 1. Scan for integer coordinates or float coordinates
    # AWC/Ruida toolpaths store coordinates in pulse units or 0.01mm or floats/integers
    # Let's inspect float32, int32, int16 values
    
    # Scan all 32-bit floats
    floats_found = []
    for i in range(0, size - 4, 4):
        val = struct.unpack_from("<f", data, i)[0]
        if 0.1 <= val <= 2000.0:
            floats_found.append(val)
            
    print(f"Total float32 values in range [0.1, 2000]: {len(floats_found)}")
    if floats_found:
        print(f"  Min float: {min(floats_found):.2f} | Max float: {max(floats_found):.2f}")

    # Scan 32-bit integers (pulse or 0.001mm units)
    ints_found = []
    for i in range(0, size - 4, 4):
        val = struct.unpack_from("<i", data, i)[0]
        # E.g. coordinates in 0.01mm or 0.001mm: 100mm = 100000
        if 100 <= val <= 2000000:
            ints_found.append(val)
            
    print(f"Total int32 values in range [100, 2000000]: {len(ints_found)}")
    if ints_found:
        print(f"  Min int: {min(ints_found)} | Max int: {max(ints_found)}")

    # Print first 256 bytes in hex
    print("\nFirst 256 bytes hex format:")
    for b_idx in range(0, min(256, size), 16):
        chunk = data[b_idx:b_idx+16]
        hex_str = " ".join(f"{b:02x}" for b in chunk)
        ascii_str = "".join(chr(b) if 32 <= b <= 126 else "." for b in chunk)
        print(f"  {b_idx:04x}: {hex_str:48s} | {ascii_str}")
