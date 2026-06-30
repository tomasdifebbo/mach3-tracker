import json
import requests
import re
import os
import sys

BASE_URL = "https://mach3-tracker.onrender.com"
DB_PATH = r"C:\DASHBOARD\server\tracker.json"
CONFIG_PATH = r"C:\DASHBOARD\monitor\config.json"

cached_materials = []

def load_config():
    if os.path.exists(CONFIG_PATH):
        with open(CONFIG_PATH, 'r') as f:
            return json.load(f)
    return {}

def get_token():
    config = load_config()
    email = config.get('email')
    password = config.get('password')
    if not email or not password:
        print('[X] Configure email/senha no config.json')
        return None
    try:
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={'email': email, 'password': password})
        if resp.status_code == 200:
            return resp.json()['token']
        else:
            print(f'[X] Erro de login: {resp.status_code}')
    except Exception as e:
        print(f'[X] Erro de conexao: {e}')
    return None

def update_materials(token):
    global cached_materials
    headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
    try:
        resp = requests.get(f'{BASE_URL}/api/materials', headers=headers, timeout=5)
        if resp.status_code == 200:
            cached_materials = resp.json()
            print(f'[*] {len(cached_materials)} materiais carregados para identificacao.')
    except Exception as e:
        print(f'[!] Erro ao carregar materiais: {e}')

def find_material_match(filename):
    if not cached_materials:
        return None
    clean_name = filename.lower()
    name_no_ext = clean_name.rsplit('.', 1)[0]
    words = re.split('[ _\\-]', name_no_ext)
    words = [w.strip() for w in words if w.strip()]
    if not words:
        return None
    w1 = words[0]
    w2 = words[1] if len(words) > 1 else ''
    w3 = words[2] if len(words) > 2 else ''
    phrase_2 = f'{w1} {w2}'.strip()
    phrase_3 = f'{w1} {w2} {w3}'.strip()
    sorted_mats = sorted(cached_materials, key=lambda x: len(x['name']), reverse=True)
    for mat in sorted_mats:
        mat_name = mat['name'].lower()
        if mat_name == phrase_3 or mat_name == phrase_2:
            return mat
    for mat in sorted_mats:
        mat_name = mat['name'].lower()
        if w1 in mat_name and w2 and (w2 in mat_name) and w3 and (w3 in mat_name):
            return mat
        if w1 in mat_name and w2 and (w2 in mat_name):
            return mat
    for mat in sorted_mats:
        mat_name = mat['name'].lower()
        if mat_name == w3 or mat_name == w2 or mat_name == w1 or mat_name.startswith(w1 + ' '):
            return mat
    return None

def extract_router_name(folder):
    match = re.search(r'ROUTER\s*([A-Za-z0-9]+)', folder, re.IGNORECASE)
    if match:
        return f"Router {match.group(1).upper()}"
    return "Router 1"

def restore():
    print("Iniciando restauracao do historico...")
    token = get_token()
    if not token:
        return
    
    update_materials(token)
    headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
    
    if not os.path.exists(DB_PATH):
        print("Arquivo tracker.json nao encontrado!")
        return
        
    with open(DB_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    jobs_to_sync = []
    for item in data:
        mat = find_material_match(item.get('file_name', ''))
        router = extract_router_name(item.get('folder', ''))
        
        job_payload = {
            "file_name": item.get('file_name'),
            "folder": item.get('folder'),
            "file_path": item.get('file_path'),
            "start_time": item.get('start_time'),
            "end_time": item.get('end_time'),
            "duration_minutes": item.get('duration_minutes', 0),
            "router_name": router
        }
        
        if mat:
            job_payload["material_id"] = mat["id"]
            job_payload["material_name"] = mat["name"]
            job_payload["material_price"] = mat["price"]
            
        jobs_to_sync.append(job_payload)
        
    print(f"Sincronizando {len(jobs_to_sync)} jobs com materiais identificados...")
    
    # Enviar em lotes
    batch_size = 50
    for i in range(0, len(jobs_to_sync), batch_size):
        batch = jobs_to_sync[i:i+batch_size]
        try:
            resp = requests.post(f"{BASE_URL}/api/jobs", headers=headers, json={"jobs": batch})
            if resp.status_code in (200, 201):
                print(f"Lote {i//batch_size + 1} enviado com sucesso!")
            else:
                print(f"Erro no lote {i//batch_size + 1}: {resp.text}")
        except Exception as e:
            print(f"Excecao enviando lote {i//batch_size + 1}: {e}")
            
    print("Historico restaurado!")

if __name__ == '__main__':
    restore()
