import requests, json, datetime, time, re, os, math

BASE_URL = "https://mach3-tracker-production.up.railway.app"
LOG_PATH = r"\\DESKTOP-1CSKMNT\Mach3\log_oficial.csv"
CONFIG_FILE = "config.json"

config = json.load(open(CONFIG_FILE))
headers = {
    'Authorization': 'Bearer ' + config['token'],
    'Content-Type': 'application/json'
}

cached_materials = []

def update_materials():
    global cached_materials
    try:
        resp = requests.get(f"{BASE_URL}/api/materials", headers=headers, timeout=5)
        if resp.status_code == 200:
            cached_materials = resp.json()
            print(f"[*] {len(cached_materials)} materiais carregados para auto-vínculo.")
    except Exception as e:
        print(f"[!] Erro ao carregar materiais: {e}")

def find_material_match(filename):
    if not cached_materials: return None
    clean_name = filename.lower()
    name_no_ext = clean_name.rsplit('.', 1)[0]
    words = re.split(r'[ _\-]', name_no_ext)
    words = [w.strip() for w in words if w.strip()]
    if not words: return None
    
    w1 = words[0]
    w2 = words[1] if len(words) > 1 else ""
    phrase_2 = f"{w1} {w2}".strip()
    
    sorted_mats = sorted(cached_materials, key=lambda x: len(x['name']), reverse=True)
    
    for mat in sorted_mats:
        mat_name = mat['name'].lower()
        if mat_name == phrase_2: return mat
            
    for mat in sorted_mats:
        mat_name = mat['name'].lower()
        if w1 in mat_name and w2 and w2 in mat_name: return mat

    for mat in sorted_mats:
        mat_name = mat['name'].lower()
        if mat_name == w1 or mat_name.startswith(w1 + " "): return mat
                
    return None

def simulate_gcode_time(filepath):
    local_path = filepath
    unc_mappings = {
        r"\\TOMAS\arquivos 2024": r"E:\arquivos 2024",
        r"\\DESKTOP-1CSKMNT\Mach3": r"C:\mach3",
    }
    for unc_prefix, local_prefix in unc_mappings.items():
        if local_path.upper().startswith(unc_prefix.upper()):
            local_path = local_prefix + local_path[len(unc_prefix):]
            break
            
    if not os.path.exists(local_path): return None
    
    try:
        feed_rate = 1000.0
        total_time = 0.0
        lx, ly = 0.0, 0.0
        with open(local_path, 'r', encoding='cp1252', errors='ignore') as f:
            for line in f:
                line = line.strip().upper()
                if not line or line.startswith('('): continue
                fm = re.search(r'F([\d.]+)', line)
                if fm: feed_rate = float(fm.group(1))
                xm = re.search(r'X(-?[\d.]+)', line)
                ym = re.search(r'Y(-?[\d.]+)', line)
                nx = float(xm.group(1)) if xm else lx
                ny = float(ym.group(1)) if ym else ly
                dist = math.sqrt((nx-lx)**2 + (ny-ly)**2)
                if dist > 0: total_time += dist / feed_rate
                lx, ly = nx, ny
        return round(total_time * 1.15, 2)
    except: return None

def sync_job(payload_start, end_time):
    try:
        r = requests.post(f"{BASE_URL}/api/jobs", json=payload_start, headers=headers, timeout=10)
        if r.status_code in (200, 201):
            job_id = r.json().get('id')
            if job_id and end_time:
                requests.patch(f"{BASE_URL}/api/jobs/latest", json={"end_time": end_time, "router_name": payload_start.get('router_name')}, headers=headers, timeout=10)
            return True
        else:
            print(f"Erro ao subir job: {r.status_code} - {r.text}")
    except Exception as e:
        print(f"Exceção no sync: {e}")
    return False

def recover():
    update_materials()
    if not os.path.exists(LOG_PATH):
        print("Arquivo de log não encontrado!")
        return

    with open(LOG_PATH, 'r', encoding='utf-8', errors='ignore') as f:
        lines = f.readlines()

    print(f"Analisando {len(lines)} linhas de histórico...")
    
    jobs_found = []
    current_opens = {}
    
    for line in lines:
        parts = line.strip().split(',')
        if len(parts) < 4: continue
        
        date_str, time_str, file_path, status = parts[0], parts[1], parts[2], parts[-1]
        router = parts[3] if len(parts) == 5 else "Central"
        
        try:
            dt = datetime.datetime.strptime(f"{date_str} {time_str}", "%d/%m/%Y %H:%M:%S")
            iso_time = dt.strftime("%Y-%m-%dT%H:%M:%S-03:00")
        except: continue
        
        if status == "INICIO":
            current_opens[router] = {
                "file_name": os.path.basename(file_path),
                "folder": file_path,
                "file_path": file_path,
                "start_time": iso_time,
                "router_name": router,
                "dt": dt
            }
        elif status == "FIM" and router in current_opens:
            job = current_opens.pop(router)
            duration = (dt - job['dt']).total_seconds() / 60
            if duration > 0.1:
                job['end_time'] = iso_time
                jobs_found.append(job)

    print(f"Encontrados {len(jobs_found)} trabalhos completos para resgate.")
    jobs_found.sort(key=lambda x: x['start_time'])
    
    count = 0
    for job in jobs_found:
        # Detect Material
        mat = find_material_match(job['file_name'])
        mat_id = mat['id'] if mat else None
        mat_name = mat['name'] if mat else None
        mat_price = mat['price'] if mat else None
        
        # Simulate Time
        est = simulate_gcode_time(job['file_path'])
        
        payload = {
            "file_name": job['file_name'],
            "folder": job['folder'],
            "file_path": job['file_path'],
            "start_time": job['start_time'],
            "router_name": job['router_name'],
            "estimated_minutes": est,
            "material_id": mat_id,
            "material_name": mat_name,
            "material_price": mat_price
        }
        
        if sync_job(payload, job['end_time']):
            count += 1
            if count % 10 == 0:
                print(f"[*] {count} jobs recuperados e vinculados.")
            
    print(f"\n✅ SUCESSO: {count} trabalhos históricos foram restaurados e vinculados a materiais!")

if __name__ == "__main__":
    recover()
