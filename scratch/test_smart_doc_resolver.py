import ctypes
import os
import time

user32 = ctypes.windll.user32
WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_int, ctypes.c_int)

WM_GETTEXT = 0x000D
WM_GETTEXTLENGTH = 0x000E

def get_wtxt(hwnd):
    try:
        length = user32.SendMessageW(hwnd, WM_GETTEXTLENGTH, 0, 0)
        if length > 0:
            buff = ctypes.create_unicode_buffer(length + 1)
            user32.SendMessageW(hwnd, WM_GETTEXT, length + 1, ctypes.byref(buff))
            return buff.value
    except Exception:
        pass
    return ""

def get_cls(hwnd):
    cbuff = ctypes.create_unicode_buffer(256)
    user32.GetClassNameW(hwnd, cbuff, 256)
    return cbuff.value

def get_wtitle(hwnd):
    length = user32.GetWindowTextLengthW(hwnd)
    if length > 0:
        buff = ctypes.create_unicode_buffer(length + 1)
        user32.GetWindowTextW(hwnd, buff, length + 1)
        return buff.value
    return ""

def get_lasercad_active_doc_name(soft_cfg_path=r"C:\LaserCAD\AWCCfg\SoftCfg.ini"):
    found_names = []
    
    # 1. Inspect Download Document dialog window controls
    def enum_dl_cb(hwnd, lparam):
        if user32.IsWindowVisible(hwnd):
            title = get_wtitle(hwnd)
            if "download" in title.lower():
                def enum_child(chwnd, lparam):
                    if get_cls(chwnd) == "Edit":
                        txt = get_wtxt(chwnd)
                        # Filter out numbers, dimensions (mm), scales, percentages
                        if txt and len(txt) >= 2 and not txt.replace('.','').replace(',','').isdigit() and 'mm' not in txt.lower() and '%' not in txt:
                            found_names.append(('download_dialog', txt))
                    return True
                user32.EnumChildWindows(hwnd, WNDENUMPROC(enum_child), 0)
        return True

    user32.EnumWindows(WNDENUMPROC(enum_dl_cb), 0)

    # 2. Inspect LaserCAD main window title
    def enum_main_cb(hwnd, lparam):
        if user32.IsWindowVisible(hwnd):
            title = get_wtitle(hwnd)
            if ("lasercad" in title.lower() or "lasercut" in title.lower()) and "-" in title:
                parts = title.split("-", 1)
                if len(parts) > 1:
                    raw_fname = parts[1].strip()
                    clean_name = raw_fname.split("\\")[-1].split("/")[-1]
                    if "." in clean_name:
                        clean_name = clean_name.rsplit(".", 1)[0]
                    if clean_name and clean_name.lower() != "untitled" and len(clean_name) >= 2:
                        found_names.append(('main_window_title', clean_name))
        return True

    user32.EnumWindows(WNDENUMPROC(enum_main_cb), 0)

    # 3. Check recent .pw5 / .dxf files in C:\LaserCAD or C:\LaserCAD\AWCDoc
    search_dirs = [r"C:\LaserCAD\AWCDoc", r"C:\LaserCAD", r"C:\LaserCAD\AWCCfg"]
    now = time.time()
    for d in search_dirs:
        if os.path.exists(d):
            try:
                for f in os.listdir(d):
                    if f.lower().endswith(('.pw5', '.ud5', '.pw', '.dxf', '.plt', '.ai')):
                        fpath = os.path.join(d, f)
                        if now - os.path.getmtime(fpath) < 300: # Modified in last 5 min
                            clean = f.rsplit('.', 1)[0]
                            found_names.append(('recent_file', clean))
            except Exception:
                pass

    # 4. Fallback to SoftCfg.ini DocName
    if os.path.exists(soft_cfg_path):
        try:
            with open(soft_cfg_path, 'r', encoding='utf-8', errors='ignore') as f:
                for line in f:
                    if line.strip().startswith('DocName='):
                        val = line.strip().split('=', 1)[1].strip()
                        if val and len(val) >= 2:
                            found_names.append(('soft_cfg_ini', val))
        except Exception:
            pass

    print("Candidates found:", found_names)
    # Prefer download_dialog, then main_window_title, then recent_file, then soft_cfg_ini
    for source_type, val in found_names:
        if source_type in ('download_dialog', 'main_window_title', 'recent_file'):
            return val
            
    if found_names:
        return found_names[0][1]
        
    return None

if __name__ == "__main__":
    name = get_lasercad_active_doc_name()
    print("Resolved Doc Name:", name)
