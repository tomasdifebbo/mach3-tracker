import requests
import json
import os

config_path = r"c:\DASHBOARD\monitor\config.json"
if os.path.exists(config_path):
    with open(config_path, "r", encoding="utf-8") as f:
        config = json.load(f)
else:
    config = {}

server_url = config.get("server_url", "https://mach3-tracker.onrender.com")
token = config.get("token", "")

headers = {
    "Content-Type": "application/json"
}
if token:
    headers["Authorization"] = f"Bearer {token}"

# Update job #2279 'chapa 1 mdf 9mm e4mm.txt' with max_x = 2687.33, max_y = 1821.91, bounding_area_m2 = 4.896
try:
    res = requests.get(f"{server_url}/api/jobs", headers=headers)
    jobs = res.json()
    for j in jobs:
        if 'chapa 1 mdf 9mm' in j.get('file_name', ''):
            job_id = j['id']
            print(f"Updating job #{job_id} ({j['file_name']})...")
            patch_res = requests.patch(f"{server_url}/api/jobs/{job_id}", json={
                "max_x": 2687.33,
                "max_y": 1821.91,
                "bounding_area_m2": 4.896
            }, headers=headers)
            print("Patch result:", patch_res.status_code, patch_res.text)
except Exception as e:
    print("Error updating job:", e)
