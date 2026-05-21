import os, json, requests

STATE_FILE = os.path.join(os.path.dirname(__file__), "monitor_state.json")
CONFIG_FILE = os.path.join(os.path.dirname(__file__), "config.json")
BASE_URL = "https://mach3-tracker.onrender.com"

state = json.load(open(STATE_FILE, "r"))
config = json.load(open(CONFIG_FILE, "r"))

print("=" * 50)
print("  DIAGNOSTICO RAPIDO - MACH3 MONITOR")
print("=" * 50)

# 1. Check routers
print("\n--- ROUTERS ---")
for r in config["routers"]:
    name = r["name"]
    path = r["log_file"]
    last_pos = state.get(name, {}).get("last_pos", 0)
    exists = os.path.exists(path)
    print(f"  {name}:")
    print(f"    Path: {path}")
    print(f"    Existe: {exists}")
    if exists:
        size = os.path.getsize(path)
        pendente = size - last_pos
        print(f"    Tamanho: {size} bytes")
        print(f"    Ultima posicao: {last_pos}")
        print(f"    Bytes pendentes: {pendente}")
        if pendente > 0:
            with open(path, 'r', encoding='cp1252', errors='replace') as f:
                f.seek(last_pos)
                lines = f.readlines()
            print(f"    Linhas pendentes: {len(lines)}")
            for line in lines[-5:]:
                print(f"      >> {line.strip()}")

# 2. Check server
print("\n--- SERVIDOR CLOUD ---")
try:
    resp = requests.get(f"{BASE_URL}/health", timeout=10)
    print(f"  Health: {resp.status_code} - {resp.text[:100]}")
except Exception as e:
    print(f"  OFFLINE: {e}")

# 3. Check token
print("\n--- TOKEN JWT ---")
token = config.get("token", "")
try:
    resp = requests.get(f"{BASE_URL}/api/user/me",
                        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                        timeout=10)
    if resp.status_code == 200:
        print(f"  Token VALIDO! User: {resp.json()}")
    else:
        print(f"  Token INVALIDO: {resp.status_code} - {resp.text[:100]}")
except Exception as e:
    print(f"  Erro: {e}")

# 4. Check recent jobs
print("\n--- ULTIMOS JOBS NA CLOUD ---")
try:
    resp = requests.get(f"{BASE_URL}/api/jobs?limit=5",
                        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                        timeout=10)
    if resp.status_code == 200:
        jobs = resp.json()
        if isinstance(jobs, list):
            for j in jobs[:5]:
                status = "ABERTO" if not j.get("end_time") else "FECHADO"
                print(f"  [{status}] {j.get('router_name','?')} | {j.get('file_name','?')} | {j.get('start_time','?')[:19]}")
        else:
            print(f"  Resposta: {str(jobs)[:200]}")
    else:
        print(f"  Erro: {resp.status_code}")
except Exception as e:
    print(f"  Erro: {e}")

# 5. Check queue
print("\n--- FILA OFFLINE ---")
queue_file = os.path.join(os.path.dirname(__file__), "fila_sincronizacao.json")
try:
    queue = json.load(open(queue_file, "r"))
    print(f"  Itens na fila: {len(queue)}")
except:
    print(f"  Fila vazia ou inexistente")

print("\n" + "=" * 50)
print("  RESULTADO: ", end="")
print("TUDO OK - PODE INICIAR O MONITOR" if token else "PRECISA CONFIGURAR TOKEN")
print("=" * 50)
