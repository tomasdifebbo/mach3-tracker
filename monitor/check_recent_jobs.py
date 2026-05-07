import requests, json

BASE_URL = "https://mach3-tracker-production.up.railway.app"
with open("config.json") as f:
    config = json.load(f)

token = config["token"]
headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

resp = requests.get(f"{BASE_URL}/api/jobs?limit=15", headers=headers, timeout=10)
data = resp.json()
jobs = data if isinstance(data, list) else data.get("jobs", [])

print(f"=== ULTIMOS {len(jobs)} JOBS NO DASHBOARD ===\n")
for j in jobs:
    st = j.get("start_time", "?")[:16] if j.get("start_time") else "?"
    et = j.get("end_time", "?")[:16] if j.get("end_time") else "em andamento"
    print(f"  {st} | {j.get('router_name','?'):15} | {j.get('file_name','?'):40} | fim={et}")
