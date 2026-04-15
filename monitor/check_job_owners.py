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
        
        print(f"Total Jobs: {len(jobs)}")
        if jobs:
            uids = set([j.get('userId') for j in jobs])
            print(f"UserIDs found in jobs: {uids}")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check()
