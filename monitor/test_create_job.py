import json
import requests
import datetime

def test():
    with open("config.json", "r") as f:
        config = json.load(f)
    token = config.get("token")
    if not token:
        print("No token")
        return
        
    url = "https://mach3tracker.up.railway.app/api/jobs"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "User-Agent": "Mach3TrackerMonitor/2.0"
    }
    
    payload = {
        "file_name": "teste_monitor_api.txt",
        "folder": "Router Central | TESTE",
        "file_path": "C:\\mach3\\teste_monitor_api.txt",
        "start_time": datetime.datetime.now().astimezone().isoformat(),
        "router_name": "Router Central",
        "estimated_minutes": 1.5,
        "material_id": None,
        "material_name": None,
        "material_price": None,
        "max_x": 100,
        "max_y": 100,
        "bounding_area_m2": 0.01
    }
    
    print(f"POST {url}")
    resp = requests.post(url, json=payload, headers=headers)
    print(f"Status: {resp.status_code}")
    print(f"Response: {resp.text}")

if __name__ == "__main__":
    test()
