import os
import re
import shutil
import threading
import time
from datetime import datetime
from pathlib import Path
from typing import Callable

from config import (
    add_history_event,
    load_config,
    load_state,
    save_state,
)

FILE_ATTRIBUTE_OFFLINE = 0x1000
FILE_ATTRIBUTE_RECALL_ON_DATA_ACCESS = 0x400000

SKIP_FILENAMES = {"desktop.ini", "thumbs.db", ".ds_store"}
SKIP_SUFFIXES = (".tmp", ".part", ".crdownload", ".onedrive")
GCODE_EXTENSIONS = {".txt", ".tap", ".nc", ".cnc", ".gcode"}


def patch_gcode_content(lines: list[str], target_speed: str = "18000") -> list[str]:
    """
    Injeta M101 após acionamento do spindle (M03/M3) e M102 antes do fim de programa (M30).
    Ajusta velocidade do spindle (ex: S12000 -> S18000), seguindo o padrão oficial do Mach3 Tracker.
    """
    # 1. Limpa M101 e M102 existentes para evitar duplicatas
    clean_lines = [l for l in lines if l.strip().upper() not in ("M101", "M102")]

    new_lines = []
    m101_inserted = False
    for l in clean_lines:
        if target_speed:
            l = l.replace("S12000", f"S{target_speed}")

        new_lines.append(l)
        code_part = l.split("(")[0].upper()
        if ("M03" in code_part or "M3" in code_part) and "M30" not in code_part and not m101_inserted:
            new_lines.append("M101\n")
            m101_inserted = True

    if not m101_inserted and len(new_lines) > 0:
        insert_idx = min(2, len(new_lines))
        new_lines.insert(insert_idx, "M101\n")
        m101_inserted = True

    final_lines = []
    m102_inserted = False
    for l in new_lines:
        code_part = l.split("(")[0].upper()
        if "M30" in code_part and not m102_inserted:
            final_lines.append("M102\n")
            m102_inserted = True
        final_lines.append(l)

    if not m102_inserted:
        final_lines.append("\nM102\n")
        m102_inserted = True

    return final_lines


def try_patch_gcode_file(file_path: Path, target_speed: str = "18000", original_name: str | None = None) -> bool:
    """Tenta aplicar os macros M101/M102 caso o arquivo seja código G válido."""
    name_to_check = original_name if original_name else file_path.name
    ext = Path(name_to_check).suffix.lower()
    if ext not in GCODE_EXTENSIONS:
        return False
    try:
        # Tenta ler como texto com fallback
        for enc in ("utf-8", "latin-1", "cp1252"):
            try:
                with open(file_path, "r", encoding=enc) as f:
                    lines = f.readlines()
                break
            except UnicodeDecodeError:
                continue
        else:
            return False

        # Verifica se o arquivo tem traços de código G (ex: G0, G1, M03, M3, X, Y, Z, N)
        sample = "".join(lines[:60]).upper()
        if not any(token in sample for token in ("G00", "G01", "G0", "G1", "M03", "M3", "M30", "X", "Z")):
            return False

        patched_lines = patch_gcode_content(lines, target_speed=target_speed)
        with open(file_path, "w", encoding="utf-8", newline="\n") as f:
            f.writelines(patched_lines)
        return True
    except Exception:
        return False


def _normalize_spaces(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip()).upper()


def _is_ignored_system_folder(folder_name: str, ignored_list: list[str]) -> bool:
    norm = _normalize_spaces(folder_name)
    for item in ignored_list:
        if norm == _normalize_spaces(item):
            return True
    if "PASTA MATRIZ" in norm or "JOBS EM ORÇAMENTO" in norm or "JOBS EM ORCAMENTO" in norm:
        return True
    if norm in {"Nº JOB - JOB", "N° JOB - JOB", "DOCUMENTAÇÕES", "DOCUMENTACOES"}:
        return True
    return False


def _should_skip_file(filename: str) -> bool:
    low = filename.lower()
    if low in SKIP_FILENAMES:
        return True
    if low.startswith("~$") or low.startswith(".~"):
        return True
    if low.endswith(SKIP_SUFFIXES):
        return True
    return False


