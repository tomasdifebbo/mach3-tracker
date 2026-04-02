import requests
import datetime
import json

# Configuration
SUPABASE_URL = "https://ifoiivttteufbtydnbyk.supabase.co"
SUPABASE_KEY = "sb_publishable_pu4zjObjq1NQ0vcG3yciTQ_HU1K0AJl"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
}

print("Iniciando limpeza profunda e sincronização de horários...")

# 1. Buscar todos os jobs de hoje do projeto Globotoy
resp = requests.get(f"{SUPABASE_URL}/rest/v1/jobs?folder=ilike.%25GLOBOTOY%25", headers=HEADERS)
jobs = resp.json()

if not jobs:
    print("Nenhum job encontrado para limpar.")
    exit()

# 2. Ajustar horários para garantir que 1-35 sejam PASSADO e 36 seja o Topo
# Vamos subtrair 1 hora de todos os jobs 1-35 para criar "espaço" para a Chapa 36
for job in jobs:
    file_name = job['file_name']
    match = __import__('re').search(r'(\d+)', file_name)
    if not match: continue
    num = int(match.group(1))
    
    if num < 36:
        # Pega o start_time atual e volta 1 hora
        st = datetime.datetime.fromisoformat(job['start_time'].replace('Z', '+00:00'))
        new_st = st - datetime.timedelta(hours=1)
        
        update_payload = {
            "start_time": new_st.isoformat().replace('+00:00', 'Z')
        }
        
        # Se tiver end_time, volta ele também
        if job.get('end_time'):
            et = datetime.datetime.fromisoformat(job['end_time'].replace('Z', '+00:00'))
            new_et = et - datetime.timedelta(hours=1)
            update_payload["end_time"] = new_et.isoformat().replace('+00:00', 'Z')
            
        requests.patch(f"{SUPABASE_URL}/rest/v1/jobs?id=eq.{job['id']}", json=update_payload, headers=HEADERS)
        print(f"Chapa {num} ajustada para o passado (id {job['id']}).")

print("Limpeza de horários concluída.")
