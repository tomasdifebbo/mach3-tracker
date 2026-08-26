import os, sys

sys.stdout.reconfigure(encoding='utf-8')

def find_file_by_name(target_name, search_dirs=None):
    if not search_dirs:
        home = os.path.expanduser("~")
        search_dirs = [
            os.path.join(home, "Desktop"),
            os.path.join(home, "Downloads"),
            os.path.join(home, "Documents"),
            r"C:\Projetos",
            r"C:\Clientes",
            r"C:\LaserCAD",
            r"E:\arquivos 2026",
            r"D:\arquivos 2026",
            r"E:\arquivos 2024"
        ]
    
    clean_target = target_name.lower().replace('.cdr','').replace('.pw5','').replace('.dxf','').strip()
    print(f"Searching for file matching '{clean_target}'...")
    
    matches = []
    for d in search_dirs:
        if os.path.exists(d):
            try:
                for root, _, files in os.walk(d):
                    for f in files:
                        fname_lower = f.lower()
                        if clean_target in fname_lower:
                            fp = os.path.join(root, f)
                            try:
                                mtime = os.path.getmtime(fp)
                                matches.append((fp, mtime))
                            except Exception:
                                pass
            except Exception:
                pass
                
    matches.sort(key=lambda x: x[1], reverse=True)
    return matches

results = find_file_by_name("PRATELEIR")
print(f"Found {len(results)} matches:")
for fp, mt in results[:5]:
    print(f"  Path: '{fp}' | mtime: {mt}")
