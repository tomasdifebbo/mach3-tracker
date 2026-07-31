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

# Update active Router Central job #2412 with operator_name = "Brenno"
try:
    res = requests.patch(f"{server_url}/api/jobs/2412", json={
        "operator_name": "Brenno"
    }, headers=headers)
    print("Patch active job 2412 result:", res.status_code, res.text)
except Exception as e:
    print("Error:", e)
