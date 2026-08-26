import requests, json, datetime

config = json.load(open(r"c:\DASHBOARD\monitor\config.json"))
url = config.get("server_url", "https://mach3-tracker.onrender.com")
headers = {"Authorization": f"Bearer {config.get('token')}", "Content-Type": "application/json"}

# Close job #2664
now_iso = datetime.datetime.now().astimezone().isoformat()
r = requests.patch(f"{url}/api/jobs/2664", json={
    "end_time": now_iso,
    "duration_minutes": 5.66
}, headers=headers)

print("Close Job #2664 Result:", r.status_code, r.text)
