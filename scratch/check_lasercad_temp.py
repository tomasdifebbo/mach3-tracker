import os

dirs = [
    r"C:\LaserCAD\AWCCfg\_Temp",
    r"C:\LaserCAD\AWCCfg\_Temp2",
    r"C:\LaserCAD\AWCCad",
    r"C:\LaserCAD\AWCDoc"
]

for d in dirs:
    print(f"=== {d} ===")
    if os.path.exists(d):
        for root, dirs_list, files in os.walk(d):
            print(f"Subdir: {root}")
            for f in files[:20]:
                fpath = os.path.join(root, f)
                print(f"  {f} ({os.path.getsize(fpath)} bytes, mtime={os.path.getmtime(fpath)})")
    else:
        print("Does not exist")
