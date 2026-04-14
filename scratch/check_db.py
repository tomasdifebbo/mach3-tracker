import sqlite3
import json

db_path = r"c:\mach3 tracker\server\mach3.db"
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

print("--- ÚLTIMOS 10 JOBS ---")
cursor.execute("SELECT * FROM jobs ORDER BY start_time DESC LIMIT 10")
for row in cursor.fetchall():
    print(dict(row))

print("\n--- JOBS EM ABERTO ---")
cursor.execute("SELECT * FROM jobs WHERE end_time IS NULL ORDER BY start_time DESC")
for row in cursor.fetchall():
    print(dict(row))

conn.close()
