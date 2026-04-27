import requests, json
BASE_URL = "https://mach3-tracker-production.up.railway.app"
config = json.load(open('config.json'))
headers = {'Authorization': 'Bearer ' + config['token'], 'Content-Type': 'application/json'}

def check():
    r = requests.get(f"{BASE_URL}/api/jobs", headers=headers)
    jobs = r.json()
    for j in jobs:
        if j['id'] in [222, 220, 218]:
            print(f"ID {j['id']}: Folder = {j.get('folder')}")

if __name__ == "__main__":
    check()
