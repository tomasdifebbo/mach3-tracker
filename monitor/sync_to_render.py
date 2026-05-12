"""
Sincroniza os dados do banco local (mach3.db) para o novo servidor Render.
Envia todos os jobs e materiais existentes.
"""
import sqlite3
import requests
import json
import time
import os

RENDER_URL = "https://mach3-tracker.onrender.com"

with open("config.json") as f:
    config = json.load(f)

token = config["token"]
headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

# Verificar conexão
r = requests.get(f"{RENDER_URL}/health", timeout=10)
print(f"Render health: {r.status_code} - {r.text}")

# Verificar quantos jobs já existem no Render
r = requests.get(f"{RENDER_URL}/api/jobs", headers=headers, timeout=10)
render_jobs = r.json() if isinstance(r.json(), list) else r.json().get("jobs", [])
print(f"Jobs no Render: {len(render_jobs)}")

if len(render_jobs) > 10:
    print("[!] Render já tem jobs. Abortando para evitar duplicatas.")
    exit(0)

# Ler banco local
db_path = os.path.join(os.path.dirname(__file__), "..", "server", "mach3.db")
if not os.path.exists(db_path):
    print(f"[X] Banco local não encontrado: {db_path}")
    exit(1)

db = sqlite3.connect(db_path)
db.row_factory = sqlite3.Row

# Sincronizar jobs
jobs = db.execute("SELECT * FROM jobs ORDER BY id ASC").fetchall()
print(f"\nJobs no banco local: {len(jobs)}")

synced = 0
errors = 0
for i, job in enumerate(jobs):
    payload = {
        "file_name": job["file_name"],
        "folder": job["folder"] or "Desconhecido",
        "file_path": job["file_path"] or "",
        "start_time": job["start_time"],
        "router_name": job["router_name"],
        "material_id": job["material_id"],
        "material_name": job["material_name"],
        "material_price": job["material_price"],
    }
    
    try:
        resp = requests.post(f"{RENDER_URL}/api/jobs", json=payload, headers=headers, timeout=10)
        if resp.status_code in (200, 201):
            data = resp.json()
            new_id = data.get("id")
            
            # Se tem end_time, fechar o job
            if job["end_time"]:
                requests.patch(
                    f"{RENDER_URL}/api/jobs/{new_id}",
                    json={"end_time": job["end_time"]},
                    headers=headers, timeout=10
                )
            synced += 1
        else:
            errors += 1
            if (i+1) % 20 == 0 or errors <= 3:
                print(f"  ERRO [{i+1}]: {resp.status_code} - {resp.text[:80]}")
    except Exception as e:
        errors += 1
        print(f"  FALHA [{i+1}]: {e}")
    
    if (i+1) % 50 == 0:
        print(f"  Progresso: {i+1}/{len(jobs)} (ok={synced}, err={errors})")
    
    time.sleep(0.2)

print(f"\n{'='*50}")
print(f"SYNC COMPLETO: {synced} jobs enviados, {errors} erros")

# Verificar total final
r = requests.get(f"{RENDER_URL}/api/jobs", headers=headers, timeout=10)
final = r.json() if isinstance(r.json(), list) else r.json().get("jobs", [])
print(f"Jobs no Render agora: {len(final)}")

db.close()
