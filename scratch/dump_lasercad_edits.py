import ctypes
import sys

sys.stdout.reconfigure(encoding='utf-8')

user32 = ctypes.windll.user32
WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_int, ctypes.c_int)

WM_GETTEXT = 0x000D
WM_GETTEXTLENGTH = 0x000E

class RECT(ctypes.Structure):
    _fields_ = [("left", ctypes.c_long), ("top", ctypes.c_long),
                ("right", ctypes.c_long), ("bottom", ctypes.c_long)]

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

def get_wrect(hwnd):
    rect = RECT()
    user32.GetWindowRect(hwnd, ctypes.byref(rect))
    return rect.left, rect.top, rect.right - rect.left, rect.bottom - rect.top

def dump_lasercad_edits():
    def enum_win_cb(hwnd, lparam):
        if user32.IsWindowVisible(hwnd):
            title = get_wtitle(hwnd)
            if "lasercad" in title.lower() or "laser" in title.lower():
                wx, wy, ww, wh = get_wrect(hwnd)
                print(f"\n==============================================")
                print(f"LaserCAD Window HWND {hwnd}: '{title}' pos=({wx},{wy}) size=({ww},{wh})")
                print(f"==============================================")
                
                edits = []
                def enum_child_cb(chwnd, lparam):
                    ccls = get_cls(chwnd)
                    txt = get_wtxt(chwnd)
                    if ccls == "Edit":
                        cx, cy, cw, ch = get_wrect(chwnd)
                        rel_x = cx - wx
                        rel_y = cy - wy
                        edits.append((chwnd, txt, rel_x, rel_y, cw, ch))
                    return True

                user32.EnumChildWindows(hwnd, WNDENUMPROC(enum_child_cb), 0)
                for chwnd, txt, rx, ry, cw, ch in edits:
                    print(f"  [HWND: {chwnd:7d}] [Edit] rel_pos=({rx:4d},{ry:4d}) size=({cw:3d},{ch:3d}) text='{txt}'")
        return True

    user32.EnumWindows(WNDENUMPROC(enum_win_cb), 0)

if __name__ == "__main__":
    dump_lasercad_edits()
