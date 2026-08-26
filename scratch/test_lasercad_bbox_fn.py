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

def get_lasercad_bounding_box():
    """
    Extracts max_x (mm), max_y (mm), and bounding_area_m2 (m²) from open LaserCAD windows.
    Returns tuple: (max_x, max_y, bounding_area_m2) or (None, None, None).
    """
    found_boxes = []

    def enum_windows_cb(hwnd, lparam):
        if user32.IsWindowVisible(hwnd):
            title = get_window_title(hwnd)
            if "lasercad" in title.lower() or "laser" in title.lower():
                edits = []
                def enum_child_cb(chwnd, lparam):
                    ccls = get_class_name(chwnd)
                    txt = get_control_text(chwnd)
                    if ccls == "Edit" and txt:
                        clean_txt = txt.replace('mm', '').strip()
                        try:
                            val = float(clean_txt)
                            # Bounding box values typically between 5mm and 3000mm
                            if 5.0 <= val <= 3000.0:
                                edits.append((chwnd, val, txt))
                        except ValueError:
                            pass
                    return True
                
                user32.EnumChildWindows(hwnd, WNDENUMPROC(enum_child_cb), 0)
                
                # Look for pairs of Edit values representing Width (X) and Height (Y)
                valid_vals = [e[1] for e in edits]
                if len(valid_vals) >= 2:
                    # Sort top 2 largest values or first pair that looks like X & Y
                    # e.g., 1400.0 and 1010.0
                    sorted_vals = sorted(valid_vals, reverse=True)
                    max_x = sorted_vals[0]
                    max_y = sorted_vals[1]
                    area_m2 = round((max_x / 1000.0) * (max_y / 1000.0), 4)
                    found_boxes.append((round(max_x, 2), round(max_y, 2), area_m2))
        return True

    try:
        user32.EnumWindows(WNDENUMPROC(enum_windows_cb), 0)
    except Exception as e:
        print(f"[!] Error reading LaserCAD bbox: {e}")

    if found_boxes:
        # Return box with largest valid area
        found_boxes.sort(key=lambda b: b[2], reverse=True)
        return found_boxes[0]
    
    return None, None, None

if __name__ == "__main__":
    mx, my, area = get_lasercad_bounding_box()
    print(f"LaserCAD Bounding Box result: max_x={mx}mm, max_y={my}mm, area={area}m²")
