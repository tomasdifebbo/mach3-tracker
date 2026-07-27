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

# Update job and kanban for royal enfield with estimated_minutes = 45
try:
    res = requests.get(f"{server_url}/api/jobs", headers=headers)
    jobs = res.json()
    for j in jobs:
        if 'royal enfield' in j.get('file_name', '').lower() or '2629' in j.get('file_name', '').lower():
            if not j.get('end_time'): # active job
                job_id = j['id']
                print(f"Setting estimated_minutes = 45 on active job #{job_id} ({j['file_name']})...")
                patch_res = requests.patch(f"{server_url}/api/jobs/{job_id}", json={
                    "estimated_minutes": 45
                }, headers=headers)
                print("Patch job result:", patch_res.status_code, patch_res.text)

    res_k = requests.get(f"{server_url}/api/kanban", headers=headers)
    tasks = res_k.json()
    for t in tasks:
        if 'royal enfield' in t.get('title', '').lower() or '2629' in t.get('title', '').lower():
            task_id = t['id']
            print(f"Setting estimated_minutes = 45 on Kanban task #{task_id}...")
            patch_k = requests.patch(f"{server_url}/api/kanban/{task_id}", json={
                "estimated_minutes": 45
            }, headers=headers)
            print("Patch kanban result:", patch_k.status_code, patch_k.text)
except Exception as e:
    print("Error:", e)
