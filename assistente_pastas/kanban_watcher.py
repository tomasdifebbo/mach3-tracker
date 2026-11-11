"""
Kanban Watcher — Monitora em segundo plano a coluna 'A Fazer' (todo) do Kanban
e aciona o Robô Router sempre que uma nova tarefa for adicionada ou atualizada.
"""

import json
import logging
import threading
import time
import urllib.request
from config import load_config


class KanbanWatcher:
    """
    Monitor de tarefas do Kanban em segundo plano.
    Consulta os endpoints local e cloud da API do Mach3 Tracker.
    """

    def __init__(self, on_task_callback):
        self.on_task_callback = on_task_callback
        self._stop_event = threading.Event()
        self._worker_thread = threading.Thread(target=self._loop, daemon=True, name="KanbanWatcherThread")
        self._known_tasks: dict[int, str | None] = {}
        self._initialized = False

    def start(self) -> None:
        if not self._worker_thread.is_alive():
            self._worker_thread.start()
            logging.info("KanbanWatcher iniciado com sucesso.")

    def stop(self) -> None:
        self._stop_event.set()

    def _fetch_todo_tasks(self) -> list[dict] | None:
        urls = [
            "http://localhost:3000/api/kanban/todo-updates",
            "https://mach3tracker.up.railway.app/api/kanban/todo-updates"
        ]
        for url in urls:
            try:
                req = urllib.request.Request(
                    url,
                    headers={"User-Agent": "RoboRouterKanban/1.0", "Accept": "application/json"}
                )
                with urllib.request.urlopen(req, timeout=4) as response:
                    if response.status == 200:
                        data = json.loads(response.read().decode("utf-8"))
                        if data.get("success") and isinstance(data.get("tasks"), list):
                            return data["tasks"]
            except Exception as e:
                logging.debug(f"Falha ao consultar Kanban em {url}: {e}")
                continue
        return None

    def _loop(self) -> None:
        # Aguarda 3 segundos iniciais para estabilização
        time.sleep(3)

        while not self._stop_event.is_set():
            cfg = load_config()
            # Só monitora se notificações estiverem ativas
            if cfg.get("notify_kanban", True) and cfg.get("notify_popup", True):
                try:
                    tasks = self._fetch_todo_tasks()
                    if tasks is not None:
                        current_ids = {t["id"] for t in tasks}

                        if not self._initialized:
                            # Primeira execução: cataloga tarefas existentes para não disparar enxurrada
                            for t in tasks:
                                self._known_tasks[t["id"]] = t.get("updated_at")
                            self._initialized = True
                            logging.info(f"KanbanWatcher inicializado com {len(self._known_tasks)} tarefas pré-existentes em 'A Fazer'.")
                        else:
                            # Detecta novas tarefas ou tarefas modificadas para 'todo'
                            new_or_updated = []
                            for t in tasks:
                                tid = t["id"]
                                up = t.get("updated_at")
                                if tid not in self._known_tasks:
                                    new_or_updated.append((t, "nova"))
                                    self._known_tasks[tid] = up
                                elif up and self._known_tasks.get(tid) != up:
                                    new_or_updated.append((t, "atualizada"))
                                    self._known_tasks[tid] = up

                            # Notifica via callback (o callback enfileira para a UI thread do Tkinter)
                            for t, reason in new_or_updated:
                                logging.info(f"KanbanWatcher detectou tarefa {reason}: ID {t.get('id')} - {t.get('title')}")
                                if self.on_task_callback:
                                    try:
                                        self.on_task_callback(t)
                                    except Exception as cb_err:
                                        logging.error(f"Erro no callback do Robô Kanban: {cb_err}")

                        # Remove do cache tarefas que saíram de 'todo' (concluídas ou movidas para 'doing')
                        # Assim, se voltarem para 'todo', dispararão notificação novamente!
                        for old_id in list(self._known_tasks.keys()):
                            if old_id not in current_ids:
                                del self._known_tasks[old_id]

                except Exception as exc:
                    logging.debug(f"Erro no ciclo do KanbanWatcher: {exc}")

            # Polling a cada 6 segundos
            self._stop_event.wait(6)
