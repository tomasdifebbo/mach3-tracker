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

def get_wclass(hwnd):
    buff = ctypes.create_unicode_buffer(256)
    user32.GetClassNameW(hwnd, buff, 256)
    return buff.value

# Open Default desktop with DESKTOP_WRITEOBJECTS | DESKTOP_READOBJECTS | DESKTOP_ENUMERATE
DESKTOP_ALL = 0x0100 | 0x0001 | 0x0002 | 0x0004 | 0x0008 | 0x0010 | 0x0020 | 0x0040 | 0x0080
hdesk = user32.OpenDesktopW("Default", 0, False, DESKTOP_ALL)
if hdesk:
    user32.SetThreadDesktop(hdesk)

print("Thread Desktop set. Enumerating desktop windows...")

def enum_cb(hwnd, lparam):
    pid = ctypes.c_ulong()
    user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
    title = get_wtitle(hwnd)
    cls = get_wclass(hwnd)
    if title:
        print(f"HWND: {hwnd} | PID: {pid.value} | Class: '{cls}' | Title: '{title}'")
    return True

user32.EnumDesktopWindows(hdesk, WNDENUMPROC(enum_cb), 0)
print("\nDone!")
