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

headers = {"Content-Type": "application/json"}
if token:
    headers["Authorization"] = f"Bearer {token}"

try:
    res = requests.get(f"{server_url}/api/jobs", headers=headers)
    jobs = res.json()
    print("Most recent 10 jobs in DB:")
    for j in jobs[:10]:
        print(f"ID #{j['id']} | file_name: '{j.get('file_name')}' | folder: '{j.get('folder')}' | router: '{j.get('router_name')}' | start: {j.get('start_time')} | end: {j.get('end_time')}")
except Exception as e:
    print("Error:", e)
