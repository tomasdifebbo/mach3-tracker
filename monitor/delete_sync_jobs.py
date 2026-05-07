"""
Deleta os 373 jobs criados hoje pelo sync (duplicados).
Mantém os 200 jobs originais.
"""
import requests, json, datetime, time

BASE_URL = "https://mach3-tracker-production.up.railway.app"

with open("config.json") as f:
    config = json.load(f)

token = config["token"]
headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

# Buscar todos os jobs
resp = requests.get(f"{BASE_URL}/api/jobs?limit=9999", headers=headers, timeout=30)
all_jobs = resp.json() if isinstance(resp.json(), list) else resp.json().get("jobs", [])
print(f"Total de jobs: {len(all_jobs)}")

today = datetime.datetime.now().strftime("%Y-%m-%d")

# Filtrar jobs criados hoje
jobs_to_delete = []
for j in all_jobs:
    created = j.get("createdAt", "") or j.get("created_at", "") or ""
    if today in created:
        jobs_to_delete.append(j)

print(f"Jobs a deletar (criados hoje): {len(jobs_to_delete)}")

deleted = 0
errors = 0
for i, j in enumerate(jobs_to_delete):
    jid = j.get("id")
    try:
        resp = requests.delete(f"{BASE_URL}/api/jobs/{jid}", headers=headers, timeout=10)
        if resp.status_code in (200, 204):
            deleted += 1
        elif resp.status_code == 404:
            deleted += 1  # Ja foi deletado
        else:
            errors += 1
            print(f"  ERRO deletando ID={jid}: {resp.status_code} - {resp.text[:100]}")
        
        if (i+1) % 50 == 0:
            print(f"  Progresso: {i+1}/{len(jobs_to_delete)} (deletados={deleted}, erros={errors})")
    except Exception as e:
        errors += 1
        print(f"  FALHA ID={jid}: {e}")
    
    time.sleep(0.1)

print(f"\n{'='*50}")
print(f"CONCLUIDO: {deleted} deletados, {errors} erros")

# Verificar total final
resp = requests.get(f"{BASE_URL}/api/jobs?limit=9999", headers=headers, timeout=30)
final_jobs = resp.json() if isinstance(resp.json(), list) else resp.json().get("jobs", [])
print(f"Total de jobs apos limpeza: {len(final_jobs)}")
