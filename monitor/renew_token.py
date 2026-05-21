import json, os, requests

CONFIG_FILE = os.path.join(os.path.dirname(__file__), "config.json")
BASE_URL = "https://mach3-tracker.onrender.com"

config = json.load(open(CONFIG_FILE, "r"))
email = config.get("email")
password = config.get("password")

print(f"[*] Fazendo login com {email}...")
try:
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=10)
    if resp.status_code == 200:
        data = resp.json()
        config["token"] = data["token"]
        with open(CONFIG_FILE, "w") as f:
            json.dump(config, f, indent=4)
        print(f"[OK] Token renovado com sucesso!")
        
        # Verify new token
        resp2 = requests.get(f"{BASE_URL}/api/user/me",
                            headers={"Authorization": f"Bearer {data['token']}", "Content-Type": "application/json"},
                            timeout=10)
        print(f"[OK] Verificacao: {resp2.status_code} - {resp2.text[:100]}")
    else:
        print(f"[X] Erro no login: {resp.status_code} - {resp.text[:200]}")
except Exception as e:
    print(f"[X] Erro: {e}")
