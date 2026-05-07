"""
Calcula o tempo total de usinagem de todos os G-codes na pasta ISOPOR BOLA.
Distribui entre 2 máquinas para estimar tempo paralelo.
"""
import os, re, math

PASTA = r"E:\arquivos 2024\ARQUIVOS 2026\router\2595A - BOLA + ARO NBA HOUSE\ROUTER\ISOPOR BOLA"

def simulate_gcode_time(filepath):
    """Estima tempo de usinagem em minutos."""
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
        
        return round(total_time * 1.15, 2)  # 15% overhead accel/decel
    except Exception as e:
        print(f"  ERRO: {e}")
        return 0

# Listar e calcular
files = sorted([f for f in os.listdir(PASTA) if f.lower().endswith('.txt')],
               key=lambda x: int(re.search(r'(\d+)', x).group(1)) if re.search(r'(\d+)', x) else 0)

print(f"{'='*65}")
print(f"  CALCULO DE TEMPO - ISOPOR BOLA ({len(files)} arquivos)")
print(f"{'='*65}\n")

tempos = []
total = 0

for f in files:
    filepath = os.path.join(PASTA, f)
    t = simulate_gcode_time(filepath)
    tempos.append((f, t))
    total += t
    horas = int(t // 60)
    mins = int(t % 60)
    print(f"  {f:35s}  {horas:02d}h{mins:02d}min  ({t:.1f} min)")

print(f"\n{'='*65}")
print(f"  TEMPO TOTAL (1 maquina): {int(total//60):02d}h{int(total%60):02d}min ({total:.1f} min)")
print(f"{'='*65}")

# Distribuir entre 2 máquinas (alternando por tempo, greedy balancing)
maq1_tempo = 0
maq2_tempo = 0
maq1_files = []
maq2_files = []

# Ordenar por tempo decrescente para melhor balanceamento
sorted_tempos = sorted(tempos, key=lambda x: x[1], reverse=True)

for fname, t in sorted_tempos:
    if maq1_tempo <= maq2_tempo:
        maq1_tempo += t
        maq1_files.append((fname, t))
    else:
        maq2_tempo += t
        maq2_files.append((fname, t))

tempo_paralelo = max(maq1_tempo, maq2_tempo)

print(f"\n{'='*65}")
print(f"  DISTRIBUICAO EM 2 MAQUINAS (paralelo)")
print(f"{'='*65}")
print(f"\n  --- Router 1 ({len(maq1_files)} arquivos) ---")
for fname, t in sorted(maq1_files, key=lambda x: int(re.search(r'(\d+)', x[0]).group(1)) if re.search(r'(\d+)', x[0]) else 0):
    print(f"    {fname:35s}  {int(t//60):02d}h{int(t%60):02d}min")
print(f"    SUBTOTAL: {int(maq1_tempo//60):02d}h{int(maq1_tempo%60):02d}min")

print(f"\n  --- Router 2 ({len(maq2_files)} arquivos) ---")
for fname, t in sorted(maq2_files, key=lambda x: int(re.search(r'(\d+)', x[0]).group(1)) if re.search(r'(\d+)', x[0]) else 0):
    print(f"    {fname:35s}  {int(t//60):02d}h{int(t%60):02d}min")
print(f"    SUBTOTAL: {int(maq2_tempo//60):02d}h{int(maq2_tempo%60):02d}min")

print(f"\n{'='*65}")
print(f"  TEMPO ESTIMADO (2 maquinas): {int(tempo_paralelo//60):02d}h{int(tempo_paralelo%60):02d}min")
print(f"  ECONOMIA vs 1 maquina:       {int((total-tempo_paralelo)//60):02d}h{int((total-tempo_paralelo)%60):02d}min")
print(f"{'='*65}")
