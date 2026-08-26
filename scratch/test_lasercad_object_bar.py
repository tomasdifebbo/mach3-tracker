import ctypes
import sys

sys.stdout.reconfigure(encoding='utf-8')

user32 = ctypes.windll.user32
WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_int, ctypes.c_int)

WM_GETTEXT = 0x000D
WM_GETTEXTLENGTH = 0x000E

class RECT(ctypes.Structure):
    _fields_ = [("left", ctypes.c_long),
                ("top", ctypes.c_long),
                ("right", ctypes.c_long),
                ("bottom", ctypes.c_long)]

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

def get_window_rect(hwnd):
    rect = RECT()
    user32.GetWindowRect(hwnd, ctypes.byref(rect))
    return rect.left, rect.top, rect.right - rect.left, rect.bottom - rect.top

def get_lasercad_object_dimensions():
    """
    Extracts the exact Object Width (X_size) and Height (Y_size) from LaserCAD's Object Bar controls.
    """
    results = []

    def enum_windows_cb(hwnd, lparam):
        if user32.IsWindowVisible(hwnd):
            title = get_window_title(hwnd)
            if "lasercad" in title.lower() or "laser" in title.lower():
                # Get main window top-left so child coords are relative
                wx, wy, ww, wh = get_window_rect(hwnd)
                
                object_bar_edits = []
                def enum_child_cb(chwnd, lparam):
                    ccls = get_class_name(chwnd)
                    if ccls == "Edit":
                        cx, cy, cw, ch = get_window_rect(chwnd)
                        # Relative position inside main window
                        rel_x = cx - wx
                        rel_y = cy - wy
                        
                        txt = get_control_text(chwnd)
                        if txt:
                            clean = txt.replace('mm', '').strip()
                            try:
                                val = float(clean)
                                # Object Bar edit controls are positioned in top-left toolbar area (rel_x < 400, rel_y < 160)
                                if rel_x < 400 and rel_y < 160:
                                    object_bar_edits.append({
                                        'hwnd': chwnd,
                                        'rel_x': rel_x,
                                        'rel_y': rel_y,
                                        'val': val,
                                        'raw': txt
                                    })
                            except ValueError:
                                pass
                    return True
                
                user32.EnumChildWindows(hwnd, WNDENUMPROC(enum_child_cb), 0)
                
                # Sort controls by position:
                # Group by rel_x:
                # Column 1 (x ~ 60-100): Pos X, Pos Y
                # Column 2 (x ~ 150-200): Width (rel_y top), Height (rel_y bottom)
                col2 = [e for e in object_bar_edits if 140 <= e['rel_x'] <= 220]
                col2.sort(key=lambda e: e['rel_y'])
                
                width_val = None
                height_val = None
                
                if len(col2) >= 2:
                    width_val = col2[0]['val']   # Top Edit in col2 = Width
                    height_val = col2[1]['val']  # Bottom Edit in col2 = Height
                elif len(object_bar_edits) >= 4:
                    # Fallback sorting
                    object_bar_edits.sort(key=lambda e: (e['rel_x'], e['rel_y']))
                    width_val = object_bar_edits[2]['val']
                    height_val = object_bar_edits[3]['val']

                if width_val is not None and height_val is not None:
                    area_m2 = round((width_val / 1000.0) * (height_val / 1000.0), 4)
                    results.append({
                        'title': title,
                        'width_mm': width_val,
                        'height_mm': height_val,
                        'area_m2': area_m2,
                        'col2': col2
                    })
        return True

    user32.EnumWindows(WNDENUMPROC(enum_windows_cb), 0)
    return results

if __name__ == "__main__":
    res = get_lasercad_object_dimensions()
    for r in res:
        print(f"\nWindow: '{r['title']}'")
        print(f"  Width (X):  {r['width_mm']} mm")
        print(f"  Height (Y): {r['height_mm']} mm")
        print(f"  Area (m²):  {r['area_m2']} m²")
