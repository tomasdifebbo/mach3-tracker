import ctypes
import sys

sys.stdout.reconfigure(encoding='utf-8')

user32 = ctypes.windll.user32
WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_int, ctypes.c_int)

WM_GETTEXT = 0x000D
WM_GETTEXTLENGTH = 0x000E

def get_control_text(hwnd):
    try:
        length = user32.SendMessageW(hwnd, WM_GETTEXTLENGTH, 0, 0)
        if length > 0:
            buff = ctypes.create_unicode_buffer(length + 1)
            user32.SendMessageW(hwnd, WM_GETTEXT, length + 1, ctypes.byref(buff))
            return buff.value
    except Exception:
        pass
    return ""

def get_class_name(hwnd):
    cbuff = ctypes.create_unicode_buffer(256)
    user32.GetClassNameW(hwnd, cbuff, 256)
    return cbuff.value

def get_window_title(hwnd):
    length = user32.GetWindowTextLengthW(hwnd)
    if length > 0:
        buff = ctypes.create_unicode_buffer(length + 1)
        user32.GetWindowTextW(hwnd, buff, length + 1)
        return buff.value
    return ""

# RECT struct for control coordinates
class RECT(ctypes.Structure):
    _fields_ = [("left", ctypes.c_long),
                ("top", ctypes.c_long),
                ("right", ctypes.c_long),
                ("bottom", ctypes.c_long)]

def get_window_rect(hwnd):
    rect = RECT()
    user32.GetWindowRect(hwnd, ctypes.byref(rect))
    return rect.left, rect.top, rect.right - rect.left, rect.bottom - rect.top

def inspect_lasercad_edits_detailed():
    print("=== INSPECTING LASERCAD EDIT CONTROLS IN DETAIL ===")
    
    def enum_windows_cb(hwnd, lparam):
        if user32.IsWindowVisible(hwnd):
            title = get_window_title(hwnd)
            if "lasercad" in title.lower() or "laser" in title.lower():
                print(f"\nWindow HWND {hwnd}: '{title}'")
                
                controls = []
                def enum_child_cb(chwnd, lparam):
                    ccls = get_class_name(chwnd)
                    txt = get_control_text(chwnd)
                    x, y, w, h = get_window_rect(chwnd)
                    controls.append((chwnd, ccls, txt, x, y, w, h))
                    return True

                user32.EnumChildWindows(hwnd, WNDENUMPROC(enum_child_cb), 0)
                
                print(f"Total controls: {len(controls)}")
                for chwnd, ccls, txt, x, y, w, h in controls:
                    if ccls == "Edit" or (txt and ("x" in txt.lower() or "y" in txt.lower() or "count" in txt.lower() or "width" in txt.lower() or "height" in txt.lower() or "mm" in txt.lower() or "selected" in txt.lower() or ":" in txt)):
                        print(f"  [HWND: {chwnd:7d}] [{ccls:10s}] pos=({x:4d},{y:4d}) size=({w:3d},{h:3d}) text='{txt}'")
        return True

    user32.EnumWindows(WNDENUMPROC(enum_windows_cb), 0)

if __name__ == "__main__":
    inspect_lasercad_edits_detailed()
