import ctypes

user32 = ctypes.windll.user32

# Buffer for text
WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_int, ctypes.c_int)

found_windows = []

def enum_windows_callback(hwnd, lparam):
    if user32.IsWindowVisible(hwnd):
        length = user32.GetWindowTextLengthW(hwnd)
        if length > 0:
            buff = ctypes.create_unicode_buffer(length + 1)
            user32.GetWindowTextW(hwnd, buff, length + 1)
            title = buff.value
            
            class_buff = ctypes.create_unicode_buffer(256)
            user32.GetClassNameW(hwnd, class_buff, 256)
            cls_name = class_buff.value
            
            if "laser" in title.lower() or "lasercad" in title.lower() or "estimate" in title.lower() or "work time" in title.lower() or "time" in title.lower() or "awc" in title.lower() or "ruida" in title.lower() or "awc" in cls_name.lower():
                found_windows.append((hwnd, title, cls_name))
    return True

user32.EnumWindows(WNDENUMPROC(enum_windows_callback), 0)

print(f"Found {len(found_windows)} relevant windows:")
for hwnd, title, cls in found_windows:
    print(f"\n[HWND: {hwnd}] Title: '{title}' | Class: '{cls}'")
    
    # Enumerate child controls of this window
    child_controls = []
    def enum_child_callback(chwnd, lparam):
        length = user32.GetWindowTextLengthW(chwnd)
        buff = ctypes.create_unicode_buffer(length + 1)
        user32.GetWindowTextW(chwnd, buff, length + 1)
        txt = buff.value
        
        cbuff = ctypes.create_unicode_buffer(256)
        user32.GetClassNameW(chwnd, cbuff, 256)
        cls_name = cbuff.value
        child_controls.append((chwnd, txt, cls_name))
        return True
    
    user32.EnumChildWindows(hwnd, WNDENUMPROC(enum_child_callback), 0)
    print(f"  Child controls count: {len(child_controls)}")
    for chwnd, txt, cls_name in child_controls:
        if txt.strip():
            print(f"    Control: [{cls_name}] '{txt}'")
