import requests
import json
import time

BASE_URL = "https://mach3-tracker-production.up.railway.app"
EMAIL = "casadotrem@gmail.com"
PASSWORD = "123456"

def final_sync():
    print("[*] Iniciando sincronizacao final...")
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": EMAIL, "password": PASSWORD})
    token = r.json()["token"]
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    # Project path
    project = "tartarugas ninjas \\ 2578g - Bancada tubo"

    # Job 1: Router 1
    print("[*] Enviando Router 1...")
    p1 = {
        "file_name": "2 pvc100mm b10mm.txt",
        "folder": f"Router 1 | {project}",
        "router_name": "Router 1"
    }
    requests.post(f"{BASE_URL}/api/jobs", json=p1, headers=headers)

    print("[*] Esperando 5 segundos para o servidor aceitar a segunda maquina (debounce)...")
    time.sleep(5)

    # Job 2: Router 2
    print("[*] Enviando Router 2...")
    p2 = {
        "file_name": "1 pvc100mm b10mm.txt",
        "folder": f"Router 2 | {project}",
        "router_name": "Router 2"
    }
    requests.post(f"{BASE_URL}/api/jobs", json=p2, headers=headers)

    print("[v] Sincronizacao Concluida!")

if __name__ == "__main__":
    final_sync()
