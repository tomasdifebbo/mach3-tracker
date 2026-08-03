import os
import time
import json
import requests
import datetime
import sys
import math
import re
import threading
import traceback

# ==========================================
# CONFIGURAÇÕES SAAS (LOCAL/NUVEM)
# ==========================================
# BASE_URL = "http://localhost:3000"
# BASE_URL = "https://mach3-tracker-production.up.railway.app"  # Railway (expired)
BASE_URL = "https://mach3-tracker.onrender.com"
URL_JOBS = f"{BASE_URL}/api/jobs"
URL_HEALTH = f"{BASE_URL}/health"
URL_LOGIN = f"{BASE_URL}/api/auth/login"

CONFIG_FILE = os.path.join(os.path.dirname(__file__), "config.json")
QUEUE_FILE = os.path.join(os.path.dirname(__file__), "fila_sincronizacao.json")
STATE_FILE = os.path.join(os.path.dirname(__file__), "monitor_state.json")

cached_materials = []

def update_materials():
    global cached_materials
    headers = get_headers()
    if not headers: return
    try:
        resp = requests.get(f"{BASE_URL}/api/materials", headers=headers, timeout=5)
        if resp.status_code == 200:
            cached_materials = resp.json()
            print(f"[*] {len(cached_materials)} materiais carregados para auto-seleção.")
    except Exception as e:
        print(f"[!] Erro ao carregar materiais: {e}")

def find_material_match(filename):
    if not cached_materials: return None
    
    # Normaliza o nome do arquivo e extrai as primeiras palavras
    clean_name = filename.lower()
    # Remove a extensão para não interferir na segunda palavra
    name_no_ext = clean_name.rsplit('.', 1)[0]
    words = re.split(r'[ _\-]', name_no_ext)
    words = [w.strip() for w in words if w.strip()]
    
    if not words: return None
    
    # Pega as primeiras palavras e a combinação delas
    w1 = words[0]
    w2 = words[1] if len(words) > 1 else ""
    w3 = words[2] if len(words) > 2 else ""
    phrase_2 = f"{w1} {w2}".strip()
    phrase_3 = f"{w1} {w2} {w3}".strip()
    
    # Ordena os materiais pelo tamanho do nome (do mais longo para o mais curto)
    sorted_mats = sorted(cached_materials, key=lambda x: len(x['name']), reverse=True)
    
    # 1ª Passada: Busca por combinação exata (3 palavras, 2 palavras)
    for mat in sorted_mats:
        mat_name = mat['name'].lower()
        if mat_name == phrase_3 or mat_name == phrase_2:
            return mat
            
    # 2ª Passada: Busca se o nome do material contém as palavras chave
    for mat in sorted_mats:
        mat_name = mat['name'].lower()
        # Verifica 3 palavras presentes
        if w1 in mat_name and w2 and w2 in mat_name and w3 and w3 in mat_name:
            return mat
        # Verifica 2 palavras presentes
        if w1 in mat_name and w2 and w2 in mat_name:
            return mat

    # 3ª Passada: Busca por palavra individual (3ª, 2ª ou 1ª)
    for mat in sorted_mats:
        mat_name = mat['name'].lower()
        if mat_name == w3 or mat_name == w2 or mat_name == w1 or mat_name.startswith(w1 + " "):
            return mat
                
    return None

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
    """Estimate machining time from a G-code file (in minutes) and extract X/Y bounding box dimensions."""
    try:
        feed_rate = 1000.0
        rapid_rate = 10000.0
        total_time = 0.0
        lx, ly, lz = 0.0, 0.0, 0.0
        min_x, max_x = float('inf'), float('-inf')
        min_y, max_y = float('inf'), float('-inf')
        
        with open(filepath, 'r', encoding='cp1252', errors='ignore') as f:
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
                
                if xm:
                    min_x = min(min_x, nx)
                    max_x = max(max_x, nx)
                if ym:
                    min_y = min(min_y, ny)
                    max_y = max(max_y, ny)

                dist = math.sqrt((nx-lx)**2 + (ny-ly)**2 + (nz-lz)**2)
                if dist > 0:
                    rate = rapid_rate if ('G00' in line or ('G0 ' in line and 'G01' not in line)) else feed_rate
                    if rate > 0: total_time += dist / rate
                
                lx, ly, lz = nx, ny, nz
        
        est_min = round(total_time * 1.15, 2)
        bound_x = round(abs(max_x - min_x), 2) if (max_x > float('-inf') and min_x < float('inf')) else None
        bound_y = round(abs(max_y - min_y), 2) if (max_y > float('-inf') and min_y < float('inf')) else None
        
        area_m2 = None
        if bound_x and bound_y:
            area_m2 = round((bound_x / 1000.0) * (bound_y / 1000.0), 3)

        return est_min, bound_x, bound_y, area_m2
    except Exception as e:
        print(f"[!] Erro ao simular tempo e dimensoes: {e}")
        return None, None, None, None

