"""
Sincroniza TODOS os dados históricos dos log_oficial.csv das routers para o Render.
Isso recupera o histórico completo de produção.
"""
import os, json, requests, datetime, re, time

RENDER_URL = "https://mach3-tracker.onrender.com"

with open("config.json") as f:
    config = json.load(f)

token = config["token"]
headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

# Verificar token
r = requests.get(f"{RENDER_URL}/api/user/me", headers=headers, timeout=10)
print(f"Auth: {r.status_code}")

# Buscar jobs existentes para dedup
r = requests.get(f"{RENDER_URL}/api/jobs", headers=headers, timeout=30)
existing_jobs = r.json() if isinstance(r.json(), list) else []
existing_fps = set()
for j in existing_jobs:
    st = (j.get("start_time") or "")[:19]
    existing_fps.add(f"{st}|{j.get('file_name','')}|{j.get('router_name','')}")
print(f"Jobs existentes: {len(existing_jobs)}")

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
total_skip = 0

for router in routers:
    rname = router["name"]
    log_path = router["log_file"]
    
    if not os.path.exists(log_path):
        print(f"[!] Log nao encontrado: {log_path}")
        continue
    
    print(f"\n=== {rname} ===")
    with open(log_path, 'r', encoding='cp1252', errors='replace') as f:
        lines = f.readlines()
    print(f"  Linhas: {len(lines)}")
    
    pending = None
    jobs = []
    
    for line in lines:
        line = line.strip()
        if not line: continue
        parts = line.split(',')
        if len(parts) < 4: continue
        
        d, h, path = parts[0], parts[1], parts[2]
        
        identity = rname
        if len(parts) >= 5:
            rn = parts[-2].strip().upper()
            if rn == "ACT10": identity = "Router 2"
            elif "ROUTER CENTRAL" in rn: identity = "Router 1"
            else: identity = rn or rname
        
        tipo = parts[-1].strip().upper()
        dt, iso = parse_time(d, h)
        if not dt: continue
        
        fname = path.split("\\")[-1] if "\\" in path else path
        if "PING" in fname.upper(): continue
        
        if "INICIO" in tipo:
            if pending and pending["file_name"] != fname:
                jobs.append(pending)
            pending = {
                "file_name": fname,
                "folder": f"{identity} | {extract_project(path)}",
                "file_path": path,
                "start_time": iso,
                "router_name": identity,
                "end_time": None
            }
        elif "FIM" in tipo and pending:
            pending["end_time"] = iso
            jobs.append(pending)
            pending = None
    
    if pending: jobs.append(pending)
    
    # Dedup
    new_jobs = []
    for j in jobs:
        fp = f"{(j['start_time'] or '')[:19]}|{j['file_name']}|{j['router_name']}"
        if fp not in existing_fps:
            new_jobs.append(j)
            existing_fps.add(fp)
        else:
            total_skip += 1
    
    print(f"  Total: {len(jobs)}, Novos: {len(new_jobs)}, Skip: {total_skip}")
    
    for i, j in enumerate(new_jobs):
        try:
            resp = requests.post(f"{RENDER_URL}/api/jobs", json={
                "file_name": j["file_name"],
                "folder": j["folder"],
                "file_path": j["file_path"],
                "start_time": j["start_time"],
                "router_name": j["router_name"],
            }, headers=headers, timeout=10)
            
            if resp.status_code in (200, 201):
                data = resp.json()
                jid = data.get("id")
                if j.get("end_time") and jid:
                    requests.patch(f"{RENDER_URL}/api/jobs/{jid}",
                        json={"end_time": j["end_time"]}, headers=headers, timeout=10)
                total_synced += 1
            
            if (i+1) % 50 == 0:
                print(f"    [{i+1}/{len(new_jobs)}] synced={total_synced}")
        except Exception as e:
            print(f"    ERRO: {e}")
        time.sleep(0.2)

print(f"\n{'='*50}")
print(f"TOTAL: {total_synced} novos jobs sincronizados, {total_skip} duplicados ignorados")

r = requests.get(f"{RENDER_URL}/api/jobs", headers=headers, timeout=30)
final = r.json() if isinstance(r.json(), list) else []
print(f"Jobs no Render: {len(final)}")
