import ctypes
import sys

sys.stdout.reconfigure(encoding='utf-8')

user32 = ctypes.windll.user32
WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_int, ctypes.c_int)

def get_window_text(hwnd):
    length = user32.GetWindowTextLengthW(hwnd)
    if length > 0:
        buff = ctypes.create_unicode_buffer(length + 1)
        user32.GetWindowTextW(hwnd, buff, length + 1)
        return buff.value
    return ""

def get_class_name(hwnd):
    cbuff = ctypes.create_unicode_buffer(256)
    user32.GetClassNameW(hwnd, cbuff, 256)
    return cbuff.value

found_controls = []

def enum_windows_callback(hwnd, lparam):
    if user32.IsWindowVisible(hwnd):
        title = get_window_text(hwnd)
        cls = get_class_name(hwnd)
        if "lasercad" in title.lower() or "laser" in title.lower():
            print(f"\n==========================================")
            print(f"Main Window: [HWND: {hwnd}] '{title}' | Class: '{cls}'")
            print(f"==========================================")
            
            def enum_child_callback(chwnd, lparam):
                txt = get_window_text(chwnd)
                ccls = get_class_name(chwnd)
                if txt or ccls in ('Edit', 'Static', 'Button'):
                    found_controls.append((chwnd, txt, ccls))
                return True

            user32.EnumChildWindows(hwnd, WNDENUMPROC(enum_child_callback), 0)
    return True

user32.EnumWindows(WNDENUMPROC(enum_windows_callback), 0)

print(f"\nTotal child controls found: {len(found_controls)}")
for chwnd, txt, ccls in found_controls:
    txt_clean = txt.strip().replace('\r', ' ').replace('\n', ' ')
    print(f"  [HWND: {chwnd}] [{ccls}] '{txt_clean}'")
