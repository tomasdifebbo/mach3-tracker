import requests, json, os

c = json.load(open(r"c:\DASHBOARD\monitor\config.json"))
h = {"Authorization": "Bearer " + c["token"], "Content-Type": "application/json"}
url = "https://mach3-tracker.onrender.com"

r = requests.get(f"{url}/api/jobs", headers=h)
jobs = r.json()

print("=== ALL Router Central + Router 2 jobs from today ===")
for j in jobs:
    if j.get('router_name') in ('Router Central', 'Router 2') and '2026-07-31' in str(j.get('start_time', '')):
        print(f"  #{j['id']} | {j.get('router_name')} | file: '{j.get('file_name')}' | folder: '{j.get('folder')}'")
        print(f"    start: {j.get('start_time')} | end: {j.get('end_time')}")
        print(f"    duration_min: {j.get('duration_minutes')} | operator: {j.get('operator_name')}")
        print()

# Also check: are there any orphaned/duplicate jobs created by the buggy parser?
print("=== Jobs with 'CADEIRANTE' or 'GATO' in file_name (misparse) ===")
for j in jobs:
    fn = str(j.get('file_name', '')).lower()
    if 'cadeirante' in fn or 'gato' in fn:
        print(f"  #{j['id']} | {j.get('router_name')} | file: '{j.get('file_name')}' | start: {j.get('start_time')} | end: {j.get('end_time')}")

# Also show the raw Mach3 log timeline for today
print("\n=== Raw Mach3 Log Timeline (Router Central - today) ===")
path_rc = r"\\DESKTOP-1CSKMNT\Mach3\log_oficial.csv"
with open(path_rc, "r", encoding="utf-8", errors="ignore") as f:
    lines = f.readlines()
for l in lines:
    if l.strip().startswith("31/07/2026"):
        print(f"  {l.strip()}")

print("\n=== Raw Mach3 Log Timeline (Router 2 - today) ===")
path_r2 = r"\\ACT10\Mach3\log_oficial.csv"
with open(path_r2, "r", encoding="utf-8", errors="ignore") as f:
    lines = f.readlines()
for l in lines:
    if l.strip().startswith("31/07/2026"):
        print(f"  {l.strip()}")
