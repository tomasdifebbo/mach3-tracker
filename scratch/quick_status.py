import requests, json
c = json.load(open(r"c:\DASHBOARD\monitor\config.json"))
h = {"Authorization": "Bearer " + c["token"]}
r = requests.get("https://mach3-tracker.onrender.com/api/routers", headers=h)
for x in r.json():
    print(f"{x['name']}: {x['status']} -> {x.get('current_job', 'N/A')}")
