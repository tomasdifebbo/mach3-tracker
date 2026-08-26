import requests, json

config = json.load(open(r"c:\DASHBOARD\monitor\config.json"))
url = config.get("server_url", "https://mach3-tracker.onrender.com")
headers = {"Authorization": f"Bearer {config.get('token')}", "Content-Type": "application/json"}

# Fetch all kanban tasks
r = requests.get(f"{url}/api/kanban", headers=headers)
tasks = r.json()

print("=== CLEANING STUCK DOING CARDS ===")
for t in tasks:
    if t.get('column_id') == 'doing' and t.get('title') != 'LETRAS ROYAL ENFIELD':
        print(f"Moving card #{t['id']} '{t.get('title')}' -> DONE")
        requests.patch(f"{url}/api/kanban/{t['id']}", json={"column_id": "done"}, headers=headers)

print("Done!")
