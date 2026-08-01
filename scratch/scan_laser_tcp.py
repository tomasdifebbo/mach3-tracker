import socket

laser_ip = "192.168.0.2"

print("=== Scanning TCP ports on 192.168.0.2 ===")

tcp_ports = [21, 22, 23, 80, 502, 1000, 2000, 3000, 5005, 8080, 9100, 50200, 50000, 40000, 10001, 10002]

for p in tcp_ports:
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(0.3)
        res = sock.connect_ex((laser_ip, p))
        if res == 0:
            print(f"  [OPEN TCP PORT] Port {p} is OPEN!")
        sock.close()
    except Exception as e:
        pass

print("TCP scan finished.")
