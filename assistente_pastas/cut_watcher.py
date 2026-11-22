"""
Cut Watcher — Monitora em segundo plano cortes finalizados no Mach3 Tracker
e aciona o Robô Transformer da Router CNC sempre que uma usinagem terminar.
"""

from datetime import datetime, timezone
import logging
import threading
import time

from api_client import fetch_json
from config import load_config


def parse_iso_utc(value) -> datetime | None:
    if not value:
        return None
    try:
        s = str(value).strip()
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception:
        return None


class CutWatcher:
    """Monitora cortes recém-concluídos (Router Central, Router 2, Laser, Vácuo)."""

    def __init__(self, on_cut_callback, poll_seconds: float = 4.0, max_age_seconds: float = 900.0):
        self.on_cut_callback = on_cut_callback
        self.poll_seconds = poll_seconds
        self.max_age_seconds = max_age_seconds
        self._stop_event = threading.Event()
        self._worker_thread = threading.Thread(target=self._loop, daemon=True, name="CutWatcherThread")
        self._known_completed_ids: set[int] = set()
        self._initialized = False

    def start(self) -> None:
        if not self._worker_thread.is_alive():
            self._worker_thread.start()
            logging.info("CutWatcher iniciado com sucesso.")

    def stop(self) -> None:
        self._stop_event.set()

    def _fetch_completed_jobs(self) -> list[dict] | None:
        data = fetch_json(
            ["/api/jobs/completed-updates?limit=30", "/api/jobs"],
            user_agent="RoboRouterCutWatcher/1.0",
            timeout=4.0,
        )
        if data is None:
            return None
        if isinstance(data, dict) and isinstance(data.get("jobs"), list):
            return data["jobs"]
        if isinstance(data, list):
            # Fallback para /api/jobs: mantém os finalizados mais recentes
            done = [j for j in data if isinstance(j, dict) and j.get("end_time")]
            done.sort(key=lambda j: str(j.get("end_time") or ""), reverse=True)
            return done[:40]
        return None

    def process_snapshot(self, jobs: list[dict], now_utc: datetime | None = None) -> list[dict]:
        """Processa uma lista de jobs finalizados, retornando apenas os cortes recém-terminados."""
        completed = [j for j in (jobs or []) if isinstance(j, dict) and j.get("id") is not None and j.get("end_time")]

        if not self._initialized:
            for j in completed:
                self._known_completed_ids.add(int(j["id"]))
            self._initialized = True
            logging.info(f"CutWatcher inicializado com {len(self._known_completed_ids)} cortes já concluídos.")
            return []

        ref_now = now_utc or datetime.now(timezone.utc)
        fresh = []
        for j in completed:
            jid = int(j["id"])
            if jid in self._known_completed_ids:
                continue
            self._known_completed_ids.add(jid)

            dur_raw = j.get("duration_minutes")
            if dur_raw is not None:
                try:
                    if float(dur_raw) < 0.4:
                        continue
                except (TypeError, ValueError):
                    pass

            end_dt = parse_iso_utc(j.get("end_time"))
            if not end_dt:
                continue
            age = (ref_now - end_dt).total_seconds()
            if age > self.max_age_seconds or age < -300:
                continue

            fresh.append((end_dt, jid, j))

        if len(self._known_completed_ids) > 2000:
            newest = sorted(self._known_completed_ids)[-1000:]
            self._known_completed_ids = set(newest)

        fresh.sort(key=lambda item: (item[0], item[1]))
        return [item[2] for item in fresh]

    def _loop(self) -> None:
        time.sleep(2.5)
        while not self._stop_event.is_set():
            cfg = load_config()
            if cfg.get("notify_cut_done", True) and cfg.get("notify_popup", True):
                try:
                    jobs = self._fetch_completed_jobs()
                    if jobs is not None:
                        newly_done = self.process_snapshot(jobs)
                        for j in newly_done:
                            logging.info(
                                f"CutWatcher detectou corte finalizado: ID {j.get('id')} | "
                                f"{j.get('router_name')} | {j.get('file_name')}"
                            )
                            if self.on_cut_callback:
                                try:
                                    self.on_cut_callback(j)
                                except Exception as cb_err:
                                    logging.error(f"Erro no callback do CutWatcher: {cb_err}")
                except Exception as exc:
                    logging.debug(f"Erro no ciclo do CutWatcher: {exc}")

            self._stop_event.wait(self.poll_seconds)
