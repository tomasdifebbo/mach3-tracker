import socket
import os
import subprocess

laser_ip = "192.168.0.2"

print(f"=== Testing Laser Controller ({laser_ip}) ===")

# 1. Ping test
ping_res = subprocess.run(["ping", "-n", "1", "-w", "1000", laser_ip], capture_output=True, text=True)
print(f"Ping output:\n{ping_res.stdout.strip()}")

# 2. Check UDP ports (50200, 5005, 50000, 50201)
for port in [50200, 5005, 50000, 50201, 40000]:
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.settimeout(1.0)
        # Ruida query status frame example: b'\xCC\x00\x00\x00' or b'\xDA\x00' or b'L'
        sock.sendto(b"\xDA\x00", (laser_ip, port))
        try:
            data, addr = sock.recvfrom(1024)
            print(f"UDP Port {port}: RESPONDED with {len(data)} bytes: {data.hex()}")
        except socket.timeout:
            print(f"UDP Port {port}: Timeout (no response)")
    except Exception as e:
        print(f"UDP Port {port}: Error {e}")

# 3. Check LaserCAD soft config or log files if present
soft_cfg = r"C:\LaserCAD\AWCCfg\SoftCfg.ini"
print(f"\nLaserCAD SoftCfg exists: {os.path.exists(soft_cfg)}")
if os.path.exists(soft_cfg):
    with open(soft_cfg, 'r', encoding='utf-8', errors='ignore') as f:
        print("SoftCfg content:")
        for l in f.readlines()[:30]:
            print("  ", l.strip())
