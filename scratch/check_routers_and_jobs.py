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

try:
    print("--- ROUTERS ---")
    res_r = requests.get(f"{server_url}/api/routers", headers=headers)
    print(json.dumps(res_r.json(), indent=2))

    print("\n--- ACTIVE JOBS ---")
    res_j = requests.get(f"{server_url}/api/jobs", headers=headers)
    jobs = res_j.json()
    active_jobs = [j for j in jobs if not j.get('end_time')]
    print(json.dumps(active_jobs, indent=2))

except Exception as e:
    print("Error:", e)
