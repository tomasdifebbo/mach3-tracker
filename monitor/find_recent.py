import os, datetime

root = r"\\DESKTOP-1CSKMNT\Mach3"
today = datetime.datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)

modified_today = []

print(f"Buscando arquivos modificados desde {today} em {root}...\n")

try:
    for r, d, files in os.walk(root):
        for f in files:
            path = os.path.join(r, f)
            try:
                mtime = os.path.getmtime(path)
                dt = datetime.datetime.fromtimestamp(mtime)
                if dt >= today:
                    modified_today.append((path, dt))
            except:
                pass
except Exception as e:
    print(f"Erro ao caminhar pastas: {e}")

modified_today.sort(key=lambda x: x[1], reverse=True)

for path, dt in modified_today[:30]:
    print(f"{dt} | {path}")

if not modified_today:
    print("Nenhum arquivo modificado hoje foi encontrado.")
