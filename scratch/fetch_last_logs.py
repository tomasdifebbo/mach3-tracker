import requests
import json
import os

# 1. Check local monitor.log if present
monitor_log_path = r"c:\DASHBOARD\monitor\monitor.log"
print("=== ÚLTIMAS 20 LINHAS DO MONITOR.LOG LOCAL ===")
if os.path.exists(monitor_log_path):
    with open(monitor_log_path, "r", encoding="utf-8", errors="ignore") as f:
        lines = f.readlines()
        for line in lines[-20:]:
            print(line.strip())
else:
    print("Arquivo monitor.log não encontrado no servidor local.")

# 2. Check API jobs endpoint for Router 1 / Router Central and Router 2
config_path = r"c:\DASHBOARD\monitor\config.json"
if os.path.exists(config_path):
    with open(config_path, "r", encoding="utf-8") as f:
        config = json.load(f)
else:
    config = {}

server_url = config.get("server_url", "https://mach3-tracker.onrender.com")
token = config.get("token", "")

headers = {"Content-Type": "application/json"}
if token:
    headers["Authorization"] = f"Bearer {token}"

try:
    print("\n=== ÚLTIMOS TRABALHOS GRAVADOS NO BANCO DE DADOS (ROUTER 1 E ROUTER 2) ===")
    res = requests.get(f"{server_url}/api/jobs", headers=headers)
    if res.status_code == 200:
        jobs = res.json()
        r1_jobs = [j for j in jobs if '1' in str(j.get('router_name')) or 'central' in str(j.get('router_name')).lower()][:5]
        r2_jobs = [j for j in jobs if '2' in str(j.get('router_name'))][:5]
        
        print("\n--- ROUTER 1 / ROUTER CENTRAL (ÚLTIMOS 5 JOBS) ---")
        for j in r1_jobs:
            print(f"ID #{j['id']} | Arquivo: {j.get('file_name')} | Pasta: {j.get('folder')} | Operador: {j.get('operator_name')} | Início: {j.get('start_time')} | Fim: {j.get('end_time')}")

        print("\n--- ROUTER 2 (ÚLTIMOS 5 JOBS) ---")
        for j in r2_jobs:
            print(f"ID #{j['id']} | Arquivo: {j.get('file_name')} | Pasta: {j.get('folder')} | Operador: {j.get('operator_name')} | Início: {j.get('start_time')} | Fim: {j.get('end_time')}")
    else:
        print("Erro na API de jobs:", res.status_code, res.text)
except Exception as e:
    print("Erro ao acessar API:", e)
