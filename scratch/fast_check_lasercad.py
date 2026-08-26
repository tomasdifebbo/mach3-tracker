import os, time

now = time.time()

# Focus specifically on C:\LaserCAD and LaserCAD-related temp folders
search_paths = [
    r"C:\LaserCAD",
    r"C:\LaserCAD\AWCCfg",
    r"C:\LaserCAD\AWCDoc",
]

recently_modified = []

for base_dir in search_paths:
    if os.path.exists(base_dir):
        for item in os.listdir(base_dir):
            fpath = os.path.join(base_dir, item)
            if os.path.isfile(fpath):
                try:
                    mtime = os.path.getmtime(fpath)
                    recently_modified.append((mtime, fpath, os.path.getsize(fpath)))
                except Exception:
                    pass

recently_modified.sort(key=lambda x: x[0], reverse=True)

print("Recently modified files in C:\\LaserCAD:")
for mtime, path, size in recently_modified:
    t_str = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(mtime))
    print(f"  [{t_str}] {path} ({size} bytes)")
