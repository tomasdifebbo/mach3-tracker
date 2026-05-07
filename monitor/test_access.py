import os

paths = [
    r"\\DESKTOP-1CSKMNT\Mach3\log_oficial.csv",
    r"\\ACT10\Mach3\log_oficial.csv",
]

for p in paths:
    exists = os.path.exists(p)
    print(f"Path: {p}")
    print(f"  exists: {exists}")
    if exists:
        size = os.path.getsize(p)
        print(f"  size: {size}")
    else:
        # Try reading directly
        try:
            with open(p, 'r') as f:
                content = f.read(100)
                print(f"  Direct read OK: {len(content)} chars")
        except Exception as e:
            print(f"  Direct read FAIL: {e}")
    print()
