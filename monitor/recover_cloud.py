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
c.execute("SELECT * FROM jobs ORDER BY id ASC")
rows = c.fetchall()

print(f"[*] Recuperando {len(rows)} jobs do banco local...")

# We need to insert them with their original timestamps
# The server auto-closes previous jobs, so we need to be careful
# We'll use direct POST with start_time, then PATCH to close them

for i, row in enumerate(rows):
    job = dict(row)
    print(f"[{i+1}/{len(rows)}] {job['file_name']} ({job['start_time'][:10]})")
    
    payload = {
        "file_name": job["file_name"],
        "folder": job["folder"] or "Desconhecido",
        "file_path": job.get("file_path", "Desconhecido"),
        "start_time": job["start_time"],
        "router_name": job.get("router_name"),
        "estimated_minutes": job.get("estimated_minutes")
    }
    
    resp = requests.post(f"{BASE_URL}/api/jobs", json=payload, headers=headers)
    if resp.status_code in (200, 201):
        new_id = resp.json().get("id")
        
        # If the job was completed, close it with the original end_time
        if job["end_time"] and new_id:
            patch_payload = {
                "end_time": job["end_time"],
                "router_name": job.get("router_name")
            }
            requests.patch(f"{BASE_URL}/api/jobs/latest", json=patch_payload, headers=headers)
        
        status = "FECHADO" if job["end_time"] else "ABERTO"
        print(f"    -> OK (ID: {new_id}) [{status}]")
    else:
        debounced = resp.json().get("debounced", False)
        if debounced:
            print(f"    -> Ignorado (debounce)")
        else:
            print(f"    -> ERRO: {resp.status_code} {resp.text[:100]}")
    
    time.sleep(0.3)  # Small delay to avoid overwhelming the server

print(f"\n[v] Recuperacao concluida!")
conn.close()
