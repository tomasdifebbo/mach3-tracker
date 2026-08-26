import ctypes
import os
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

print("=== SEARCHING FOR ALL WINDOWS OF CorelDRW.exe AND LaserCAD.exe ===")

all_windows = []

def enum_cb(hwnd, lparam):
    pid = ctypes.c_ulong()
    user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
    title = get_wtitle(hwnd)
    cls = get_wclass(hwnd)
    visible = user32.IsWindowVisible(hwnd)
    if title or "corel" in cls.lower() or "laser" in cls.lower():
        all_windows.append((hwnd, pid.value, visible, cls, title))
    return True

user32.EnumWindows(WNDENUMPROC(enum_cb), 0)

for hwnd, pid, vis, cls, title in all_windows:
    if "corel" in title.lower() or "corel" in cls.lower() or "laser" in title.lower() or "laser" in cls.lower() or "doc" in title.lower() or "download" in title.lower():
        print(f"HWND: {hwnd} | PID: {pid} | Visible: {vis} | Class: '{cls}' | Title: '{title}'")

print("\nDone!")
