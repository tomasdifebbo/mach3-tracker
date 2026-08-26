import requests, json

# We can also add an admin route or update directly via python using API or postgres
# Let's check if we can update the user plan via admin endpoint if user 1 (the original account) is admin!
url = "https://mach3-tracker.onrender.com"

# Try logging in with primary account or demo user
r = requests.post(f"{url}/api/auth/login", json={"email": "demo@mach3tracker.com", "password": "demo123"})
data = r.json()
token = data.get("token")
headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

# Update settings
requests.patch(f"{url}/api/user/settings", json={
    "companyName": "Fábrica Modelo CNC & Laser",
    "costPerHour": 80.00,
    "plannedHours": 8
}, headers=headers)

print("Updated Demo User Settings!")
