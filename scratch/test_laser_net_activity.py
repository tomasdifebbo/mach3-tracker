import socket
import time
import subprocess

print("=== TESTING LASER NETWORK ACTIVITY MONITOR ===")
laser_ip = "192.168.0.2"

def check_netstat(ip):
    try:
        res = subprocess.run(["netstat", "-n"], capture_output=True, text=True, timeout=3)
        lines = [line for line in res.stdout.splitlines() if ip in line]
        return len(lines), lines
    except Exception as e:
        return 0, []

count, matches = check_netstat(laser_ip)
print(f"Netstat connections with {laser_ip}: {count}")
for m in matches:
    print("  ", m.strip())
