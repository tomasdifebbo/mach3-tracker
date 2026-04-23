import requests, json, datetime, time

BASE_URL = "https://mach3-tracker-production.up.railway.app"
config = json.load(open('config.json'))
headers = {
    'Authorization': 'Bearer ' + config['token'],
    'Content-Type': 'application/json'
}

def inject_job(file_name, folder_path, start_time, end_time, router_name, estimated):
    payload_start = {
        "file_name": file_name,
        "folder": f"{router_name} | 2591 - PIRACANJUBA",
        "file_path": os.path.join(folder_path, file_name),
        "start_time": start_time,
        "router_name": router_name,
        "estimated_minutes": estimated
    }
    
    try:
        r = requests.post(f"{BASE_URL}/api/jobs", json=payload_start, headers=headers, timeout=10)
        if r.status_code in (200, 201):
            data = r.json()
            job_id = data.get('id')
            print(f"Job criado: {file_name} (ID: {job_id})")
            
            payload_end = {
                "end_time": end_time,
                "router_name": router_name
            }
            r2 = requests.patch(f"{BASE_URL}/api/jobs/latest", json=payload_end, headers=headers, timeout=10)
            if r2.status_code in (200, 204):
                print(f"  Finalizado com sucesso.")
            else:
                print(f"  Erro ao finalizar: {r2.status_code}")
        else:
            print(f"Erro ao criar: {r.status_code} - {r.text}")
    except Exception as e:
        print(f"Exceção: {e}")

import os
folder = r"E:\arquivos 2024\ARQUIVOS 2026\router\2591 - PIRACANJUBA\ROUTER\ISOPOR - SORVETE"
today = datetime.date.today().isoformat()

# Job 1
inject_job(
    "1 pvc100mm b10mm.txt",
    folder,
    f"{today}T08:30:00-03:00",
    f"{today}T09:22:00-03:00",
    "Router 2",
    51.5
)

# Job 2
inject_job(
    "2 pvc100mm b10mm.txt",
    folder,
    f"{today}T09:30:00-03:00",
    f"{today}T10:52:00-03:00",
    "Router 2",
    81.9
)
