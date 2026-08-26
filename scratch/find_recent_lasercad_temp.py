import os, time

now = time.time()
print(f"Current timestamp: {now}")

search_paths = [
    r"C:\LaserCAD",
    os.environ.get("TEMP", r"C:\Users\Atelier Arte\AppData\Local\Temp")
]

recently_modified = []

for base_dir in search_paths:
    if os.path.exists(base_dir):
        for root, dirs, files in os.walk(base_dir):
            for f in files:
                try:
                    fpath = os.path.join(root, f)
                    mtime = os.path.getmtime(fpath)
                    # Check files modified in the last 24 hours (86400 seconds)
                    if (now - mtime) < 86400:
                        recently_modified.append((mtime, fpath, os.path.getsize(fpath)))
                except Exception:
                    pass

recently_modified.sort(key=lambda x: x[0], reverse=True)

print(f"\nTotal recently modified files in last 24h: {len(recently_modified)}")
print("Most recent 30 files:")
for mtime, path, size in recently_modified[:30]:
    t_str = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(mtime))
    print(f"  [{t_str}] {path} ({size} bytes)")
