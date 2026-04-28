import requests, json

BASE_URL = "https://mach3-tracker-production.up.railway.app"
config = json.load(open('config.json'))
headers = {'Authorization': 'Bearer ' + config['token'], 'Content-Type': 'application/json'}

r = requests.get(f"{BASE_URL}/api/jobs", headers=headers)
if r.status_code != 200:
    print(f"Erro: {r.status_code} - {r.text}")
    exit()

jobs = r.json()
print(f"Total de jobs no historico: {len(jobs)}")
print(f"{'='*80}")

# Count by router
routers = {}
for j in jobs:
    rn = j.get('router_name') or 'Sem Router'
    routers[rn] = routers.get(rn, 0) + 1

print("\nJobs por Router:")
for rn, count in sorted(routers.items()):
    print(f"  {rn}: {count} jobs")

# Count by project (extract from folder)
projects = {}
for j in jobs:
    folder = j.get('folder', 'Desconhecido')
    parts = folder.replace('\\\\', '\\').split('\\')
    ridx = next((i for i, p in enumerate(parts) if p.upper() == 'ROUTER'), -1)
    if ridx != -1 and ridx < len(parts) - 1:
        pname = parts[ridx + 1]
    else:
        pname = parts[-1] if parts else 'Desconhecido'
    projects[pname] = projects.get(pname, 0) + 1

print(f"\nJobs por Projeto ({len(projects)} projetos):")
for pname, count in sorted(projects.items(), key=lambda x: -x[1]):
    print(f"  {pname}: {count} jobs")

# Show last 10 jobs
print(f"\nUltimos 10 jobs:")
print(f"{'ID':<6} {'Data':<12} {'Arquivo':<35} {'Router':<15} {'Projeto'}")
print(f"{'-'*90}")
for j in jobs[:10]:
    from datetime import datetime
    dt = datetime.fromisoformat(j['start_time'].replace('Z', '+00:00')) if j.get('start_time') else None
    date_str = dt.strftime('%d/%m/%Y') if dt else '-'
    fname = (j.get('file_name') or '-')[:33]
    router = (j.get('router_name') or 'Central')[:13]
    folder = j.get('folder', '')
    parts = folder.replace('\\\\', '\\').split('\\')
    ridx = next((i for i, p in enumerate(parts) if p.upper() == 'ROUTER'), -1)
    if ridx != -1 and ridx < len(parts) - 1:
        pname = parts[ridx + 1]
    else:
        pname = parts[-1] if parts else '-'
    print(f"#{j['id']:<5} {date_str:<12} {fname:<35} {router:<15} {pname}")
