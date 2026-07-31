import os
import json

state_file = r"c:\DASHBOARD\monitor\monitor_state.json"
with open(state_file, "r") as f:
    state = json.load(f)

paths = {
    "Router Central": r"\\DESKTOP-1CSKMNT\Mach3\log_oficial.csv",
    "Router 2": r"\\ACT10\Mach3\log_oficial.csv"
}

for name, path in paths.items():
    last_pos = state.get(name, {}).get("last_pos", 0)
    if os.path.exists(path):
        size = os.path.getsize(path)
        print(f"=== {name} ===")
        print(f"Path: {path}")
        print(f"Recorded last_pos: {last_pos} | Current size: {size}")
        if size < last_pos:
            print("[!] File was truncated or reset! size < last_pos")
        elif size > last_pos:
            print(f"[!] New data available! ({size - last_pos} bytes unread)")
            with open(path, "r", encoding="utf-8", errors="ignore") as f:
                f.seek(last_pos)
                new_lines = f.readlines()
                print("Unread lines:")
                for l in new_lines:
                    print("  ", l.strip())
        else:
            print("No new data written to log file since 10:16 AM.")
    else:
        print(f"=== {name} === Path NOT found: {path}")
    print()
