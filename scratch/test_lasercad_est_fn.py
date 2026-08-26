import ctypes
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

user32 = ctypes.windll.user32
WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_int, ctypes.c_int)

def get_window_text(hwnd):
    length = user32.GetWindowTextLengthW(hwnd)
    if length > 0:
        buff = ctypes.create_unicode_buffer(length + 1)
        user32.GetWindowTextW(hwnd, buff, length + 1)
        return buff.value
    return ""

def get_lasercad_estimated_minutes():
    """
    Scans running LaserCAD windows and popups via Win32 API to extract estimated work time.
    Returns estimated time in minutes (float) or None if not found/zero.
    """
    found_times = []

    def enum_windows_callback(hwnd, lparam):
        if user32.IsWindowVisible(hwnd):
            title = get_window_text(hwnd)
            title_lower = title.lower()
            
            if "lasercad" in title_lower or "laser" in title_lower or "work time" in title_lower or "estimate" in title_lower:
                def enum_child_callback(chwnd, lparam):
                    txt = get_window_text(chwnd)
                    if txt:
                        # Pattern 1: 'Worked Times:00:05:30' or 'Work Time: 00:05:30'
                        m1 = re.search(r'(?:worked\s*times?|work\s*time|estimate\s*time)[:\s]+(\d{1,2}):(\d{2}):(\d{2})', txt, re.IGNORECASE)
                        if m1:
                            hrs, mins, secs = map(int, m1.groups())
                            tot = hrs * 60 + mins + secs / 60.0
                            if tot > 0:
                                found_times.append(tot)
                        
                        # Pattern 2: Popup dialogs showing just HH:MM:SS or MM:SS
                        elif "work time" in title_lower or "estimate" in title_lower or "calculat" in title_lower:
                            m2 = re.search(r'\b(\d{1,2}):(\d{2}):(\d{2})\b', txt)
                            if m2:
                                hrs, mins, secs = map(int, m2.groups())
                                tot = hrs * 60 + mins + secs / 60.0
                                if tot > 0:
                                    found_times.append(tot)
                    return True

                user32.EnumChildWindows(hwnd, WNDENUMPROC(enum_child_callback), 0)
        return True

    try:
        user32.EnumWindows(WNDENUMPROC(enum_windows_callback), 0)
    except Exception as e:
        print(f"[!] Error inspecting LaserCAD win32 windows: {e}")

    if found_times:
        # Return the max/most realistic non-zero value found
        return round(max(found_times), 2)
    return None

if __name__ == "__main__":
    est = get_lasercad_estimated_minutes()
    print(f"Extracted estimated minutes: {est}")
