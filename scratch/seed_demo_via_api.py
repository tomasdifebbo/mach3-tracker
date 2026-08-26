import requests, json, datetime

url = "https://mach3-tracker.onrender.com"

# 1. Register demo account
reg_payload = {
    "email": "demo@mach3tracker.com",
    "password": "demo123"
}

print("Registering demo user...")
r = requests.post(f"{url}/api/auth/register", json=reg_payload)
print("Register status:", r.status_code, r.text[:200])

# 2. Login to get token
print("Logging in demo user...")
r = requests.post(f"{url}/api/auth/login", json=reg_payload)
print("Login status:", r.status_code)
data = r.json()
token = data.get("token")
print("Token received:", token[:30] if token else "None")

headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

# 3. Create Routers
print("Creating Routers...")
r1 = requests.post(f"{url}/api/routers", json={"name": "CNC Router Central 1325"}, headers=headers)
r2 = requests.post(f"{url}/api/routers", json={"name": "Router 2 (Precisão)"}, headers=headers)
r3 = requests.post(f"{url}/api/routers", json={"name": "Laser Ruida CO2 1390"}, headers=headers)

# Set status note
requests.patch(f"{url}/api/routers/1/status", json={"status": "working", "status_note": "Usinando painel MDF 15mm (O.S. 2629A)"}, headers=headers)
requests.patch(f"{url}/api/routers/1/operator", json={"operator_name": "Tomás"}, headers=headers)

requests.patch(f"{url}/api/routers/2/status", json={"status": "idle", "status_note": "Aguardando próxima chapa ACM Prata"}, headers=headers)
requests.patch(f"{url}/api/routers/2/operator", json={"operator_name": "Lucas"}, headers=headers)

requests.patch(f"{url}/api/routers/3/status", json={"status": "working", "status_note": "Corte de letras em acrílico 4mm"}, headers=headers)
requests.patch(f"{url}/api/routers/3/operator", json={"operator_name": "Carlos"}, headers=headers)

# 4. Create Operators
print("Adding Operators...")
requests.post(f"{url}/api/operators", json={"name": "Tomás", "shift": "Manhã"}, headers=headers)
requests.post(f"{url}/api/operators", json={"name": "Lucas", "shift": "Tarde"}, headers=headers)
requests.post(f"{url}/api/operators", json={"name": "Carlos", "shift": "Geral"}, headers=headers)

# 5. Add Materials
print("Adding Materials...")
mat1 = requests.post(f"{url}/api/materials", json={"name": "Acrílico Cristal 4mm", "price": 180.00, "feed_rate": 2500, "pass_width": 100, "sheet_width_mm": 2000, "sheet_height_mm": 1000}, headers=headers).json()
mat2 = requests.post(f"{url}/api/materials", json={"name": "MDF Cru 15mm", "price": 120.00, "feed_rate": 3500, "pass_width": 100, "sheet_width_mm": 2750, "sheet_height_mm": 1850}, headers=headers).json()
mat3 = requests.post(f"{url}/api/materials", json={"name": "ACM Prata 3mm", "price": 210.00, "feed_rate": 4000, "pass_width": 100, "sheet_width_mm": 1220, "sheet_height_mm": 2440}, headers=headers).json()
mat4 = requests.post(f"{url}/api/materials", json={"name": "PVC Expandido 10mm", "price": 150.00, "feed_rate": 3000, "pass_width": 100, "sheet_width_mm": 2000, "sheet_height_mm": 1000}, headers=headers).json()

# 6. Add Jobs (Active & Completed)
print("Creating Jobs...")
now = datetime.datetime.now(datetime.timezone.utc)

# Active Job Router 1
requests.post(f"{url}/api/jobs", json={
    "file_name": "2629A - Painel Ripada Royal Enfield.tap",
    "folder": "2629A - Royal Enfield",
    "file_path": "E:\\arquivos 2026\\2629A - Royal Enfield\\2629A - Painel Ripada Royal Enfield.tap",
    "start_time": (now - datetime.timedelta(minutes=25)).isoformat(),
    "router_name": "CNC Router Central 1325",
    "estimated_minutes": 42.5,
    "material_id": mat2.get("id"),
    "material_name": "MDF Cru 15mm",
    "material_price": 120.00,
    "operator_name": "Tomás",
    "max_x": 2400.0,
    "max_y": 1200.0,
    "bounding_area_m2": 2.880
}, headers=headers)

