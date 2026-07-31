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
    res = requests.get(f"{server_url}/api/jobs", headers=headers)
    jobs = res.json()
    active_jobs = [j for j in jobs if not j.get('end_time')]
    print(f"Total Active Jobs: {len(active_jobs)}")
    for j in active_jobs:
        print(f"ID #{j['id']} | router_name: '{j.get('router_name')}' | file_name: '{j.get('file_name')}' | folder: '{j.get('folder')}' | start_time: {j.get('start_time')} | est_min: {j.get('estimated_minutes')}")
except Exception as e:
    print("Error:", e)
