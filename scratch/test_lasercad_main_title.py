import ctypes
import sys

sys.stdout.reconfigure(encoding='utf-8')

user32 = ctypes.windll.user32
WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_int, ctypes.c_int)

def get_wtitle(hwnd):
    length = user32.GetWindowTextLengthW(hwnd)
    if length > 0:
        buff = ctypes.create_unicode_buffer(length + 1)
        user32.GetWindowTextW(hwnd, buff, length + 1)
        return buff.value
    return ""

def dump_all_titles():
    def enum_cb(hwnd, lparam):
        if user32.IsWindowVisible(hwnd):
            title = get_wtitle(hwnd)
            if title and ("laser" in title.lower() or "awc" in title.lower() or "pw5" in title.lower()):
                print(f"HWND {hwnd}: '{title}'")
        return True

    user32.EnumWindows(WNDENUMPROC(enum_cb), 0)

if __name__ == "__main__":
    dump_all_titles()
