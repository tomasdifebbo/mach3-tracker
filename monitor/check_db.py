import sqlite3
conn = sqlite3.connect(r'c:\mach3 tracker\server\mach3.db')
c = conn.cursor()
c.execute("SELECT COUNT(*) FROM jobs WHERE folder LIKE '%GLOBOTOY%'")
print(f"Globotoy no DB local: {c.fetchone()[0]}")
c.execute("SELECT COUNT(*) FROM jobs")
print(f"Total no DB local: {c.fetchone()[0]}")
c.execute("SELECT id, file_name, start_time FROM jobs WHERE folder LIKE '%GLOBOTOY%' ORDER BY id LIMIT 5")
for r in c.fetchall():
    print(f"  ID {r[0]}: {r[1]} | {r[2]}")
conn.close()
