import os
import time
import json
import requests
import datetime

# ==========================================
# CONFIGURAÇÕES SAAS (LOCAL/NUVEM)
# ==========================================
BASE_URL = "https://mach3-tracker-production.up.railway.app"
URL_JOBS = f"{BASE_URL}/api/jobs"
URL_HEALTH = f"{BASE_URL}/health"
URL_LOGIN = f"{BASE_URL}/api/auth/login"

CONFIG_FILE = os.path.join(os.path.dirname(__file__), "config.json")
QUEUE_FILE = os.path.join(os.path.dirname(__file__), "fila_sincronizacao.json")

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
        return config["token"]
    
    print("[!] Monitor não autenticado. Tentando login...")
    email = config.get("email")
    password = config.get("password")
    
    if not email or not password:
        print("[X] Email ou senha não configurados no config.json")
        return None
        
    try:
        resp = requests.post(URL_LOGIN, json={"email": email, "password": password})
        if resp.status_code == 200:
            data = resp.json()
            config["token"] = data["token"]
            save_config(config)
            print("[✓] Login realizado com sucesso!")
            return data["token"]
        else:
            print(f"[X] Erro no login: {resp.text}")
    except Exception as e:
        print(f"[X] Erro de conexão: {e}")
    return None

def get_headers():
    return {
        "Authorization": f"Bearer {get_token()}",
        "Content-Type": "application/json"
    }

def load_queue():
    if not os.path.exists(QUEUE_FILE):
        return []
    try:
        with open(QUEUE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except:
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
    print(f"[!] Erro de conexão. Evento salvo na fila offline.")

def process_queue():
    queue = load_queue()
    if not queue:
        return

    try:
        requests.get(URL_HEALTH, timeout=2)
    except:
        return 

    print(f"[*] Sincronizando {len(queue)} registros pendentes...")
    
    sucessos = 0
    for req in queue:
        try:
            headers = get_headers()
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
        print(f"[✓] {sucessos} eventos sincronizados!")

def processa_inicio(caminho, nome_arquivo, iso_time, origem):
    payload = {
        "file_name": nome_arquivo,
        "folder": f"{origem} | {caminho}",
        "file_path": caminho,
        "start_time": iso_time
    }
    
    if len(load_queue()) == 0:
        try:
            resp = requests.post(URL_JOBS, json=payload, headers=get_headers(), timeout=5)
            if resp.status_code in (200, 201, 204, 400):
                print(f"[+] {origem} -> Iniciou: {nome_arquivo}")
                return
        except Exception as e:
            print(f"Erro POST: {e}")
    
    enqueue_request("POST", URL_JOBS, payload)

def processa_fim(iso_time, origem):
    payload = { "end_time": iso_time }
    PATCH_URL = f"{BASE_URL}/api/jobs/latest"
    
    # Nota: Em sistemas multirouter, o PATCH /latest pode ser impreciso se ambas terminarem ao mesmo tempo.
    # Mas como o userId é o mesmo e o comportamento do Mach3 é sequencial por máquina, geralmente funciona.
    
    if len(load_queue()) == 0:
        try:
            resp = requests.patch(PATCH_URL, json=payload, headers=get_headers(), timeout=5)
            if resp.status_code in (200, 204, 404):
                print(f"[√] {origem} -> Finalizou.")
                return
        except Exception as e:
            print(f"Erro PATCH: {e}")
        
    enqueue_request("PATCH", PATCH_URL, payload)

def parse_mach3_time(data_str, hora_str):
    try:
        dt = datetime.datetime.strptime(f"{data_str.strip()} {hora_str.strip()}", "%d/%m/%Y %H:%M:%S")
        return dt.astimezone().isoformat()
    except Exception:
        return datetime.datetime.now().astimezone().isoformat()

def main():
    print("==================================================")
    print("   MONITOR MULTI-ROUTER 2026 (GLOBOTOY)")
    print("==================================================")
    
    config = load_config()
    routers = config.get("routers", [])
    
    if not routers:
        print("[X] Nenhuma router configurada no config.json!")
        return

    # Inicializa estado de cada fime
    router_states = {}
    for r in routers:
        name = r["name"]
        path = r["log_file"]
        last_pos = 0
        if os.path.exists(path):
            last_pos = os.path.getsize(path)
        router_states[name] = {"path": path, "last_pos": last_pos}
        print(f"[*] Monitorando {name}: {path}")

    print("[*] Sistema de retenção anti-quedas ativo.")

    while True:
        process_queue()
        time.sleep(1)

        for name, state in router_states.items():
            path = state["path"]
            
            if not os.path.exists(path):
                continue
                
            try:
                current_size = os.path.getsize(path)
                if current_size > state["last_pos"]:
                    with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                        f.seek(state["last_pos"])
                        lines = f.readlines()
                        state["last_pos"] = f.tell()
                    
                    for line in lines:
                        if not line.strip(): continue
                        parts = line.strip().split(',')
                        
                        if len(parts) >= 4:
                            data_str, hora_str, caminho_completo = parts[0], parts[1], parts[2]
                            tipo = parts[-1].strip().upper()
                            
                            nome_arquivo = caminho_completo.split("\\")[-1] if "\\" in caminho_completo else caminho_completo
                            iso_time = parse_mach3_time(data_str, hora_str)
                            
                            if "INICIO" in tipo:
                                processa_inicio(caminho_completo, nome_arquivo, iso_time, name)
                            elif "FIM" in tipo:
                                processa_fim(iso_time, name)
            except Exception as e:
                # Silencioso para não poluir o terminal Windows se o arquivo estiver bloqueado rápido
                pass

if __name__ == "__main__":
    main()