# Active Job Laser 3
requests.post(f"{url}/api/jobs", json={
    "file_name": "LETRAS ROYAL ENFIELD.cdr",
    "folder": "2629A - Royal Enfield",
    "file_path": "C:\\Projetos\\2629A - Royal Enfield\\LETRAS ROYAL ENFIELD.cdr",
    "start_time": (now - datetime.timedelta(minutes=12)).isoformat(),
    "router_name": "Laser Ruida CO2 1390",
    "estimated_minutes": 18.0,
    "material_id": mat1.get("id"),
    "material_name": "Acrílico Cristal 4mm",
    "material_price": 180.00,
    "operator_name": "Carlos",
    "max_x": 850.0,
    "max_y": 420.0,
    "bounding_area_m2": 0.357
}, headers=headers)

# Completed Job 1
j1 = requests.post(f"{url}/api/jobs", json={
    "file_name": "2578B - Predios Tartarugas Ninjas.tap",
    "folder": "2578B - Tartarugas Ninjas",
    "file_path": "E:\\arquivos 2026\\2578B - Tartarugas Ninjas\\2578B - Predios.tap",
    "start_time": (now - datetime.timedelta(minutes=140)).isoformat(),
    "router_name": "CNC Router Central 1325",
    "estimated_minutes": 40.0,
    "material_id": mat4.get("id"),
    "material_name": "PVC Expandido 10mm",
    "material_price": 150.00,
    "operator_name": "Tomás",
    "max_x": 2000.0,
    "max_y": 1000.0,
    "bounding_area_m2": 2.000
}, headers=headers).json()

# Close Completed Job 1
if j1.get("id"):
    requests.patch(f"{url}/api/jobs/{j1['id']}", json={
        "end_time": (now - datetime.timedelta(minutes=101.5)).isoformat(),
        "duration_minutes": 38.5
    }, headers=headers)

# Completed Job 2
j2 = requests.post(f"{url}/api/jobs", json={
    "file_name": "2650C - Logo Fachada ACM.tap",
    "folder": "2650C - Fachada Loja",
    "file_path": "E:\\arquivos 2026\\2650C - Fachada\\2650C - Logo Fachada ACM.tap",
    "start_time": (now - datetime.timedelta(minutes=200)).isoformat(),
    "router_name": "Router 2 (Precisão)",
    "estimated_minutes": 24.0,
    "material_id": mat3.get("id"),
    "material_name": "ACM Prata 3mm",
    "material_price": 210.00,
    "operator_name": "Lucas",
    "max_x": 1220.0,
    "max_y": 2440.0,
    "bounding_area_m2": 2.9768
}, headers=headers).json()

if j2.get("id"):
    requests.patch(f"{url}/api/jobs/{j2['id']}", json={
        "end_time": (now - datetime.timedelta(minutes=178.0)).isoformat(),
        "duration_minutes": 22.0
    }, headers=headers)

# 7. Add Maintenance Tasks
print("Adding Maintenance Tasks...")
requests.post(f"{url}/api/maintenance", json={
    "machine": "CNC Router Central 1325",
    "task": "Lubrificação dos Guias Lineares e Fuso de Esferas",
    "type": "Preventiva",
    "due_date": now.strftime("%Y-%m-%d"),
    "status": "pendente",
    "notes": "Utilizar graxa especial de lítio NLGI 2 a cada 40 horas de usinagem"
}, headers=headers)

requests.post(f"{url}/api/maintenance", json={
    "machine": "Laser Ruida CO2 1390",
    "task": "Troca de Água Destilada & Limpeza dos Espelhos/Lente Focal",
    "type": "Preventiva",
    "due_date": now.strftime("%Y-%m-%d"),
    "status": "concluido",
    "notes": "Fluido trocado no chiller CW-5200. Espelhos alinhados com laser vermelho."
}, headers=headers)

print("\n=== DEMO USER & DATA POPULATED SUCCESSFULLY ===")
print("Email: demo@mach3tracker.com")
print("Password: demo123")
