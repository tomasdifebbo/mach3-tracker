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
    # 1. Close job #2530 (stuck active job from 13:08)
    print("Closing job #2530...")
    res1 = requests.patch(f"{server_url}/api/jobs/2530", json={
        "end_time": "2026-07-31T13:20:00.000Z"
    }, headers=headers)
    print("Close job #2530 result:", res1.status_code, res1.text)

    # 2. Fix router_name on job #2532 to 'Router 2' or 'Router Central'
    print("Fixing job #2532 router_name...")
    res2 = requests.patch(f"{server_url}/api/jobs/2532", json={
        "file_name": "2 PVC 100MM B10MM.TXT",
        "end_time": "2026-07-31T13:58:00.000Z" # Job finished
    }, headers=headers)
    print("Fix job #2532 result:", res2.status_code, res2.text)

except Exception as e:
    print("Error:", e)
