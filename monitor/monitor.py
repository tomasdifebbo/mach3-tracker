import os
import time
import json
import requests
import datetime
import sys
import math
import re

# ==========================================
# CONFIGURAÇÕES SAAS (LOCAL/NUVEM)
# ==========================================
# BASE_URL = "http://localhost:3000"
BASE_URL = "https://mach3-tracker-production.up.railway.app" 
URL_JOBS = f"{BASE_URL}/api/jobs"
URL_HEALTH = f"{BASE_URL}/health"
URL_LOGIN = f"{BASE_URL}/api/auth/login"

CONFIG_FILE = os.path.join(os.path.dirname(__file__), "config.json")
QUEUE_FILE = os.path.join(os.path.dirname(__file__), "fila_sincronizacao.json")
STATE_FILE = os.path.join(os.path.dirname(__file__), "monitor_state.json")

def load_state():
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE, "r") as f:
                return json.load(f)
        except: pass
    return {}

def save_state(state):
    with open(STATE_FILE, "w") as f:
        json.dump(state, f, indent=4)

def load_config():
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, "r") as f:
            return json.load(f)
    return {"email": "", "password": "", "token": "", "routers": []}

def save_config(config):
    with open(CONFIG_FILE, "w") as f:
        json.dump(config, f, indent=4)

def get_token():
    config = load_config()
    if config.get("token"):
        # Validate token before using (JWT expires after 7 days)
        try:
            resp = requests.get(f"{BASE_URL}/api/user/me",
                                headers={"Authorization": f"Bearer {config['token']}",
                                         "Content-Type": "application/json"},
                                timeout=3)
            if resp.status_code == 200:
                return config["token"]
            elif resp.status_code in (401, 403):
                print("[!] Token expirado, renovando...")
                config["token"] = ""
                save_config(config)
            else:
                return config["token"]  # Server issue, use existing
        except Exception:
            return config["token"]  # Offline, use what we have
    
    print("[!] Autenticando com a nuvem...")
    email = config.get("email")
    password = config.get("password")
    
    if not email or not password:
        print("[X] Configure email/senha no config.json")
        return None
        
    try:
        resp = requests.post(URL_LOGIN, json={"email": email, "password": password})
        if resp.status_code == 200:
            data = resp.json()
            config["token"] = data["token"]
            save_config(config)
            print("[[v]] Autenticação realizada!")
            return data["token"]
        else:
            print(f"[X] Erro de login: {resp.status_code}")
    except Exception as e:
        print(f"[X] Servidor offline ou erro de conexão: {e}")
    return None

def get_headers():
    tk = get_token()
    if not tk: return None
    return {
        "Authorization": f"Bearer {tk}",
        "Content-Type": "application/json"
    }

