import requests, json

url = "https://mach3-tracker.onrender.com"

# 1. Login with demo@mach3tracker.com
r_demo = requests.post(f"{url}/api/auth/login", json={"email": "demo@mach3tracker.com", "password": "demo123"})
token_demo = r_demo.json().get("token")
headers_demo = {"Authorization": f"Bearer {token_demo}"}

print("=== CALLING /api/user/me FOR DEMO USER ===")
me = requests.get(f"{url}/api/user/me", headers=headers_demo).json()
print("Role:", me.get("role"))
print("Plan:", me.get("plan"))

print("\n=== CALLING /api/admin/users WITH DEMO TOKEN ===")
res_admin = requests.get(f"{url}/api/admin/users", headers=headers_demo)
print("Status Code:", res_admin.status_code)
print("Response:", res_admin.text[:300])
