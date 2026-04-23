import os

# Verificar macros M101 e M102 na pasta Mach3 da router
mach3_path = r"\\DESKTOP-1CSKMNT\Mach3"
macros_path = os.path.join(mach3_path, "macros")

print("=== VERIFICAÇÃO DE MACROS M101/M102 ===\n")

# Checar se a pasta macros existe
if os.path.exists(macros_path):
    print(f"[OK] Pasta macros encontrada: {macros_path}")
    files = os.listdir(macros_path)
    macro_files = [f for f in files if f.upper().startswith('M10')]
    print(f"Macros encontrados: {macro_files}")
    
    for mf in ['M101.m1s', 'M102.m1s']:
        fp = os.path.join(macros_path, mf)
        if os.path.exists(fp):
            print(f"\n--- {mf} ---")
            with open(fp, 'r', encoding='cp1252', errors='replace') as f:
                print(f.read())
        else:
            print(f"\n[X] {mf} NAO ENCONTRADO!")
else:
    print(f"[X] Pasta macros nao encontrada em {macros_path}")
    # Tentar na raiz do Mach3
    for mf in ['M101.m1s', 'M102.m1s']:
        fp = os.path.join(mach3_path, mf)
        if os.path.exists(fp):
            print(f"\n[OK] {mf} encontrado na raiz: {fp}")
            with open(fp, 'r', encoding='cp1252', errors='replace') as f:
                print(f.read())

# Verificar o que tem na pasta Mach3 compartilhada
print("\n=== ARQUIVOS NA RAIZ DO SHARE ===")
try:
    for item in os.listdir(mach3_path):
        full = os.path.join(mach3_path, item)
        if os.path.isdir(full):
            print(f"  [DIR]  {item}")
        else:
            size = os.path.getsize(full)
            print(f"  [FILE] {item} ({size} bytes)")
except Exception as e:
    print(f"Erro: {e}")

# Verificar se os arquivos que estão sendo cortados HOJE têm M101/M102
print("\n=== VERIFICANDO SE GCODE ATUAL TEM M101/M102 ===")
# Pegar o ultimo arquivo cortado do log
log_path = os.path.join(mach3_path, "log_oficial.csv")
with open(log_path, 'r', encoding='cp1252', errors='replace') as f:
    lines = f.readlines()

# Pegar ultimo INICIO
last_file = None
for line in reversed(lines):
    parts = line.strip().split(',')
    if len(parts) >= 4 and 'INICIO' in parts[-1]:
        last_file = parts[2]
        break

if last_file:
    print(f"Ultimo arquivo cortado: {last_file}")
    if os.path.exists(last_file):
        with open(last_file, 'r', encoding='cp1252', errors='replace') as f:
            content = f.read()
        has_m101 = 'M101' in content.upper()
        has_m102 = 'M102' in content.upper()
        print(f"  Tem M101: {has_m101}")
        print(f"  Tem M102: {has_m102}")
    else:
        print(f"  [!] Arquivo nao acessivel: {last_file}")
