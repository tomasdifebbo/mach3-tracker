import re, os

dlls = [
    r"C:\Program Files\LaserCAD\AWCPrograms\trocenMidWare.dll",
    r"C:\Program Files\LaserCAD\AWCPrograms\SLsrDl.dll",
    r"C:\Program Files\LaserCAD\AWCPrograms\SLsrDlEx.dll",
    r"C:\Program Files\LaserCAD\AWCPrograms\AWCLib.dll",
    r"C:\Program Files\LaserCAD\AWCPrograms\UsbConnectLib.dll"
]

for dll_path in dlls:
    print(f"\n================ Strings in {os.path.basename(dll_path)} ================")
    if os.path.exists(dll_path):
        with open(dll_path, "rb") as f:
            data = f.read()
        # Find ASCII strings with len >= 4
        strings = re.findall(b'[a-zA-Z_][a-zA-Z0-9_]{3,}', data)
        print(f"  Total string tokens: {len(strings)}")
        # Filter interesting function-like strings
        func_tokens = set()
        for s in strings:
            s_str = s.decode('ascii', errors='ignore')
            if any(k in s_str.lower() for k in ["status", "state", "work", "connect", "read", "get", "start", "stop", "download", "time", "cut", "laser", "udp", "tcp", "socket"]):
                func_tokens.add(s_str)
        print(f"  Interesting functions/tokens ({len(func_tokens)}):")
        for fn in sorted(list(func_tokens))[:30]:
            print("   -", fn)
