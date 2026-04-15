import os
import requests
import datetime
import time

BASE_URL = "https://mach3-tracker-production.up.railway.app"
LOG_FILE = r"\\DESKTOP-1CSKMNT\Mach3\log_oficial.csv"
EMAIL = "casadotrem@gmail.com"
PASSWORD = "123456"

def get_token():
    try:
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={"email": EMAIL, "password": PASSWORD})
        if resp.status_code == 200:
            return resp.json()["token"]
    except Exception as e:
        print(f"Erro login: {e}")
    return None

def parse_mach3_time(data_str, hora_str):
    try:
        dt = datetime.datetime.strptime(f"{data_str.strip()} {hora_str.strip()}", "%d/%m/%Y %H:%M:%S")
        return dt.astimezone().isoformat()
    except:
        return None

def recover():
    token = get_token()
    if not token: return print("Falha no login.")
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    print(f"Lendo log: {LOG_FILE}")
    if not os.path.exists(LOG_FILE):
        return print("Arquivo não encontrado.")

    with open(LOG_FILE, 'r', encoding='utf-8', errors='ignore') as f:
        lines = f.readlines()

    print(f"Processando {len(lines)} linhas...")
    count = 0
    for line in lines:
        if not line.strip(): continue
        parts = line.strip().split(',')
        if len(parts) >= 4:
            data_str, hora_str, caminho_completo = parts[0], parts[1], parts[2]
            tipo = parts[-1].strip().upper()
            router_name = "Router Central"
            if len(parts) >= 5:
                router_name = parts[-2].strip()
            
            iso_time = parse_mach3_time(data_str, hora_str)
            if not iso_time: continue

            nome_arquivo = caminho_completo.split("\\")[-1] if "\\" in caminho_completo else caminho_completo
            
            if "INICIO" in tipo:
                payload = {
                    "file_name": nome_arquivo,
                    "folder": f"{router_name} | {caminho_completo}",
                    "file_path": caminho_completo,
                    "start_time": iso_time,
                    "router_name": router_name
                }
                requests.post(f"{BASE_URL}/api/jobs", json=payload, headers=headers)
                time.sleep(0.1)
                count += 1
            elif "FIM" in tipo:
                payload = {"end_time": iso_time, "router_name": router_name}
                requests.patch(f"{BASE_URL}/api/jobs/latest", json=payload, headers=headers)
                time.sleep(0.1)
                count += 1

    print(f"Recuperação finalizada. {count} eventos enviados.")

if __name__ == "__main__":
    recover()
