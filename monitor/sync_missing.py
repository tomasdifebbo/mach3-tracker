"""
Reprocessa o log_oficial.csv a partir de 16/04/2026 e envia os jobs faltantes pro dashboard.
O dashboard parou de receber dados após 14/04 (job ID 288).
"""
import os, json, requests, datetime, re, math, time

BASE_URL = "https://mach3-tracker-production.up.railway.app"
config = json.load(open('config.json'))
headers = {
    'Authorization': 'Bearer ' + config['token'],
    'Content-Type': 'application/json'
}

LOG_PATH = r"\\DESKTOP-1CSKMNT\Mach3\log_oficial.csv"

def parse_mach3_time(data_str, hora_str):
    try:
        dt = datetime.datetime.strptime(f"{data_str.strip()} {hora_str.strip()}", "%d/%m/%Y %H:%M:%S")
        return dt.astimezone().isoformat()
    except:
        return datetime.datetime.now().astimezone().isoformat()

def extract_project_name(caminho):
    full_parts = [p for p in caminho.split("\\") if p]
    folder_parts = full_parts[:-1] if len(full_parts) > 1 else full_parts
    skip_list = ["ROUTER", "ISOPOR", "ARQUIVO", "CNC", "ARQUIVOS", "2024", "2026", "TOMAS", "MACH3"]
    
    for p in reversed(folder_parts):
        if p.upper() not in skip_list and len(p) > 2 and "." not in p:
            return p
    return folder_parts[-1] if folder_parts else "Desconhecido"

# Ler o log
with open(LOG_PATH, 'r', encoding='cp1252', errors='replace') as f:
    lines = f.readlines()

print(f"Total de linhas no log: {len(lines)}")

# Filtrar linhas a partir de 16/04/2026
cutoff = datetime.datetime(2026, 4, 16)
pending_jobs = []

for line in lines:
    parts = line.strip().split(',')
    if len(parts) < 4:
        continue
    
    data_str = parts[0].strip()
    hora_str = parts[1].strip()
    caminho = parts[2].strip()
    tipo = parts[-1].strip().upper()
    
    try:
        dt = datetime.datetime.strptime(data_str, "%d/%m/%Y")
        if dt < cutoff:
            continue
    except:
        continue
    
    # Skip PINGs
    nome_arquivo = caminho.split("\\")[-1] if "\\" in caminho else caminho
    if "PING" in nome_arquivo.upper():
        continue
    
    iso_time = parse_mach3_time(data_str, hora_str)
    
    # Detectar router
    origem = "Router Central"
    if len(parts) >= 5:
        r_name = parts[-2].strip().upper()
        if r_name == "ACT10":
            origem = "Router 2"
        elif "ROUTER CENTRAL" in r_name:
            origem = "Router 1"
        else:
            origem = r_name or "Router Central"
    
    pending_jobs.append({
        'tipo': tipo,
        'iso_time': iso_time,
        'caminho': caminho,
        'nome_arquivo': nome_arquivo,
        'origem': origem,
        'data_str': data_str,
        'hora_str': hora_str
    })

print(f"Jobs pendentes desde 16/04: {len(pending_jobs)}")

# Agrupar em pares INICIO/FIM - ignorar INICIOs duplicados rápidos (< 5s = falso start)
real_jobs = []
current_start = None

for job in pending_jobs:
    if "INICIO" in job['tipo']:
        current_start = job
    elif "FIM" in job['tipo'] and current_start:
        # Verificar se o INICIO e FIM fazem sentido (diferença > 30 segundos)
        try:
            start_dt = datetime.datetime.fromisoformat(current_start['iso_time'])
            end_dt = datetime.datetime.fromisoformat(job['iso_time'])
            diff = (end_dt - start_dt).total_seconds()
            
            if diff > 30:  # Mais de 30s = job real
                real_jobs.append({
                    'start': current_start,
                    'end': job,
                    'duration_min': diff / 60
                })
        except:
            pass
        current_start = None

print(f"Jobs reais (>30s): {len(real_jobs)}")
print()

# Mostrar preview
for i, rj in enumerate(real_jobs):
    s = rj['start']
    e = rj['end']
    print(f"  {i+1}. {s['iso_time'][:16]} -> {e['iso_time'][:16]} | {s['origem']} | {s['nome_arquivo']} | dur: {rj['duration_min']:.0f}min")

# Perguntar se quer enviar
print(f"\n--- Total: {len(real_jobs)} jobs para sincronizar ---")
resp = 's' # Force sync without prompt

if resp != 's':
    print("Cancelado.")
    exit()

# Enviar cada job
enviados = 0
erros = 0

for rj in real_jobs:
    s = rj['start']
    e = rj['end']
    project = extract_project_name(s['caminho'])
    
    payload_start = {
        "file_name": s['nome_arquivo'],
        "folder": f"{s['origem']} | {project}",
        "file_path": s['caminho'],
        "start_time": s['iso_time'],
        "router_name": s['origem'],
    }
    
    try:
        # Criar job
        r = requests.post(f"{BASE_URL}/api/jobs", json=payload_start, headers=headers, timeout=10)
        if r.status_code in (200, 201):
            data = r.json()
            job_id = data.get('id')
            
            # Finalizar job
            payload_end = {
                "end_time": e['iso_time'],
                "router_name": s['origem']
            }
            r2 = requests.patch(f"{BASE_URL}/api/jobs/latest", json=payload_end, headers=headers, timeout=10)
            
            if r2.status_code in (200, 204):
                print(f"  [OK] ID:{job_id} | {s['nome_arquivo']}")
                enviados += 1
            else:
                print(f"  [!] Criou ID:{job_id} mas erro ao finalizar: {r2.status_code}")
                erros += 1
        else:
            print(f"  [X] Erro ao criar: {r.status_code} - {r.text[:100]}")
            erros += 1
    except Exception as ex:
        print(f"  [X] Exceção: {ex}")
        erros += 1
    
    time.sleep(0.3)  # Não sobrecarregar o servidor

print(f"\n=== RESULTADO ===")
print(f"Enviados: {enviados}")
print(f"Erros: {erros}")
