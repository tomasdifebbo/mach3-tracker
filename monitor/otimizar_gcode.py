import os
import re
import glob

def optimize_file(filepath):
    print(f"Otimizando: {os.path.basename(filepath)}")
    with open(filepath, 'r', encoding='cp1252', errors='ignore') as f:
        lines = f.readlines()
        
    new_lines = []
    
    for line in lines:
        clean = line.strip()
        if not clean:
            continue
            
        # Remover os códigos N (ex: N100)
        clean = re.sub(r'^N\d+', '', clean)
        
        # Remover M101/M102 duplicados (caso existam mais de um no arquivo)
        
        # Otimizar zeros desnecessários (X10.000 -> X10)
        clean = re.sub(r'([XYZF])([-0-9]+)\.000', r'\1\2', clean)
        clean = re.sub(r'([XYZF])([-0-9]+)\.00', r'\1\2', clean)
        clean = re.sub(r'([XYZF])([-0-9]+)\.0(?!\d)', r'\1\2', clean)
        
        new_lines.append(clean + "\n")
        
    with open(filepath, 'w', encoding='cp1252') as f:
        f.writelines(new_lines)

def main():
    folder = r"E:\arquivos 2024\ARQUIVOS 2026\router\2659A - TRONO GAMER MONSTER\ROUTER\ISOPOR+"
    files = glob.glob(os.path.join(folder, '*.txt'))
    
    for f in files:
        optimize_file(f)
        
    print("Processo concluído! Os arquivos foram enxugados e os códigos N foram removidos.")

if __name__ == '__main__':
    main()
