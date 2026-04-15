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
        
        print(f"--- ÚLTIMOS 15 JOBS ---")
        for j in jobs[:15]:
            print(f"ID: {j.get('id')}, File: {j.get('file_name')}, Router: {j.get('router_name')}, Start: {j.get('start_time')}, End: {j.get('end_time')}")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check()
