import requests, json

config = json.load(open(r"c:\DASHBOARD\monitor\config.json"))
url = config.get("server_url", "https://mach3-tracker.onrender.com")
headers = {"Authorization": f"Bearer {config.get('token')}", "Content-Type": "application/json"}

r = requests.get(f"{url}/api/jobs", headers=headers)
jobs = r.json()

laser_jobs = [j for j in jobs if j.get('router_name') == 'Laser Ruida'][:3]

print("=== CURRENT LASER RUIDA JOBS ===")
for j in laser_jobs:
    print(f"ID #{j['id']} | file_name: '{j.get('file_name')}' | start: {j.get('start_time')} | end: {j.get('end_time')}")
    print(f"  est_min: {j.get('estimated_minutes')} | area_m2: {j.get('bounding_area_m2')}")
