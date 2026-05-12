import sqlite3
import collections

db_path = r'c:\mach3 tracker\server\mach3.db'
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

cursor.execute("SELECT id, email FROM users")
users = cursor.fetchall()
print(f"Users: {users}")

cursor.execute("SELECT userId, count(*) FROM jobs GROUP BY userId")
job_counts = cursor.fetchall()
print(f"Job counts by user: {job_counts}")

conn.close()
