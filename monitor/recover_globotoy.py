import sqlite3, requests, time, os, re, json

BASE_URL = "https://mach3-tracker-production.up.railway.app"
CONFIG_FILE = "config.json"

config = json.load(open(CONFIG_FILE))
headers = {"Authorization": f"Bearer {config['token']}", "Content-Type": "application/json"}

cached_materials = []
def update_materials():
    global cached_materials
    try:
        resp = requests.get(f"{BASE_URL}/api/materials", headers=headers, timeout=5)
        if resp.status_code == 200: cached_materials = resp.json()
    except: pass

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
        if mat['name'].lower() == phrase_2: return mat
    for mat in sorted_mats:
        mat_name = mat['name'].lower()
        if w1 in mat_name and w2 and w2 in mat_name: return mat
    for mat in sorted_mats:
        mat_name = mat['name'].lower()
        if mat_name == w1 or mat_name.startswith(w1 + " "): return mat
    return None

def recover_globotoy():
    update_materials()
    conn = sqlite3.connect(r"c:\mach3 tracker\server\mach3.db")
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("SELECT * FROM jobs WHERE folder LIKE '%GLOBOTOY%' ORDER BY start_time ASC")
    rows = c.fetchall()

    print(f"[*] Enviando {len(rows)} trabalhos GLOBOTOY com auto-vínculo de materiais...")

    for i, row in enumerate(rows):
        job = dict(row)
        mat = find_material_match(job['file_name'])
        
        payload = {
            "file_name": job["file_name"],
            "folder": f"Router 1 | {job['folder']}",
            "file_path": job.get("file_path", "Desconhecido"),
            "start_time": job["start_time"],
            "router_name": job.get("router_name") or "Router 1",
            "material_id": mat['id'] if mat else None,
            "material_name": mat['name'] if mat else None,
            "material_price": 0
        }
        
        resp = requests.post(f"{BASE_URL}/api/jobs", json=payload, headers=headers)
        new_id = resp.json().get('id') if resp.status_code in (200, 201) else None
        
        if new_id and job["end_time"]:
            requests.patch(f"{BASE_URL}/api/jobs/latest", json={
                "end_time": job["end_time"],
                "router_name": job.get("router_name") or "Router 1"
            }, headers=headers)
            print(f"[{i+1}/{len(rows)}] {job['file_name']} -> OK")
        
        time.sleep(0.1)

    print(f"\nPROJETO GLOBOTOY RESTAURADO COM SUCESSO!")
    conn.close()

if __name__ == "__main__":
    recover_globotoy()
