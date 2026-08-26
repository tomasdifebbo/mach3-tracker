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

def get_lasercad_estimated_time():
    """
    Finds running LaserCAD windows and extracts 'Worked Times:HH:MM:SS' or estimated work time.
    Returns estimated time in minutes (float) or None.
    """
    found_times = []

    def enum_windows_callback(hwnd, lparam):
        if user32.IsWindowVisible(hwnd):
            title = get_window_text(hwnd)
            if "lasercad" in title.lower() or "laser" in title.lower():
                # Search child windows for Worked Times button/static
                def enum_child_callback(chwnd, lparam):
                    txt = get_window_text(chwnd)
                    if txt:
                        # Match 'Worked Times:00:05:30' or 'Worked Times: 00:05:30' or 'Work Time: 00:05:30'
                        m = re.search(r'(?:worked\s*times|work\s*time|estimate\s*time)[:\s]+(\d{1,2}):(\d{2}):(\d{2})', txt, re.IGNORECASE)
                        if m:
                            hrs, mins, secs = map(int, m.groups())
                            total_minutes = hrs * 60 + mins + secs / 60.0
                            found_times.append({
                                'hwnd': chwnd,
                                'text': txt,
                                'hours': hrs,
                                'minutes': mins,
                                'seconds': secs,
                                'total_minutes': round(total_minutes, 2)
                            })
                        # Also check if text is just HH:MM:SS inside a work time dialog
                        elif "work time" in title.lower() or "estimate" in title.lower():
                            m2 = re.search(r'(\d{1,2}):(\d{2}):(\d{2})', txt)
                            if m2:
                                hrs, mins, secs = map(int, m2.groups())
                                total_minutes = hrs * 60 + mins + secs / 60.0
                                found_times.append({
                                    'hwnd': chwnd,
                                    'text': txt,
                                    'hours': hrs,
                                    'minutes': mins,
                                    'seconds': secs,
                                    'total_minutes': round(total_minutes, 2)
                                })
                    return True
                
                user32.EnumChildWindows(hwnd, WNDENUMPROC(enum_child_callback), 0)
        return True

    user32.EnumWindows(WNDENUMPROC(enum_windows_callback), 0)
    return found_times

if __name__ == "__main__":
    results = get_lasercad_estimated_time()
    print(f"Extracted LaserCAD times: {results}")
