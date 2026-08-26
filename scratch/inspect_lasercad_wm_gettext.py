import ctypes
import sys

sys.stdout.reconfigure(encoding='utf-8')

user32 = ctypes.windll.user32
WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_int, ctypes.c_int)

WM_GETTEXT = 0x000D
WM_GETTEXTLENGTH = 0x000E

def get_control_text_wm(hwnd):
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

def inspect_all_edits_and_statics():
    found_inputs = []

    def enum_windows_callback(hwnd, lparam):
        if user32.IsWindowVisible(hwnd):
            title = get_window_title(hwnd)
            if "lasercad" in title.lower() or "laser" in title.lower():
                print(f"\nWindow: [HWND: {hwnd}] '{title}'")
                
                def enum_child_callback(chwnd, lparam):
                    ccls = get_class_name(chwnd)
                    txt = get_control_text_wm(chwnd)
                    if txt and txt.strip():
                        found_inputs.append((chwnd, ccls, txt.strip()))
                    return True

                user32.EnumChildWindows(hwnd, WNDENUMPROC(enum_child_callback), 0)
        return True

    user32.EnumWindows(WNDENUMPROC(enum_windows_callback), 0)
    return found_inputs

if __name__ == "__main__":
    inputs = inspect_all_edits_and_statics()
    print(f"\nFound {len(inputs)} controls with text in LaserCAD:")
    for hwnd, ccls, txt in inputs:
        print(f"  [HWND: {hwnd}] [{ccls}] '{txt}'")
