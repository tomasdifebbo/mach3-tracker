import os

paths_to_check = [
    r"C:\LaserCAD",
    r"C:\LaserCAD\AWCCfg",
    r"C:\LaserCAD\temp",
    r"C:\LaserCAD\sys",
]

for p in paths_to_check:
    print(f"=== Directory: {p} ===")
    if os.path.exists(p):
        try:
            items = os.listdir(p)
            print(f"Items ({len(items)}): {items[:25]}")
        except Exception as e:
            print("Error:", e)
    else:
        print("Path does not exist")

# Also check SoftCfg.ini content
soft_cfg = r"C:\LaserCAD\AWCCfg\SoftCfg.ini"
if os.path.exists(soft_cfg):
    print(f"\n=== Content of {soft_cfg} ===")
    try:
        with open(soft_cfg, 'r', encoding='utf-8', errors='ignore') as f:
            print(f.read())
    except Exception as e:
        print("Error reading SoftCfg:", e)
