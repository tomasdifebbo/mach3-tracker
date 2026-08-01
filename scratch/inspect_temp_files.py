import os

cfg_dir = r"C:\LaserCAD\AWCCfg"

print("=== Inspecting _Temp and _Temp2 in LaserCAD AWCCfg ===")
for fname in ["_Temp", "_Temp2", "SoftCfg.ini", "SysCfg.ini"]:
    p = os.path.join(cfg_dir, fname)
    if os.path.exists(p):
        print(f"\n--- {fname} (size: {os.path.getsize(p)} bytes) ---")
        try:
            with open(p, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read(1000)
                print(content[:500])
        except Exception as e:
            print("Read text error:", e)

        # Also binary snippet
        with open(p, "rb") as f:
            bindata = f.read(200)
            print("Header bytes (hex):", bindata[:64].hex())
