import requests

BASE_URL = "http://localhost:3000"

try:
    r = requests.get(f"{BASE_URL}/health")
    print(f"Health: {r.status_code} - {r.text}")
    
    r = requests.get(f"{BASE_URL}/api/user/me")
    print(f"User Me (No Auth): {r.status_code}")
except Exception as e:
    print(f"Error: {e}")
