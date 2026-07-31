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
    res = requests.get(f"{server_url}/api/routers", headers=headers)
    print("ROUTERS IN DB:")
    print(json.dumps(res.json(), indent=2))
except Exception as e:
    print("Error:", e)
