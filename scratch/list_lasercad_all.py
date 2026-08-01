import os

for base_dir in [r"C:\LaserCAD", r"C:\Program Files\LaserCAD"]:
    print(f"\n================ Listing {base_dir} ================")
    if os.path.exists(base_dir):
        for root, dirs, files in os.walk(base_dir):
            for f in files:
                p = os.path.join(root, f)
                print(f"  {p} ({os.path.getsize(p)} bytes)")
