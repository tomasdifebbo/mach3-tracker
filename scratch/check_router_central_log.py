import os

path = r"\\DESKTOP-1CSKMNT\Mach3\log_oficial.csv"
print(f"Path: {path}")
print(f"Exists: {os.path.exists(path)}")
if os.path.exists(path):
    size = os.path.getsize(path)
    print(f"File size: {size}")
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        lines = f.readlines()
    print(f"Total lines: {len(lines)}")
    print("\nLast 10 raw lines:")
    for l in lines[-10:]:
        print(repr(l.strip()))

# Check state
import json
state_path = r"c:\DASHBOARD\monitor\monitor_state.json"
with open(state_path, "r") as f:
    state = json.load(f)
print(f"\nMonitor state last_pos for Router Central: {state.get('Router Central', {}).get('last_pos', 'N/A')}")
print(f"File size: {size}")
if size > state.get('Router Central', {}).get('last_pos', 0):
    print(f"[!] NEW DATA: {size - state.get('Router Central', {}).get('last_pos', 0)} bytes unread!")
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        f.seek(state.get('Router Central', {}).get('last_pos', 0))
        new_lines = f.readlines()
    print("Unread lines:")
    for l in new_lines:
        print("  ", repr(l.strip()))
else:
    print("No new data since last monitor read.")
