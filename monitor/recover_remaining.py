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
        if resp.status_code == 200: cached_materials = resp.json()
    except: pass

def simulate_gcode_time(filepath):
    local_path = filepath
    unc_mappings = { 
        r"\\TOMAS\arquivos 2024": r"E:\arquivos 2024", 
        r"\\DESKTOP-1CSKMNT\Mach3": r"C:\mach3",
        r"\\TOMAS\ARQUIVOS 2026": r"E:\ARQUIVOS 2026"
    }
    for unc_prefix, local_prefix in unc_mappings.items():
        if local_path.upper().startswith(unc_prefix.upper()):
            local_path = local_prefix + local_path[len(unc_prefix):]
            break
    if not os.path.exists(local_path): return 5.0
    try:
        feed_rate = 1200.0
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
        return max(round(total_time * 1.10, 2), 2.0)
    except: return 5.0

def recover():
    update_materials()
    if not os.path.exists(LOG_PATH): return
    with open(LOG_PATH, 'r', encoding='utf-8', errors='ignore') as f:
        lines = f.readlines()

    all_found = []
    current_opens = {}
    for line in lines:
        parts = line.strip().split(',')
        if len(parts) < 4: continue
        date_str, time_str, file_path, status = parts[0], parts[1], parts[2], parts[-1]
        router = parts[3] if len(parts) == 5 else "Central"
        
        if "GLOBOTOY" in file_path.upper(): continue
        
        try:
            dt = datetime.datetime.strptime(f"{date_str} {time_str}", "%d/%m/%Y %H:%M:%S")
        except: continue

        if status == "INICIO":
            current_opens[router] = {
                "file_name": os.path.basename(file_path),
                "folder": file_path,
                "file_path": file_path,
                "start_time": dt,
                "router_name": router
            }
        elif status == "FIM" and router in current_opens:
            job = current_opens.pop(router)
            duration_sec = (dt - job['start_time']).total_seconds()
            if duration_sec < 20: continue
            
            duration_min = duration_sec / 60
            est = simulate_gcode_time(job['file_path'])
            
            if duration_min > 120:
                job['end_time'] = job['start_time'] + datetime.timedelta(minutes=est)
            else:
                job['end_time'] = dt
                
            job['duration_min'] = duration_min
            job['estimated_minutes'] = est
            all_found.append(job)

    final_jobs = []
    all_found.sort(key=lambda x: x['start_time'])
    i = 0
    while i < len(all_found):
        best_job = all_found[i]
        j = i + 1
        while j < len(all_found) and (all_found[j]['start_time'] - best_job['start_time']).total_seconds() < 180:
            if all_found[j]['file_name'] == best_job['file_name']:
                if all_found[j]['duration_min'] > best_job['duration_min']: best_job = all_found[j]
            j += 1
        final_jobs.append(best_job)
        i = j

    print(f"Subindo {len(final_jobs)} trabalhos restantes higienizados...")
    count = 0
    for job in final_jobs:
        payload = {
            "file_name": job['file_name'],
            "folder": job['folder'],
            "file_path": job['file_path'],
            "start_time": job['start_time'].strftime("%Y-%m-%dT%H:%M:%S-03:00"),
            "router_name": job['router_name'],
            "estimated_minutes": job['estimated_minutes'],
            "material_price": 0
        }
        try:
            r = requests.post(f"{BASE_URL}/api/jobs", json=payload, headers=headers, timeout=10)
            if r.status_code in (200, 201):
                end_time_str = job['end_time'].strftime("%Y-%m-%dT%H:%M:%S-03:00")
                requests.patch(f"{BASE_URL}/api/jobs/latest", json={"end_time": end_time_str, "router_name": job['router_name']}, headers=headers, timeout=10)
                count += 1
                if count % 20 == 0: print(f"{count} jobs restaurados...")
        except: pass
    print(f"Sucesso: {count} jobs adicionais restaurados!")

if __name__ == "__main__":
    recover()
