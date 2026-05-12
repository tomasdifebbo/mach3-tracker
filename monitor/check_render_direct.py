import requests, json

with open('config.json') as f:
    config = json.load(f)

# Login again to render to get a fresh token
r = requests.post('https://mach3-tracker.onrender.com/api/auth/login', json={
    'email': config['email'],
    'password': config['password']
})
if r.status_code == 200:
    token = r.json()['token']
    print("Login OK")
    
    # Fetch jobs
    headers = {'Authorization': 'Bearer ' + token}
    r2 = requests.get('https://mach3-tracker.onrender.com/api/jobs', headers=headers)
    if r2.status_code == 200:
        jobs = r2.json()
        print(f"Total jobs from API: {len(jobs)}")
        
        for j in jobs[:5]:
            print(f"ID: {j.get('id')} | File: {j.get('file_name')} | Start: {j.get('start_time')}")
    else:
        print(f"Erro jobs: {r2.status_code} - {r2.text}")
else:
    print(f"Erro login: {r.status_code} - {r.text}")
