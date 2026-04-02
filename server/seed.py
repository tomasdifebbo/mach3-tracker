import sqlite3
from datetime import datetime
import os

db_path = os.path.join(os.path.dirname(__file__), 'tracker.db')
conn = sqlite3.connect(db_path)
c = conn.cursor()

jobs = [
    { "name": "mesa_de_centro.tap", "folder": r"..\arquivos 2024\moveis", "start": "2026-03-29T08:30:00-03:00", "end": "2026-03-29T10:15:00-03:00", "dur": 105 },
    { "name": "porta_cozinha_v2.tap", "folder": r"..\arquivos 2024\cozinha", "start": "2026-03-29T10:30:00-03:00", "end": "2026-03-29T11:45:00-03:00", "dur": 75 },
    { "name": "medalha_personalizada.tap", "folder": r"..\arquivos 2024\medalhas", "start": "2026-03-28T09:00:00-03:00", "end": "2026-03-28T09:45:00-03:00", "dur": 45 },
    { "name": "placa_decorativa.tap", "folder": r"..\arquivos 2024\placas", "start": "2026-03-28T13:00:00-03:00", "end": "2026-03-28T15:30:00-03:00", "dur": 150 },
    { "name": "mesa_de_centro.tap", "folder": r"..\arquivos 2024\moveis", "start": "2026-03-27T08:00:00-03:00", "end": "2026-03-27T10:00:00-03:00", "dur": 120 },
    { "name": "logo_empresa.tap", "folder": r"..\arquivos 2024\logos", "start": "2026-03-27T14:00:00-03:00", "end": "2026-03-27T14:30:00-03:00", "dur": 30 },
    { "name": "caixa_presente.tap", "folder": r"..\arquivos 2024\caixas", "start": "2026-03-26T09:00:00-03:00", "end": "2026-03-26T12:00:00-03:00", "dur": 180 },
    { "name": "porta_cozinha_v2.tap", "folder": r"..\arquivos 2024\cozinha", "start": "2026-03-26T13:30:00-03:00", "end": "2026-03-26T16:00:00-03:00", "dur": 150 },
    { "name": "relogio_parede.tap", "folder": r"..\arquivos 2024\relogios", "start": "2026-03-25T10:00:00-03:00", "end": "2026-03-25T11:30:00-03:00", "dur": 90 },
    { "name": "tabuleiro_xadrez.tap", "folder": r"..\arquivos 2024\jogos", "start": "2026-03-25T14:00:00-03:00", "end": "2026-03-25T17:00:00-03:00", "dur": 180 }
]

c.execute('DELETE FROM jobs')
try:
    c.execute("UPDATE sqlite_sequence SET seq = 0 WHERE name = 'jobs'")
except:
    pass

for j in reversed(jobs):
    dt = datetime.fromisoformat(j['start'].replace('-03:00', ''))
    c.execute('''
        INSERT INTO jobs (file_name, file_path, folder, start_time, end_time, duration_minutes, day, month, year)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        j['name'],
        j['folder'] + '\\\\' + j['name'],
        j['folder'],
        j['start'],
        j['end'],
        j['dur'],
        dt.day,
        dt.month,
        dt.year
    ))

conn.commit()
conn.close()
print("Seed Python completed!")
