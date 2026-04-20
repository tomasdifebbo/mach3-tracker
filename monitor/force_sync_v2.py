import requests
import json

BASE_URL = "https://mach3-tracker-production.up.railway.app"
EMAIL = "casadotrem@gmail.com"
PASSWORD = "123456"

def final_sync():
    # Login
    print("[*] Autenticando...")
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": EMAIL, "password": PASSWORD})
    token = r.json()["token"]
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    # Project Name
    project = "2578g - Bancada tubo"

    # 1. Force Start Router 1
    print(f"[*] Sincronizando Router 1: {project}")
    payload1 = {
        "file_name": "2 pvc100mm b10mm.txt",
        "folder": f"Router 1 | {project}",
        "router_name": "Router 1"
    }
    requests.post(f"{BASE_URL}/api/jobs", json=payload1, headers=headers)

    # 2. Force Start Router 2
    print(f"[*] Sincronizando Router 2: {project}")
    payload2 = {
        "file_name": "1 pvc100mm b10mm.txt",
        "folder": f"Router 2 | {project}",
        "router_name": "Router 2"
    }
    requests.post(f"{BASE_URL}/api/jobs", json=payload2, headers=headers)

    print("[v] Sincronização Final Concluída!")

if __name__ == "__main__":
    final_sync()
