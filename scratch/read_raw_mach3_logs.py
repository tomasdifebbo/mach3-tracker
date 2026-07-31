import os

paths = {
    "Router Central (DESKTOP-1CSKMNT)": r"\\DESKTOP-1CSKMNT\Mach3\log_oficial.csv",
    "Router 2 (ACT10)": r"\\ACT10\Mach3\log_oficial.csv"
}

for name, path in paths.items():
    print(f"=== {name} ===")
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8", errors="ignore") as f:
                lines = f.readlines()
                print(f"Total de linhas no log: {len(lines)}")
                print("Últimas 10 linhas:")
                for l in lines[-10:]:
                    print(l.strip())
        except Exception as e:
            print(f"Erro ao ler arquivo: {e}")
    else:
        print(f"Caminho não encontrado ou inacessível: {path}")
    print()
