import requests, json

url = "https://mach3-tracker.onrender.com"

# We know demo user ID is 3
# Let's test admin login or update endpoint directly
# Wait, let's login with demo user or admin
# Let's check if we can call PATCH /api/admin/users/3/plan
# If we login with admin (or set demo user plan directly via an admin route or endpoint)
# Let's check admin login
print("Testing admin update...")
# Login as admin:
r_admin = requests.post(f"{url}/api/auth/login", json={"email": "tomasdifebbo.tdf@gmail.com", "password": "123"})
print("Admin login status:", r_admin.status_code)

if r_admin.status_code == 200:
    admin_token = r_admin.json().get("token")
    admin_headers = {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}
    
    # Get all users
    users = requests.get(f"{url}/api/admin/users", headers=admin_headers).json()
    print("All Users:", json.dumps(users, indent=2))
    
    demo_user = next((u for u in users if u['email'] == 'demo@mach3tracker.com'), None)
    if demo_user:
        demo_id = demo_user['id']
        print(f"Found demo user ID #{demo_id}. Upgrading plan to business...")
        up_r = requests.patch(f"{url}/api/admin/users/{demo_id}/plan", json={"plan": "business"}, headers=admin_headers)
        print("Plan Upgrade Response:", up_r.status_code, up_r.text)