def _scan_oficina_files(oficina_path: Path) -> list[dict]:
    """Scan files inside 3 - OFICINA using scandir metadata only (does NOT trigger OneDrive hydration)."""
    results = []
    root_str = str(oficina_path)

    def _walk(current_dir: str):
        try:
            with os.scandir(current_dir) as it:
                for entry in it:
                    try:
                        if entry.is_dir(follow_symlinks=False):
                            _walk(entry.path)
                        elif entry.is_file(follow_symlinks=False):
                            if _should_skip_file(entry.name):
                                continue
                            st = entry.stat(follow_symlinks=False)
                            rel = os.path.relpath(entry.path, root_str).replace("\\", "/")
                            attrs = getattr(st, "st_file_attributes", 0)
                            is_cloud = bool(
                                attrs & (FILE_ATTRIBUTE_OFFLINE | FILE_ATTRIBUTE_RECALL_ON_DATA_ACCESS)
                            )
                            results.append(
                                {
                                    "rel_path": rel,
                                    "name": entry.name,
                                    "category": rel.split("/")[0] if "/" in rel else "(Raiz)",
                                    "size": st.st_size,
                                    "mtime": st.st_mtime,
                                    "is_cloud": is_cloud,
                                }
                            )
                    except OSError:
                        continue
        except OSError:
            return

    _walk(root_str)
    results.sort(key=lambda x: x["rel_path"].lower())
    return results


