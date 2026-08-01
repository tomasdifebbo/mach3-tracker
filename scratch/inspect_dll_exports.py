import pefile
import os

dlls = [
    r"C:\Program Files\LaserCAD\AWCPrograms\trocenMidWare.dll",
    r"C:\Program Files\LaserCAD\AWCPrograms\SLsrDl.dll",
    r"C:\Program Files\LaserCAD\AWCPrograms\SLsrDlEx.dll",
    r"C:\Program Files\LaserCAD\AWCPrograms\AWCLib.dll",
    r"C:\Program Files\LaserCAD\AWCPrograms\UsbConnectLib.dll"
]

for dll_path in dlls:
    print(f"\n================ Exports for {os.path.basename(dll_path)} ================")
    if os.path.exists(dll_path):
        try:
            pe = pefile.PE(dll_path)
            if hasattr(pe, 'DIRECTORY_ENTRY_EXPORT'):
                for exp in pe.DIRECTORY_ENTRY_EXPORT.symbols:
                    name = exp.name.decode('utf-8') if exp.name else f"ordinal_{exp.ordinal}"
                    print(f"  Export: {name}")
            else:
                print("  No exported functions found.")
        except Exception as e:
            print(f"  Error loading PE: {e}")
