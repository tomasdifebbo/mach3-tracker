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

try:
    res = requests.get(f"{server_url}/api/kanban", headers=headers)
    tasks = res.json()
    print("Total Kanban tasks:", len(tasks))
    seen = {}
    duplicates = []
    for t in tasks:
        title = t['title'].strip().lower()
        if title in seen:
            duplicates.append(t)
            print(f"DUPLICATE FOUND: ID #{t['id']} | Title: '{t['title']}' | Column: {t['column_id']}")
        else:
            seen[title] = t['id']
            print(f"Task #{t['id']}: '{t['title']}' | Column: {t['column_id']} | Machine: {t.get('machine')}")

    # Delete duplicates if found
    for d in duplicates:
        print(f"Deleting duplicate task #{d['id']} ('{d['title']}')...")
        del_res = requests.delete(f"{server_url}/api/kanban/{d['id']}", headers=headers)
        print("Delete result:", del_res.status_code, del_res.text)

except Exception as e:
    print("Error:", e)
