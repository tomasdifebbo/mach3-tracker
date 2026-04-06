import os
import time
import json
import requests
import datetime

# ==========================================
# CONFIGURAÇÕES DA FILA DE OFFLINE SYNC
# ==========================================
# ==========================================
# CONFIGURAÇÕES SAAS (LOCAL/NUVEM)
# ==========================================
BASE_URL = "http://localhost:3000"
URL_JOBS = f"{BASE_URL}/api/jobs"
URL_HEALTH = f"{BASE_URL}/health"
URL_LOGIN = f"{BASE_URL}/api/auth/login"

CONFIG_FILE = os.path.join(os.path.dirname(__file__), "config.json")
QUEUE_FILE = os.path.join(os.path.dirname(__file__), "fila_sincronizacao.json")

def load_config():
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, "r") as f:
            return json.load(f)
    return {"email": "", "password": "", "token": ""}

def get_log_file():
    config = load_config()
    return config.get("log_file", "C:\\Mach3\\Mach3Track.csv")

LOG_FILE = get_log_file()

def save_config(config):
    with open(CONFIG_FILE, "w") as f:
        json.dump(config, f, indent=4)

def get_token():
    config = load_config()
    if config.get("token"):
        return config["token"]
    
    # Se não houver token, tenta logar
    print("[!] Monitor não autenticado. Tentando login...")
    email = config.get("email") or input("Email do SaaS: ")
    password = config.get("password") or input("Senha do SaaS: ")
    
    try:
        resp = requests.post(URL_LOGIN, json={"email": email, "password": password})
        if resp.status_code == 200:
            data = resp.json()
            config["token"] = data["token"]
            config["email"] = email
            config["password"] = password
            save_config(config)
            print("[✓] Login realizado com sucesso!")
            return data["token"]
        else:
            print(f"[X] Erro no login: {resp.text}")
    except Exception as e:
        print(f"[X] Erro de conexão: {e}")
    return None

TOKEN = get_token()

def get_headers():
    return {
        "Authorization": f"Bearer {get_token()}",
        "Content-Type": "application/json"
    }

HEADERS = get_headers()

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
    print(f"[!] Supabase Offline. Comando salvo na fila de segurança.")

def process_queue():
    """Tenta enviar pacotes atrasados em ordem cronológica"""
    queue = load_queue()
    if not queue:
        return

    try:
        requests.get(URL_HEALTH, timeout=2)
    except:
        return 

    print(f"[*] Conexão Cloud restabelecida! Sincronizando {len(queue)} registros...")
    
    sucessos = 0
    for req in queue:
        try:
            if req["method"] == "POST":
                resp = requests.post(req["url"], json=req["payload"], headers=get_headers(), timeout=5)
            elif req["method"] == "PATCH":
                resp = requests.patch(req["url"], json=req["payload"], headers=get_headers(), timeout=5)
            
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
    dt = datetime.datetime.fromisoformat(iso_time)
    
    # 🕵️ TRAVA DE DUPLICAÇÃO E COOLDOWN (30 segundos)
    exibicao_folder = f"{origem} | {caminho}" if origem else caminho
    
    payload = {
        "file_name": nome_arquivo,
        "folder": exibicao_folder,
        "file_path": caminho,
        "start_time": iso_time
    }
    
    # Enviar para o SaaS local
    if len(load_queue()) == 0:
        try:
            resp = requests.post(URL_JOBS, json=payload, headers=get_headers(), timeout=5)
            if resp.status_code in (200, 201, 204, 400):
                print(f"[+] {origem} Iniciou: {nome_arquivo}")
                return
        except Exception as e:
            print(f"Erro POST: {e}")
    
    enqueue_request("POST", URL_JOBS, payload)

def processa_fim(iso_time, origem):
    payload = { "end_time": iso_time }
    
    # SaaS local use target endpoint
    PATCH_URL = f"{BASE_URL}/api/jobs/latest"
    
    if len(load_queue()) == 0:
        try:
            resp = requests.patch(PATCH_URL, json=payload, headers=get_headers(), timeout=5)
            if resp.status_code in (200, 204, 404):
                print(f"[√] {origem} Finalizou.")
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
    print("Iniciando Monitor Inteligente Offline Sync (Store-And-Forward)...")
    
    # Se o CSV original da Router não existir, espera
    while not os.path.exists(LOG_FILE):
        time.sleep(2)
        print(f"Aguardando a criação do log na Mach3 ({LOG_FILE})...")

    # Monitora ativamente abrindo e fechando o arquivo rápido para NÃO bloquear o Mach3 no Windows
    last_pos = os.path.getsize(LOG_FILE)
    print(f"[*] Monitorando {LOG_FILE} ativamente com sistema de retenção anti-quedas!")

    while True:
        # Tenta sincronizar registros que deram erro de internet no passado
        process_queue()
        time.sleep(1) # Aguarda 1 segundo a cada ciclo

        try:
            current_size = os.path.getsize(LOG_FILE)
            if current_size > last_pos:
                with open(LOG_FILE, 'r', encoding='utf-8', errors='ignore') as f:
                    f.seek(last_pos)
                    lines = f.readlines()
                    last_pos = f.tell()
                
                # Se encontrou novas linhas (Mach3 salvou novos logs)
                for line in lines:
                    if not line.strip(): continue
                    parts = line.strip().split(',')
                    
                    if len(parts) >= 4:
                        data_str = parts[0].strip()
                        hora_str = parts[1].strip()
                        
                        # New Multi-Router Parser:
                        # Format 1 (Legacy): Date,Time,Path,Status
                        # Format 2 (V2): Date,Time,Path,Machine,Status
                        
                        tipo = parts[-1].strip().upper()
                        origem = "TOMAS" # Valor padrão se não detectado
                        
                        if len(parts) == 4:
                            caminho_completo = parts[2].strip()
                        else:
                            # Tenta pegar o penúltimo como máquina se houver 5+ partes
                            origem = parts[3].strip()
                            caminho_completo = parts[2].strip()
                        
                        nome_arquivo = caminho_completo.split("\\")[-1] if "\\" in caminho_completo else caminho_completo
                        
                        iso_time = parse_mach3_time(data_str, hora_str)
                        
                        if "INICIO" in tipo:
                            processa_inicio(caminho_completo, nome_arquivo, iso_time, origem)
                        elif "FIM" in tipo:
                            processa_fim(iso_time, origem)
        except Exception as e:
            pass # Ignora bloqueios temporários se a Mach3 estiver salvando naquele exato milissegundo


if __name__ == "__main__":
    main()
