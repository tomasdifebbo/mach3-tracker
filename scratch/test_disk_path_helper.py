import sys, os

sys.path.append(r"c:\DASHBOARD\monitor")
import monitor

sys.stdout.reconfigure(encoding='utf-8')

m = monitor.LaserMonitorThread("192.168.0.2", 5005)
disk_path = m.find_file_on_disk_by_name("PRATELEIR")
print("Target Name: PRATELEIR")
print("Found Disk Path:", disk_path)
if disk_path:
    folder = disk_path.split("\\")[-2] if "\\" in disk_path else "Laser Ruida"
    print("Project Folder:", folder)
