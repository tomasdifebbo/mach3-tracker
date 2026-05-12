import requests, json

config = json.load(open('config.json'))
headers = {'Authorization': 'Bearer ' + config['token'], 'Content-Type': 'application/json'}

r = requests.get('https://mach3-tracker.onrender.com/api/jobs?limit=20', headers=headers, timeout=10)
print(f"Status: {r.status_code}")

if r.status_code == 200:
    data = r.json()
    jobs = data if isinstance(data, list) else data.get('jobs', [])

    print(f"\nUltimos 20 jobs no dashboard (RENDER):\n")
    for j in reversed(jobs):
        sid = j.get('start_time', '')[:16] if j.get('start_time') else 'N/A'
        eid = j.get('end_time', '')[:16] if j.get('end_time') else 'rodando...'
        print(f"  ID:{j.get('id')} | {sid} -> {eid} | {j.get('router_name','')} | {j.get('file_name','')} | {j.get('folder','')}")
else:
    print(f"Erro: {r.text}")
