"""
Remove duplicatas do Supabase - mantém apenas 1 registro por start_time+file_name+router_name
"""
import requests, json

config = json.load(open('config.json'))

# Login
r = requests.post('https://mach3-tracker.onrender.com/api/auth/login', json={
    'email': config['email'], 'password': config['password']
}, timeout=30)
token = r.json()['token']
headers = {'Authorization': 'Bearer ' + token}

# Buscar todos os jobs
r2 = requests.get('https://mach3-tracker.onrender.com/api/jobs', headers=headers, timeout=30)
jobs = r2.json()
print(f"Total ANTES: {len(jobs)}")

# Encontrar duplicatas
seen = {}
duplicates = []

for j in jobs:
    key = f"{(j.get('start_time') or '')[:19]}|{j.get('file_name','')}|{j.get('router_name','')}"
    if key in seen:
        duplicates.append(j['id'])
    else:
        seen[key] = j['id']

print(f"Duplicatas encontradas: {len(duplicates)}")
print(f"Jobs unicos: {len(seen)}")

# Deletar duplicatas
deleted = 0
for i, jid in enumerate(duplicates):
    try:
        r = requests.delete(f'https://mach3-tracker.onrender.com/api/jobs/{jid}', headers=headers, timeout=10)
        if r.status_code == 200:
            deleted += 1
        if (i+1) % 50 == 0:
            print(f"  [{i+1}/{len(duplicates)}] deletados...")
    except:
        pass

print(f"\nDeletados: {deleted}")
print(f"Total DEPOIS: {len(jobs) - deleted}")
