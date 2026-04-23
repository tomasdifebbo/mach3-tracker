import requests, json

config = json.load(open('config.json'))
headers = {'Authorization': 'Bearer ' + config['token'], 'Content-Type': 'application/json'}

r = requests.get('https://mach3-tracker-production.up.railway.app/api/jobs?limit=10', headers=headers, timeout=10)
print(f"Status: {r.status_code}")

data = r.json()
jobs = data if isinstance(data, list) else data.get('jobs', [])

print(f"\nUltimos 20 jobs no dashboard:\n")
for j in reversed(jobs):
    sid = j.get('start_time', '')[:16] if j.get('start_time') else 'N/A'
    eid = j.get('end_time', '')[:16] if j.get('end_time') else 'rodando...'
    print(f"  ID:{j.get('id')} | {sid} -> {eid} | {j.get('router_name','')} | {j.get('file_name','')} | {j.get('folder','')}")
