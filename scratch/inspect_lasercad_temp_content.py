import os

print("=== Content of C:\\LaserCAD\\AWCCfg\\_Temp2 ===")
try:
    with open(r"C:\LaserCAD\AWCCfg\_Temp2", "rb") as f:
        data = f.read()
        print("Raw hex/string:", data[:200])
        print("Decoded string (if text):", data.decode('utf-8', errors='ignore'))
except Exception as e:
    print("Error:", e)

print("\n=== Content of C:\\LaserCAD\\AWCCfg\\_Temp (first 500 bytes) ===")
try:
    with open(r"C:\LaserCAD\AWCCfg\_Temp", "rb") as f:
        data = f.read(500)
        print("Raw hex:", data[:100])
        print("Ascii strings in _Temp:")
        import re
        ascii_strings = re.findall(b'[\x20-\x7e]{3,}', data)
        for s in ascii_strings[:20]:
            print("  ", s.decode('ascii', errors='ignore'))
except Exception as e:
    print("Error:", e)

print("\n=== Content of C:\\LaserCAD\\AWCCfg\\SysCfg.ini ===")
try:
    with open(r"C:\LaserCAD\AWCCfg\SysCfg.ini", "r", encoding="utf-8", errors="ignore") as f:
        print(f.read())
except Exception as e:
    print("Error:", e)
