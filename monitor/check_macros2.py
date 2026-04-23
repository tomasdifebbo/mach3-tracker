import os

macros = r"\\DESKTOP-1CSKMNT\Mach3\macros"
print("Conteudo da pasta macros:")
for f in os.listdir(macros):
    print(f"  {f}")

# Verificar se M101/M102 estao na raiz do Mach3
root = r"\\DESKTOP-1CSKMNT\Mach3"
for m in ['M101.m1s', 'M102.m1s', 'm101.m1s', 'm102.m1s']:
    fp = os.path.join(root, m)
    if os.path.exists(fp):
        print(f"\n[ENCONTRADO NA RAIZ] {m}:")
        with open(fp, 'r', encoding='cp1252', errors='replace') as f:
            print(f.read())

# Verificar m1076 para entender o formato
m1076 = os.path.join(root, "m1076.m1s")
if os.path.exists(m1076):
    print("\n--- m1076.m1s (referencia de formato) ---")
    with open(m1076, 'r', encoding='cp1252', errors='replace') as f:
        content = f.read()
    # Mostrar apenas as primeiras 30 linhas
    for i, line in enumerate(content.split('\n')[:30]):
        print(line)
