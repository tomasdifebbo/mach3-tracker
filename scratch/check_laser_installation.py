import os

print("=== Checking LaserCAD and related directories ===")
dirs_to_check = [
    r"C:\LaserCAD",
    r"C:\RDWorksV8",
    r"C:\Program Files\LaserCAD",
    r"C:\Program Files (x86)\LaserCAD"
]

for d in dirs_to_check:
    print(f"\nDirectory {d}: Exists = {os.path.exists(d)}")
    if os.path.exists(d):
        try:
            files = os.listdir(d)
            print(f"  Files count: {len(files)}")
            for f in files[:20]:
                print("   -", f)
        except Exception as e:
            print("  Error:", e)

# Also check running processes for LaserCAD or RDWorks or Ruida
import subprocess
ps = subprocess.run(["tasklist"], capture_output=True, text=True)
print("\n=== Running Processes (Laser / Mach3 / CAD) ===")
for line in ps.stdout.splitlines():
    line_lower = line.lower()
    if any(k in line_lower for k in ["laser", "mach3", "awc", "ruida", "rdworks", "python", "monitor"]):
        print("  ", line)
