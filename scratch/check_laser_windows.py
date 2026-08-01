import subprocess
import time

print("=== Checking all netstat connections to 192.168.0.2 ===")
res = subprocess.run(["netstat", "-ano"], capture_output=True, text=True)
found = False
for line in res.stdout.splitlines():
    if "192.168.0.2" in line or "LaserCAD" in line:
        print("  ", line)
        found = True
if not found:
    print("No active TCP/UDP connections to 192.168.0.2 right now.")

# Check all open windows on system to see LaserCAD window titles
import ctypes
user32 = ctypes.windll.user32

windows = []
def enum_windows_callback(hwnd, extra):
    if user32.IsWindowVisible(hwnd):
        length = user32.GetWindowTextLengthW(hwnd)
        if length > 0:
            buff = ctypes.create_unicode_buffer(length + 1)
            user32.GetWindowTextW(hwnd, buff, length + 1)
            title = buff.value
            if any(k in title.lower() for k in ["laser", "download", "cad", "awc", "ruida", "corte", "mach3"]):
                windows.append((hwnd, title))
    return True

WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_int, ctypes.c_int)
user32.EnumWindows(WNDENUMPROC(enum_windows_callback), 0)

print("\n=== Relevant Open Windows ===")
for hwnd, title in windows:
    print(f"  HWND {hwnd}: '{title}'")
