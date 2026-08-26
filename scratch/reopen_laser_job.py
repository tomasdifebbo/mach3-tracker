import requests, json

config = json.load(open(r"c:\DASHBOARD\monitor\config.json"))
url = config.get("server_url", "https://mach3-tracker.onrender.com")
headers = {"Authorization": f"Bearer {config.get('token')}", "Content-Type": "application/json"}

# Reopen job #2644 (set end_time = null, duration_minutes = null)
r = requests.patch(f"{url}/api/jobs/2644", json={
    "end_time": None,
    "duration_minutes": None
}, headers=headers)

print("Reopen Job Result:", r.status_code, r.text)
