import sqlite3

conn = sqlite3.connect(r'c:\DASHBOARD\server\dashboard.db')
c = conn.cursor()

for row in c.execute("SELECT name FROM sqlite_master WHERE type='table'"):
    print('table:', row[0])
