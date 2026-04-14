import os
import time
import json
import requests
import datetime
import sys

# ==========================================
# CONFIGURAÇÕES SAAS (LOCAL/NUVEM)
# ==========================================
BASE_URL = "http://localhost:3000"
# BASE_URL = "https://mach3-tracker-production.up.railway.app" 
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
            print("[✓] Autenticação realizada!")
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
        print(f"[✓] {sucessos} eventos sincronizados com a nuvem!")

def processa_inicio(caminho, nome_arquivo, iso_time, origem):
    # Extract actual folder from full file path
    pasta = caminho.rsplit("\\", 1)[0] if "\\" in caminho else caminho
    
    payload = {
        "file_name": nome_arquivo,
        "folder": f"{origem} | {pasta}",
        "file_path": caminho,
        "start_time": iso_time,
        "router_name": origem
    }
    
    headers = get_headers()
    if headers and len(load_queue()) == 0:
        try:
            resp = requests.post(URL_JOBS, json=payload, headers=headers, timeout=5)
            if resp.status_code in (200, 201, 204, 400):
                print(f"[+] {origem} -> INICIOU: {nome_arquivo}")
                return
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
                print(f"[√] {origem} -> FINALIZOU.")
                return
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
                last_pos = os.path.getsize(path)
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
                            # Se tiver 5 partes, a 4a é o nome da Router (ex: ACT10)
                            # Se tiver 4 partes e o config for compartilhado, o nome vem da config
                            identidade_router = name
                            if len(parts) >= 5:
                                # A penultima parte em logs de 5 campos é a router (ex: ACT10)
                                # A ultima parte é sempre INICIO/FIM
                                if parts[-2].strip().upper() in ["ACT10", "ROUTER 1", "ROUTER 2"]:
                                    identidade_router = parts[-2].strip()
                            
                            tipo = parts[-1].strip().upper()
                            nome_arquivo = caminho_completo.split("\\")[-1] if "\\" in caminho_completo else caminho_completo
                            iso_time = parse_mach3_time(data_str, hora_str)
                            
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