class FolderAssistantEngine:
    def __init__(self, on_notify: Callable[[str, str], None] | None = None):
        self._lock = threading.RLock()
        self._copy_lock = threading.Lock()
        self._on_notify = on_notify
        self._stop_event = threading.Event()
        self._wake_event = threading.Event()

        self.last_scan_time: str | None = None
        self.last_scan_error: str | None = None
        self.jobs_snapshot: list[dict] = []
        self.copy_status: dict = {
            "active": False,
            "job": None,
            "current_file": None,
            "copied_count": 0,
            "total_count": 0,
            "error": None,
        }
        # Track notifications already fired in current session to avoid repeating
        self._notified_signatures: dict[str, set[str]] = {}

        self._worker_thread = threading.Thread(target=self._monitor_loop, daemon=True)

    def start(self) -> None:
        if not self._worker_thread.is_alive():
            self._worker_thread.start()

    def stop(self) -> None:
        self._stop_event.set()
        self._wake_event.set()

    def trigger_scan_now(self) -> None:
        self._wake_event.set()

    def _notify(self, title: str, message: str) -> None:
        cfg = load_config()
        if cfg.get("notify_popup", True) and self._on_notify:
            try:
                self._on_notify(title, message)
            except Exception:
                pass

    def scan_once(self, allow_auto_copy: bool = True) -> list[dict]:
        cfg = load_config()
        source_dir = Path(cfg["source_dir"])
        dest_dir = Path(cfg["dest_dir"])
        oficina_regex = re.compile(cfg["oficina_folder_pattern"], re.IGNORECASE)
        ignored_sys = cfg.get("ignored_system_folders", [])

        if not source_dir.exists():
            with self._lock:
                self.last_scan_error = f"Pasta de origem não encontrada: {source_dir}"
                self.last_scan_time = datetime.now().strftime("%H:%M:%S")
            return self.jobs_snapshot

        state = load_state()
        jobs_state = state.setdefault("jobs", {})
        was_first_scan = not state.get("first_scan_done", False)

        scanned_jobs: list[dict] = []
        jobs_to_auto_copy: list[str] = []

        try:
            with os.scandir(source_dir) as it:
                entries = [e for e in it if e.is_dir(follow_symlinks=False)]
        except OSError as exc:
            with self._lock:
                self.last_scan_error = f"Erro ao ler OneDrive: {exc}"
                self.last_scan_time = datetime.now().strftime("%H:%M:%S")
            return self.jobs_snapshot

        entries.sort(key=lambda e: e.name.lower())

        for entry in entries:
            job_name = entry.name
            if _is_ignored_system_folder(job_name, ignored_sys):
                continue

            job_path = Path(entry.path)
            oficina_dir: Path | None = None
            try:
                with os.scandir(job_path) as sub_it:
                    for sub in sub_it:
                        if sub.is_dir(follow_symlinks=False) and oficina_regex.match(sub.name):
                            oficina_dir = Path(sub.path)
                            break
            except OSError:
                pass

            files = _scan_oficina_files(oficina_dir) if oficina_dir else []
            dest_job_dir = dest_dir / job_name
            dest_exists = dest_job_dir.exists()

            jstate = jobs_state.get(job_name, {})
            copied_set = set(jstate.get("copied_files", []))
            ignored_set = set(jstate.get("ignored_files", []))
            is_ignored_job = bool(jstate.get("ignored", False))

            enriched_files = []
            new_rel_paths = []
            missing_local_count = 0
            total_bytes = 0
            new_bytes = 0

            for f in files:
                rel = f["rel_path"]
                total_bytes += f["size"]
                local_file_path = dest_job_dir / Path(rel)
                exists_local = local_file_path.exists() if dest_exists else False
                if not exists_local:
                    missing_local_count += 1

                is_new = (not exists_local) and (rel not in copied_set) and (rel not in ignored_set)
                if is_new:
                    new_rel_paths.append(rel)
                    new_bytes += f["size"]

                enriched_files.append(
                    {
                        **f,
                        "exists_local": exists_local,
                        "is_new": is_new,
                    }
                )

            if len(enriched_files) == 0:
                status = "aguardando"
            elif dest_exists:
                status = "atualizacao" if len(new_rel_paths) > 0 else "sincronizado"
            else:
                if is_ignored_job and len(new_rel_paths) == 0:
                    status = "ignorado"
                elif is_ignored_job and len(new_rel_paths) > 0:
                    status = "atualizacao"
                else:
                    status = "novo"

            latest_mtime = max((f["mtime"] for f in enriched_files), default=0.0)
            categories = sorted({f["category"] for f in enriched_files})

            job_info = {
                "name": job_name,
                "source_path": str(job_path),
                "oficina_path": str(oficina_dir) if oficina_dir else None,
                "dest_path": str(dest_job_dir),
                "dest_exists": dest_exists,
                "status": status,
                "total_files": len(enriched_files),
                "new_files_count": len(new_rel_paths),
                "missing_local_count": missing_local_count,
                "total_bytes": total_bytes,
                "new_bytes": new_bytes,
                "categories": categories,
                "latest_mtime": latest_mtime,
                "latest_date_str": (
                    datetime.fromtimestamp(latest_mtime).strftime("%d/%m/%Y %H:%M")
                    if latest_mtime > 0
                    else "—"
                ),
                "last_copied_at": jstate.get("last_copied_at"),
                "ignored": is_ignored_job,
                "files": enriched_files,
            }
            scanned_jobs.append(job_info)

            # Notifications & auto-copy queuing for newly detected items
            if status in ("novo", "atualizacao") and len(new_rel_paths) > 0:
                prev_notified = self._notified_signatures.get(job_name, set())
                unnotified = set(new_rel_paths) - prev_notified
                if unnotified:
                    self._notified_signatures[job_name] = prev_notified | set(new_rel_paths)
                    if not was_first_scan:
                        if status == "novo":
                            self._notify(
                                "Novo serviço liberado na Oficina!",
                                f"{job_name} ({len(new_rel_paths)} arquivo(s) em 3 - OFICINA)",
                            )
                            add_history_event(
                                "detected",
                                job_name,
                                f"Novo serviço detectado com {len(new_rel_paths)} arquivo(s).",
                                list(new_rel_paths),
                            )
                        else:
                            self._notify(
                                "Novos arquivos em 3 - OFICINA!",
                                f"{job_name}: +{len(unnotified)} arquivo(s) novo(s)",
                            )
                            add_history_event(
                                "detected",
                                job_name,
                                f"Detectado(s) {len(unnotified)} arquivo(s) novo(s) na pasta 3 - OFICINA.",
                                sorted(unnotified),
                            )

                if allow_auto_copy and cfg.get("auto_copy_new", False):
                    jobs_to_auto_copy.append(job_name)

        if was_first_scan:
            state["first_scan_done"] = True
            save_state(state)

        # Sort priority: novo -> atualizacao -> sincronizado -> aguardando -> ignorado
        priority = {
            "novo": 0,
            "atualizacao": 1,
            "sincronizado": 2,
            "aguardando": 3,
            "ignorado": 4,
        }
        scanned_jobs.sort(key=lambda j: (priority.get(j["status"], 9), -j["latest_mtime"], j["name"].lower()))

        with self._lock:
            self.jobs_snapshot = scanned_jobs
            self.last_scan_time = datetime.now().strftime("%H:%M:%S")
            self.last_scan_error = None

        # Sync snapshot with central Mach3 Tracker cloud dashboard
        self._push_snapshot_to_cloud(scanned_jobs)

        # Execute auto-copy outside scan lock
        for jname in jobs_to_auto_copy:
            self.copy_job(jname, force_missing=False, triggered_by="auto")

        return self.jobs_snapshot

    def _push_snapshot_to_cloud(self, snapshot: list[dict]) -> None:
        def _worker():
            try:
                import requests
                cfg = load_config()
                payload = {
                    'status': 'online',
                    'last_scan_time': self.last_scan_time,
                    'total_projects': len(snapshot),
                    'active_config': {
                        'source_dir': cfg.get('source_dir'),
                        'dest_dir': cfg.get('dest_dir'),
                        'oficina_folder_pattern': cfg.get('oficina_folder_pattern'),
                        'target_spindle_speed': cfg.get('target_spindle_speed', '18000'),
                        'patch_gcode_macros': cfg.get('patch_gcode_macros', True),
                        'auto_copy_new': cfg.get('auto_copy_new', True),
                    },
                    'jobs': snapshot,
                }
                base_url = cfg.get('cloud_api_url', 'https://mach3tracker.up.railway.app')
                requests.post(f'{base_url}/api/oficina-sync', json=payload, timeout=8)
            except Exception:
                pass

        threading.Thread(target=_worker, daemon=True).start()

    def copy_job(self, job_name: str, force_missing: bool = False, triggered_by: str = "manual") -> dict:
        """
        Copies contents of <Job>/3 - OFICINA into <dest_dir>/<Job>.
        NEVER overwrites files that already exist locally in <dest_dir>/<Job>.
        """
        with self._copy_lock:
            cfg = load_config()
            source_job_dir = Path(cfg["source_dir"]) / job_name
            dest_job_dir = Path(cfg["dest_dir"]) / job_name
            oficina_regex = re.compile(cfg["oficina_folder_pattern"], re.IGNORECASE)

            if not source_job_dir.exists():
                return {"ok": False, "error": f"Pasta de origem não encontrada: {source_job_dir}"}

            oficina_dir: Path | None = None
            with os.scandir(source_job_dir) as it:
                for sub in it:
                    if sub.is_dir(follow_symlinks=False) and oficina_regex.match(sub.name):
                        oficina_dir = Path(sub.path)
                        break

            if not oficina_dir or not oficina_dir.exists():
                return {"ok": False, "error": "Subpasta '3 - OFICINA' não encontrada neste projeto."}

            files = _scan_oficina_files(oficina_dir)
            if not files:
                return {"ok": False, "error": "A pasta '3 - OFICINA' ainda não possui arquivos liberados."}

            state = load_state()
            jstate = state.setdefault("jobs", {}).setdefault(job_name, {})
            copied_set = set(jstate.get("copied_files", []))
            ignored_set = set(jstate.get("ignored_files", []))

            to_copy = []
            skipped_existing = 0
            for f in files:
                rel = f["rel_path"]
                dst_file = dest_job_dir / Path(rel)
                if dst_file.exists():
                    skipped_existing += 1
                    copied_set.add(rel)
                    continue
                if force_missing:
                    to_copy.append(f)
                else:
                    if (rel not in copied_set) and (rel not in ignored_set):
                        to_copy.append(f)

            # Always ensure project folder exists in ARQUIVOS 2026 when user explicitly copies
            dest_job_dir.mkdir(parents=True, exist_ok=True)

            if not to_copy:
                jstate["ignored"] = False
                jstate["copied_files"] = sorted(copied_set)
                save_state(state)
                self.scan_once(allow_auto_copy=False)
                return {
                    "ok": True,
                    "copied": 0,
                    "skipped_existing": skipped_existing,
                    "message": "Todos os arquivos já existem na pasta local (nenhum arquivo sobrescrito).",
                }

            self.copy_status = {
                "active": True,
                "job": job_name,
                "current_file": "",
                "copied_count": 0,
                "total_count": len(to_copy),
                "error": None,
            }

            copied_files_now = []
            errors = []

            try:
                for idx, f in enumerate(to_copy, start=1):
                    rel = f["rel_path"]
                    self.copy_status["current_file"] = rel
                    src_file = oficina_dir / Path(rel)
                    dst_file = dest_job_dir / Path(rel)

                    # Double-check non-overwrite safety right before writing
                    if dst_file.exists():
                        skipped_existing += 1
                        copied_set.add(rel)
                        self.copy_status["copied_count"] = idx
                        continue

                    dst_file.parent.mkdir(parents=True, exist_ok=True)
                    tmp_dst = dst_file.with_name(dst_file.name + ".copying_tmp")

                    try:
                        # Stream in 1MB chunks (triggers OneDrive hydration cleanly without copying reparse attributes)
                        with open(src_file, "rb") as fsrc, open(tmp_dst, "wb") as fdst:
                            shutil.copyfileobj(fsrc, fdst, length=1024 * 1024)

                        # Injeção automática de M101 e M102 para o Mach3 Tracker
                        if cfg.get("patch_gcode_macros", True):
                            try_patch_gcode_file(
                                tmp_dst,
                                target_speed=cfg.get("target_spindle_speed", "18000"),
                                original_name=dst_file.name
                            )

                        try:
                            os.utime(tmp_dst, (f["mtime"], f["mtime"]))
                        except OSError:
                            pass
                        if dst_file.exists():
                            tmp_dst.unlink(missing_ok=True)
                            skipped_existing += 1
                        else:
                            tmp_dst.replace(dst_file)
                            copied_files_now.append(rel)
                            copied_set.add(rel)
                    except Exception as exc:
                        tmp_dst.unlink(missing_ok=True)
                        errors.append(f"{rel}: {exc}")

                    self.copy_status["copied_count"] = idx
            finally:
                self.copy_status["active"] = False
                self.copy_status["current_file"] = None

            now_str = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
            jstate["ignored"] = False
            jstate["copied_files"] = sorted(copied_set)
            if copied_files_now:
                jstate["last_copied_at"] = now_str
            save_state(state)

            if copied_files_now:
                mode_label = "automaticamente" if triggered_by == "auto" else "manualmente"
                add_history_event(
                    "copied",
                    job_name,
                    f"{len(copied_files_now)} arquivo(s) copiado(s) {mode_label} para ARQUIVOS 2026.",
                    copied_files_now,
                )
                if triggered_by == "auto":
                    self._notify(
                        "Serviço copiado para ARQUIVOS 2026!",
                        f"{job_name}: {len(copied_files_now)} arquivo(s) de 3 - OFICINA copiado(s).",
                    )

            if errors:
                add_history_event(
                    "error",
                    job_name,
                    f"Falha ao copiar {len(errors)} arquivo(s) (verifique sincronização do OneDrive).",
                    errors,
                )

            self.scan_once(allow_auto_copy=False)
            return {
                "ok": len(errors) == 0,
                "copied": len(copied_files_now),
                "skipped_existing": skipped_existing,
                "errors": errors,
                "dest_path": str(dest_job_dir),
            }

    def set_job_ignored(self, job_name: str, ignored: bool) -> dict:
        state = load_state()
        jstate = state.setdefault("jobs", {}).setdefault(job_name, {})
        jstate["ignored"] = ignored

        if ignored:
            # Snapshot current files so we ignore existing ones, while still catching FUTURE files added later
            job_match = next((j for j in self.jobs_snapshot if j["name"] == job_name), None)
            if job_match:
                current_rels = {f["rel_path"] for f in job_match["files"]}
                jstate["ignored_files"] = sorted(set(jstate.get("ignored_files", [])) | current_rels)
            add_history_event("ignored", job_name, "Marcado como já atendido / ignorado.")
        else:
            jstate["ignored_files"] = []
            add_history_event("unignored", job_name, "Reativado para fila de pendentes.")

        save_state(state)
        self.scan_once(allow_auto_copy=False)
        return {"ok": True}

    def mark_all_current_pending_as_ignored(self) -> dict:
        state = load_state()
        jobs_state = state.setdefault("jobs", {})
        count = 0
        for job in self.jobs_snapshot:
            if job["status"] in ("novo", "atualizacao") and not job["dest_exists"]:
                jname = job["name"]
                jstate = jobs_state.setdefault(jname, {})
                jstate["ignored"] = True
                current_rels = {f["rel_path"] for f in job["files"]}
                jstate["ignored_files"] = sorted(set(jstate.get("ignored_files", [])) | current_rels)
                count += 1

        if count > 0:
            add_history_event(
                "ignored",
                "Lote Inicial",
                f"{count} projeto(s) pré-existente(s) marcado(s) como já atendidos.",
            )
            save_state(state)
            self.scan_once(allow_auto_copy=False)
        return {"ok": True, "count": count}

    def open_in_explorer(self, path_str: str) -> dict:
        p = Path(path_str)
        if not p.exists():
            return {"ok": False, "error": f"Pasta ainda não existe: {p}"}
        os.startfile(str(p))
        return {"ok": True}

    def _monitor_loop(self) -> None:
        # Initial scan without firing Windows toast barrage on startup
        self.scan_once(allow_auto_copy=True)
        while not self._stop_event.is_set():
            cfg = load_config()
            interval = max(10, int(cfg.get("scan_interval_seconds", 25)))
            self._wake_event.wait(timeout=interval)
            self._wake_event.clear()
            if self._stop_event.is_set():
                break
            try:
                self.scan_once(allow_auto_copy=True)
            except Exception as exc:
                with self._lock:
                    self.last_scan_error = str(exc)
