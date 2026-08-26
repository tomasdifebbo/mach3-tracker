import ctypes
import re
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

def find_lasercad_active_doc_name():
    doc_name = None
    
    # 1. Check Download Document dialog window
    def enum_dl_cb(hwnd, lparam):
        nonlocal doc_name
        if user32.IsWindowVisible(hwnd):
            title = get_wtitle(hwnd)
            if "download" in title.lower():
                wx, wy, ww, wh = get_wrect(hwnd)
                def enum_child(chwnd, lparam):
                    nonlocal doc_name
                    if get_cls(chwnd) == "Edit":
                        txt = get_wtxt(chwnd)
                        # The "Name:" field in Download Document contains the document name
                        if txt and len(txt) >= 1 and not txt.isdigit() and doc_name is None:
                            doc_name = txt
                            print(f"[+] Found doc name in Download Document dialog: '{txt}'")
                    return True
                user32.EnumChildWindows(hwnd, WNDENUMPROC(enum_child), 0)
        return True

    user32.EnumWindows(WNDENUMPROC(enum_dl_cb), 0)
    
    # 2. Check LaserCAD main window title bar
    def enum_main_cb(hwnd, lparam):
        nonlocal doc_name
        if user32.IsWindowVisible(hwnd):
            title = get_wtitle(hwnd)
            if ("lasercad" in title.lower() or "lasercut" in title.lower()) and "-" in title:
                # E.g. "LaserCAD V7.87.3 - C:\Users\Desktop\Corte1.pw5" or "LaserCAD V8.16.9 - royal_enfield"
                parts = title.split("-", 1)
                if len(parts) > 1:
                    raw_fname = parts[1].strip()
                    # Remove file path if present
                    clean_name = raw_fname.split("\\")[-1].split("/")[-1]
                    # Remove extension
                    if "." in clean_name and not clean_name.startswith("Untitled"):
                        clean_name = clean_name.rsplit(".", 1)[0]
                    if clean_name and clean_name.lower() != "untitled" and len(clean_name) >= 2:
                        print(f"[+] Found doc name in LaserCAD Window Title: '{clean_name}' (raw: '{title}')")
                        if not doc_name:
                            doc_name = clean_name
        return True

    user32.EnumWindows(WNDENUMPROC(enum_main_cb), 0)
    return doc_name

if __name__ == "__main__":
    name = find_lasercad_active_doc_name()
    print(f"Resulting Document Name: '{name}'")
