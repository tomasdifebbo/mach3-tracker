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

# Create the active job for Router 2 that was missed
print("Creating active job for Router 2 - 1 pvc 100mm b10mm.txt...")
res = requests.post(f"{server_url}/api/jobs", json={
    "file_name": "1 pvc 100mm b10mm.txt",
    "folder": "2624D - CADEIRANTE + GATO 1",
    "file_path": "\\\\TOMAS\\arquivos 2024\\ARQUIVOS 2026\\router\\2624D - CADEIRANTE + GATO 1\\35\\ROUTER\\ISOPOR\\1 pvc 100mm b10mm.txt",
    "start_time": "2026-07-31T13:08:38.000Z",
    "router_name": "Router 2"
}, headers=headers)
print("Result:", res.status_code, res.text)

# Verify
print("\nVerifying active jobs...")
res2 = requests.get(f"{server_url}/api/jobs", headers=headers)
jobs = res2.json()
active = [j for j in jobs if not j.get('end_time')]
for j in active:
    print(f"  Active: #{j['id']} | {j.get('router_name')} | {j.get('file_name')}")

print("\nVerifying routers...")
res3 = requests.get(f"{server_url}/api/routers", headers=headers)
for r in res3.json():
    print(f"  {r['name']}: status={r['status']}, current_job={r.get('current_job')}")
