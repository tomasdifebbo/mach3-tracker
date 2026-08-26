import requests, json

config = json.load(open(r"c:\DASHBOARD\monitor\config.json"))
url = config.get("server_url", "https://mach3-tracker.onrender.com")
headers = {"Authorization": f"Bearer {config.get('token')}", "Content-Type": "application/json"}

r = requests.get(f"{url}/api/jobs", headers=headers)
jobs = r.json()

laser_jobs = [j for j in jobs if j.get('router_name') == 'Laser Ruida'][:5]

print("=== Most Recent 5 Laser Ruida Jobs in DB ===")
for j in laser_jobs:
    print(f"ID #{j['id']} | file_name: '{j.get('file_name')}' | start: {j.get('start_time')}")
    print(f"  estimated_minutes: {j.get('estimated_minutes')}")
    print(f"  max_x: {j.get('max_x')} | max_y: {j.get('max_y')} | area_m2: {j.get('bounding_area_m2')}")
    print(f"  material_id: {j.get('material_id')} | material_name: '{j.get('material_name')}' | price: {j.get('material_price')}")
    print(f"  end_time: {j.get('end_time')}")
    print()
