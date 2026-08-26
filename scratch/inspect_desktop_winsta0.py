import ctypes

user32 = ctypes.windll.user32
kernel32 = ctypes.windll.kernel32

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

# Open Default Desktop
hdesk = user32.OpenDesktopW("Default", 0, False, 0x0100) # DESKTOP_ENUMERATE
if not hdesk:
    hdesk = user32.GetThreadDesktop(kernel32.GetCurrentThreadId())

print("Desktop handle:", hdesk)

def enum_cb(hwnd, lparam):
    pid = ctypes.c_ulong()
    user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
    title = get_wtitle(hwnd)
    cls = get_wclass(hwnd)
    if title:
        print(f"PID: {pid.value} | Class: '{cls}' | Title: '{title}'")
    return True

user32.EnumDesktopWindows(hdesk, WNDENUMPROC(enum_cb), 0)
