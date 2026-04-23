import os

path = r"\\ACT10\Mach3\macros\Mach3Mill\M101.m1s"
if os.path.exists(path):
    print(f"=== M101.m1s em ACT10 ===")
    with open(path, 'r', encoding='cp1252', errors='replace') as f:
        print(f.read())
else:
    print("M101.m1s nao encontrado em ACT10\Mach3\macros\Mach3Mill")

# Verificar o log local da ACT10
log_act10 = r"\\ACT10\Mach3\log_oficial.csv"
if os.path.exists(log_act10):
    mtime = os.path.getmtime(log_act10)
    import datetime
    print(f"\nlog_oficial.csv em ACT10: {datetime.datetime.fromtimestamp(mtime)}")
    with open(log_act10, 'r', encoding='cp1252', errors='replace') as f:
        lines = f.readlines()
        print(f"Total linhas: {len(lines)}")
        for l in lines[-10:]:
            print(l.strip())
else:
    print("\nlog_oficial.csv nao encontrado em ACT10\Mach3")
