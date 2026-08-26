import requests, json

url = "https://mach3-tracker.onrender.com"

# Login as demo user
r = requests.post(f"{url}/api/auth/login", json={"email": "demo@mach3tracker.com", "password": "demo123"})
token = r.json().get("token")
headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

# Check /api/user/me
user_info = requests.get(f"{url}/api/user/me", headers=headers).json()
print("Demo User Info:", json.dumps(user_info, indent=2, ensure_ascii=False))
