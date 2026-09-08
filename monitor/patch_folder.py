import os
import sys
import stat
import re

def patch_gcode_file(filepath, target_speed="18000"):
    if not os.path.isfile(filepath):
        return False, "Arquivo não encontrado"
    ext = os.path.splitext(filepath)[1].lower()
    if ext not in ('.txt', '.tap', '.nc', '.cnc', '.gcode'):
        return False, "Extensão não suportada"

    try:
        os.chmod(filepath, stat.S_IWRITE | stat.S_IREAD)
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            lines = f.readlines()

        # 1. Limpar M101 e M102 existentes para evitar duplicatas
        clean_lines = [l for l in lines if l.strip().upper() not in ('M101', 'M102')]
        
        new_lines = []
        m101_inserted = False
        for l in clean_lines:
            # Substituir velocidade de rotação do Spindle (ex: S12000 -> S18000)
            if target_speed:
                l = l.replace('S12000', f'S{target_speed}')

            new_lines.append(l)
            code_part = l.split('(')[0].upper()
            if ('M03' in code_part or 'M3' in code_part) and 'M30' not in code_part and not m101_inserted:
                new_lines.append('M101\n')
                m101_inserted = True
                    
        if not m101_inserted and len(new_lines) > 0:
            insert_idx = min(2, len(new_lines))
            new_lines.insert(insert_idx, 'M101\n')
            m101_inserted = True

        final_lines = []
        m102_inserted = False
        for l in new_lines:
            code_part = l.split('(')[0].upper()
            if 'M30' in code_part and not m102_inserted:
                final_lines.append('M102\n')
                m102_inserted = True
            final_lines.append(l)

        if not m102_inserted:
            final_lines.append('\nM102\n')
            m102_inserted = True

        with open(filepath, 'w', encoding='utf-8') as f:
            f.writelines(final_lines)
        return True, "Sucesso"
    except Exception as e:
        return False, str(e)

def main():
    folder = sys.argv[1] if len(sys.argv) > 1 else r"E:\arquivos 2024\ARQUIVOS 2026\router\2652c - parede A"
    speed = sys.argv[2] if len(sys.argv) > 2 else "18000"

    print(f"=== PATCH G-CODE: M101, M102 E SPINDLE SPEED (S{speed}) ===")
    print(f"Diretório alvo: {folder}\n")

    if not os.path.exists(folder):
        print(f"[X] Erro: Diretório não encontrado: {folder}")
        return

    patched_count = 0
    skipped_count = 0

    for root, _, files in os.walk(folder):
        for f in files:
            if f.lower().endswith(('.txt', '.tap', '.nc', '.cnc', '.gcode')):
                fp = os.path.join(root, f)
                ok, msg = patch_gcode_file(fp, target_speed=speed)
                if ok:
                    patched_count += 1
                    rel_path = os.path.relpath(fp, folder)
                    print(f"[+] Ajustado com sucesso (S{speed}): {rel_path}")
                else:
                    skipped_count += 1
                    print(f"[!] Erro ao ajustar {f}: {msg}")

    print(f"\n==========================================")
    print(f"Processo finalizado!")
    print(f"Arquivos ajustados: {patched_count}")
    print(f"Arquivos com falha (ex: abertos no Mach3): {skipped_count}")
    print(f"==========================================")

if __name__ == "__main__":
    main()