def processa_inicio(caminho, nome_arquivo, iso_time, origem, estimated_minutes=None, max_x=None, max_y=None, area_m2=None):
    # Extract actual folder from full file path
    project_name = "LaserCAD"
    parts = caminho.split("\\")
    if len(parts) > 2:
        # Improved project folder extraction for deep UNC paths
        full_parts = [p for p in caminho.split("\\") if p]
        folder_parts = full_parts[:-1] if len(full_parts) > 1 else full_parts
        project_name = "Desconhecido"
        skip_list = ["ROUTER", "ISOPOR", "ARQUIVO", "CNC", "ARQUIVOS", "2024", "2026", "TOMAS", "MACH3"]
        for p in reversed(folder_parts):
            if p and p.upper() not in skip_list and not p.startswith("{"):
                project_name = p
                break

    # Simulate machining time and bounding box dimensions for progress bar & m²
    estimated, max_x_val, max_y_val, area_m2_val = estimated_minutes, max_x, max_y, area_m2
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
        g_est, g_max_x, g_max_y, g_area = simulate_gcode_time(local_path)
        if g_est and not estimated:
            estimated = g_est
        if g_max_x and not max_x_val:
            max_x_val = g_max_x
        if g_max_y and not max_y_val:
            max_y_val = g_max_y
        if g_area and not area_m2_val:
            area_m2_val = g_area
        if estimated:
            print(f"[~] Tempo estimado: {estimated:.1f} min | X={max_x_val}mm Y={max_y_val}mm Area={area_m2_val}m2")
    
    # Auto-detect material from filename
    mat = find_material_match(nome_arquivo)
    mat_id = mat['id'] if mat else None
    mat_name = mat['name'] if mat else None
    mat_price = mat['price'] if mat else None
    
    if mat:
        print(f"[+] Material detectado: {mat_name}")

    payload = {
        "file_name": nome_arquivo,
        "folder": f"{origem} | {project_name}",
        "file_path": caminho,
        "start_time": iso_time,
        "router_name": origem,
        "estimated_minutes": estimated,
        "material_id": mat_id,
        "material_name": mat_name,
        "material_price": mat_price,
        "max_x": max_x_val,
        "max_y": max_y_val,
        "bounding_area_m2": area_m2_val
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

    # Carregar materiais para auto-seleção
    update_materials()

    last_heartbeat = 0
    HEARTBEAT_INTERVAL = 300  # 5 minutos

    while True:
        try:
            # Heartbeat - log a cada 5 minutos para saber que o monitor está vivo
            now = time.time()
            if now - last_heartbeat > HEARTBEAT_INTERVAL:
                hb_msg = f"[HEARTBEAT] {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - Monitor ativo"
                print(hb_msg)
                with open(os.path.join(os.path.dirname(__file__), "monitor.log"), "a", encoding="utf-8") as lf:
                    lf.write(hb_msg + "\n")
                last_heartbeat = now

            try:
                process_queue()
            except Exception as e:
                print(f"[!] Erro ao processar fila: {e}")
            
            changed = False
            for name, state in router_states.items():
                path = state["path"]
                
                try:
                    # Timeout protection para UNC paths que podem travar
                    path_exists = False
                    current_size = 0
                    
                    def check_path():
                        nonlocal path_exists, current_size
                        if os.path.exists(path):
                            path_exists = True
                            current_size = os.path.getsize(path)
                    
                    t = threading.Thread(target=check_path)
                    t.start()
                    t.join(timeout=5)  # Max 5 segundos para checar UNC path
                    
                    if t.is_alive():
                        print(f"[!] Timeout ao acessar {name} ({path}) - rede lenta?")
                        continue
                    
                    if not path_exists:
                        continue
                except Exception as e:
                    print(f"[!] Erro ao verificar {name}: {e}")
                    continue
                    
                if current_size < state["last_pos"]: # Arquivo foi resetado
                    state["last_pos"] = 0
                    changed = True
                
                if current_size > state["last_pos"]:
                    try:
                        with open(path, 'r', encoding='cp1252', errors='replace') as f:
                            f.seek(state["last_pos"])
                            lines = f.readlines()
                            state["last_pos"] = f.tell()
                            changed = True
                    except Exception as e:
                        print(f"[!] Erro ao ler log de {name}: {e}")
                        continue
                    
                    for line in lines:
                        if not line.strip(): continue
                        parts = line.strip().split(',')
                        if len(parts) >= 4:
                            data_str, hora_str = parts[0], parts[1]
                            
                            # Detect tipo (last field is always INICIO/FIM)
                            tipo = parts[-1].strip().upper()
                            
                            # Detect router identity from penultimate field if present
                            identidade_router = name
                            if len(parts) >= 5:
                                candidate_router = parts[-2].strip().upper()
                                # Check if the penultimate field is a known machine identifier
                                if candidate_router in ("ACT10", "ROUTER 2", "ROUTER2"):
                                    identidade_router = "Router 2"
                                    # Path = join everything between time and machine identifier
                                    caminho_completo = ",".join(parts[2:-2])
                                elif "ROUTER CENTRAL" in candidate_router or "ROUTER 1" in candidate_router or "ROUTER1" in candidate_router:
                                    identidade_router = "Router Central"
                                    caminho_completo = ",".join(parts[2:-2])
                                elif "LASER" in candidate_router or "RUIDA" in candidate_router:
                                    identidade_router = "Laser Ruida"
                                    caminho_completo = ",".join(parts[2:-2])
                                elif "\\" not in candidate_router and "/" not in candidate_router and ".TXT" not in candidate_router and ".TAP" not in candidate_router and len(candidate_router) <= 20:
                                    # Looks like a real machine name (short, no path chars)
                                    identidade_router = candidate_router or name
                                    caminho_completo = ",".join(parts[2:-2])
                                else:
                                    # Penultimate field looks like a path fragment, not a machine name
                                    # Path = join everything between time and tipo
                                    caminho_completo = ",".join(parts[2:-1])
                            else:
                                # Exactly 4 fields: date, time, path, tipo
                                caminho_completo = parts[2]
                            
                            nome_arquivo = caminho_completo.split("\\")[-1] if "\\" in caminho_completo else caminho_completo
                            # Clean trailing whitespace/tabs from file name
                            nome_arquivo = nome_arquivo.strip()
                            iso_time = parse_mach3_time(data_str, hora_str)
                            
                            log_msg = f"[{iso_time}] {identidade_router} | {tipo} | {nome_arquivo}"
                            with open(os.path.join(os.path.dirname(__file__), "monitor.log"), "a", encoding="utf-8") as lf:
                                lf.write(log_msg + "\n")
                            print(log_msg)
                            
                            try:
                                if "INICIO" in tipo:
                                    processa_inicio(caminho_completo, nome_arquivo, iso_time, identidade_router)
                                elif "FIM" in tipo:
                                    processa_fim(iso_time, identidade_router)
                            except Exception as e:
                                print(f"[!] Erro ao processar evento {tipo} de {name}: {e}")
            
            if changed:
                save_state({n: {"last_pos": s["last_pos"]} for n, s in router_states.items()})
        except Exception as e:
            print(f"[!] Erro no loop: {e}")
            traceback.print_exc()
        
        time.sleep(1)

# ==========================================
# MONITOR LASERCAD & RUIDA LASER (UDP 5005 / PORTA 50200)
# ==========================================
import socket

class LaserMonitorThread(threading.Thread):
    # Tempo (em segundos) de segurança para considerar um corte esquecido em aberto (4 horas)
    IDLE_TIMEOUT = 14400

    def __init__(self, laser_ip="192.168.0.2", port=5005):
        super().__init__(daemon=True)
        self.laser_ip = laser_ip
        self.port = port
        self.status = "offline"  # offline, idle, working
        self.last_filename = None
        self.last_cfg_mtime = 0
        self.download_dialog_open = False
        self.running = True
        # Timestamp da última atividade de rede com a controladora
        self.last_network_activity = 0
        self._sniffer_running = False
        self.last_estimated_minutes = None
        self.last_bbox = (None, None, None)
        self.job_start_time = 0
        self.current_estimated_sec = None

    def get_lasercad_estimated_minutes(self):
        """Captura o tempo estimado de corte do LaserCAD (botão/janela Estimate Work Time) via Win32 API."""
        try:
            import ctypes, re
            user32 = ctypes.windll.user32
            WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_int, ctypes.c_int)
            found_times = []

            def get_wtxt(hwnd):
                length = user32.GetWindowTextLengthW(hwnd)
                if length > 0:
                    buff = ctypes.create_unicode_buffer(length + 1)
                    user32.GetWindowTextW(hwnd, buff, length + 1)
                    return buff.value
                return ""

            def enum_windows_cb(hwnd, lparam):
                if user32.IsWindowVisible(hwnd):
                    title = get_wtxt(hwnd)
                    t_low = title.lower()
                    if "lasercad" in t_low or "laser" in t_low or "work time" in t_low or "estimate" in t_low:
                        def enum_child_cb(chwnd, lparam):
                            txt = get_wtxt(chwnd)
                            if txt:
                                m1 = re.search(r'(?:worked\s*times?|work\s*time|estimate\s*time)[:\s]+(\d{1,2}):(\d{2}):(\d{2})', txt, re.IGNORECASE)
                                if m1:
                                    h, m, s = map(int, m1.groups())
                                    tot = h * 60 + m + s / 60.0
                                    if tot > 0: found_times.append(tot)
                                elif "work time" in t_low or "estimate" in t_low or "calculat" in t_low:
                                    m2 = re.search(r'\b(\d{1,2}):(\d{2}):(\d{2})\b', txt)
                                    if m2:
                                        h, m, s = map(int, m2.groups())
                                        tot = h * 60 + m + s / 60.0
                                        if tot > 0: found_times.append(tot)
                            return True
                        user32.EnumChildWindows(hwnd, WNDENUMPROC(enum_child_cb), 0)
                return True

            user32.EnumWindows(WNDENUMPROC(enum_windows_cb), 0)
            if found_times:
                return round(max(found_times), 2)
        except Exception:
            pass
        return None

    def get_lasercad_bounding_box(self):
        """Captura as dimensões exatas de largura (X) e altura (Y) do vetor/desenho no LaserCAD via Win32 API."""
        try:
            import ctypes
            user32 = ctypes.windll.user32
            WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_int, ctypes.c_int)
            WM_GETTEXT = 0x000D
            WM_GETTEXTLENGTH = 0x000E

            class RECT(ctypes.Structure):
                _fields_ = [("left", ctypes.c_long), ("top", ctypes.c_long),
                            ("right", ctypes.c_long), ("bottom", ctypes.c_long)]

            def get_wtxt(hwnd):
                try:
                    length = user32.SendMessageW(hwnd, WM_GETTEXTLENGTH, 0, 0)
                    if length > 0:
                        buff = ctypes.create_unicode_buffer(length + 1)
                        user32.SendMessageW(hwnd, WM_GETTEXT, length + 1, ctypes.byref(buff))
                        return buff.value
                except Exception:
                    pass
                return ""

            def get_cls(hwnd):
                cbuff = ctypes.create_unicode_buffer(256)
                user32.GetClassNameW(hwnd, cbuff, 256)
                return cbuff.value

            def get_wtitle(hwnd):
                length = user32.GetWindowTextLengthW(hwnd)
                if length > 0:
                    buff = ctypes.create_unicode_buffer(length + 1)
                    user32.GetWindowTextW(hwnd, buff, length + 1)
                    return buff.value
                return ""

            def get_wrect(hwnd):
                rect = RECT()
                user32.GetWindowRect(hwnd, ctypes.byref(rect))
                return rect.left, rect.top, rect.right - rect.left, rect.bottom - rect.top

            found_boxes = []

            def enum_win_cb(hwnd, lparam):
                if user32.IsWindowVisible(hwnd):
                    title = get_wtitle(hwnd)
                    if "lasercad" in title.lower() or "laser" in title.lower():
                        wx, wy, ww, wh = get_wrect(hwnd)
                        object_bar_edits = []

                        def enum_child_cb(chwnd, lparam):
                            ccls = get_cls(chwnd)
                            if ccls == "Edit":
                                cx, cy, cw, ch = get_wrect(chwnd)
                                rel_x = cx - wx
                                rel_y = cy - wy
                                txt = get_wtxt(chwnd)
                                if txt:
                                    clean = txt.replace('mm', '').strip()
                                    try:
                                        val = float(clean)
                                        # Object Bar edit controls are in top-left toolbar area (rel_x < 400, rel_y < 160)
                                        if rel_x < 400 and rel_y < 160 and val > 0:
                                            object_bar_edits.append({
                                                'rel_x': rel_x,
                                                'rel_y': rel_y,
                                                'val': val
                                            })
                                    except ValueError:
                                        pass
                            return True

                        user32.EnumChildWindows(hwnd, WNDENUMPROC(enum_child_cb), 0)

                        # Column 2 (x ~ 140-230): Width (top Edit), Height (bottom Edit)
                        col2 = [e for e in object_bar_edits if 140 <= e['rel_x'] <= 230]
                        col2.sort(key=lambda e: e['rel_y'])

                        width_val = None
                        height_val = None

                        if len(col2) >= 2:
                            width_val = col2[0]['val']
                            height_val = col2[1]['val']
                        elif len(object_bar_edits) >= 4:
                            object_bar_edits.sort(key=lambda e: (e['rel_x'], e['rel_y']))
                            width_val = object_bar_edits[2]['val']
                            height_val = object_bar_edits[3]['val']

                        if width_val and height_val:
                            area_m2 = round((width_val / 1000.0) * (height_val / 1000.0), 4)
                            found_boxes.append((round(width_val, 2), round(height_val, 2), area_m2))
                return True

            user32.EnumWindows(WNDENUMPROC(enum_win_cb), 0)

            if found_boxes:
                # Prefer non-full-bed boxes if available
                non_bed_boxes = [b for b in found_boxes if not (abs(b[0] - 1400.0) < 5 and abs(b[1] - 1010.0) < 5)]
                if non_bed_boxes:
                    return non_bed_boxes[0]
                return found_boxes[0]
        except Exception:
            pass
        return None, None, None

    def _start_network_sniffer(self):
        """Inicia thread que escuta tráfego UDP na porta 50200 (AWC controller)."""
        if self._sniffer_running:
            return
        self._sniffer_running = True

        def sniffer():
            try:
                sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
                # Escutar na porta 50200 para captar respostas da controladora
                sock.bind(("0.0.0.0", 50200))
                sock.settimeout(2)
                print(f"[*] Sniffer de rede Laser ativo na porta 50200")
                while self.running:
                    try:
                        data, addr = sock.recvfrom(4096)
                        if data:
                            self.last_network_activity = time.time()
                    except socket.timeout:
                        continue
                    except Exception:
                        continue
            except OSError as e:
                # Porta pode estar em uso pelo LaserCAD — usar abordagem alternativa
                print(f"[!] Porta 50200 em uso, usando monitor de conexões TCP/UDP ativo")
                self._sniffer_via_netstat()
            except Exception as e:
                print(f"[!] Erro no sniffer de rede: {e}")
            finally:
                self._sniffer_running = False

        t = threading.Thread(target=sniffer, daemon=True)
        t.start()

    def _sniffer_via_netstat(self):
        """Fallback: checa conexões ativas com o IP da laser via netstat."""
        while self.running:
            try:
                import subprocess
                result = subprocess.run(
                    ["netstat", "-n"],
                    capture_output=True, text=True, timeout=5
                )
                if self.laser_ip in result.stdout:
                    self.last_network_activity = time.time()
            except Exception:
                pass
            time.sleep(5)

    def run(self):
        print(f"[*] Monitor de Laser (LaserCAD/AWC) iniciado no IP {self.laser_ip}...")
        
        soft_cfg_path = r"C:\LaserCAD\AWCCfg\SoftCfg.ini"
        
        # Iniciar sniffer de rede
        self._start_network_sniffer()
        
        # Inicializar DocName
        if os.path.exists(soft_cfg_path):
            self.last_cfg_mtime = os.path.getmtime(soft_cfg_path)
            doc = self.read_doc_name(soft_cfg_path)
            if doc:
                self.last_filename = doc
                print(f"[*] Projeto atual no LaserCAD: {doc}")

        while self.running:
            try:
                # 0. Capturar tempo estimado e dimensões m² se visíveis no LaserCAD
                captured_est = self.get_lasercad_estimated_minutes()
                if captured_est:
                    self.last_estimated_minutes = captured_est

                bx, by, barea = self.get_lasercad_bounding_box()
                if bx and by:
                    self.last_bbox = (bx, by, barea)

                # 1. Detectar janela "Download Document" do LaserCAD via Win32 API
                download_visible = self.is_download_dialog_open()
                
                if download_visible and not self.download_dialog_open:
                    # Dialog acabou de abrir - ler o DocName do SoftCfg.ini
                    self.download_dialog_open = True
                    doc = self.read_doc_name(soft_cfg_path)
                    if doc:
                        self.last_filename = doc
                    print(f"[~] Janela Download Document aberta (projeto: {self.last_filename})")
                
                elif not download_visible and self.download_dialog_open:
                    # Dialog acabou de fechar = Download foi enviado!
                    self.download_dialog_open = False
                    doc = self.read_doc_name(soft_cfg_path)
                    if doc:
                        self.last_filename = doc
                    
                    file_to_report = self.last_filename or f"Corte Laser {datetime.datetime.now().strftime('%H:%M')}"
                    print(f"[+] LASER DOWNLOAD ENVIADO: {file_to_report}")
                    
                    est_to_report = self.last_estimated_minutes or self.get_lasercad_estimated_minutes()
                    if est_to_report:
                        print(f"[~] Tempo estimado do LaserCAD capturado: {est_to_report:.2f} min")

                    res_x, res_y, res_area = self.last_bbox if self.last_bbox[0] else self.get_lasercad_bounding_box()
                    if res_x and res_y:
                        print(f"[~] Dimensões m² do LaserCAD capturadas: {res_x}mm x {res_y}mm ({res_area} m²)")

                    if self.status == "working":
                        # Finalizar job anterior primeiro ao iniciar um novo download
                        processa_fim(datetime.datetime.now().astimezone().isoformat(), "Laser Ruida")
                    
                    processa_inicio(
                        caminho=f"LaserCAD\\{file_to_report}",
                        nome_arquivo=file_to_report,
                        iso_time=datetime.datetime.now().astimezone().isoformat(),
                        origem="Laser Ruida",
                        estimated_minutes=est_to_report,
                        max_x=res_x,
                        max_y=res_y,
                        area_m2=res_area
                    )
                    self.status = "working"
                    self.job_start_time = time.time()
                    self.current_estimated_sec = (est_to_report * 60.0) if est_to_report else None
                    self.last_network_activity = time.time()
                    self.last_estimated_minutes = None
                    self.last_bbox = (None, None, None)

                # 1.5. Trigger automático por início de transmissão de rede com a controladora
                net_active = (self.last_network_activity > 0 and (time.time() - self.last_network_activity) < 3)
                if self.status != "working" and net_active:
                    doc = self.read_doc_name(soft_cfg_path)
                    if doc:
                        self.last_filename = doc
                    file_to_report = self.last_filename or f"Corte Laser {datetime.datetime.now().strftime('%H:%M')}"
                    print(f"[+] LASER CORTE INICIADO (Transmissão de Rede): {file_to_report}")

                    est_to_report = self.last_estimated_minutes or self.get_lasercad_estimated_minutes()
                    res_x, res_y, res_area = self.last_bbox if self.last_bbox[0] else self.get_lasercad_bounding_box()

                    processa_inicio(
                        caminho=f"LaserCAD\\{file_to_report}",
                        nome_arquivo=file_to_report,
                        iso_time=datetime.datetime.now().astimezone().isoformat(),
                        origem="Laser Ruida",
                        estimated_minutes=est_to_report,
                        max_x=res_x,
                        max_y=res_y,
                        area_m2=res_area
                    )
                    self.status = "working"
                    self.job_start_time = time.time()
                    self.current_estimated_sec = (est_to_report * 60.0) if est_to_report else None
                    self.last_estimated_minutes = None
                    self.last_bbox = (None, None, None)

                # 2. Checar SoftCfg.ini para atualizar DocName
                if os.path.exists(soft_cfg_path):
                    try:
                        mtime = os.path.getmtime(soft_cfg_path)
                        if mtime > self.last_cfg_mtime:
                            self.last_cfg_mtime = mtime
                            doc = self.read_doc_name(soft_cfg_path)
                            if doc:
                                self.last_filename = doc
                                print(f"[~] Projeto LaserCAD atualizado: {doc}")
                    except Exception:
                        pass

                # 3. Detectar FIM do corte automaticamente após o bipe / término do tempo de corte
                if self.status == "working":
                    now_ts = time.time()
                    job_dur = (now_ts - self.job_start_time) if self.job_start_time > 0 else 0

                    is_finished = False
                    reason = ""

                    # Regra A: Se temos o tempo estimado do LaserCAD, aguarda o cumprimento do tempo de corte físico
                    if self.current_estimated_sec and self.current_estimated_sec > 0:
                        if job_dur >= self.current_estimated_sec * 0.95:
                            is_finished = True
                            reason = f"tempo de corte do LaserCAD concluído ({job_dur:.1f}s / {self.current_estimated_sec:.0f}s)"

                    # Regra B: Se NÃO temos o tempo estimado, aguarda pelo menos 10 minutos de corte antes de finalizar por inatividade
                    elif job_dur >= 600:
                        is_finished = True
                        reason = f"tempo padrão de corte concluído ({int(job_dur)}s)"

                    if is_finished:
                        print(f"[+] LASER CORTE FINALIZADO AUTOMATICAMENTE: {reason}")
                        processa_fim(datetime.datetime.now().astimezone().isoformat(), "Laser Ruida")
                        self.status = "idle"
                        self.last_network_activity = 0
                        self.job_start_time = 0
                        self.current_estimated_sec = None

                # 4. Ping check para conexao de rede com a maquina
                is_alive = os.system(f"ping -n 1 -w 1500 {self.laser_ip} > nul") == 0

                if is_alive:
                    if self.status == "offline":
                        print(f"[+] Laser ({self.laser_ip}) ficou ONLINE!")
                        self.status = "idle"
                else:
                    if self.status != "offline" and self.status != "working":
                        print(f"[!] Laser ({self.laser_ip}) desconectada / offline.")
                        self.status = "offline"
            except Exception as e:
                pass

            time.sleep(1)

    def is_download_dialog_open(self):
        """Detectar se a janela de Download / Transmissão do LaserCAD está aberta via Win32 API"""
        try:
            import ctypes
            user32 = ctypes.windll.user32
            
            # Check multiple common window titles for download/transfer in LaserCAD
            titles = ["Download Document", "Download", "Baixar", "Enviar", "Transfer", "Download File"]
            for t in titles:
                hwnd = user32.FindWindowW(None, t)
                if hwnd and user32.IsWindowVisible(hwnd):
                    return True
            return False
        except Exception:
            return False

    def read_doc_name(self, cfg_path):
        try:
            with open(cfg_path, 'r', encoding='utf-8', errors='ignore') as f:
                for line in f:
                    if line.strip().startswith('DocName='):
                        val = line.strip().split('=', 1)[1].strip()
                        if val and len(val) >= 2:
                            return val
        except Exception:
            pass
        return None

    def find_recent_lasercad_file(self, search_dirs):
        now = time.time()
        for d in search_dirs:
            if os.path.exists(d):
                try:
                    for root, _, files in os.walk(d):
                        for f in files:
                            if f.lower().endswith(('.pw5', '.ud5', '.pw', '.dxf', '.plt', '.nc')):
                                fpath = os.path.join(root, f)
                                mtime = os.path.getmtime(fpath)
                                # Se modificado nos últimos 60 segundos
                                if now - mtime < 60:
                                    return f
                except Exception:
                    pass
        return None

def start_laser_monitor():
    t = LaserMonitorThread(laser_ip="192.168.0.2", port=5005)
    t.start()

if __name__ == "__main__":
    start_laser_monitor()
    main()

