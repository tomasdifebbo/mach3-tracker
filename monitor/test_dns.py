import socket

hosts = [
    "db.timapinomzlmgrrfqcrp.supabase.co",
    "timapinomzlmgrrfqcrp.supabase.co",
    "aws-0-sa-east-1.pooler.supabase.com"
]

for host in hosts:
    try:
        ip = socket.gethostbyname(host)
        print(f"[+] {host} -> {ip}")
    except:
        print(f"[-] {host} no resolve")
