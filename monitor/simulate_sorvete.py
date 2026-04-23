import os, re, math

def simulate_gcode_time(filepath):
    """Estimate machining time from a G-code file (in minutes)."""
    try:
        feed_rate = 1000.0
        rapid_rate = 10000.0
        total_time = 0.0
        lx, ly, lz = 0.0, 0.0, 0.0
        
        with open(filepath, 'r', encoding='cp1252', errors='ignore') as f:
            for line in f:
                line = line.strip().upper()
                if not line or line.startswith('('): continue
                
                fm = re.search(r'F([\d.]+)', line)
                if fm: feed_rate = float(fm.group(1))
                
                xm = re.search(r'X(-?[\d.]+)', line)
                ym = re.search(r'Y(-?[\d.]+)', line)
                zm = re.search(r'Z(-?[\d.]+)', line)
                
                nx = float(xm.group(1)) if xm else lx
                ny = float(ym.group(1)) if ym else ly
                nz = float(zm.group(1)) if zm else lz
                
                dist = math.sqrt((nx-lx)**2 + (ny-ly)**2 + (nz-lz)**2)
                if dist > 0:
                    rate = rapid_rate if ('G00' in line or ('G0 ' in line and 'G01' not in line)) else feed_rate
                    if rate > 0: total_time += dist / rate
                
                lx, ly, lz = nx, ny, nz
        
        return round(total_time * 1.15, 2)  # 15% overhead for accel/decel
    except Exception as e:
        print(f"Erro ao simular {filepath}: {e}")
        return None

folder = r"E:\arquivos 2024\ARQUIVOS 2026\router\2591 - PIRACANJUBA\ROUTER\ISOPOR - SORVETE"
files = ["1 pvc100mm b10mm.txt", "2 pvc100mm b10mm.txt"]

for f in files:
    path = os.path.join(folder, f)
    if os.path.exists(path):
        time_min = simulate_gcode_time(path)
        print(f"File: {f} | Estimated: {time_min} min")
    else:
        print(f"File not found: {path}")
