"""
Sync LIMPO - Envia apenas jobs reais (duração > 1 min) para o Render.
Filtra falsos starts e duplicatas.
"""
import os, json, requests, datetime, re, time

RENDER_URL = "https://mach3-tracker.onrender.com"
MIN_DURATION_MIN = 1.0  # Ignora jobs com menos de 1 minuto

with open("config.json") as f:
    config = json.load(f)
token = config["token"]
headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

# Verificar
r = requests.get(f"{RENDER_URL}/api/user/me", headers=headers, timeout=10)
print(f"Auth: {r.status_code}")

routers = [
    {"name": "Router Central", "log_file": r"\\DESKTOP-1CSKMNT\Mach3\log_oficial.csv"},
    {"name": "Router 2", "log_file": r"\\ACT10\Mach3\log_oficial.csv"},
]

skip_list = ["ROUTER", "ISOPOR", "ARQUIVO", "CNC", "ARQUIVOS", "2024", "2026", "TOMAS", "MACH3"]

def parse_time(d, h):
    try:
        dt = datetime.datetime.strptime(f"{d.strip()} {h.strip()}", "%d/%m/%Y %H:%M:%S")
        return dt, dt.astimezone().isoformat()
    except:
        return None, None

def extract_project(path):
    parts = [p for p in path.split("\\") if p]
    folders = parts[:-1] if len(parts) > 1 else parts
    for p in reversed(folders):
        if p.upper() not in skip_list and len(p) > 2 and "." not in p:
            return p
    return folders[-1] if folders else "Desconhecido"

total_synced = 0
total_filtered = 0
sent_fps = set()

for router in routers:
    rname = router["name"]
    log_path = router["log_file"]
    
    if not os.path.exists(log_path):
        print(f"[!] Nao encontrado: {log_path}")
        continue
    
    print(f"\n=== {rname} ===")
    with open(log_path, 'r', encoding='cp1252', errors='replace') as f:
        lines = f.readlines()
    print(f"  Linhas: {len(lines)}")
    
    # Parse ALL events in order
    events = []
    for line in lines:
        line = line.strip()
        if not line: continue
        parts = line.split(',')
        if len(parts) < 4: continue
        
        d, h, path_full = parts[0], parts[1], parts[2]
        tipo = parts[-1].strip().upper()
        dt, iso = parse_time(d, h)
        if not dt: continue
        
        fname = path_full.split("\\")[-1] if "\\" in path_full else path_full
        if "PING" in fname.upper(): continue
        
        identity = rname
        if len(parts) >= 5:
            rn = parts[-2].strip().upper()
            if rn == "ACT10": identity = "Router 2"
        
        events.append({
            "dt": dt, "iso": iso, "fname": fname, 
            "path": path_full, "tipo": tipo, "router": identity
        })
    
    # Build jobs by matching INICIO->FIM pairs correctly
    valid_jobs = []
    current_start = None
    
    for ev in events:
        if "INICIO" in ev["tipo"]:
            # If we have a pending start, check if it should be saved
            if current_start:
                # Auto-close previous at this event's time
                dur = (ev["dt"] - current_start["dt"]).total_seconds() / 60.0
                if dur >= MIN_DURATION_MIN:
                    valid_jobs.append({
                        "file_name": current_start["fname"],
                        "folder": extract_project(current_start["path"]),
                        "file_path": current_start["path"],
                        "start_time": current_start["iso"],
                        "end_time": ev["iso"],
                        "router_name": current_start["router"],
                        "duration": dur
                    })
                else:
                    total_filtered += 1
            
            current_start = ev
            
        elif "FIM" in ev["tipo"]:
            if current_start:
                dur = (ev["dt"] - current_start["dt"]).total_seconds() / 60.0
                if dur >= MIN_DURATION_MIN:
                    valid_jobs.append({
                        "file_name": current_start["fname"],
                        "folder": extract_project(current_start["path"]),
                        "file_path": current_start["path"],
                        "start_time": current_start["iso"],
                        "end_time": ev["iso"],
                        "router_name": current_start["router"],
                        "duration": dur
                    })
                else:
                    total_filtered += 1
                current_start = None
    
    # Last pending job (still running)
    if current_start:
        valid_jobs.append({
            "file_name": current_start["fname"],
            "folder": extract_project(current_start["path"]),
            "file_path": current_start["path"],
            "start_time": current_start["iso"],
            "end_time": None,
            "router_name": current_start["router"],
            "duration": 0
        })
    
    # Dedup within this router (same start_time + file_name)
    deduped = []
    for j in valid_jobs:
        fp = f"{(j['start_time'] or '')[:19]}|{j['file_name']}|{j['router_name']}"
        if fp not in sent_fps:
            deduped.append(j)
            sent_fps.add(fp)
    
    print(f"  Jobs validos (>{MIN_DURATION_MIN}min): {len(deduped)}")
    print(f"  Filtrados (falsos starts): {total_filtered}")
    
    # Send to Render
    for i, j in enumerate(deduped):
        try:
            payload = {
                "file_name": j["file_name"],
                "folder": j["folder"],
                "file_path": j["file_path"],
                "start_time": j["start_time"],
                "router_name": j["router_name"],
            }
            resp = requests.post(f"{RENDER_URL}/api/jobs", json=payload, headers=headers, timeout=10)
            if resp.status_code in (200, 201):
                data = resp.json()
                jid = data.get("id")
                if j.get("end_time") and jid:
                    requests.patch(f"{RENDER_URL}/api/jobs/{jid}",
                        json={"end_time": j["end_time"]}, headers=headers, timeout=10)
                total_synced += 1
            
            if (i+1) % 50 == 0:
                print(f"    [{i+1}/{len(deduped)}]")
        except Exception as e:
            print(f"    ERRO: {e}")
        time.sleep(0.15)

print(f"\n{'='*50}")
print(f"JOBS ENVIADOS: {total_synced}")
print(f"FILTRADOS: {total_filtered}")

r = requests.get(f"{RENDER_URL}/api/jobs", headers=headers, timeout=30)
final = r.json() if isinstance(r.json(), list) else []
print(f"JOBS NO RENDER: {len(final)}")
