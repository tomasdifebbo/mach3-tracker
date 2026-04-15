import requests

BASE_URL = "https://mach3-tracker-production.up.railway.app"
EMAIL = "casadotrem@gmail.com"
PASSWORD = "123456"

def close_stuck_jobs():
    try:
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": EMAIL, "password": PASSWORD})
        token = r.json().get("token")
        h = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        
        # Stuck IDs from previous check
        ids = [219, 224]
        import datetime
        now = datetime.datetime.now().astimezone().isoformat()
        
        for job_id in ids:
            print(f"Fechando job #{job_id}...")
            # We can't PATCH by id directly in a clean way in the current API without a specific route,
            # but PATCH /api/jobs/latest with router_name works.
            # However, I can manually update them if I had a route.
            # Wait, I have PATCH /api/jobs/:id but it only updates material.
            
            # I will use a special trick: I'll send a FIM request with the correct router_name
            # and it will close the latest open one for that router.
            
            # Job 219 is ACT10
            # Job 224 is Router Central
            
            router = "ACT10" if job_id == 219 else "Router Central"
            payload = {"end_time": now, "router_name": router}
            res = requests.patch(f"{BASE_URL}/api/jobs/latest", json=payload, headers=h)
            print(f"Status para {router}: {res.status_code}")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    close_stuck_jobs()
