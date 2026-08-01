import os, json, datetime

# Current time
now = datetime.datetime.now()
print(f"Current local time: {now.strftime('%H:%M:%S')}")
print(f"Current UTC time: {datetime.datetime.utcnow().strftime('%H:%M:%S')}")

# Check Router Central log for any new lines
path_rc = r"\\DESKTOP-1CSKMNT\Mach3\log_oficial.csv"
size_rc = os.path.getsize(path_rc)
state = json.load(open(r"c:\DASHBOARD\monitor\monitor_state.json"))
last_pos_rc = state.get("Router Central", {}).get("last_pos", 0)
print(f"\nRouter Central: file_size={size_rc}, last_pos={last_pos_rc}, new_bytes={size_rc - last_pos_rc}")

if size_rc > last_pos_rc:
    with open(path_rc, "r", encoding="utf-8", errors="ignore") as f:
        f.seek(last_pos_rc)
        new = f.read()
    print(f"NEW LINES:\n{new}")

# Check Router 2 log for any new lines
path_r2 = r"\\ACT10\Mach3\log_oficial.csv"
size_r2 = os.path.getsize(path_r2)
last_pos_r2 = state.get("Router 2", {}).get("last_pos", 0)
print(f"\nRouter 2: file_size={size_r2}, last_pos={last_pos_r2}, new_bytes={size_r2 - last_pos_r2}")

if size_r2 > last_pos_r2:
    with open(path_r2, "r", encoding="utf-8", errors="ignore") as f:
        f.seek(last_pos_r2)
        new = f.read()
    print(f"NEW LINES:\n{new}")

# Verify: does the active job start time match what's expected?
print(f"\nJob #2538 start_time (UTC): 2026-07-31T14:15:49.000Z")
print(f"Expected local display: 11:15:49 BRT")
print(f"Elapsed since 11:15:49 = {(now - datetime.datetime(2026, 7, 31, 11, 15, 49)).total_seconds() / 60:.1f} min")
