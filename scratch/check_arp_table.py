import subprocess

print("=== Checking ARP table for all connected devices ===")
res = subprocess.run(["arp", "-a"], capture_output=True, text=True)
print(res.stdout)
