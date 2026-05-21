import json, os, requests

CONFIG_FILE = os.path.join(os.path.dirname(__file__), "config.json")
BASE_URL = "https://mach3-tracker.onrender.com"
config = json.load(open(CONFIG_FILE, "r"))
token = config["token"]
headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

print("=== VERIFICACAO CLOUD ===\n")

# Check recent jobs
resp = requests.get(f"{BASE_URL}/api/jobs?limit=10", headers=headers, timeout=10)
if resp.status_code == 200:
    jobs = resp.json()
    if isinstance(jobs, list):
        print(f"Ultimos {len(jobs)} jobs:\n")
        for j in jobs:
            status = "ATIVO" if not j.get("end_time") else "OK"
            router = j.get("router_name", "?")
            fname = j.get("file_name", "?")
            start = j.get("start_time", "?")[:19] if j.get("start_time") else "?"
            end = j.get("end_time", "")[:19] if j.get("end_time") else "-"
            folder = j.get("folder", "?")
            print(f"  [{status:5}] {router:15} | {fname:45} | {start} -> {end}")
    else:
        print(f"Resposta inesperada: {str(jobs)[:300]}")
else:
    print(f"Erro: {resp.status_code} - {resp.text[:200]}")

# Check state
print("\n=== ESTADO DO MONITOR ===")
state = json.load(open(os.path.join(os.path.dirname(__file__), "monitor_state.json"), "r"))
for name, s in state.items():
    print(f"  {name}: posicao = {s.get('last_pos', 0)}")
