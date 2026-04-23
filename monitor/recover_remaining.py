import sqlite3
import requests
import time

BASE_URL = "https://mach3-tracker-production.up.railway.app"

r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "casadotrem@gmail.com", "password": "123456"})
token = r.json()["token"]
headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

conn = sqlite3.connect(r"c:\mach3 tracker\server\mach3.db")
conn.row_factory = sqlite3.Row
c = conn.cursor()
c.execute("SELECT * FROM jobs WHERE id >= 35 ORDER BY start_time ASC")
rows = c.fetchall()

print(f"[*] Enviando {len(rows)} jobs restantes...")

for i, row in enumerate(rows):
    job = dict(row)
    payload = {
        "file_name": job["file_name"],
        "folder": f"Router 1 | {job['folder']}",
        "start_time": job["start_time"],
        "router_name": job.get("router_name") or "Router 1",
    }
    
    resp = requests.post(f"{BASE_URL}/api/jobs", json=payload, headers=headers)
    new_id = resp.json().get("id") if resp.status_code in (200, 201) else None
    
    if new_id and job["end_time"]:
        requests.patch(f"{BASE_URL}/api/jobs/latest", json={
            "end_time": job["end_time"],
            "router_name": job.get("router_name") or "Router 1"
        }, headers=headers)
    
    dur = job.get("duration_minutes") or 0
    print(f"[{i+1}/{len(rows)}] {job['file_name']} -> ID:{new_id} [{dur:.0f}min]")
    time.sleep(0.3)

print("[v] Concluido!")
conn.close()
