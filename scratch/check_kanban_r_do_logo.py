import requests, json

config = json.load(open(r"c:\DASHBOARD\monitor\config.json"))
url = config.get("server_url", "https://mach3-tracker.onrender.com")
headers = {"Authorization": f"Bearer {config.get('token')}", "Content-Type": "application/json"}

r = requests.get(f"{url}/api/kanban", headers=headers)
tasks = r.json()

print("=== ALL KANBAN TASKS IN DB ===")
for t in tasks:
    print(f"ID #{t['id']} | title: '{t.get('title')}' | col: '{t.get('column_id')}' | machine: '{t.get('machine')}' | op: '{t.get('operator')}'")
