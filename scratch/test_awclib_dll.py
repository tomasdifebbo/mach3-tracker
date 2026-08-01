import ctypes
import os

dll_path = r"C:\Program Files\LaserCAD\AWCPrograms\AWCLib.dll"
print(f"Loading {dll_path}...")

try:
    # Set DLL search directory so dependent DLLs can be loaded
    os.add_dll_directory(r"C:\Program Files\LaserCAD\AWCPrograms")
    awc = ctypes.cdll.LoadLibrary(dll_path)
    print("Successfully loaded AWCLib.dll!")
    
    # List functions
    print("Available attributes:")
    funcs = [attr for attr in dir(awc) if attr.startswith("AWC_")]
    for f in funcs:
        print("  -", f)
except Exception as e:
    print("Error loading DLL:", e)
