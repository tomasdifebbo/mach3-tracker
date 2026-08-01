import subprocess

# Check all python executables on system
print("=== Searching for python executables ===")
res = subprocess.run(["where", "python"], capture_output=True, text=True)
print(res.stdout)

# Check architecture of C:\LaserCAD\AWCCfg\SoftCfg.ini or other config files
import os
print("Checking LaserCAD cfg directory files:")
cfg_dir = r"C:\LaserCAD\AWCCfg"
for f in os.listdir(cfg_dir):
    p = os.path.join(cfg_dir, f)
    print(f"  {f} | mtime: {os.path.getmtime(p)} | size: {os.path.getsize(p)}")
