import struct
import os

path = r"C:\LaserCAD\AWCCfg\_Temp"
if os.path.exists(path):
    size = os.path.getsize(path)
    with open(path, "rb") as f:
        data = f.read()

    print(f"=== PARSING ALL COORDINATES FROM _Temp ({size} bytes) ===")

    # AWC/Ruida binary format stores vector moves.
    # In AWC toolpaths, coordinates are often stored as relative or absolute integer points (pulse units or 0.01mm)
    # Let's inspect signed 32-bit integers and signed 16-bit integers
    
    # 1. Test 32-bit integers assuming pulse units (e.g. 4.801895 pulses/mm for X, 4.797931 pulses/mm for Y)
    pulses_per_mm_x = 4.801895
    pulses_per_mm_y = 4.797931
    
    x_coords = []
    y_coords = []
    
    # Let's scan all consecutive integer pairs (X, Y)
    for i in range(0, size - 8, 4):
        ix = struct.unpack_from("<i", data, i)[0]
        iy = struct.unpack_from("<i", data, i+4)[0]
        
        # Convert pulse units to mm
        x_mm = ix / pulses_per_mm_x
        y_mm = iy / pulses_per_mm_y
        
        # Check if coordinates fall within machine table limits (0 to 1420mm X, 0 to 1010mm Y)
        if 0.1 <= x_mm <= 1420.0 and 0.1 <= y_mm <= 1010.0:
            x_coords.append(x_mm)
            y_coords.append(y_mm)

    print(f"Valid X/Y pulse coordinate pairs found: {len(x_coords)}")
    if x_coords and y_coords:
        min_x, max_x = min(x_coords), max(x_coords)
        min_y, max_y = min(y_coords), max(y_coords)
        width_mm = max_x - min_x
        height_mm = max_y - min_y
        area_m2 = (width_mm / 1000.0) * (height_mm / 1000.0)
        print(f"  Pulse Coordinates Bounding Box:")
        print(f"    X: min={min_x:.1f}mm, max={max_x:.1f}mm -> Width = {width_mm:.1f}mm")
        print(f"    Y: min={min_y:.1f}mm, max={max_y:.1f}mm -> Height = {height_mm:.1f}mm")
        print(f"    Area (m²) = {area_m2:.4f} m²")

    # 2. Also test 0.01mm or 0.001mm unit integer coordinates
    x_coords_mm = []
    y_coords_mm = []
    for i in range(0, size - 8, 4):
        ix = struct.unpack_from("<i", data, i)[0]
        iy = struct.unpack_from("<i", data, i+4)[0]
        
        # If in 0.01mm (100 = 1mm)
        x_mm = ix / 100.0
        y_mm = iy / 100.0
        if 1.0 <= x_mm <= 1420.0 and 1.0 <= y_mm <= 1010.0:
            x_coords_mm.append(x_mm)
            y_coords_mm.append(y_mm)

    print(f"\nValid 0.01mm coordinate pairs found: {len(x_coords_mm)}")
    if x_coords_mm and y_coords_mm:
        min_x, max_x = min(x_coords_mm), max(x_coords_mm)
        min_y, max_y = min(y_coords_mm), max(y_coords_mm)
        width_mm = max_x - min_x
        height_mm = max_y - min_y
        area_m2 = (width_mm / 1000.0) * (height_mm / 1000.0)
        print(f"  0.01mm Bounding Box:")
        print(f"    X: min={min_x:.1f}mm, max={max_x:.1f}mm -> Width = {width_mm:.1f}mm")
        print(f"    Y: min={min_y:.1f}mm, max={max_y:.1f}mm -> Height = {height_mm:.1f}mm")
        print(f"    Area (m²) = {area_m2:.4f} m²")
