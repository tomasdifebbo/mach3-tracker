import requests, json

url = "https://mach3-tracker.onrender.com"

# Login as admin / master or update user plan
# Let's check admin endpoint or update script
# Admin login endpoint or direct database update script
print("Upgrading demo user to business plan...")
# We can use admin login or script
r_login = requests.post(f"{url}/api/auth/login", json={"email": "demo@mach3tracker.com", "password": "demo123"})
token = r_login.json().get("token")
headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

# Let's check admin portal update user plan endpoint
# POST /api/admin/users/:id
# Or let's test if admin endpoint exists
admin_r = requests.get(f"{url}/api/admin/users", headers=headers)
print("Admin GET users status:", admin_r.status_code)
