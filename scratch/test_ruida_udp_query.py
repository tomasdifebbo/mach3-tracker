import socket
import time

laser_ip = "192.168.0.2"
ports = [5005, 50200, 50000]

poll_cmd = b"\xd8\x00\x02\x00\x01\x00"

print(f"=== Testing Ruida UDP Status Query to {laser_ip} ===")

for p in ports:
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.settimeout(2.0)
        sock.sendto(poll_cmd, (laser_ip, p))
        print(f"Sent {len(poll_cmd)} bytes to {laser_ip}:{p}")
        try:
            data, addr = sock.recvfrom(1024)
            print(f"  [SUCCESS] Port {p} responded ({len(data)} bytes): hex={data.hex()}")
            if len(data) >= 5:
                state_byte = data[4]
                state_map = {0: "IDLE (Parada)", 1: "WORKING (Cortando)", 2: "PAUSED (Pausada)"}
                print(f"  Machine State Byte: {state_byte} -> {state_map.get(state_byte, 'Desconhecido')}")
        except socket.timeout:
            print(f"  [TIMEOUT] Port {p}: No response within 2s.")
        except Exception as e:
            print(f"  [RECV ERROR] Port {p}: {e}")
        finally:
            sock.close()
    except Exception as e:
        print(f"  [SEND ERROR] Port {p}: {e}")
