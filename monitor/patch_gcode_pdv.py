import os

# Pasta fornecida pelo usuário
folder = r"E:\arquivos 2024\ARQUIVOS 2026\router\2582A - CAPACETE PDV\ROUTER\ISOPOR"

def patch_file(filepath):
    if not os.path.isfile(filepath):
        return

    # Apenas arquivos de G-Code
    if not (filepath.endswith('.txt') or filepath.endswith('.tap') or filepath.endswith('.nc')):
        return

    print(f"Processando: {os.path.basename(filepath)}...")
    
    try:
        # Abrir com errors='ignore' para evitar problemas com caracteres estranhos no G-code
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            lines = f.readlines()

        # 1. Limpa M101/M102 existentes para evitar duplicidade
        lines = [L for L in lines if L.strip() not in ["M101", "M102"]]
        
        new_lines = []
        modified = False
        
        # 2. Inserir M101 após o primeiro M03 (Início do Spindle)
        m101_inserted = False
        for line in lines:
            new_lines.append(line)
            if "M03" in line.upper() and not m101_inserted:
                new_lines.append("M101\n")
                m101_inserted = True
                modified = True
        
        # Se não achou M03, coloca no topo (após primeira linha de comentário ou G-code)
        if not m101_inserted and len(new_lines) > 0:
             new_lines.insert(1, "M101\n")
             modified = True

        # 3. Inserir M102 antes do M30 ou no final do arquivo
        final_lines = []
        m102_inserted = False
        for line in new_lines:
            if "M30" in line.upper() and not m102_inserted:
                final_lines.append("M102\n")
                m102_inserted = True
                modified = True
            final_lines.append(line)
        
        if not m102_inserted:
            final_lines.append("\nM102\n")
            modified = True

        if modified:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.writelines(final_lines)
            print(f"Sucesso: {os.path.basename(filepath)}")
        else:
            print(f"Sem alteracoes necessarias: {os.path.basename(filepath)}")
            
    except Exception as e:
        print(f"Erro ao processar {filepath}: {e}")

# Executar para todos os arquivos na pasta
if os.path.exists(folder):
    files = os.listdir(folder)
    for filename in files:
        patch_file(os.path.join(folder, filename))
    print("\n--- Processo concluido com sucesso ---")
else:
    print(f"Pasta nao encontrada: {folder}")
