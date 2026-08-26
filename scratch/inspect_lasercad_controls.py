import ctypes
import sys

# Set stdout encoding
sys.stdout.reconfigure(encoding='utf-8')

user32 = ctypes.windll.user32
WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_int, ctypes.c_int)

hwnd_lasercad = user32.FindWindowW(None, None)

def get_window_info(hwnd):
    length = user32.GetWindowTextLengthW(hwnd)
    buff = ctypes.create_unicode_buffer(length + 1)
    user32.GetWindowTextW(hwnd, buff, length + 1)
    
    cbuff = ctypes.create_unicode_buffer(256)
    user32.GetClassNameW(hwnd, cbuff, 256)
    return buff.value, cbuff.value

found_windows = []
def enum_windows_callback(hwnd, lparam):
    if user32.IsWindowVisible(hwnd):
        title, cls = get_window_info(hwnd)
        if "lasercad" in title.lower() or "laser" in title.lower() or "work time" in title.lower():
            found_windows.append((hwnd, title, cls))
    return True

user32.EnumWindows(WNDENUMPROC(enum_windows_callback), 0)

for hwnd, title, cls in found_windows:
    print(f"\n==========================================")
    print(f"[HWND: {hwnd}] Title: '{title}' | Class: '{cls}'")
    print(f"==========================================")
    
    child_controls = []
    def enum_child_callback(chwnd, lparam):
        ctxt, ccls = get_window_info(chwnd)
        child_controls.append((chwnd, ctxt, ccls))
        return True
    
    user32.EnumChildWindows(hwnd, WNDENUMPROC(enum_child_callback), 0)
    print(f"Total child controls: {len(child_controls)}")
    for chwnd, txt, ccls in child_controls:
        txt_clean = txt.strip().replace('\r', ' ').replace('\n', ' ')
        if txt_clean:
            print(f"  [HWND: {chwnd}] [{ccls}] '{txt_clean}'")
