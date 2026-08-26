import os, time, sys

sys.stdout.reconfigure(encoding='utf-8')

def find_most_recent_cdr_file(max_age_seconds=3600):
    home = os.path.expanduser("~")
    search_dirs = [
        r"E:\arquivos 2024",
        r"E:\arquivos 2026",
        r"D:\arquivos 2026",
        r"C:\Projetos",
        r"C:\Clientes",
        os.path.join(home, "Desktop"),
        os.path.join(home, "Downloads"),
        os.path.join(home, "Documents")
    ]
    
    now = time.time()
    newest_file = None
    newest_mtime = 0
    
    for d in search_dirs:
        if os.path.exists(d):
            try:
                for root, _, files in os.walk(d):
                    for f in files:
                        if f.lower().endswith(('.cdr', '.pw5', '.dxf')):
                            fp = os.path.join(root, f)
                            try:
                                mtime = os.path.getmtime(fp)
                                if (now - mtime) < max_age_seconds and mtime > newest_mtime:
                                    newest_mtime = mtime
                                    newest_file = fp
                            except Exception:
                                pass
            except Exception:
                pass
                
    return newest_file, newest_mtime

fp, mt = find_most_recent_cdr_file(max_age_seconds=14400) # last 4 hours
print("Most Recent CDR File:", fp)
if fp:
    diff_min = (time.time() - mt) / 60
    print(f"Modified {diff_min:.1f} minutes ago.")
