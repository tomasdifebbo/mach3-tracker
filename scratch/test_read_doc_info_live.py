import sys, os

sys.path.append(r"c:\DASHBOARD\monitor")
import monitor

sys.stdout.reconfigure(encoding='utf-8')

m = monitor.LaserMonitorThread("192.168.0.2", 5005)
cfg_path = r"C:\LaserCAD\SoftCfg.ini"

print("=== TESTING LIVE read_doc_info() ===")
doc_name, full_file_path = m.read_doc_info(cfg_path)
print("Extracted Doc Name:", doc_name)
print("Extracted Full Path:", full_file_path)
