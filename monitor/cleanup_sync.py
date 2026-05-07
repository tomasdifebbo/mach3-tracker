"""
Identifica e remove os jobs duplicados/falsos criados pelo sync_missing_v2.py
Mantém apenas os jobs legítimos (que existiam antes da sincronização).
"""
import requests, json, datetime

BASE_URL = "https://mach3-tracker-production.up.railway.app"

with open("config.json") as f:
    config = json.load(f)

token = config["token"]
headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

# Buscar todos os jobs
resp = requests.get(f"{BASE_URL}/api/jobs?limit=9999", headers=headers, timeout=30)
all_jobs = resp.json() if isinstance(resp.json(), list) else resp.json().get("jobs", [])
print(f"Total de jobs no cloud: {len(all_jobs)}")

# Separar jobs criados HOJE (pela sync) vs jobs antigos
# Os jobs criados pelo sync terão createdAt de hoje
today = datetime.datetime.now().strftime("%Y-%m-%d")
print(f"Data de hoje: {today}")

jobs_today = []
jobs_old = []

for j in all_jobs:
    created = j.get("createdAt", "") or j.get("created_at", "") or ""
    if today in created:
        jobs_today.append(j)
    else:
        jobs_old.append(j)

print(f"Jobs criados HOJE (sync): {len(jobs_today)}")
print(f"Jobs antigos (manter): {len(jobs_old)}")

# Mostrar amostra dos jobs de hoje
print("\n--- Amostra dos jobs criados hoje ---")
for j in jobs_today[:5]:
    print(f"  ID={j.get('id')} | {j.get('start_time','?')[:16]} | {j.get('router_name','?')} | {j.get('file_name','?')}")
print(f"  ... e mais {len(jobs_today)-5} jobs")

# Confirmar antes de deletar
print(f"\n[!] Vou DELETAR {len(jobs_today)} jobs criados hoje pelo sync.")
print(f"[!] Os {len(jobs_old)} jobs antigos serao mantidos.")

# Verificar se tem endpoint de delete
test_resp = requests.delete(f"{BASE_URL}/api/jobs/99999", headers=headers, timeout=5)
print(f"\nTeste endpoint delete: status={test_resp.status_code}")
if test_resp.status_code == 405:
    print("[!] Endpoint DELETE nao existe. Vou tentar outra abordagem.")
