import requests
import json
import os
import sys

# Read config or token if available
config_path = r"c:\DASHBOARD\monitor\config.json"
if os.path.exists(config_path):
    with open(config_path, "r", encoding="utf-8") as f:
        config = json.load(f)
else:
    config = {}

server_url = config.get("server_url", "https://mach3-tracker.onrender.com")
token = config.get("token", "")

print(f"Connecting to {server_url}...")

headers = {
    "Content-Type": "application/json"
}
if token:
    headers["Authorization"] = f"Bearer {token}"

# 1. Post job to /api/jobs
job_payload = {
    "file_name": "1 pvc 100mm b10mm",
    "folder": "PARAQUEDAS - ISOPOR",
    "file_path": r"C:\CNC\1 pvc 100mm b10mm.tap",
    "router_name": "Router 2",
    "start_time": "2026-07-25T10:25:00-03:00",
    "material_name": "PVC"
}

try:
    res = requests.post(f"{server_url}/api/jobs", json=job_payload, headers=headers)
    print("Job POST response:", res.status_code, res.text)
except Exception as e:
    print("Job POST error:", e)

# 2. Post Kanban task to /api/kanban
kanban_payload = {
    "title": "1 pvc 100mm b10mm",
    "machine": "Router 2",
    "operator": "Operador",
    "priority": "alta",
    "column_id": "doing",
    "date": "2026-07-25"
}

try:
    res2 = requests.post(f"{server_url}/api/kanban", json=kanban_payload, headers=headers)
    print("Kanban POST response:", res2.status_code, res2.text)
except Exception as e:
    print("Kanban POST error:", e)
