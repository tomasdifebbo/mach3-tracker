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

print("=== INSPECTING ALL VISIBLE WINDOWS NOW ===")

def enum_cb(hwnd, lparam):
    if user32.IsWindowVisible(hwnd):
        title = get_wtitle(hwnd)
        cls = get_wclass(hwnd)
        if title and any(k in title.lower() for k in ["corel", "laser", "doc", "pratel", "pw5", "cdr", "download"]):
            print(f"HWND: {hwnd} | Class: '{cls}' | Title: '{title}'")
    return True

user32.EnumWindows(WNDENUMPROC(enum_cb), 0)
print("\nDone!")
