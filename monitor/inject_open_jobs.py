import os
import json
import requests
import re

def get_open_folders():
    with open('config.json', 'r') as f:
        config = json.load(f)
    
    r = requests.post('https://mach3tracker.up.railway.app/api/auth/login', json={'email': config['email'], 'password': config['password']})
    token = r.json()['token']
    
    resp = requests.get('https://mach3tracker.up.railway.app/api/jobs?status=open', headers={'Authorization': f'Bearer {token}'})
    jobs = resp.json()
    
    folders = set()
    for j in jobs:
        fpath = j.get('file_path')
        if fpath and ("\\" in fpath or "/" in fpath):
            # Normalize UNC paths to local E: or C:
            local_path = fpath
            unc_mappings = {
                r"\\TOMAS\arquivos 2024": r"E:\arquivos 2024",
                r"\\DESKTOP-1CSKMNT\Mach3": r"C:\mach3",
            }
            for unc, local in unc_mappings.items():
                if local_path.upper().startswith(unc.upper()):
                    local_path = local + local_path[len(unc):]
                    break
            
            d = os.path.dirname(local_path)
            if os.path.exists(d):
                folders.add(d)
                
    return folders

def process_folder(directory):
    files = [f for f in os.listdir(directory) if f.lower().endswith('.txt') or f.lower().endswith('.tap') or f.lower().endswith('.nc')]
    modified_count = 0
    for filename in files:
        path = os.path.join(directory, filename)
        
        try:
            with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                lines = f.readlines()
        except Exception:
            continue
            
        new_lines = []
        m102_added = False
        changed = False
        
        # Check if already has M102
        has_m102 = any('M102' in l.upper() for l in lines)
        if has_m102:
            continue
            
        for i, line in enumerate(lines):
            new_lines.append(line)
            if i < len(lines) - 1 and 'M30' in lines[i+1].upper() and not m102_added:
                new_lines.append("M102\n")
                m102_added = True
                changed = True
                
        if not m102_added:
            new_lines.insert(-1, "M102\n")
            m102_added = True
            changed = True
            
        if changed:
            try:
                with open(path, 'w', encoding='utf-8') as f:
                    f.writelines(new_lines)
                modified_count += 1
                print(f"  [+] M102 injetado em: {filename}")
            except Exception as e:
                print(f"  [!] Erro ao salvar {filename}: {e}")
                
    return modified_count

def main():
    print("Buscando pastas de trabalhos em aberto...")
    folders = get_open_folders()
    print(f"Encontradas {len(folders)} pastas ativas.")
    
    total_mod = 0
    for d in folders:
        print(f"\nVerificando pasta: {d}")
        count = process_folder(d)
        total_mod += count
        
    print(f"\nConcluido! Total de arquivos modificados com M102: {total_mod}")

if __name__ == '__main__':
    main()
