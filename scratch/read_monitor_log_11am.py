import os

log_path = r"c:\DASHBOARD\monitor\monitor.log"
if os.path.exists(log_path):
    with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
        lines = f.readlines()
    print(f"Total log lines: {len(lines)}")
    print("\nLogs from today (2026-08-05):")
    today_lines = [l.strip() for l in lines if "2026-08-05" in l]
    for l in today_lines:
        print(l)
