import json
import requests
import os

DB_PATH = r"C:\DASHBOARD\server\tracker.json"
SUPABASE_URL = "https://ifoiivttteufbtydnbyk.supabase.co"
SUPABASE_KEY = "sb_publishable_pu4zjObjq1NQ0vcG3yciTQ_HU1K0AJl"
URL_JOBS = f"{SUPABASE_URL}/rest/v1/jobs"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json"
}

def migrate():
    if not os.path.exists(DB_PATH):
        print("Arquivo tracker.json não encontrado.")
        return

    with open(DB_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    print(f"Migrando {len(data)} registros para o Supabase...")
    
    # Remove 'id' de cada item para deixar o Supabase gerar automaticamente
    for item in data:
        if 'id' in item:
            del item['id']
    
    resp = requests.post(URL_JOBS, json=data, headers=HEADERS)
    if resp.status_code in (200, 201, 204):
        print("Migração concluída com sucesso!")
    else:
        print(f"Erro na migração: {resp.status_code}")
        print(resp.text)

if __name__ == "__main__":
    migrate()
