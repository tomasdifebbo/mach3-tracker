import os, datetime

root = r"\\DESKTOP-1CSKMNT\Mach3"

def get_info(path):
    if os.path.exists(path):
        mtime = os.path.getmtime(path)
        dt = datetime.datetime.fromtimestamp(mtime)
        size = os.path.getsize(path)
        return f"Existe: Sim | Tamanho: {size} | Modificado: {dt}"
    return "Existe: Nao"

print(f"log_oficial.csv: {get_info(os.path.join(root, 'log_oficial.csv'))}")
print(f"Profile.txt: {get_info(os.path.join(root, 'Profile.txt'))}")
print(f"LastErrors.txt: {get_info(os.path.join(root, 'LastErrors.txt'))}")
print(f"lasterr.txt: {get_info(os.path.join(root, 'lasterr.txt'))}")

print("\n--- Conteudo de LastErrors.txt ---")
le = os.path.join(root, 'LastErrors.txt')
if os.path.exists(le):
    with open(le, 'r', encoding='cp1252', errors='replace') as f:
        print(f.read())

print("\n--- Ultimas 10 linhas de lasterr.txt ---")
lerr = os.path.join(root, 'lasterr.txt')
if os.path.exists(lerr):
    with open(lerr, 'r', encoding='cp1252', errors='replace') as f:
        lines = f.readlines()
        for l in lines[-10:]:
            print(l.strip())
