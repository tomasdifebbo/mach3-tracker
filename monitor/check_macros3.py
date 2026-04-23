import os

root = r"\\DESKTOP-1CSKMNT\Mach3"

# Ler M101 e M102 do Mach3Mill
mill_macros = os.path.join(root, "macros", "Mach3Mill")

for m in ['M101.m1s', 'M102.m1s']:
    fp = os.path.join(mill_macros, m)
    if os.path.exists(fp):
        print(f"\n=== {m} (Mach3Mill) ===")
        with open(fp, 'r', encoding='cp1252', errors='replace') as f:
            print(f.read())
    else:
        print(f"[X] {m} nao encontrado em Mach3Mill")

# Verificar o perfil ativo do Mach3
profile = os.path.join(root, "Profile.txt")
if os.path.exists(profile):
    with open(profile, 'r') as f:
        print(f"\n=== Profile.txt ===")
        print(f.read())

# Verificar LastFile.txt
lastfile = os.path.join(root, "LastFile.txt")
if os.path.exists(lastfile):
    with open(lastfile, 'r', encoding='cp1252', errors='replace') as f:
        content = f.read()
        print(f"\n=== LastFile.txt ===")
        print(f"'{content}'")

# Verificar o log_oficial.csv - tamanho atual
log = os.path.join(root, "log_oficial.csv")
size = os.path.getsize(log)
print(f"\n=== log_oficial.csv ===")
print(f"Tamanho atual: {size} bytes")

# Verificar tracker_log.txt (outro log mencionado na listagem)
tracker = os.path.join(root, "tracker_log.txt")
if os.path.exists(tracker):
    with open(tracker, 'r', encoding='cp1252', errors='replace') as f:
        lines = f.readlines()
    print(f"\n=== tracker_log.txt ({len(lines)} linhas) ===")
    print("Ultimas 10 linhas:")
    for l in lines[-10:]:
        print(l.strip())
