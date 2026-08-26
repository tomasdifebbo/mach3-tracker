import os
import re
import time
import ctypes

user32 = ctypes.windll.user32
WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_int, ctypes.c_int)

def get_wtitle(hwnd):
    length = user32.GetWindowTextLengthW(hwnd)
    if length > 0:
        buff = ctypes.create_unicode_buffer(length + 1)
        user32.GetWindowTextW(hwnd, buff, length + 1)
        return buff.value
    return ""

def extract_path_from_window_title(title):
    if not title:
        return None
    
    # 1. Match full Windows path like C:\Folder\Subfolder\file.cdr or C:/Folder/file.cdr
    win_path_match = re.search(r'([a-zA-Z]:\\[^\*\>\<\?\"]+)', title)
    if win_path_match:
        p = win_path_match.group(1).strip()
        if ']' in p:
            p = p.split(']')[0].strip()
        p = p.rstrip('*]').strip()
        return p

    # 2. Match UNC path like \\Server\Folder\file.cdr
    unc_path_match = re.search(r'(\\\\[^\*\>\<\?\"]+)', title)
    if unc_path_match:
        p = unc_path_match.group(1).strip()
        if ']' in p:
            p = p.split(']')[0].strip()
        p = p.rstrip('*]').strip()
        return p

    # 3. Match filename ending in .cdr or .pw5
    cdr_match = re.search(r'([^\s\\/\[\]]+\.(?:cdr|pw5|dxf|ai))', title, re.IGNORECASE)
    if cdr_match:
        return cdr_match.group(1)

    return None

def find_recent_cdr_file(search_dirs=None):
    if not search_dirs:
        home = os.path.expanduser("~")
        search_dirs = [
            os.path.join(home, "Desktop"),
            os.path.join(home, "Downloads"),
            os.path.join(home, "Documents"),
            r"C:\Projetos",
            r"C:\Clientes",
            r"E:\arquivos 2026",
            r"D:\arquivos 2026"
        ]
    
    now = time.time()
    recent_file = None
    newest_mtime = 0
    
    for d in search_dirs:
        if os.path.exists(d):
            try:
                for root, _, files in os.walk(d):
                    # Limit depth to 4 levels
                    depth = root.count(os.sep) - d.count(os.sep)
                    if depth > 4:
                        continue
                    for f in files:
                        if f.lower().endswith(('.cdr', '.pw5', '.dxf')):
                            fp = os.path.join(root, f)
                            try:
                                mtime = os.path.getmtime(fp)
                                # Modified in last 15 minutes
                                if (now - mtime) < 900 and mtime > newest_mtime:
                                    newest_mtime = mtime
                                    recent_file = fp
                            except Exception:
                                pass
            except Exception:
                pass
                
    return recent_file

print("=== TESTING TITLE PARSER ON COREL WINDOW TITLES ===")
test_titles = [
    r"CorelDRAW 2021 (64-Bit) - [C:\Clientes\2629A - royal enfield\PRATELEIR.cdr *]",
    r"PRATELEIR.cdr [Modificado] - CorelDRAW 2021",
    r"C:\Projetos 2026\2578B - tartarugas ninjas\peça.cdr - CorelDRAW",
    r"CorelDRAW - C:\Users\Atelier Arte\Desktop\PRATELEIR.cdr *",
    r"LaserCAD - [C:\LaserCAD\AWCCfg\PRATELEIR.pw5]"
]

for t in test_titles:
    res = extract_path_from_window_title(t)
    print(f"Title: '{t}'\n  -> Extracted: '{res}'\n")

print("=== CHECKING FOR RECENT CDR FILES ON SYSTEM ===")
rec = find_recent_cdr_file()
print("Most Recent CDR File:", rec)
