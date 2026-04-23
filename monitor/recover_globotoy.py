import sqlite3
import requests
import time

BASE_URL = "https://mach3-tracker-production.up.railway.app"

# Login
r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "casadotrem@gmail.com", "password": "123456"})
token = r.json()["token"]
headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

# Read local DB
conn = sqlite3.connect(r"c:\mach3 tracker\server\mach3.db")
conn.row_factory = sqlite3.Row
c = conn.cursor()
c.execute("SELECT * FROM jobs ORDER BY start_time ASC")
rows = c.fetchall()

print(f"[*] Enviando {len(rows)} jobs GLOBOTOY do banco local...")

for i, row in enumerate(rows):
    job = dict(row)
    print(f"[{i+1}/{len(rows)}] {job['file_name']} | {job['folder']} | {job['start_time'][:10]}")
    
    payload = {
        "file_name": job["file_name"],
        "folder": f"Router 1 | {job['folder']}",
        "file_path": job.get("file_path", "Desconhecido"),
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
        print(f"    -> OK (ID: {new_id}) [{job['duration_minutes']:.0f} min]")
    elif new_id:
        print(f"    -> OK (ID: {new_id}) [ABERTO]")
    else:
        debounced = resp.json().get("debounced", False)
        print(f"    -> {'Ignorado (debounce)' if debounced else 'ERRO'}")
    
    time.sleep(0.3)

print(f"\n[v] GLOBOTOY recuperado com {len(rows)} jobs!")
conn.close()
