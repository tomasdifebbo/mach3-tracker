import os
import re

directory = r"E:\arquivos 2024\ARQUIVOS 2026\router\2580 - Italac\ROUTER\ISOPOR"
files = [f for f in os.listdir(directory) if f.endswith('.txt')]

for filename in files:
    path = os.path.join(directory, filename)
    print(f"Processando: {filename}")
    
    with open(path, 'r', encoding='utf-8', errors='ignore') as f:
        lines = f.readlines()
    
    new_lines = []
    m101_added = False
    m102_added = False
    
    for i, line in enumerate(lines):
        new_lines.append(line)
        
        # Injetar M101 após M03 (Liga Spindle) se ainda não foi adicionado
        if not m101_added and 'M03' in line:
            new_lines.append("M101\n")
            m101_added = True
            
        # Injetar M102 antes de M30 (Fim de Programa)
        if i < len(lines) - 1 and 'M30' in lines[i+1] and not m102_added:
            new_lines.append("M102\n")
            m102_added = True
            
    # Caso não tenha encontrado M03, tenta colocar no começo após o header
    if not m101_added:
        for i, line in enumerate(new_lines):
            if line.startswith('N'):
                new_lines.insert(i + 1, "M101\n")
                m101_added = True
                break

    # Caso não tenha encontrado M30, tenta colocar no final
    if not m102_added:
        new_lines.insert(-1, "M102\n")
        m102_added = True

    try:
        with open(path, 'w', encoding='utf-8') as f:
            f.writelines(new_lines)
        print(f"Finalizado: {filename} (M101: {m101_added}, M102: {m102_added})")
    except PermissionError:
        print(f"ERRO: O arquivo '{filename}' está sendo usado por outro processo (provavelmente Mach3).")
    except Exception as e:
        print(f"ERRO inesperado em '{filename}': {e}")

print("\nProcessamento concluído.")
