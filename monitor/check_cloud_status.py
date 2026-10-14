import urllib.request
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')
token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJjYXNhZG90cmVtQGdtYWlsLmNvbSIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc5MTIxMjE4MiwiZXhwIjoxNzkxODE2OTgyfQ.2Sm8DgSuhuudSBW2seDzOSaegMfAeijeiQ1OiSCMvvw'

# Routers status
req_r = urllib.request.Request('https://mach3tracker.up.railway.app/api/routers', headers={'Authorization': f'Bearer {token}'})
with urllib.request.urlopen(req_r) as resp:
    routers = json.loads(resp.read().decode())
    print("=== STATUS DAS MÁQUINAS NA NUVEM ===")
    for r in routers:
        print(f"* {r.get('name')}: status={r.get('status')} | current_job={r.get('current_job')} | elapsed={r.get('elapsed_minutes')} min")

# Active jobs
req_j = urllib.request.Request('https://mach3tracker.up.railway.app/api/jobs', headers={'Authorization': f'Bearer {token}'})
with urllib.request.urlopen(req_j) as resp:
    jobs = json.loads(resp.read().decode())
    active_jobs = [j for j in jobs if not j.get('end_time')]
    print("\n=== JOBS ATIVOS NA NUVEM (end_time null) ===")
    for j in active_jobs:
        print(f"* Job #{j.get('id')}: {j.get('router_name')} | {j.get('file_name')} | started: {j.get('start_time')}")

    print("\n=== ÚLTIMOS 5 JOBS REGISTRADOS ===")
    for j in jobs[:5]:
        print(f"* Job #{j.get('id')}: {j.get('router_name')} | {j.get('file_name')} | {j.get('start_time')} -> {j.get('end_time') or 'EM ANDAMENTO'} ({j.get('duration_minutes')} min)")
