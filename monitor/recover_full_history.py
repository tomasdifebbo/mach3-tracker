import requests
import datetime
import time
import os
import math
import re

BASE_URL = "https://mach3-tracker-production.up.railway.app"
LOG_FILE = r"\\DESKTOP-1CSKMNT\Mach3\log_oficial.csv"

# UNC-to-local path mapping for time simulation
UNC_MAPPINGS = {
    "\\\\TOMAS\\arquivos 2024": "E:\\arquivos 2024",
}

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
                    rate = rapid_rate if 'G00' in line else feed_rate
                    if rate > 0: total_time += dist / rate
                lx, ly, lz = nx, ny, nz
        return round(total_time * 1.15, 2)
    except:
        return None

def get_local_path(unc_path):
    for unc, local in UNC_MAPPINGS.items():
        if unc_path.upper().startswith(unc.upper()):
            return local + unc_path[len(unc):]
    return unc_path

def parse_time(date_str, time_str):
    try:
        dt = datetime.datetime.strptime(f"{date_str.strip()} {time_str.strip()}", "%d/%m/%Y %H:%M:%S")
        return dt.replace(tzinfo=datetime.timezone(datetime.timedelta(hours=-3))).isoformat()
    except:
        return None

def main():
    print("[*] Lendo log completo...")
    with open(LOG_FILE, 'r', encoding='utf-8', errors='ignore') as f:
        raw_lines = f.readlines()
    
    print(f"[*] {len(raw_lines)} linhas no log")
    
    # Parse all events
    events = []
    for line in raw_lines:
        line = line.strip()
        if not line: continue
        parts = line.split(',')
        if len(parts) < 4: continue
        
        date_str = parts[0]
        time_str = parts[1]
        caminho = parts[2]
        
        # Detect router identity
        router = "Router 1"
        if len(parts) >= 5:
            r_name = parts[-2].strip().upper()
            tipo = parts[-1].strip().upper()
            if r_name == "ACT10":
                router = "Router 2"
            elif "ROUTER CENTRAL" in r_name:
                router = "Router 1"
            else:
                tipo = parts[-1].strip().upper()
        else:
            tipo = parts[-1].strip().upper()
        
        iso = parse_time(date_str, time_str)
        if not iso: continue
        
        nome = caminho.split("\\")[-1] if "\\" in caminho else caminho
        
        # Skip ping/test
        if "PING" in nome.upper() or "DESCONHECIDO" in nome.upper():
            if "FIM" not in tipo:
                continue
        
        # Extract project name
        full_parts = [p for p in caminho.split("\\") if p]
        folder_parts = full_parts[:-1] if len(full_parts) > 1 else full_parts
        skip_list = ["ROUTER", "ISOPOR", "ARQUIVO", "CNC", "ARQUIVOS", "2024", "2026", "TOMAS", "MACH3"]
        project_name = "Desconhecido"
        for p in reversed(folder_parts):
            if p.upper() not in skip_list and len(p) > 2 and "." not in p:
                project_name = p
                break
        
        events.append({
            "type": tipo,
            "time": iso,
            "file_name": nome,
            "path": caminho,
            "router": router,
            "project": project_name
        })
    
    print(f"[*] {len(events)} eventos parseados")
    
    # Build job pairs (INICIO -> FIM)
    jobs = []
    open_jobs = {}  # key = router
    
    for ev in events:
        if "INICIO" in ev["type"]:
            # Close any previous open job on same router
            key = ev["router"]
            if key in open_jobs:
                prev = open_jobs[key]
                prev["end_time"] = ev["time"]
                jobs.append(prev)
            
            open_jobs[key] = {
                "file_name": ev["file_name"],
                "start_time": ev["time"],
                "end_time": None,
                "router": ev["router"],
                "project": ev["project"],
                "path": ev["path"]
            }
        elif "FIM" in ev["type"]:
            key = ev["router"]
            if key in open_jobs:
                open_jobs[key]["end_time"] = ev["time"]
                jobs.append(open_jobs[key])
                del open_jobs[key]
    
    # Add any still-open jobs
    for key, job in open_jobs.items():
        jobs.append(job)
    
    # Filter out ghost jobs (< 1 minute)
    real_jobs = []
    for j in jobs:
        if j["end_time"]:
            start = datetime.datetime.fromisoformat(j["start_time"])
            end = datetime.datetime.fromisoformat(j["end_time"])
            dur = (end - start).total_seconds() / 60
            if dur < 1:
                continue
        if "DESCONHECIDO" in j["file_name"].upper():
            continue
        if "PING" in j["file_name"].upper():
            continue
        real_jobs.append(j)
    
    print(f"[*] {len(real_jobs)} jobs reais encontrados")
    
    # Login
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "casadotrem@gmail.com", "password": "123456"})
    token = r.json()["token"]
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    # First, clear any existing jobs to avoid duplicates
    existing = requests.get(f"{BASE_URL}/api/jobs", headers=headers).json()
    if existing:
        print(f"[*] Limpando {len(existing)} jobs existentes...")
        for j in existing:
            requests.delete(f"{BASE_URL}/api/jobs/{j['id']}", headers=headers)
    
    # Sort by start_time
    real_jobs.sort(key=lambda x: x["start_time"])
    
    # Upload each job
    for i, job in enumerate(real_jobs):
        # Try to simulate time
        local_path = get_local_path(job["path"])
        est = None
        if os.path.exists(local_path):
            est = simulate_gcode_time(local_path)
        
        payload = {
            "file_name": job["file_name"],
            "folder": f"{job['router']} | {job['project']}",
            "file_path": job["path"],
            "start_time": job["start_time"],
            "router_name": job["router"],
            "estimated_minutes": est
        }
        
        resp = requests.post(f"{BASE_URL}/api/jobs", json=payload, headers=headers)
        new_id = resp.json().get("id") if resp.status_code in (200, 201) else None
        
        if new_id and job["end_time"]:
            requests.patch(f"{BASE_URL}/api/jobs/latest", json={
                "end_time": job["end_time"],
                "router_name": job["router"]
            }, headers=headers)
        
        status = "ABERTO" if not job["end_time"] else "OK"
        est_str = f" (~{est:.0f}min)" if est else ""
        print(f"[{i+1}/{len(real_jobs)}] {job['file_name']} | {job['router']} | {job['start_time'][:10]} [{status}]{est_str}")
        time.sleep(0.2)
    
    print(f"\n[v] RECUPERACAO COMPLETA! {len(real_jobs)} jobs restaurados.")

if __name__ == "__main__":
    main()
