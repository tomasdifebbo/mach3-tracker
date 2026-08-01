"""Test: simulate the new parser logic on Router Central's log lines."""

test_lines = [
    # Router Central - no machine identifier, but path with comma = 5 fields
    "31/07/2026,11:15:49,\\\\TOMAS\\arquivos 2024\\ARQUIVOS 2026\\router\\2624D - CADEIRANTE + GATO 1,35\\ROUTER\\ISOPOR\\3 pvc 100mm b10mm.txt,INICIO",
    # Router Central - normal 4-field line
    "30/07/2026,15:15:27,Desconhecido,FIM",
    # Router 2 - ACT10 identifier, path with comma = 6 fields
    "31/07/2026,10:08:38,\\\\TOMAS\\arquivos 2024\\ARQUIVOS 2026\\router\\2624D - CADEIRANTE + GATO 1,35\\ROUTER\\ISOPOR\\1 pvc 100mm b10mm.txt,ACT10,INICIO",
    # Router 2 - normal FIM
    "31/07/2026,09:10:14,Desconhecido,ACT10,FIM",
]

for line in test_lines:
    parts = line.strip().split(',')
    print(f"\nLine: {line[:80]}...")
    print(f"  Parts count: {len(parts)}")
    
    data_str, hora_str = parts[0], parts[1]
    tipo = parts[-1].strip().upper()
    
    identidade_router = "Router Central"  # default
    if len(parts) >= 5:
        candidate_router = parts[-2].strip().upper()
        print(f"  Candidate router: '{candidate_router}'")
        
        if candidate_router in ("ACT10", "ROUTER 2", "ROUTER2"):
            identidade_router = "Router 2"
            caminho_completo = ",".join(parts[2:-2])
        elif "ROUTER CENTRAL" in candidate_router or "ROUTER 1" in candidate_router:
            identidade_router = "Router Central"
            caminho_completo = ",".join(parts[2:-2])
        elif "LASER" in candidate_router or "RUIDA" in candidate_router:
            identidade_router = "Laser Ruida"
            caminho_completo = ",".join(parts[2:-2])
        elif "\\" not in candidate_router and "/" not in candidate_router and ".TXT" not in candidate_router and ".TAP" not in candidate_router and len(candidate_router) <= 20:
            identidade_router = candidate_router or "Router Central"
            caminho_completo = ",".join(parts[2:-2])
        else:
            # Looks like path fragment
            caminho_completo = ",".join(parts[2:-1])
    else:
        caminho_completo = parts[2]
    
    nome_arquivo = caminho_completo.split("\\")[-1] if "\\" in caminho_completo else caminho_completo
    nome_arquivo = nome_arquivo.strip()
    
    print(f"  Result: router='{identidade_router}' | tipo='{tipo}' | file='{nome_arquivo}'")
    print(f"  Full path: '{caminho_completo}'")
