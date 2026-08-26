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

def extract_project_folder_and_filename(full_path):
    if not full_path:
        return None, None
    clean_path = full_path.replace('/', '\\').strip()
    if clean_path.endswith('*'):
        clean_path = clean_path[:-1].strip()
    
    parts = [p for p in clean_path.split('\\') if p]
    if not parts:
        return None, None
        
    file_name = parts[-1]
    
    # Extract project folder (skip generic folders)
    folder_parts = parts[:-1]
    skip_list = ["DESKTOP", "DOWNLOADS", "DOCUMENTS", "DOCUMENTOS", "C:", "D:", "E:", "F:", "USERS", "ATELIER ARTE", "TEMP", "TMP", "ROUTER", "CNC", "LASERCAD"]
    
    project_folder = None
    for p in reversed(folder_parts):
        if p and p.upper() not in skip_list and not p.startswith('{'):
            project_folder = p
            break
            
    return project_folder or "Geral", file_name

def get_active_coreldraw_info():
    found_info = None
    
    def enum_cb(hwnd, lparam):
        nonlocal found_info
        if user32.IsWindowVisible(hwnd):
            title = get_wtitle(hwnd)
            if "corel" in title.lower():
                print(f"[+] Corel Window Title found: '{title}'")
                # Look for file path inside brackets or after hyphen:
                # E.g. "CorelDRAW 2021 (64-Bit) - [C:\Clientes\2629A - royal enfield\LETRAS ROYAL.cdr *]"
                # E.g. "CorelDRAW - C:\Users\Atelier Arte\Downloads\ROUTER (13).cdr*"
                if "[" in title and "]" in title:
                    raw_path = title.split("[", 1)[1].split("]", 1)[0].strip()
                elif "-" in title:
                    raw_path = title.rsplit("-", 1)[1].strip()
                else:
                    raw_path = ""
                    
                if "\\" in raw_path or "/" in raw_path:
                    folder, fname = extract_project_folder_and_filename(raw_path)
                    print(f"    Extracted -> Folder: '{folder}' | File: '{fname}'")
                    if not found_info:
                        found_info = (raw_path, folder, fname)
        return True

    user32.EnumWindows(WNDENUMPROC(enum_cb), 0)
    return found_info

if __name__ == "__main__":
    info = get_active_coreldraw_info()
    print("\nResulting Info:", info)
