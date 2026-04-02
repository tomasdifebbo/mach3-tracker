import os

folder = r"E:\arquivos 2024\ARQUIVOS 2026\router\2576 - GLOBOTOY\3 - OFICINA\ROUTER\ISOPOR"
files_to_patch = [f"{i} pvc100mm b10mm.txt" for i in range(36, 46)]

def patch_file(filepath):
    if not os.path.exists(filepath):
        print(f"Arquivo não encontrado: {filepath}")
        return

    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    modified = False
    new_lines = []
    
    # 1. Clean existing M101/M102 to avoid duplicates
    lines = [L for L in lines if L.strip() not in ["M101", "M102"]]
    
    # 2. Insert M101 after M03 (Spindle Start) - Better reliability in Mach3
    m101_inserted = False
    for i, line in enumerate(lines):
        new_lines.append(line)
        if "M03" in line and not m101_inserted:
            new_lines.append("M101\n")
            m101_inserted = True
            modified = True
            
    # 3. Insert M102 before M30
    final_lines = []
    m102_inserted = False
    for line in new_lines:
        if "M30" in line and not m102_inserted:
            final_lines.append("M102\n")
            m102_inserted = True
            modified = True
        final_lines.append(line)

    if modified:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.writelines(final_lines)
        print(f"Patched (V2): {os.path.basename(filepath)}")

for filename in files_to_patch:
    patch_file(os.path.join(folder, filename))

print("Finalizado.")
