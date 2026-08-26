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

def get_lasercad_bounding_box():
    found_boxes = []

    def enum_win_cb(hwnd, lparam):
        if user32.IsWindowVisible(hwnd):
            title = get_wtitle(hwnd)
            if "lasercad" in title.lower() or "laser" in title.lower():
                wx, wy, ww, wh = get_wrect(hwnd)
                object_bar_edits = []

                def enum_child_cb(chwnd, lparam):
                    ccls = get_cls(chwnd)
                    if ccls == "Edit":
                        cx, cy, cw, ch = get_wrect(chwnd)
                        rel_x = cx - wx
                        rel_y = cy - wy
                        txt = get_wtxt(chwnd)
                        if txt:
                            clean = txt.replace('mm', '').strip()
                            try:
                                val = float(clean)
                                if rel_x < 400 and rel_y < 160 and val > 0:
                                    object_bar_edits.append({
                                        'rel_x': rel_x,
                                        'rel_y': rel_y,
                                        'val': val
                                    })
                            except ValueError:
                                pass
                    return True

                user32.EnumChildWindows(hwnd, WNDENUMPROC(enum_child_cb), 0)

                col2 = [e for e in object_bar_edits if 140 <= e['rel_x'] <= 230]
                col2.sort(key=lambda e: e['rel_y'])

                width_val = None
                height_val = None

                if len(col2) >= 2:
                    width_val = col2[0]['val']
                    height_val = col2[1]['val']
                elif len(object_bar_edits) >= 4:
                    object_bar_edits.sort(key=lambda e: (e['rel_x'], e['rel_y']))
                    width_val = object_bar_edits[2]['val']
                    height_val = object_bar_edits[3]['val']

                if width_val and height_val:
                    area_m2 = round((width_val / 1000.0) * (height_val / 1000.0), 4)
                    found_boxes.append((round(width_val, 2), round(height_val, 2), area_m2))
        return True

    user32.EnumWindows(WNDENUMPROC(enum_win_cb), 0)

    if found_boxes:
        # Prefer non-full-bed boxes if available
        non_bed_boxes = [b for b in found_boxes if not (abs(b[0] - 1400.0) < 5 and abs(b[1] - 1010.0) < 5)]
        if non_bed_boxes:
            return non_bed_boxes[0]
        return found_boxes[0]

    return None, None, None

if __name__ == "__main__":
    mx, my, area = get_lasercad_bounding_box()
    print(f"Extracted Object Box: max_x={mx}mm, max_y={my}mm, area={area}m²")
