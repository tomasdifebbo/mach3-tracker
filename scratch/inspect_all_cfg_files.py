import os, struct, re

cfg_dir = r"C:\LaserCAD\AWCCfg"
print(f"=== Files in {cfg_dir} ===")
for f in os.listdir(cfg_dir):
    fpath = os.path.join(cfg_dir, f)
    if os.path.isfile(fpath):
        size = os.path.getsize(fpath)
        mtime = os.path.getmtime(fpath)
        print(f"  {f:20s} ({size:7d} bytes) mtime={mtime}")
        if f.endswith('.ini') or f.endswith('.txt') or size < 10000:
            try:
                with open(fpath, 'r', encoding='utf-8', errors='ignore') as fp:
                    content = fp.read()
                    print(f"    --- Content of {f} ---")
                    for line in content.splitlines()[:15]:
                        print("      ", line)
            except Exception as e:
                pass
