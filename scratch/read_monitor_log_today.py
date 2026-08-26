import os

log_path = r"c:\DASHBOARD\monitor\monitor.log"
if os.path.exists(log_path):
    with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
        lines = f.readlines()
    print(f"Total log lines: {len(lines)}")
    print("\nLast 60 log lines:")
    for l in lines[-60:]:
        print(l.strip())
