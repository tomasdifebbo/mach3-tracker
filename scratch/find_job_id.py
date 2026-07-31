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
    pvc_jobs = [j for j in jobs if 'pvc' in str(j.get('file_name')).lower()][:5]
    print("Recent PVC jobs:")
    for j in pvc_jobs:
        print(f"ID #{j['id']} | type: {type(j['id'])} | file_name: {j.get('file_name')} | end_time: {j.get('end_time')} | router: {j.get('router_name')}")
except Exception as e:
    print("Error:", e)
