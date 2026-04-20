import requests
import json
import time

BASE_URL = "https://mach3-tracker-production.up.railway.app"
EMAIL = "casadotrem@gmail.com"
PASSWORD = "123456"

def sync():
    # Login
    print("[*] Autenticando...")
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": EMAIL, "password": PASSWORD})
    token = r.json()["token"]
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    # 1. Cleanup "PING" and "TEST"
    print("[*] Limpando registros de teste...")
    jobs = requests.get(f"{BASE_URL}/api/jobs", headers=headers).json()
    for j in jobs:
        if j.get("file_name") in ["PING", "TEST", "TEST_ROUTER_2"] or "PING" in j.get("file_name", "").upper():
            print(f"[-] Deletando job #{j['id']} ({j['file_name']})")
            requests.delete(f"{BASE_URL}/api/jobs/{j['id']}", headers=headers)

    # 2. Force Start Machine 1 (Router Central)
    print("[*] Forçando Início Máquina 1...")
    payload1 = {
        "file_name": "2 pvc100mm b10mm.txt",
        "folder": "Router Central | ISOPOR",
        "router_name": "Router Central"
    }
    requests.post(f"{BASE_URL}/api/jobs", json=payload1, headers=headers)

    # 3. Force Start Machine 2 (Router 2)
    print("[*] Forçando Início Máquina 2...")
    payload2 = {
        "file_name": "1 pvc100mm b10mm.txt",
        "folder": "Router 2 | ISOPOR",
        "router_name": "Router 2"
    }
    requests.post(f"{BASE_URL}/api/jobs", json=payload2, headers=headers)

    print("[v] Sincronização de Emergência Concluída!")

if __name__ == "__main__":
    sync()
