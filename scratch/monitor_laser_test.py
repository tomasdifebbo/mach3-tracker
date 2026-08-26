import requests, json, time, datetime

config = json.load(open(r"c:\DASHBOARD\monitor\config.json"))
url = config.get("server_url", "https://mach3-tracker.onrender.com")
headers = {"Authorization": f"Bearer {config.get('token')}", "Content-Type": "application/json"}

print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] Monitoring for new Laser Ruida job...")

# Get initial list of jobs
r = requests.get(f"{url}/api/jobs", headers=headers)
initial_jobs = {j['id']: j for j in r.json() if j.get('router_name') == 'Laser Ruida'}
print(f"Initial Laser Ruida jobs count: {len(initial_jobs)}")

new_job_id = None

for i in range(120): # Poll for up to 6 minutes
    try:
        r = requests.get(f"{url}/api/jobs", headers=headers)
        current_jobs = {j['id']: j for j in r.json() if j.get('router_name') == 'Laser Ruida'}
        
        # Check for new job ID
        for jid, jdata in current_jobs.items():
            if jid not in initial_jobs:
                if not new_job_id:
                    new_job_id = jid
                    print(f"\n[+] NEW JOB DETECTED! ID #{new_job_id}")
                    print(f"    File: {jdata.get('file_name')}")
                    print(f"    Start Time: {jdata.get('start_time')}")
                    print(f"    Dimensions: {jdata.get('max_x')}mm x {jdata.get('max_y')}mm")
                    print(f"    Area m²: {jdata.get('bounding_area_m2')}")
                    print(f"    Material: {jdata.get('material_name')}")

            if jid == new_job_id:
                if jdata.get('end_time'):
                    print(f"\n[+] JOB FINISHED! ID #{new_job_id}")
                    print(f"    End Time: {jdata.get('end_time')}")
                    print(f"    Duration: {jdata.get('duration_minutes')} min")
                    break
        if new_job_id and current_jobs[new_job_id].get('end_time'):
            break
    except Exception as e:
        print("Error polling:", e)
    
    time.sleep(3)

if new_job_id:
    r = requests.get(f"{url}/api/jobs", headers=headers)
    final_job = [j for j in r.json() if j['id'] == new_job_id][0]
    print("\n================ FINAL REPORT ================")
    print(f"ID: #{final_job['id']}")
    print(f"Arquivo: {final_job.get('file_name')}")
    print(f"Horário de Início: {final_job.get('start_time')}")
    print(f"Metro Quadrado (m²): {final_job.get('bounding_area_m2')}")
    print(f"Horário de Término: {final_job.get('end_time')}")
    print(f"Duração: {final_job.get('duration_minutes')} min")
else:
    print("\nNo new job detected within timeout.")
