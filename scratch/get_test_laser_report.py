import requests, json, datetime

config = json.load(open(r"c:\DASHBOARD\monitor\config.json"))
url = config.get("server_url", "https://mach3-tracker.onrender.com")
headers = {"Authorization": f"Bearer {config.get('token')}", "Content-Type": "application/json"}

r = requests.get(f"{url}/api/jobs", headers=headers)
jobs = r.json()

laser_jobs = [j for j in jobs if j.get('router_name') == 'Laser Ruida'][:5]

print("=== RECENT LASER RUIDA JOBS IN DB ===")
for j in laser_jobs:
    print(f"ID #{j['id']} | file_name: '{j.get('file_name')}'")
    print(f"  start_time: {j.get('start_time')}")
    print(f"  end_time:   {j.get('end_time')}")
    print(f"  duration:   {j.get('duration_minutes')} min")
    print(f"  max_x:      {j.get('max_x')} mm | max_y: {j.get('max_y')} mm")
    print(f"  area_m2:    {j.get('bounding_area_m2')} m²")
    print(f"  material:   {j.get('material_name')} (R$ {j.get('material_price')})")
    print("-" * 50)
