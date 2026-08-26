import ctypes

user32 = ctypes.windll.user32
WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_int, ctypes.c_int)

def get_wtitle(hwnd):
    length = user32.GetWindowTextLengthW(hwnd)
    if length > 0:
        buff = ctypes.create_unicode_buffer(length + 1)
        user32.GetWindowTextW(hwnd, buff, length + 1)
        return buff.value
    return ""

def get_wclass(hwnd):
    buff = ctypes.create_unicode_buffer(256)
    user32.GetClassNameW(hwnd, buff, 256)
    return buff.value

def inspect_pid_windows(pid_target, app_name):
    print(f"\n=== INSPECTING WINDOWS FOR {app_name} (PID {pid_target}) ===")
    found = []
    
    def enum_cb(hwnd, lparam):
        pid = ctypes.c_ulong()
        user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
        if pid.value == pid_target:
            title = get_wtitle(hwnd)
            cls = get_wclass(hwnd)
            visible = user32.IsWindowVisible(hwnd)
            print(f"HWND: {hwnd} | Visible: {visible} | Class: '{cls}' | Title: '{title}'")
            found.append((hwnd, title, cls))
        return True

    user32.EnumWindows(WNDENUMPROC(enum_cb), 0)
    return found

# CorelDRW PID 17452, LaserCAD PID 1164
inspect_pid_windows(17452, "CorelDRAW")
inspect_pid_windows(1164, "LaserCAD")
