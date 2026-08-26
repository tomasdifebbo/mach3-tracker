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

def find_exact_download_dialog_edits():
    def enum_win_cb(hwnd, lparam):
        if user32.IsWindowVisible(hwnd):
            title = get_wtitle(hwnd)
            wx, wy, ww, wh = get_wrect(hwnd)
            # Find popups/dialogs (width < 800, height < 600) or titled Download
            if "download" in title.lower() or (ww < 800 and wh < 600 and ("laser" in title.lower() or "document" in title.lower() or title == "")):
                print(f"Candidate Window HWND {hwnd}: '{title}' pos=({wx},{wy}) size=({ww},{wh})")
                
                edits = []
                def enum_child(chwnd, lparam):
                    ccls = get_cls(chwnd)
                    txt = get_wtxt(chwnd)
                    cx, cy, cw, ch = get_wrect(chwnd)
                    rel_x = cx - wx
                    rel_y = cy - wy
                    if ccls == "Edit":
                        edits.append((chwnd, txt, rel_x, rel_y, cw, ch))
                    return True

                user32.EnumChildWindows(hwnd, WNDENUMPROC(enum_child), 0)
                if edits:
                    print(f"  Edits in HWND {hwnd}:")
                    for chwnd, txt, rx, ry, cw, ch in edits:
                        print(f"    [HWND {chwnd:7d}] rel_pos=({rx:4d},{ry:4d}) size=({cw:3d},{ch:3d}) text='{txt}'")
        return True

    user32.EnumWindows(WNDENUMPROC(enum_win_cb), 0)

if __name__ == "__main__":
    find_exact_download_dialog_edits()
