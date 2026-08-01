import requests, json, datetime

c = json.load(open(r"c:\DASHBOARD\monitor\config.json"))
h = {"Authorization": "Bearer " + c["token"]}

r = requests.get("https://mach3-tracker.onrender.com/api/jobs", headers=h)
jobs = r.json()

# Compare how our manually created jobs look vs monitor-created ones
print("=== Manually created jobs (today, Router Central & Router 2) ===")
for j in jobs:
    if j.get('router_name') in ('Router Central', 'Router 2') and '2026-07-31' in str(j.get('start_time', '')):
        print(f"  #{j['id']} | {j.get('router_name')} | {j.get('file_name')}")
        print(f"    start_time: {j.get('start_time')}")
        print(f"    end_time: {j.get('end_time')}")
        print()

# Also check a monitor-created job from today for comparison  
print("=== Monitor-created jobs (Laser Ruida today) ===")
for j in jobs:
    if j.get('router_name') == 'Laser Ruida' and '2026-07-31' in str(j.get('start_time', '')):
        print(f"  #{j['id']} | {j.get('router_name')} | {j.get('file_name')}")
        print(f"    start_time: {j.get('start_time')}")
        print(f"    end_time: {j.get('end_time')}")
        print()

# Show what the monitor would have generated
print("=== parse_mach3_time simulation ===")
dt = datetime.datetime.strptime("31/07/2026 11:15:49", "%d/%m/%Y %H:%M:%S")
local_iso = dt.astimezone().isoformat()
print(f"parse_mach3_time('31/07/2026', '11:15:49') = {local_iso}")

dt2 = datetime.datetime.strptime("31/07/2026 10:08:38", "%d/%m/%Y %H:%M:%S")
local_iso2 = dt2.astimezone().isoformat()
print(f"parse_mach3_time('31/07/2026', '10:08:38') = {local_iso2}")
