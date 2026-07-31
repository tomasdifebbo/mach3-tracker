import os

path = r"\\ACT10\Mach3\log_oficial.csv"
print(f"Path: {path}")
print(f"Exists: {os.path.exists(path)}")
if os.path.exists(path):
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        lines = f.readlines()
    print(f"Total lines: {len(lines)}")
    print("Last 5 raw lines:")
    for l in lines[-5:]:
        print(repr(l.strip()))
