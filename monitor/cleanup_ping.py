import requests
import json

BASE_URL = "https://mach3-tracker-production.up.railway.app"
EMAIL = "casadotrem@gmail.com"
PASSWORD = "123456"

# Login
r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": EMAIL, "password": PASSWORD})
token = r.json()["token"]
headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

# 1. Delete all "PING" jobs
jobs = requests.get(f"{BASE_URL}/api/jobs", headers=headers).json()
for j in jobs:
    if j.get("file_name") == "PING":
        requests.delete(f"{BASE_URL}/api/jobs/{j['id']}", headers=headers)
        print(f"Deleted PING job {j['id']}")

# 2. Force start the correct Router 2 job
payload = {
    "file_name": "1 pvc100mm b10mm.txt",
    "folder": "Router 2 | ISOPOR",
    "start_time": "2026-04-16T14:55:00.000Z",
    "router_name": "Router 2"
}
requests.post(f"{BASE_URL}/api/jobs", json=payload, headers=headers)
print("Started Router 2 with correct name")
