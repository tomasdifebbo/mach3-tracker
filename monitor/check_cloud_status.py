import requests

BASE_URL = "https://mach3-tracker-production.up.railway.app"
EMAIL = "casadotrem@gmail.com"
PASSWORD = "123456"

def report():
    try:
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": EMAIL, "password": PASSWORD})
        token = r.json()["token"]
        h = {"Authorization": f"Bearer {token}"}
        
        r_jobs = requests.get(f"{BASE_URL}/api/jobs", headers=h)
        jobs = r_jobs.json()
        
        print(f"--- RELATÓRIO DE SINCRONIZAÇÃO CLOUD ---")
        print(f"Total de Jobs no Servidor: {len(jobs)}")
        
        if jobs:
            dates = sorted(list(set([j["start_time"][:10] for j in jobs])))
            print(f"Datas Presentes: {', '.join(dates)}")
            
            recent = [j for j in jobs if j["start_time"].startswith(dates[-1])]
            print(f"Jobs em {dates[-1]}: {len(recent)}")
            for j in recent[:5]:
                print(f"  - {j['file_name']} ({j['start_time'][11:19]})")
        else:
            print("Nenhum job encontrado no servidor.")
            
    except Exception as e:
        print(f"Erro ao gerar relatório: {e}")

if __name__ == "__main__":
    report()
