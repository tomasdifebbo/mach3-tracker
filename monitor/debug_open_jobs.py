import requests

BASE_URL = "https://mach3-tracker-production.up.railway.app"
EMAIL = "casadotrem@gmail.com"
PASSWORD = "123456"

def check():
    try:
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": EMAIL, "password": PASSWORD})
        token = r.json().get("token")
        h = {"Authorization": f"Bearer {token}"}
        
        r_jobs = requests.get(f"{BASE_URL}/api/jobs", headers=h)
        jobs = r_jobs.json()
        
        open_jobs = [j for j in jobs if j.get('end_time') is None]
        print(f"Open Jobs: {len(open_jobs)}")
        for j in open_jobs:
            print(f"ID: {j.get('id')}, Name: '{j.get('file_name')}', Router: '{j.get('router_name')}'")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check()
