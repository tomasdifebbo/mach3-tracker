import json
import threading
from datetime import datetime
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

CONFIG_PATH = DATA_DIR / "config.json"
STATE_PATH = DATA_DIR / "state.json"
ICON_PATH = DATA_DIR / "oficina_icon.ico"

DEFAULT_CONFIG = {
    "source_dir": r"C:\Users\Atelier Arte\Atelier Casa do Trem LTDA\dados2 - Jobs Ativos",
    "dest_dir": r"E:\arquivos 2024\ARQUIVOS 2026",
    "oficina_folder_pattern": r"^\s*3\s*-\s*OFICINA\s*$",
    "scan_interval_seconds": 25,
    "auto_copy_new": False,
    "notify_popup": True,
    "sound_alert": True,
    "patch_gcode_macros": True,
    "target_spindle_speed": "18000",
    "ignored_system_folders": [
        "01 -  JOBS EM ORÇAMENTO",
        "01 - JOBS EM ORÇAMENTO",
        "DOCUMENTAÇÕES",
        "DOCUMENTACOES",
        "N1. JOB - DESCRIÇÃO JOB (PASTA MATRIZ - EXEMPLO)",
        "Nº JOB - JOB",
    ],
}

_lock = threading.RLock()


def load_config() -> dict:
    with _lock:
        cfg = dict(DEFAULT_CONFIG)
        if CONFIG_PATH.exists():
            try:
                loaded = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
                if isinstance(loaded, dict):
                    cfg.update(loaded)
            except Exception:
                pass
        else:
            save_config(cfg)
        return cfg


def save_config(cfg: dict) -> dict:
    with _lock:
        merged = dict(DEFAULT_CONFIG)
        merged.update(cfg)
        CONFIG_PATH.write_text(
            json.dumps(merged, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        return merged


def load_state() -> dict:
    with _lock:
        st = {
            "jobs": {},
            "history": [],
            "first_scan_done": False,
        }
        if STATE_PATH.exists():
            try:
                loaded = json.loads(STATE_PATH.read_text(encoding="utf-8"))
                if isinstance(loaded, dict):
                    st.update(loaded)
            except Exception:
                pass
        return st


def save_state(st: dict) -> None:
    with _lock:
        if "history" in st and len(st["history"]) > 150:
            st["history"] = st["history"][:150]
        tmp_path = STATE_PATH.with_suffix(".json_save")
        tmp_path.write_text(
            json.dumps(st, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        tmp_path.replace(STATE_PATH)


def add_history_event(event_type: str, job_name: str, message: str, details: list[str] | None = None) -> None:
    with _lock:
        st = load_state()
        entry = {
            "timestamp": datetime.now().strftime("%d/%m/%Y %H:%M:%S"),
            "type": event_type,
            "job": job_name,
            "message": message,
            "details": (details or [])[:30],
        }
        st.setdefault("history", []).insert(0, entry)
        save_state(st)
