import requests, json

config = json.load(open(r"c:\DASHBOARD\monitor\config.json"))
url = config.get("server_url", "https://mach3-tracker.onrender.com")
headers = {"Authorization": f"Bearer {config.get('token')}", "Content-Type": "application/json"}

# Fetch current active job on Laser Ruida
r = requests.get(f"{url}/api/jobs", headers=headers)
jobs = r.json()
active_laser = [j for j in jobs if j.get('router_name') == 'Laser Ruida' and not j.get('end_time')]

print("Active Laser Jobs:", active_laser)

if active_laser:
    job_id = active_laser[0]['id']
    print(f"Updating active Laser Job #{job_id}...")
    # Update with estimated_minutes, max_x, max_y, area_m2
    res = requests.patch(f"{url}/api/jobs/{job_id}", json={
        "estimated_minutes": 5.5,
        "max_x": 1400.0,
        "max_y": 1010.0,
        "bounding_area_m2": 1.414
    }, headers=headers)
    print("PATCH Result:", res.status_code, res.text)
