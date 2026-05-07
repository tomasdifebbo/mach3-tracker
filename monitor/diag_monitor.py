import os, json

STATE_FILE = os.path.join(os.path.dirname(__file__), "monitor_state.json")
CONFIG_FILE = os.path.join(os.path.dirname(__file__), "config.json")

# Load state
with open(STATE_FILE, "r") as f:
    state = json.load(f)

with open(CONFIG_FILE, "r") as f:
    config = json.load(f)

print("=== DIAGNOSTICO DO MONITOR ===\n")

for router in config["routers"]:
    name = router["name"]
    path = router["log_file"]
    last_pos = state.get(name, {}).get("last_pos", 0)
    
    print(f"--- {name} ---")
    print(f"  Log path: {path}")
    print(f"  Exists: {os.path.exists(path)}")
    
    if os.path.exists(path):
        current_size = os.path.getsize(path)
        print(f"  Current size: {current_size}")
        print(f"  Last position: {last_pos}")
        print(f"  Bytes pendentes: {current_size - last_pos}")
        
        if current_size > last_pos:
            with open(path, 'r', encoding='cp1252', errors='replace') as f:
                f.seek(last_pos)
                new_lines = f.readlines()
            print(f"  Linhas novas nao processadas: {len(new_lines)}")
            print(f"  Conteudo pendente:")
            for line in new_lines:
                print(f"    >> {line.strip()}")
    else:
        print(f"  ARQUIVO NAO ENCONTRADO!")
    print()

# Check token
import requests
BASE_URL = "https://mach3-tracker-production.up.railway.app"
token = config.get("token", "")
print("--- Token JWT ---")
try:
    resp = requests.get(f"{BASE_URL}/api/user/me",
                        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                        timeout=5)
    print(f"  Status: {resp.status_code}")
    if resp.status_code == 200:
        print(f"  Token VALIDO: {resp.json()}")
    else:
        print(f"  Token INVALIDO/EXPIRADO: {resp.text}")
except Exception as e:
    print(f"  Erro de conexao: {e}")

# Check server health
print("\n--- Servidor Cloud ---")
try:
    resp = requests.get(f"{BASE_URL}/health", timeout=5)
    print(f"  Status: {resp.status_code}")
    print(f"  Response: {resp.text[:200]}")
except Exception as e:
    print(f"  OFFLINE: {e}")
