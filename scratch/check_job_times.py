import requests, json

c = json.load(open(r"c:\DASHBOARD\monitor\config.json"))
h = {"Authorization": "Bearer " + c["token"]}

# Check active jobs with their times
r = requests.get("https://mach3-tracker.onrender.com/api/jobs", headers=h)
jobs = r.json()
active = [j for j in jobs if not j.get('end_time')]
print("Active jobs with times:")
for j in active:
    print(f"  #{j['id']} | {j.get('router_name')} | {j.get('file_name')}")
    print(f"    start_time: {j.get('start_time')}")
    print()

# Check the recent closed Router Central jobs too
rc_jobs = [j for j in jobs if j.get('router_name') == 'Router Central'][:5]
print("Recent Router Central jobs:")
for j in rc_jobs:
    print(f"  #{j['id']} | file: {j.get('file_name')} | start: {j.get('start_time')} | end: {j.get('end_time')}")
