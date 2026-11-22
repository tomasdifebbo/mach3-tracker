import os
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import config
import cut_watcher
import engine
import icon_helper
import painel_oficina


def run_tests():
    icon = icon_helper.ensure_app_icon()
    assert icon.exists(), "Icon not created"
    print("1. Icon OK:", icon)

    eng = engine.FolderAssistantEngine()
    jobs = eng.scan_once(allow_auto_copy=False)
    print("2. Real OneDrive scan OK! Jobs found:", len(jobs))
    config.STATE_PATH.unlink(missing_ok=True)

    with tempfile.TemporaryDirectory() as tmp:
        tmp_p = Path(tmp)
        src = tmp_p / "src"
        dst = tmp_p / "dst"
        cfg_orig = config.CONFIG_PATH.read_text(encoding="utf-8")
        try:
            job_dir = src / "9999A - TESTE PROJETO"
            (job_dir / "1 - BRIEFING").mkdir(parents=True)
            (job_dir / "1 - BRIEFING" / "nao_copiar.pdf").write_text("briefing", encoding="utf-8")
            (job_dir / "3 - OFICINA" / "ROUTER").mkdir(parents=True)
            cloud_file = job_dir / "3 - OFICINA" / "ROUTER" / "peca1.cdr"
            cloud_file.write_text("original_onedrive_13h30", encoding="utf-8")
            # Simula liberação inicial às 13:30 (timestamp fixo)
            os.utime(cloud_file, (1700000000.0, 1700000000.0))

            config.save_config({
                "source_dir": str(src),
                "dest_dir": str(dst),
                "auto_copy_new": False,
                "patch_gcode_macros": True,
                "target_spindle_speed": "18000"
            })
            eng2 = engine.FolderAssistantEngine()

            # --- ETAPA 1: Primeiro Scan (Detecta Novo Serviço) ---
            res_scan = eng2.scan_once(allow_auto_copy=False)
            assert len(res_scan) == 1
            assert res_scan[0]["status"] == "novo"
            assert res_scan[0]["new_files_count"] == 1
            print("3. Scan inicial: Novo serviço detectado com sucesso!")

            # --- ETAPA 2: Cópia Inicial para ARQUIVOS 2026 ---
            res_copy = eng2.copy_job("9999A - TESTE PROJETO")
            assert res_copy["ok"] and res_copy["copied"] == 1
            copied_file = dst / "9999A - TESTE PROJETO" / "ROUTER" / "peca1.cdr"
            assert copied_file.exists()
            assert copied_file.read_text(encoding="utf-8") == "original_onedrive_13h30"

            # Scan após cópia deve estar 100% sincronizado
            res_scan_sync = eng2.scan_once(allow_auto_copy=False)
            assert res_scan_sync[0]["status"] == "sincronizado"
            assert res_scan_sync[0]["new_files_count"] == 0
            print("3.1 Cópia inicial e sincronização concluídas com sucesso!")

            # --- ETAPA 3: Simulação de Atualização de Arquivo na Nuvem (Revisão às 14:00+) ---
            # O usuário descreveu: "LIBERARAM O ARQUIVO DIA 17 A 13:30 E ATUALIZARAM O MESMO APOS AS DUAS"
            time.sleep(0.05)
            cloud_file.write_text("desenho_revisado_as_14_horas_pelo_projetista", encoding="utf-8")
            os.utime(cloud_file, (1700005000.0, 1700005000.0))  # 5000 segundos mais recente

            # O sistema DEVE detectar como 'atualizacao' e marcar is_modified=True
            res_scan_updated = eng2.scan_once(allow_auto_copy=False)
            assert res_scan_updated[0]["status"] == "atualizacao", f"Status esperado 'atualizacao', obteve '{res_scan_updated[0]['status']}'"
            assert res_scan_updated[0]["new_files_count"] == 1
            assert res_scan_updated[0]["files"][0]["is_modified"] is True
            assert res_scan_updated[0]["files"][0]["is_new"] is True
            print("3.2 Detecção de arquivo atualizado/revisado na nuvem PASSED!")

            # --- ETAPA 4: Sincronização / Sobrescrita Segura do Arquivo Atualizado ---
            res_copy_update = eng2.copy_job("9999A - TESTE PROJETO")
            assert res_copy_update["ok"] is True
            assert res_copy_update["updated"] == 1
            assert copied_file.read_text(encoding="utf-8") == "desenho_revisado_as_14_horas_pelo_projetista"

            # Após cópia da revisão, deve voltar a sincronizado
            res_scan_after = eng2.scan_once(allow_auto_copy=False)
            assert res_scan_after[0]["status"] == "sincronizado"
            assert res_scan_after[0]["new_files_count"] == 0
            assert res_scan_after[0]["files"][0]["is_modified"] is False
            print("3.3 Atualização / Sobrescrita com nova versão PASSED!")

            # --- ETAPA 5: Proteção de alterações do operador caso a nuvem NÃO tenha mudado ---
            # Se o operador alterar o arquivo localmente mas a nuvem não mudar, NÃO sobrescrever!
            copied_file.write_text("ajuste_fino_do_operador_da_maquina", encoding="utf-8")
            (job_dir / "3 - OFICINA" / "MANUAL").mkdir(parents=True)
            (job_dir / "3 - OFICINA" / "MANUAL" / "guia.pdf").write_text("manual_novo", encoding="utf-8")

            res_scan_add_file = eng2.scan_once(allow_auto_copy=False)
            assert res_scan_add_file[0]["status"] == "atualizacao"
            assert res_scan_add_file[0]["new_files_count"] == 1  # apenas o guia.pdf

            res_copy_add = eng2.copy_job("9999A - TESTE PROJETO")
            assert res_copy_add["ok"] and res_copy_add["copied"] == 1
            # peca1.cdr NÃO deve ter sido sobrescrita pois a nuvem não mudou para ela
            assert copied_file.read_text(encoding="utf-8") == "ajuste_fino_do_operador_da_maquina"
            print("3.4 Proteção de edição local do operador PASSED!")

            # --- ETAPA 6: Injeção de M101/M102 e ajuste de Spindle em G-Code ---
            gcode_sample = (
                "( Mach2/3 Postprocessor )\n"
                "N10G00G21G17G90G40G49G80\n"
                "N20T1M06\n"
                "N30S12000M03\n"
                "N40G00X0Y0Z10\n"
                "N50G01Z-5F1000\n"
                "N60G00Z10\n"
                "N70M30\n"
                "%\n"
            )
            (job_dir / "3 - OFICINA" / "ROUTER" / "corte_teste.txt").write_text(gcode_sample, encoding="utf-8")
            res_scan_gcode = eng2.scan_once(allow_auto_copy=False)
            res_copy_gcode = eng2.copy_job("9999A - TESTE PROJETO")
            assert res_copy_gcode["ok"] and res_copy_gcode["copied"] == 1
            dst_gcode = dst / "9999A - TESTE PROJETO" / "ROUTER" / "corte_teste.txt"
            assert dst_gcode.exists()
            content = dst_gcode.read_text(encoding="utf-8")
            assert "M101" in content
            assert "M102" in content
            assert "S18000" in content
            assert "S12000" not in content
            print("3.5 G-Code M101/M102 & Spindle Injection PASSED!")

        finally:
            config.CONFIG_PATH.write_text(cfg_orig, encoding="utf-8")
            config.STATE_PATH.unlink(missing_ok=True)

    assert hasattr(painel_oficina, "FolderAssistantApp")
    print("4. Native Tkinter UI module PASSED!")

    # --- ETAPA 7: CutWatcher & Deteccao de Corte Finalizado ---
    from datetime import datetime, timezone, timedelta
    now_utc = datetime(2026, 11, 22, 13, 0, 0, tzinfo=timezone.utc)
    cw = cut_watcher.CutWatcher(on_cut_callback=None, max_age_seconds=900)

    # Primeiro scan apenas cataloga historico existente (nao dispara enxurrada)
    initial_batch = [
        {"id": 100, "file_name": "antigo.txt", "end_time": (now_utc - timedelta(minutes=2)).isoformat(), "duration_minutes": 25.0},
    ]
    assert cw.process_snapshot(initial_batch, now_utc=now_utc) == []

    # Novo corte concluido agora + corte < 0.4m + corte stale de 2h atras
    next_batch = initial_batch + [
        {"id": 101, "file_name": "micro.txt", "end_time": (now_utc - timedelta(seconds=10)).isoformat(), "duration_minutes": 0.2},
        {"id": 102, "file_name": "stale.txt", "end_time": (now_utc - timedelta(hours=2)).isoformat(), "duration_minutes": 40.0},
        {"id": 103, "file_name": "2 pvc100mm b10mm.txt", "router_name": "Router Central", "end_time": (now_utc - timedelta(seconds=20)).isoformat(), "duration_minutes": 32.4},
    ]
    detected = cw.process_snapshot(next_batch, now_utc=now_utc)
    assert [d["id"] for d in detected] == [103], f"Esperado [103], obteve {detected}"
    # Re-processar o mesmo snapshot nao duplica notificacao
    assert cw.process_snapshot(next_batch, now_utc=now_utc) == []

    proj, _ = painel_oficina.FolderAssistantApp._resolve_cut_display_and_dir({
        "folder": "cod",
        "file_path": r"\\TOMAS\arquivos 2024\ARQUIVOS 2026\router\2640  - EXPRESSO HOGWARTS CCXP\ROUTER\GRANDE HALL\ARCO VITRAL\ISOPOR\cod\2 pvc100mm b10mm.txt",
    })
    assert proj == "ARCO VITRAL", f"Esperado ARCO VITRAL, obteve {proj}"
    print("5. CutWatcher & Cut Completion Notification PASSED!")


if __name__ == "__main__":
    run_tests()
