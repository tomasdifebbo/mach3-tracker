import os, time, ctypes

user32 = ctypes.windll.user32

def get_wtitle(hwnd):
    length = user32.GetWindowTextLengthW(hwnd)
    if length > 0:
        buff = ctypes.create_unicode_buffer(length + 1)
        user32.GetWindowTextW(hwnd, buff, length + 1)
        return buff.value
    return ""

print("=== 1. Checking Window Titles ===")
def enum_cb(hwnd, lparam):
    if user32.IsWindowVisible(hwnd):
        title = get_wtitle(hwnd)
        if "laser" in title.lower() or "corel" in title.lower() or "cad" in title.lower():
            print(f"  Window: '{title}'")
    return True
user32.EnumWindows(ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_int, ctypes.c_int)(enum_cb), 0)

print("\n=== 2. Checking Recent Files in Common Folders ===")
dirs_to_check = [
    r"C:\LaserCAD",
    r"C:\LaserCAD\AWCDoc",
    r"C:\LaserCAD\AWCCfg",
    os.path.expanduser(r"~\Desktop"),
    os.path.expanduser(r"~\Downloads"),
]

now = time.time()
recent_files = []
for d in dirs_to_check:
    if os.path.exists(d):
        try:
            for f in os.listdir(d):
                if f.lower().endswith(('.pw5', '.ud5', '.pw', '.dxf', '.plt', '.ai', '.cdr')):
                    fpath = os.path.join(d, f)
                    mtime = os.path.getmtime(fpath)
                    age_min = (now - mtime) / 60.0
                    if age_min < 60: # Modified in last 1 hour
                        recent_files.append((f, age_min, d))
        except Exception:
            pass

recent_files.sort(key=lambda x: x[1])
for f, age, d in recent_files[:10]:
    print(f"  File: '{f}' (modified {age:.1f} min ago in {d})")

print("\n=== 3. Checking SoftCfg.ini ===")
soft_cfg = r"C:\LaserCAD\AWCCfg\SoftCfg.ini"
if os.path.exists(soft_cfg):
    with open(soft_cfg, 'r', encoding='utf-8', errors='ignore') as fp:
        for line in fp:
            if 'doc' in line.lower() or 'name' in line.lower() or 'file' in line.lower():
                print(f"  {line.strip()}")
