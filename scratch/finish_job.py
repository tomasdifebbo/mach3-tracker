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

# Update Kanban task to 'done' (Concluído) via PATCH /api/kanban/:id
try:
    res_k = requests.get(f"{server_url}/api/kanban", headers=headers)
    tasks = res_k.json()
    for t in tasks:
        if t.get('title') == '1 pvc 100mm b10mm':
            task_id = t['id']
            res_move = requests.patch(f"{server_url}/api/kanban/{task_id}", json={
                "column_id": "done"
            }, headers=headers)
            print(f"Moved Kanban Task #{task_id} to DONE:", res_move.status_code, res_move.text)
except Exception as e:
    print("Error updating Kanban task:", e)
