import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import config
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
            (job_dir / "3 - OFICINA" / "ROUTER" / "peca1.cdr").write_text("original_onedrive", encoding="utf-8")

            config.save_config({
                "source_dir": str(src),
                "dest_dir": str(dst),
                "auto_copy_new": False,
                "patch_gcode_macros": True,
                "target_spindle_speed": "18000"
            })
            eng2 = engine.FolderAssistantEngine()
            res_scan = eng2.scan_once(allow_auto_copy=False)
            assert len(res_scan) == 1 and res_scan[0]["status"] == "novo"

            res_copy = eng2.copy_job("9999A - TESTE PROJETO")
            assert res_copy["ok"] and res_copy["copied"] == 1
            copied_file = dst / "9999A - TESTE PROJETO" / "ROUTER" / "peca1.cdr"
            assert copied_file.exists()

            copied_file.write_text("editado_pelo_operador_router", encoding="utf-8")
            (job_dir / "3 - OFICINA" / "MANUAL").mkdir(parents=True)
            (job_dir / "3 - OFICINA" / "MANUAL" / "guia.pdf").write_text("manual_novo", encoding="utf-8")

            res_scan2 = eng2.scan_once(allow_auto_copy=False)
            assert res_scan2[0]["status"] == "atualizacao" and res_scan2[0]["new_files_count"] == 1

            res_copy2 = eng2.copy_job("9999A - TESTE PROJETO")
            assert res_copy2["ok"] and res_copy2["copied"] == 1
            assert copied_file.read_text(encoding="utf-8") == "editado_pelo_operador_router"
            print("3. Copy + Non-Overwrite + Incremental Sync Test PASSED!")

            # 3.1 Teste específico de injeção de M101 e M102 em G-code
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
            res_scan3 = eng2.scan_once(allow_auto_copy=False)
            res_copy3 = eng2.copy_job("9999A - TESTE PROJETO")
            assert res_copy3["ok"] and res_copy3["copied"] == 1
            dst_gcode = dst / "9999A - TESTE PROJETO" / "ROUTER" / "corte_teste.txt"
            assert dst_gcode.exists()
            content = dst_gcode.read_text(encoding="utf-8")
            assert "M101" in content
            assert "M102" in content
            assert "S18000" in content
            assert "S12000" not in content
            print("3.1 G-Code M101/M102 & Spindle Injection PASSED!")
        finally:
            config.CONFIG_PATH.write_text(cfg_orig, encoding="utf-8")
            config.STATE_PATH.unlink(missing_ok=True)

    assert hasattr(painel_oficina, "FolderAssistantApp")
    print("4. Native Tkinter UI module PASSED!")


if __name__ == "__main__":
    run_tests()
