import sqlite3

db_path = r'c:\mach3 tracker\server\mach3.db'
conn = sqlite3.connect(db_path)
cursor = conn.cursor()
cursor.execute("SELECT id, email FROM users")
users = cursor.fetchall()
print(f"Users: {users}")
conn.close()
