import requests
import json
import os

config_path = r"c:\DASHBOARD\monitor\config.json"
with open(config_path, "r", encoding="utf-8") as f:
    config = json.load(f)

server_url = config.get("server_url", "https://mach3-tracker.onrender.com")
token = config.get("token", "")
headers = {"Content-Type": "application/json"}
if token:
    headers["Authorization"] = f"Bearer {token}"

# Create the active job for Router Central
print("Creating active job for Router Central - 3 pvc 100mm b10mm.txt...")
res = requests.post(f"{server_url}/api/jobs", json={
    "file_name": "3 pvc 100mm b10mm.txt",
    "folder": "2624D - CADEIRANTE + GATO 1",
    "file_path": "\\\\TOMAS\\arquivos 2024\\ARQUIVOS 2026\\router\\2624D - CADEIRANTE + GATO 1,35\\ROUTER\\ISOPOR\\3 pvc 100mm b10mm.txt",
    "start_time": "2026-07-31T14:15:49.000Z",
    "router_name": "Router Central"
}, headers=headers)
print("Result:", res.status_code, res.text)

# Also close the old FIM events that were missed (2 pvc 100mm b10mm.txt jobs) 
# They should already be closed, but let's verify
print("\nAll active jobs now:")
res2 = requests.get(f"{server_url}/api/jobs", headers=headers)
jobs = res2.json()
active = [j for j in jobs if not j.get('end_time')]
for j in active:
    print(f"  #{j['id']} | {j.get('router_name')} | {j.get('file_name')} | start: {j.get('start_time')}")

print("\nRouter statuses:")
res3 = requests.get(f"{server_url}/api/routers", headers=headers)
for r in res3.json():
    print(f"  {r['name']}: status={r['status']}, current_job={r.get('current_job')}")
