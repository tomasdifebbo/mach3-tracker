import ctypes
import re
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

def get_lasercad_dimensions():
    """
    Extracts the bounding box dimensions (X width, Y height in mm) and area (m²) from LaserCAD controls.
    """
    dims = []

    def enum_windows_cb(hwnd, lparam):
        if user32.IsWindowVisible(hwnd):
            title = get_window_title(hwnd)
            if "lasercad" in title.lower() or "laser" in title.lower():
                edits = []
                def enum_child_cb(chwnd, lparam):
                    ccls = get_class_name(chwnd)
                    txt = get_control_text(chwnd)
                    if ccls == "Edit" and txt:
                        # Clean mm suffix if present e.g. '1400.000 mm' -> '1400.000'
                        clean_txt = txt.replace('mm', '').strip()
                        try:
                            val = float(clean_txt)
                            if 1.0 <= val <= 5000.0:  # Reasonable laser bed size in mm (1mm to 5m)
                                edits.append((chwnd, val, txt))
                        except ValueError:
                            pass
                    return True
                
                user32.EnumChildWindows(hwnd, WNDENUMPROC(enum_child_cb), 0)
                
                # Check pairs of values that look like X (width) and Y (height)
                # E.g. 1400mm x 1010mm or 1438mm x 1061mm
                if len(edits) >= 2:
                    vals = [e[1] for e in edits]
                    dims.append({
                        'title': title,
                        'edits': edits,
                        'vals': vals
                    })
        return True

    user32.EnumWindows(WNDENUMPROC(enum_windows_cb), 0)
    return dims

if __name__ == "__main__":
    res = get_lasercad_dimensions()
    for item in res:
        print(f"\nWindow: '{item['title']}'")
        print("Numeric Edit values:", [e[1] for e in item['edits']])
        for hwnd, val, txt in item['edits']:
            print(f"  [HWND: {hwnd}] raw='{txt}' -> float={val}")
