import requests
import datetime
import json

# Configuration
SUPABASE_URL = "https://ifoiivttteufbtydnbyk.supabase.co"
SUPABASE_KEY = "sb_publishable_pu4zjObjq1NQ0vcG3yciTQ_HU1K0AJl"
URL_JOBS = f"{SUPABASE_URL}/rest/v1/jobs"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
}

# Data from user
durations_raw = [
    "23:23", "22:25", "24:16", "53:09", "37:36", "48:32", "33:51", "45:53",
    "47:10", "46:01", "39:49", "45:00", "43:39", "48:07", "41:30", "42:20",
    "51:01", "43:57", "44:15", "45:34", "46:53", "30:25", "48:28", "33:09",
    "34:44", "36:41", "36:30", "39:39", "41:51", "36:11", "37:08", "29:25",
    "37:50", "32:42", "29:07"
]

start_base = datetime.datetime(2026, 4, 1, 6, 20, 0)
operator_gap = datetime.timedelta(minutes=10)

def parse_duration(d_str):
    m, s = map(int, d_str.split(':'))
    return datetime.timedelta(minutes=m, seconds=s)

# Split into two routers: Odd indices (1, 3, 5...) and Even (2, 4, 6...)
# Router A: 1, 3, 5...
# Router B: 2, 4, 6...
router_a_indices = [i for i in range(len(durations_raw)) if i % 2 == 0]
router_b_indices = [i for i in range(len(durations_raw)) if i % 2 != 0]

jobs_to_insert = []

def process_router(indices, router_name):
    current_start = start_base
    for idx in indices:
        sheet_num = idx + 1
        d_str = durations_raw[idx]
        duration = parse_duration(d_str)
        current_end = current_start + duration
        
        file_name = f"{sheet_num} pvc100mm b10mm.txt"
        # We append the router name to the folder to distinguish in the report if possible
        # but let's keep the folder same as requested and maybe just file_name?
        # Actually, let's keep it as is, but in two parallel timelines.
        
        payload = {
            "file_name": file_name,
            "folder": f"2576 - GLOBOTOY / 3 - OFICINA / ROUTER / ISOPOR ({router_name})",
            "file_path": f"E:\\\\arquivos 2024\\\\ARQUIVOS 2026\\\\router\\\\2576 - GLOBOTOY\\\\3 - OFICINA\\\\ROUTER\\\\ISOPOR\\\\{file_name}",
            "start_time": current_start.astimezone().isoformat(),
            "end_time": current_end.astimezone().isoformat(),
            "day": current_start.day,
            "month": current_start.month,
            "year": current_start.year,
            "duration_minutes": round(duration.total_seconds() / 60, 2)
        }
        jobs_to_insert.append(payload)
        current_start = current_end + operator_gap

process_router(router_a_indices, "Router A")
process_router(router_b_indices, "Router B")

print(f"Submetendo {len(jobs_to_insert)} trabalhos paralelos para o Supabase...")

error_count = 0
for job in jobs_to_insert:
    try:
        resp = requests.post(URL_JOBS, json=job, headers=HEADERS, timeout=5)
        if resp.status_code not in (200, 201, 204):
            print(f"Erro ao inserir {job['file_name']}: {resp.status_code}")
            error_count += 1
    except Exception as e:
        print(f"Falha na requisição para {job['file_name']}: {e}")
        error_count += 1

if error_count == 0:
    print("Sucesso: Todos os 35 registros inseridos em paralelo.")
else:
    print(f"Concluido com {error_count} erros.")
