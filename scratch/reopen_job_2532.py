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
    print("Re-opening active job #2532 on Router Central...")
    res = requests.patch(f"{server_url}/api/jobs/2532", json={
        "end_time": None,
        "router_name": "Router Central",
        "operator_name": "Brenno"
    }, headers=headers)
    print("Reopen result:", res.status_code, res.text)
except Exception as e:
    print("Error:", e)
