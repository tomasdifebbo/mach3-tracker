"""
Sincroniza jobs pendentes que o monitor processou localmente mas 
não conseguiu enviar ao cloud (16/04 a 05/05/2026).
Lê diretamente dos log_oficial.csv das routers.
"""
import os, json, requests, datetime, re, math, time

BASE_URL = "https://mach3-tracker-production.up.railway.app"
CONFIG_FILE = os.path.join(os.path.dirname(__file__), "config.json")

with open(CONFIG_FILE) as f:
    config = json.load(f)

token = config["token"]
headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

# Verificar token
resp = requests.get(f"{BASE_URL}/api/user/me", headers=headers, timeout=5)
if resp.status_code != 200:
    print(f"[X] Token invalido: {resp.status_code}")
    exit(1)
print("[OK] Token valido")

# Buscar TODOS os jobs existentes no cloud para evitar duplicatas
print("[*] Carregando jobs existentes do cloud...")
resp = requests.get(f"{BASE_URL}/api/jobs?limit=9999", headers=headers, timeout=30)
cloud_jobs = resp.json() if isinstance(resp.json(), list) else resp.json().get("jobs", [])
print(f"[*] {len(cloud_jobs)} jobs encontrados no cloud")

# Criar set de fingerprints para deduplicação
existing_fingerprints = set()
for j in cloud_jobs:
    st = j.get("start_time", "")[:19] if j.get("start_time") else ""
    fn = j.get("file_name", "")
    rn = j.get("router_name", "")
    existing_fingerprints.add(f"{st}|{fn}|{rn}")

# Data de corte - sincronizar a partir de 16/04/2026
CUTOFF_DATE = datetime.datetime(2026, 4, 16, 0, 0, 0)

# Routers e seus logs
routers = [
    {"name": "Router Central", "log_file": r"\\DESKTOP-1CSKMNT\Mach3\log_oficial.csv"},
    {"name": "Router 2", "log_file": r"\\ACT10\Mach3\log_oficial.csv"},
]

def parse_mach3_time(data_str, hora_str):
    try:
        dt = datetime.datetime.strptime(f"{data_str.strip()} {hora_str.strip()}", "%d/%m/%Y %H:%M:%S")
        return dt, dt.astimezone().isoformat()
    except:
        return None, None

skip_list = ["ROUTER", "ISOPOR", "ARQUIVO", "CNC", "ARQUIVOS", "2024", "2026", "TOMAS", "MACH3"]

def extract_project(caminho):
    full_parts = [p for p in caminho.split("\\") if p]
    folder_parts = full_parts[:-1] if len(full_parts) > 1 else full_parts
    for p in reversed(folder_parts):
        if p.upper() not in skip_list and len(p) > 2 and "." not in p:
            return p
    return folder_parts[-1] if folder_parts else "Desconhecido"

# Processar cada router
total_synced = 0
total_skipped = 0

for router in routers:
    rname = router["name"]
    log_path = router["log_file"]
    
    if not os.path.exists(log_path):
        print(f"[!] Log nao encontrado: {log_path}")
        continue
    
    print(f"\n=== Processando {rname} ({log_path}) ===")
    
    with open(log_path, 'r', encoding='cp1252', errors='replace') as f:
        lines = f.readlines()
    
    print(f"  Total de linhas no log: {len(lines)}")
    
    # Agrupar em pares INICIO/FIM
    pending_start = None
    jobs_to_sync = []
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
        
        parts = line.split(',')
        if len(parts) < 4:
            continue
        
        data_str, hora_str, caminho_completo = parts[0], parts[1], parts[2]
        
        # Identidade da router
        identidade_router = rname
        if len(parts) >= 5:
            r_name = parts[-2].strip().upper()
            if r_name == "ACT10":
                identidade_router = "Router 2"
            elif "ROUTER CENTRAL" in r_name:
                identidade_router = "Router 1"
            else:
                identidade_router = r_name or rname
        
        tipo = parts[-1].strip().upper()
        
        dt, iso_time = parse_mach3_time(data_str, hora_str)
        if dt is None or dt < CUTOFF_DATE:
            continue
        
        nome_arquivo = caminho_completo.split("\\")[-1] if "\\" in caminho_completo else caminho_completo
        
        # Skip PINGs
        if "PING" in nome_arquivo.upper():
            continue
        
        if "INICIO" in tipo:
            # Se já temos um INICIO pendente sem FIM, salvar como job sem fim
            if pending_start and pending_start["file_name"] != nome_arquivo:
                jobs_to_sync.append(pending_start)
            
            project_name = extract_project(caminho_completo)
            
            pending_start = {
                "file_name": nome_arquivo,
                "folder": f"{identidade_router} | {project_name}",
                "file_path": caminho_completo,
                "start_time": iso_time,
                "router_name": identidade_router,
                "end_time": None
            }
        elif "FIM" in tipo and pending_start:
            pending_start["end_time"] = iso_time
            jobs_to_sync.append(pending_start)
            pending_start = None
    
    # Último job pendente
    if pending_start:
        jobs_to_sync.append(pending_start)
    
    print(f"  Jobs encontrados desde {CUTOFF_DATE.strftime('%d/%m/%Y')}: {len(jobs_to_sync)}")
    
    # Filtrar duplicatas (já existem no cloud)
    new_jobs = []
    for j in jobs_to_sync:
        st = j["start_time"][:19] if j["start_time"] else ""
        fingerprint = f"{st}|{j['file_name']}|{j['router_name']}"
        if fingerprint not in existing_fingerprints:
            new_jobs.append(j)
        else:
            total_skipped += 1
    
    print(f"  Jobs novos (nao duplicados): {len(new_jobs)}")
    print(f"  Jobs ja existentes (skip): {total_skipped}")
    
    # Enviar ao cloud
    for i, job in enumerate(new_jobs):
        payload = {
            "file_name": job["file_name"],
            "folder": job["folder"],
            "file_path": job["file_path"],
            "start_time": job["start_time"],
            "router_name": job["router_name"],
        }
        
        try:
            # Criar o job
            resp = requests.post(f"{BASE_URL}/api/jobs", json=payload, headers=headers, timeout=10)
            if resp.status_code in (200, 201):
                data = resp.json()
                job_id = data.get("id")
                
                # Se temos end_time, fechar o job
                if job.get("end_time"):
                    patch_resp = requests.patch(
                        f"{BASE_URL}/api/jobs/{job_id}",
                        json={"end_time": job["end_time"]},
                        headers=headers, timeout=10
                    )
                    status = "completo" if patch_resp.status_code in (200, 204) else f"fim_erro:{patch_resp.status_code}"
                else:
                    status = "em andamento"
                
                print(f"  [{i+1}/{len(new_jobs)}] OK: {job['file_name']} ({status})")
                total_synced += 1
            else:
                print(f"  [{i+1}/{len(new_jobs)}] ERRO {resp.status_code}: {job['file_name']} - {resp.text[:100]}")
        except Exception as e:
            print(f"  [{i+1}/{len(new_jobs)}] FALHA: {job['file_name']} - {e}")
        
        time.sleep(0.3)  # Rate limiting

print(f"\n{'='*50}")
print(f"RESUMO: {total_synced} jobs sincronizados, {total_skipped} duplicados ignorados")
