import os

path = r"\\DESKTOP-1CSKMNT\Mach3\log_oficial.csv"
if not os.path.exists(path):
    print("ERRO: Arquivo nao encontrado via network share.")
    exit()

with open(path, 'r', encoding='cp1252', errors='replace') as f:
    for line in f:
        if 'sorvete' in line.lower():
            print(line.strip())