def load_queue():
    if not os.path.exists(QUEUE_FILE):
        return []
    try:
        with open(QUEUE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []

def save_queue(queue):
    with open(QUEUE_FILE, "w", encoding="utf-8") as f:
        json.dump(queue, f, indent=4)

def enqueue_request(method, url, payload):
    queue = load_queue()
    queue.append({
        "timestamp": time.time(),
        "method": method,
        "url": url,
        "payload": payload
    })
    save_queue(queue)
    print(f"[!] Armazenado em fila offline.")

def process_queue():
    queue = load_queue()
    if not queue: return

    try:
        requests.get(URL_HEALTH, timeout=2)
    except:
        return 

    headers = get_headers()
    if not headers: return

    sucessos = 0
    for req in queue:
        try:
            if req["method"] == "POST":
                resp = requests.post(req["url"], json=req["payload"], headers=headers, timeout=5)
            elif req["method"] == "PATCH":
                resp = requests.patch(req["url"], json=req["payload"], headers=headers, timeout=5)
            
            if resp.status_code in (200, 201, 204, 404, 400):
                sucessos += 1
            else:
                break 
        except Exception:
            break

    if sucessos > 0:
        fila_restante = queue[sucessos:]
        save_queue(fila_restante)
        print(f"[v] {sucessos} eventos sincronizados com a nuvem!")

def simulate_gcode_time(filepath):
    """Estimate machining time from a G-code file (in minutes)."""
    try:
        feed_rate = 1000.0
        rapid_rate = 10000.0
        total_time = 0.0
        lx, ly, lz = 0.0, 0.0, 0.0
        
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            for line in f:
                line = line.strip().upper()
                if not line or line.startswith('('): continue
                
                fm = re.search(r'F([\d.]+)', line)
                if fm: feed_rate = float(fm.group(1))
                
                xm = re.search(r'X(-?[\d.]+)', line)
                ym = re.search(r'Y(-?[\d.]+)', line)
                zm = re.search(r'Z(-?[\d.]+)', line)
                
                nx = float(xm.group(1)) if xm else lx
                ny = float(ym.group(1)) if ym else ly
                nz = float(zm.group(1)) if zm else lz
                
                dist = math.sqrt((nx-lx)**2 + (ny-ly)**2 + (nz-lz)**2)
                if dist > 0:
                    rate = rapid_rate if ('G00' in line or ('G0 ' in line and 'G01' not in line)) else feed_rate
                    if rate > 0: total_time += dist / rate
                
                lx, ly, lz = nx, ny, nz
        
        return round(total_time * 1.15, 2)  # 15% overhead for accel/decel
    except Exception as e:
        print(f"[!] Erro ao simular tempo: {e}")
        return None

def processa_inicio(caminho, nome_arquivo, iso_time, origem):
    # Extract actual folder from full file path
    # Extract actual folder from full file path
    # Example: \\TOMAS\arquivos 2024\ARQUIVOS 2026\router\Project\Folder -> Project\Folder
    parts = caminho.split("\\")
    if len(parts) > 2:
        # Try to get the project name (e.g., 2578I - Donatello)
        # Usually projects are 3 levels deep from the root share
        project = parts[-3] if len(parts) >= 3 else "Desconhecido"
        subfolder = parts[-2] if len(parts) >= 2 else ""
         # Skip diagnostic PING lines
        if "PING" in nome_arquivo.upper():
            return

        # Improved project folder extraction for deep UNC paths
        # Goal: Find the folder name that represents the project (e.g., "2578g - Bancada tubo")
        # Logic: Skip generic end-folders like "ROUTER", "ISOPOR", "ARQUIVO"
        full_parts = [p for p in caminho.split("\\") if p]
        
        # Exclude the filename (last part)
        folder_parts = full_parts[:-1] if len(full_parts) > 1 else full_parts
        
        project_name = "Desconhecido"
        skip_list = ["ROUTER", "ISOPOR", "ARQUIVO", "CNC", "ARQUIVOS", "2024", "2026", "TOMAS", "MACH3"]
        
        # Traverse backwards to find the first non-generic name
        for p in reversed(folder_parts):
            # Also skip anything that looks like a file (has extension)
            if p.upper() not in skip_list and len(p) > 2 and "." not in p:
                project_name = p
                break
        
        if project_name == "Desconhecido" and folder_parts:
            project_name = folder_parts[-1] # Fallback to last folder

        # Simulate machining time for progress bar
        estimated = None
        # Map UNC paths to local paths (\\TOMAS\arquivos 2024\... -> E:\arquivos 2024\...)
        local_path = caminho
        unc_mappings = {
            r"\\TOMAS\arquivos 2024": r"E:\arquivos 2024",
            r"\\DESKTOP-1CSKMNT\Mach3": r"C:\mach3",
        }
        for unc_prefix, local_prefix in unc_mappings.items():
            if local_path.upper().startswith(unc_prefix.upper()):
                local_path = local_prefix + local_path[len(unc_prefix):]
                break
        
        if os.path.exists(local_path):
            estimated = simulate_gcode_time(local_path)
            if estimated:
                print(f"[~] Tempo estimado: {estimated:.1f} min ({estimated/60:.1f}h)")
        else:
            print(f"[!] Arquivo não encontrado para simulação: {local_path}")

        payload = {
            "file_name": nome_arquivo,
            "folder": f"{origem} | {project_name}",
            "file_path": caminho,
            "start_time": iso_time,
            "router_name": origem,
            "estimated_minutes": estimated
        }
    
    headers = get_headers()
    if headers and len(load_queue()) == 0:
        try:
            resp = requests.post(URL_JOBS, json=payload, headers=headers, timeout=5)
            if resp.status_code in (200, 201, 204):
                data = resp.json()
                job_id = data.get("id")
                print(f"[+] {origem} -> INICIOU: {nome_arquivo} (ID: {job_id})")
                return
            else:
                print(f"[!] Erro ao iniciar {origem}: {resp.status_code} - {resp.text}")
        except Exception:
            pass
    
    enqueue_request("POST", URL_JOBS, payload)

def processa_fim(iso_time, origem):
    payload = { "end_time": iso_time, "router_name": origem }
    PATCH_URL = f"{BASE_URL}/api/jobs/latest"
    
    headers = get_headers()
    if headers and len(load_queue()) == 0:
        try:
            resp = requests.patch(PATCH_URL, json=payload, headers=headers, timeout=5)
            if resp.status_code in (200, 204, 404):
                print(f"[OK] {origem} -> FINALIZOU.")
                return
            else:
                print(f"[!] Erro ao finalizar {origem}: {resp.status_code} - {resp.text}")
        except Exception:
            pass
        
    enqueue_request("PATCH", PATCH_URL, payload)

def parse_mach3_time(data_str, hora_str):
    try:
        dt = datetime.datetime.strptime(f"{data_str.strip()} {hora_str.strip()}", "%d/%m/%Y %H:%M:%S")
        return dt.astimezone().isoformat()
    except Exception:
        return datetime.datetime.now().astimezone().isoformat()

def main():
    print("==================================================")
    print("   MACH3 TRACKER - MONITOR MULTI-ROUTER V2.0")
    print("==================================================")
    
    # Forçar login no inicio para teste
    get_token()
    
    config = load_config()
    routers = config.get("routers", [])
    
    if not routers:
        print("[X] Nenhuma router configurada.")
        return

    print("[*] Monitor Ativo e Aguardando Cortes...")

    router_states = {}
    states = load_state()
    for r in routers:
        name = r["name"]
        path = r["log_file"]
        # Se no tem estado salvo, comea do fim para evitar duplicidade histrica antiga,
        # MAS se o arquivo existir, podemos tentar ler os últimos 7 dias.
        # Por padrão, vamos salvar a posição para que amanhã ele saiba onde parou.
        last_pos = states.get(name, {}).get("last_pos")
        
        if last_pos is None:
            if os.path.exists(path):
                # Se for novo, vamos ler os últimos 5000 bytes para pegar o que está rodando agora
                file_size = os.path.getsize(path)
                last_pos = max(0, file_size - 5000) 
            else:
                last_pos = 0
                
        router_states[name] = {"path": path, "last_pos": last_pos}
        print(f"[*] Monitorando {name} (Início em: {last_pos} bytes)")

    while True:
        try:
            process_queue()
            
            changed = False
            for name, state in router_states.items():
                path = state["path"]
                
                if not os.path.exists(path):
                    continue
                    
                current_size = os.path.getsize(path)
                if current_size < state["last_pos"]: # Arquivo foi resetado
                    state["last_pos"] = 0
                    changed = True
                
                if current_size > state["last_pos"]:
                    with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                        f.seek(state["last_pos"])
                        lines = f.readlines()
                        state["last_pos"] = f.tell()
                        changed = True
                    
                    for line in lines:
                        if not line.strip(): continue
                        parts = line.strip().split(',')
                        if len(parts) >= 4:
                            data_str, hora_str, caminho_completo = parts[0], parts[1], parts[2]
                            
                            # Logica de identificação de Router:
                            identidade_router = name
                            if len(parts) >= 5:
                                # A penultima parte em logs de 5 campos é a router
                                r_name = parts[-2].strip().upper()
                                # Router Naming Standardization
                                if r_name == "ACT10":
                                    identidade_router = "Router 2"
                                elif "ROUTER CENTRAL" in str(r_name).upper():
                                    identidade_router = "Router 1"
                                else:
                                    identidade_router = r_name or "Desconhecido"
                            
                            tipo = parts[-1].strip().upper()
                            nome_arquivo = caminho_completo.split("\\")[-1] if "\\" in caminho_completo else caminho_completo
                            iso_time = parse_mach3_time(data_str, hora_str)
                            
                            log_msg = f"[{iso_time}] {identidade_router} | {tipo} | {nome_arquivo}"
                            with open(os.path.join(os.path.dirname(__file__), "monitor.log"), "a", encoding="utf-8") as lf:
                                lf.write(log_msg + "\n")
                            print(log_msg)
                            
                            if "INICIO" in tipo:
                                processa_inicio(caminho_completo, nome_arquivo, iso_time, identidade_router)
                            elif "FIM" in tipo:
                                processa_fim(iso_time, identidade_router)
            
            if changed:
                save_state({n: {"last_pos": s["last_pos"]} for n, s in router_states.items()})
        except Exception as e:
            print(f"[!] Erro no loop: {e}")
        
        time.sleep(1)

if __name__ == "__main__":
    main()
