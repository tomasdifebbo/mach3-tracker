import requests, json

config = json.load(open('config.json'))

r = requests.post('https://mach3-tracker.onrender.com/api/auth/login', json={
    'email': config['email'],
    'password': config['password']
}, timeout=15)
print(f"Login: {r.status_code}")

if r.status_code == 200:
    token = r.json()['token']
    r2 = requests.get('https://mach3-tracker.onrender.com/api/jobs', 
        headers={'Authorization': 'Bearer ' + token}, timeout=15)
    jobs = r2.json()
    print(f"Total jobs no Supabase: {len(jobs)}")
    for j in jobs[:5]:
        print(f"  ID:{j.get('id')} | {j.get('file_name')} | {j.get('folder')} | {j.get('router_name')}")
    
    r3 = requests.get('https://mach3-tracker.onrender.com/api/stats',
        headers={'Authorization': 'Bearer ' + token}, timeout=15)
    stats = r3.json()
    print(f"\nStats: {stats.get('totalJobs')} jobs | {stats.get('totalHours',0):.1f}h total | {stats.get('jobsToday')} hoje")
else:
    print(f"Erro: {r.text}")
