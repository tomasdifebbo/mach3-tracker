import os
import re

directory = r"C:\Users\Atelier Arte\Atelier Casa do Trem LTDA\dados2 - Jobs Ativos\2591 - PIRACANJUBA\3 - OFICINA\ROUTER\NAVIO - ISOPOR"
files = [f for f in os.listdir(directory) if f.lower().endswith('.txt') or f.lower().endswith('.tap') or f.lower().endswith('.nc')]

print(f"Encontrados {len(files)} arquivos para processar.\n")

for filename in files:
    path = os.path.join(directory, filename)
    print(f"Processando: {filename}")
    
    with open(path, 'r', encoding='utf-8', errors='ignore') as f:
        lines = f.readlines()
    
    # Check if already has M101
    has_m101 = any('M101' in line for line in lines)
    if has_m101:
        print(f"Aviso: {filename} ja possui macros de rastreio. Pulando.")
        continue

    new_lines = []
    m101_added = False
    m102_added = False
    
    for i, line in enumerate(lines):
        new_lines.append(line)
        
        # Injetar M101 apos M03 (Liga Spindle) ou logo no inicio apos o header
        if not m101_added and ('M03' in line or 'M3' in line):
            new_lines.append("M101\n")
            m101_added = True
            
        # Injetar M102 antes de M30 (Fim de Programa) ou no final
        if i < len(lines) - 1 and ('M30' in lines[i+1] or 'M05' in lines[i+1]) and not m102_added:
            new_lines.append("M102\n")
            m102_added = True
            
    # Fallbacks caso nao encontre M03 ou M30
    if not m101_added:
        new_lines.insert(min(5, len(new_lines)), "M101\n")
        m101_added = True
    
    if not m102_added:
        new_lines.append("M102\n")
        m102_added = True

    try:
        with open(path, 'w', encoding='utf-8') as f:
            f.writelines(new_lines)
        print(f"Finalizado: {filename} (M101: OK, M102: OK)")
    except Exception as e:
        print(f"ERRO em '{filename}': {e}")

print("\nProcessamento concluido com sucesso!")
