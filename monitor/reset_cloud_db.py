import requests

BASE_URL = "https://mach3-tracker-production.up.railway.app"
EMAIL = "casadotrem@gmail.com"
PASSWORD = "123456"

def reset_db():
    try:
        print("Realizando login...")
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": EMAIL, "password": PASSWORD})
        token = r.json().get("token")
        if not token:
            return print("Erro de login.")
        
        h = {"Authorization": f"Bearer {token}"}
        
        print("Buscando jobs na nuvem...")
        r_jobs = requests.get(f"{BASE_URL}/api/jobs", headers=h)
        jobs = r_jobs.json()
        
        print(f"Total de jobs atuais: {len(jobs)}")
        
        if jobs:
            print("Apagando todos os jobs existentes para evitar duplicatas...")
            for j in jobs:
                job_id = j.get('id')
                if job_id:
                    requests.delete(f"{BASE_URL}/api/jobs/{job_id}", headers=h)
            print("Todos os jobs apagados da nuvem com sucesso.")
        else:
            print("Nenhum job para apagar.")
            
    except Exception as e:
        print(f"Erro ao limpar banco de dados: {e}")

if __name__ == "__main__":
    reset_db()
