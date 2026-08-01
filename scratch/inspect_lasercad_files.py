import os

for root_dir in [r"C:\LaserCAD", r"C:\Program Files\LaserCAD"]:
    print(f"\n================ Root: {root_dir} ================")
    for root, dirs, files in os.walk(root_dir):
        for f in files:
            full_path = os.path.join(root, f)
            mtime = os.path.getmtime(full_path)
            size = os.path.getsize(full_path)
            # Find files modified recently or .ini, .log, .cfg, .txt, .dat, .xml files
            ext = os.path.splitext(f)[1].lower()
            if ext in ['.ini', '.log', '.cfg', '.txt', '.dat', '.xml', '.doc', '.out', '.err', '.pw5', '.ud5']:
                print(f"  {full_path} | size: {size} | ext: {ext}")

# Also check open TCP/UDP sockets by LaserCAD.exe (PID 28668)
import subprocess
print("\n=== Netstat for LaserCAD.exe ===")
res = subprocess.run(["netstat", "-ano"], capture_output=True, text=True)
for line in res.stdout.splitlines():
    if "28668" in line or "192.168.0.2" in line or "50200" in line or "5005" in line:
        print("  ", line)
