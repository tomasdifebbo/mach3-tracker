import os

path = r"\\DESKTOP-1CSKMNT\Mach3\log_oficial.csv"
with open(path, 'r', encoding='cp1252', errors='replace') as f:
    lines = f.readlines()

count5 = 0
for l in lines:
    if len(l.split(',')) >= 5:
        count5 += 1
        if count5 < 10:
            print(f"5-col: {l.strip()}")

print(f"Total de linhas com 5+ colunas: {count5}")
