import os, time, ctypes

user32 = ctypes.windll.user32
WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_int, ctypes.c_int)

WM_GETTEXT = 0x000D
WM_GETTEXTLENGTH = 0x000E

def get_wtxt(hwnd):
    try:
        length = user32.SendMessageW(hwnd, WM_GETTEXTLENGTH, 0, 0)
        if length > 0:
            buff = ctypes.create_unicode_buffer(length + 1)
            user32.SendMessageW(hwnd, WM_GETTEXT, length + 1, ctypes.byref(buff))
            return buff.value
    except Exception:
        pass
    return ""

def get_cls(hwnd):
    cbuff = ctypes.create_unicode_buffer(256)
    user32.GetClassNameW(hwnd, cbuff, 256)
    return cbuff.value

def get_wtitle(hwnd):
    length = user32.GetWindowTextLengthW(hwnd)
    if length > 0:
        buff = ctypes.create_unicode_buffer(length + 1)
        user32.GetWindowTextW(hwnd, buff, length + 1)
        return buff.value
    return ""

print("=== ALL VISIBLE LASERCAD WINDOWS AND CONTROLS ===")
def enum_win(hwnd, lparam):
    if user32.IsWindowVisible(hwnd):
        title = get_wtitle(hwnd)
        if "laser" in title.lower() or "awc" in title.lower() or "download" in title.lower():
            print(f"\nWindow HWND {hwnd}: '{title}'")
            edits = []
            def enum_child(chwnd, lparam):
                ccls = get_cls(chwnd)
                txt = get_wtxt(chwnd)
                if txt and len(txt.strip()) > 0:
                    edits.append((ccls, txt))
                return True
            user32.EnumChildWindows(hwnd, WNDENUMPROC(enum_child), 0)
            for ccls, txt in edits[:30]:
                print(f"  [{ccls}] '{txt}'")
    return True

user32.EnumWindows(WNDENUMPROC(enum_win), 0)

print("\n=== C:\\LaserCAD\\AWCCfg FILES MODIFIED IN LAST 2 HOURS ===")
cfg_dir = r"C:\LaserCAD\AWCCfg"
now = time.time()
if os.path.exists(cfg_dir):
    for f in os.listdir(cfg_dir):
        fpath = os.path.join(cfg_dir, f)
        if os.path.isfile(fpath):
            mtime = os.path.getmtime(fpath)
            age_min = (now - mtime) / 60.0
            print(f"  File: {f:20s} size={os.path.getsize(fpath):7d} B  mtime_age={age_min:6.1f} min")
