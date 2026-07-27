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

# Fetch Kanban tasks
try:
    res = requests.get(f"{server_url}/api/kanban", headers=headers)
    tasks = res.json()
    for t in tasks:
        if 'royal enfield' in t.get('title', '').lower() or '2629' in t.get('title', '').lower():
            task_id = t['id']
            print(f"Found task #{task_id}: {t['title']} | Column: {t['column_id']} | Machine: {t.get('machine')}")
            # Patch task to 'doing' (Em Andamento)
            patch_res = requests.patch(f"{server_url}/api/kanban/{task_id}", json={
                "column_id": "doing",
                "machine": t.get('machine') or "Router Central"
            }, headers=headers)
            print("Patch task result:", patch_res.status_code, patch_res.text)
except Exception as e:
    print("Error:", e)
