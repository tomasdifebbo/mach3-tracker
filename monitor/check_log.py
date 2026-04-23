import os

path = r"\\DESKTOP-1CSKMNT\Mach3\log_oficial.csv"
print(f"Existe: {os.path.exists(path)}")
print(f"Tamanho: {os.path.getsize(path)} bytes")

with open(path, 'r', encoding='cp1252', errors='replace') as f:
    lines = f.readlines()

print(f"Total linhas: {len(lines)}")
print("\n--- ULTIMAS 20 LINHAS ---")
for l in lines[-20:]:
    print(l.strip())
