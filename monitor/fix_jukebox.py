import requests, json
BASE_URL = "https://mach3-tracker-production.up.railway.app"
config = json.load(open('config.json'))
headers = {'Authorization': 'Bearer ' + config['token'], 'Content-Type': 'application/json'}

def fix_jukebox():
    r = requests.get(f"{BASE_URL}/api/jobs", headers=headers)
    jobs = r.json()
    
    to_fix = [j for j in jobs if 'CORTE VITOR' in (j.get('folder') or '')]
    print(f"Encontrados {len(to_fix)} jobs para corrigir.")
    
    for job in to_fix:
        # We update the folder path to include the new project name after 'router'
        # Current: ...\router\CORTE VITOR\...
        # New: ...\router\2592A - JUKEBOX\...
        new_folder = job['folder'].replace('CORTE VITOR', '2592A - JUKEBOX')
        
        # We need an endpoint to update the job. Assuming PUT /api/jobs/:id or similar.
        # Based on typical REST, let's try PATCH /api/jobs/:id
        job_id = job['id']
        resp = requests.patch(f"{BASE_URL}/api/jobs/{job_id}", json={"folder": new_folder}, headers=headers)
        if resp.status_code == 200:
            print(f"ID {job_id} atualizado com sucesso!")
        else:
            print(f"Erro ao atualizar ID {job_id}: {resp.status_code}")

if __name__ == "__main__":
    fix_jukebox()
