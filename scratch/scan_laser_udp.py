import socket

laser_ip = "192.168.0.2"

print("=== Scanning UDP ports on 192.168.0.2 ===")

# Test a range of common laser controller ports
ports_to_test = [
    5005, 50200, 50201, 50000, 40000, 10000, 8080, 8000, 1001, 1002, 2000, 3000,
    502, 1024, 8888, 9999, 1234, 5555, 6666, 7777, 8889, 2300, 2400
]

# Different query commands used by AWC / Trocen / Ruida / Leetro
cmds = [
    b"\xCC\x00\x00\x00",
    b"\xDA\x00",
    b"L",
    b"\xd8\x00\x02\x00\x01\x00",
    b"\x5a\x00\x00\x00",
    b"\x00\x00\x00\x00"
]

for p in ports_to_test:
    for cmd in cmds:
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            sock.settimeout(0.1)
            sock.sendto(cmd, (laser_ip, p))
            try:
                data, addr = sock.recvfrom(1024)
                print(f"  [FOUND!] Port {p} responded to cmd {cmd.hex()}: {data.hex()}")
            except socket.timeout:
                pass
            except Exception as e:
                if "10054" not in str(e):
                    print(f"  Port {p} error: {e}")
            finally:
                sock.close()
        except Exception:
            pass

print("Scan finished.")
