"""
Limpa TODOS os jobs do Render e resincroniza corretamente.
"""
import requests, json, time

RENDER_URL = "https://mach3-tracker.onrender.com"
with open("config.json") as f:
    config = json.load(f)

token = config["token"]
headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

# Buscar todos
r = requests.get(f"{RENDER_URL}/api/jobs", headers=headers, timeout=30)
jobs = r.json() if isinstance(r.json(), list) else []
print(f"Jobs a deletar: {len(jobs)}")

# Deletar todos
deleted = 0
for i, j in enumerate(jobs):
    try:
        r = requests.delete(f"{RENDER_URL}/api/jobs/{j['id']}", headers=headers, timeout=10)
        if r.status_code in (200, 204): deleted += 1
    except: pass
    if (i+1) % 100 == 0: print(f"  {i+1}/{len(jobs)}")
    time.sleep(0.05)

print(f"Deletados: {deleted}")

# Verificar
r = requests.get(f"{RENDER_URL}/api/jobs", headers=headers, timeout=10)
final = r.json() if isinstance(r.json(), list) else []
print(f"Jobs restantes: {len(final)}")
