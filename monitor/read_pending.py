import os

LOG_PATH = r"\\DESKTOP-1CSKMNT\Mach3\log_oficial.csv"
SAVED_POS = 157952

if not os.path.exists(LOG_PATH):
    print("LOG NAO ENCONTRADO")
else:
    size = os.path.getsize(LOG_PATH)
    print(f"Tamanho atual: {size} bytes")
    print(f"Posicao salva: {SAVED_POS} bytes")
    print(f"Bytes pendentes: {size - SAVED_POS}")
    
    with open(LOG_PATH, 'r', encoding='cp1252', errors='replace') as f:
        f.seek(SAVED_POS)
        lines = f.readlines()
    
    print(f"Linhas pendentes: {len(lines)}")
    print("---")
    for l in lines:
        l = l.strip()
        if l:
            print(l)
