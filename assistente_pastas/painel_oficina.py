import logging
import os
from pathlib import Path
import subprocess
import queue
import sys
import threading
import time
import traceback
import tkinter as tk
from tkinter import messagebox, ttk
import winsound
from filelock import FileLock, Timeout

from config import (
    DATA_DIR,
    load_config,
    load_state,
    save_config,
)
from engine import FolderAssistantEngine
from icon_helper import ensure_app_icon
from robo_notificador import RoboNotificador

LOCK_FILE = DATA_DIR / "instance.lock"
SHOW_SIGNAL = DATA_DIR / "show_window.signal"
PID_FILE = DATA_DIR / "instance.pid"
WINDOW_TITLE = "ACT • Controle de Pastas (3 - OFICINA ➔ ARQUIVOS 2026)"

logging.basicConfig(
    filename=str(DATA_DIR / "painel.log"),
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    encoding="utf-8",
)
sys.excepthook = lambda t, v, tb: logging.error("Erro:\n%s", "".join(traceback.format_exception(t, v, tb)))

# Palette
BG_MAIN = "#0f172a"
BG_CARD = "#1e293b"
BG_ELEV = "#273549"
FG_MAIN = "#f1f5f9"
FG_MUTED = "#94a3b8"
AMBER = "#f59e0b"
AMBER_HOVER = "#fbbf24"
EMERALD = "#10b981"
SKY = "#38bdf8"
DANGER = "#ef4444"


def format_bytes(num_bytes: int) -> str:
    if not num_bytes or num_bytes <= 0:
        return "0 KB"
    units = ["B", "KB", "MB", "GB"]
    val = float(num_bytes)
    idx = 0
    while val >= 1024 and idx < len(units) - 1:
        val /= 1024.0
        idx += 1
    return f"{val:.1f} {units[idx]}" if idx > 1 else f"{int(val)} {units[idx]}"


class FolderAssistantApp:
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title(WINDOW_TITLE)
        self.root.geometry("1120x720")
        self.root.minsize(900, 560)
        self.root.configure(bg=BG_MAIN)

        try:
            ico = ensure_app_icon()
            self.root.iconbitmap(str(ico))
        except Exception:
            pass

        self.ui_queue: queue.Queue = queue.Queue()
        self.engine = FolderAssistantEngine(on_notify=self._enqueue_notification)

        self.active_tab = "pendentes"
        self.selected_job_name: str | None = None
        self.last_signature: str = ""
        self.mini_widget: tk.Toplevel | None = None
        self.robo = RoboNotificador(self.root, sound_enabled_fn=lambda: load_config().get("sound_alert", True))

        self._setup_styles()
        self._build_layout()

        self.root.protocol("WM_DELETE_WINDOW", self._on_close_button)
        # When restored from the taskbar, close the mini-bar automatically
        self.root.bind("<Map>", self._on_root_mapped)

        # Start engine
        self.engine.start()
        self.root.after(300, self._poll_loop)

    def _enqueue_notification(
        self,
        title: str,
        message: str,
        folder_path: str | None = None,
        job_name: str | None = None,
    ) -> None:
        self.ui_queue.put(("notify", (title, message, folder_path, job_name)))

    def _setup_styles(self) -> None:
        style = ttk.Style(self.root)
        style.theme_use("clam")

        style.configure(".", background=BG_MAIN, foreground=FG_MAIN, font=("Segoe UI", 10))
        style.configure("Card.TFrame", background=BG_CARD)

        style.configure(
            "Treeview",
            background=BG_CARD,
            fieldbackground=BG_CARD,
            foreground=FG_MAIN,
            rowheight=30,
            borderwidth=0,
            font=("Segoe UI", 9),
        )
        style.configure(
            "Treeview.Heading",
            background=BG_ELEV,
            foreground=FG_MUTED,
            relief="flat",
            padding=(8, 6),
            font=("Segoe UI Semibold", 9),
        )
        style.map(
            "Treeview",
            background=[("selected", "#334155")],
            foreground=[("selected", "#ffffff")],
        )
        style.map("Treeview.Heading", background=[("active", "#334155")])

        style.configure(
            "Amber.Horizontal.TProgressbar",
            troughcolor=BG_MAIN,
            background=AMBER,
            bordercolor=BG_MAIN,
            lightcolor=AMBER,
            darkcolor=AMBER,
        )

    def _make_btn(
        self,
        parent: tk.Widget,
        text: str,
        command,
        bg: str = BG_ELEV,
        fg: str = FG_MAIN,
        hover_bg: str = "#334155",
        bold: bool = True,
        padx: int = 12,
        pady: int = 6,
    ) -> tk.Button:
        font = ("Segoe UI Semibold", 9) if bold else ("Segoe UI", 9)
        btn = tk.Button(
            parent,
            text=text,
            command=command,
            bg=bg,
            fg=fg,
            activebackground=hover_bg,
            activeforeground=fg,
            relief="flat",
            bd=0,
            padx=padx,
            pady=pady,
            cursor="hand2",
            font=font,
        )
        btn.bind("<Enter>", lambda e: btn.configure(bg=hover_bg) if str(btn["state"]) != "disabled" else None)
        btn.bind("<Leave>", lambda e: btn.configure(bg=bg) if str(btn["state"]) != "disabled" else None)
        return btn

    def _build_layout(self) -> None:
        cfg = load_config()

        # 1. Header Bar
        header = tk.Frame(self.root, bg=BG_CARD, padx=18, pady=12)
        header.pack(fill="x")

        title_box = tk.Frame(header, bg=BG_CARD)
        title_box.pack(side="left")

        lbl_title = tk.Label(
            title_box,
            text="Controle de Pastas • 3 - OFICINA ➔ ARQUIVOS 2026",
            bg=BG_CARD,
            fg=FG_MAIN,
            font=("Segoe UI Bold", 13),
        )
        lbl_title.pack(anchor="w")

        self.lbl_scan_status = tk.Label(
            title_box,
            text="Iniciando verificação do OneDrive...",
            bg=BG_CARD,
            fg=EMERALD,
            font=("Segoe UI", 9),
        )
        self.lbl_scan_status.pack(anchor="w", pady=(2, 0))

        controls_box = tk.Frame(header, bg=BG_CARD)
        controls_box.pack(side="right")

        self.var_auto_copy = tk.BooleanVar(value=bool(cfg.get("auto_copy_new", False)))
        chk_auto = tk.Checkbutton(
            controls_box,
            text="Cópia Automática de Novos",
            variable=self.var_auto_copy,
            command=self._on_toggle_auto_copy,
            bg=BG_ELEV,
            fg=FG_MAIN,
            selectcolor=BG_MAIN,
            activebackground=BG_ELEV,
            activeforeground=FG_MAIN,
            padx=10,
            pady=5,
            relief="flat",
            cursor="hand2",
            font=("Segoe UI Semibold", 9),
        )
        chk_auto.pack(side="left", padx=(0, 8))

        self._make_btn(controls_box, "⟳ Verificar Agora", self._on_scan_now).pack(side="left", padx=(0, 8))
        self._make_btn(controls_box, "🤖 Testar Robô", self._on_test_robo).pack(side="left", padx=(0, 8))
        self._make_btn(controls_box, "◱ Modo Mini-Barra", self._enter_mini_mode).pack(side="left", padx=(0, 8))
        self._make_btn(controls_box, "⚙ Configurações", self._open_settings_dialog).pack(side="left")

        # 2. Path Strip
        path_strip = tk.Frame(self.root, bg="#0b1120", padx=18, pady=7)
        path_strip.pack(fill="x")

        self.btn_src_path = tk.Label(
            path_strip,
            text=f"ORIGEM: {cfg.get('source_dir', '')}",
            bg=BG_CARD,
            fg=SKY,
            padx=8,
            pady=3,
            cursor="hand2",
            font=("Segoe UI", 8),
        )
        self.btn_src_path.pack(side="left")
        self.btn_src_path.bind("<Button-1>", lambda e: self._open_folder(load_config().get("source_dir", "")))

        tk.Label(path_strip, text="➔", bg="#0b1120", fg=FG_MUTED, padx=6).pack(side="left")

        self.btn_dst_path = tk.Label(
            path_strip,
            text=f"DESTINO: {cfg.get('dest_dir', '')}",
            bg=BG_CARD,
            fg=EMERALD,
            padx=8,
            pady=3,
            cursor="hand2",
            font=("Segoe UI", 8),
        )
        self.btn_dst_path.pack(side="left")
        self.btn_dst_path.bind("<Button-1>", lambda e: self._open_folder(load_config().get("dest_dir", "")))

        tk.Label(
            path_strip,
            text="✓ Proteção Ativa: nunca sobrescreve arquivos já existentes localmente",
            bg="#0b1120",
            fg=EMERALD,
            font=("Segoe UI Semibold", 8),
        ).pack(side="right")

        # 3. Copy Progress Bar (hidden unless copying)
        self.progress_frame = tk.Frame(self.root, bg="#292112", padx=18, pady=8)
        self.lbl_progress_title = tk.Label(
            self.progress_frame,
            text="Copiando arquivos...",
            bg="#292112",
            fg=AMBER,
            font=("Segoe UI Semibold", 9),
        )
        self.lbl_progress_title.pack(anchor="w")
        self.progress_bar = ttk.Progressbar(
            self.progress_frame,
            style="Amber.Horizontal.TProgressbar",
            orient="horizontal",
            mode="determinate",
        )
        self.progress_bar.pack(fill="x", pady=4)
        self.lbl_progress_file = tk.Label(
            self.progress_frame,
            text="",
            bg="#292112",
            fg=FG_MUTED,
            font=("Segoe UI", 8),
        )
        self.lbl_progress_file.pack(anchor="w")

        # 4. Tabs + Search Bar
        toolbar = tk.Frame(self.root, bg=BG_MAIN, padx=18, pady=10)
        toolbar.pack(fill="x")

        tabs_frame = tk.Frame(toolbar, bg=BG_MAIN)
        tabs_frame.pack(side="left")

        self.tab_buttons: dict[str, tk.Button] = {}
        tab_defs = [
            ("pendentes", "Novos / Pendentes (0)"),
            ("aguardando", "Aguardando 3 - OFICINA (0)"),
            ("sincronizado", "Na Pasta 2026 (0)"),
            ("ignorado", "Já Feitos / Antigos (0)"),
            ("todos", "Todos (0)"),
            ("historico", "Histórico"),
        ]
        for key, label in tab_defs:
            b = tk.Button(
                tabs_frame,
                text=label,
                command=lambda k=key: self._switch_tab(k),
                bg=BG_ELEV if key == "pendentes" else BG_CARD,
                fg=AMBER if key == "pendentes" else FG_MUTED,
                relief="flat",
                bd=0,
                padx=11,
                pady=6,
                cursor="hand2",
                font=("Segoe UI Semibold", 9),
            )
            b.pack(side="left", padx=(0, 5))
            self.tab_buttons[key] = b

        search_frame = tk.Frame(toolbar, bg=BG_MAIN)
        search_frame.pack(side="right")
        tk.Label(search_frame, text="Buscar:", bg=BG_MAIN, fg=FG_MUTED, font=("Segoe UI", 9)).pack(side="left", padx=(0, 6))
        self.var_search = tk.StringVar()
        self.var_search.trace_add("write", lambda *_: self._refresh_views(force=True))
        ent_search = tk.Entry(
            search_frame,
            textvariable=self.var_search,
            bg=BG_CARD,
            fg=FG_MAIN,
            insertbackground=FG_MAIN,
            relief="flat",
            width=26,
            font=("Segoe UI", 9),
        )
        ent_search.pack(side="left", ipady=5, ipadx=6)

        # 5. Action Bar for Selected Job / Batch
        action_bar = tk.Frame(self.root, bg=BG_CARD, padx=18, pady=8)
        action_bar.pack(fill="x", padx=18, pady=(0, 8))

        self.btn_copy_selected = self._make_btn(
            action_bar,
            "⬇ Copiar Selecionado p/ 2026",
            self._on_copy_selected,
            bg=AMBER,
            fg="#0b0f17",
            hover_bg=AMBER_HOVER,
        )
        self.btn_copy_selected.pack(side="left", padx=(0, 8))

        self.btn_open_2026 = self._make_btn(action_bar, "📂 Abrir em ARQUIVOS 2026", self._on_open_selected_dest)
        self.btn_open_2026.pack(side="left", padx=(0, 8))

        self.btn_open_src = self._make_btn(action_bar, "☁ Abrir 3 - OFICINA (OneDrive)", self._on_open_selected_src)
        self.btn_open_src.pack(side="left", padx=(0, 8))

        self.btn_toggle_ignore = self._make_btn(action_bar, "✓ Marcar Já Feito", self._on_toggle_ignore_selected)
        self.btn_toggle_ignore.pack(side="left", padx=(0, 8))

        # Right side batch buttons
        self.btn_copy_all = self._make_btn(
            action_bar,
            "⬇ Copiar Todos os Pendentes",
            self._on_copy_all_pending,
            bg="#065f46",
            fg="#ecfdf5",
            hover_bg="#047857",
        )
        self.btn_copy_all.pack(side="right")

        self.btn_ignore_all = self._make_btn(
            action_bar,
            "Marcar Pendentes Atuais como Já Feitos",
            self._on_ignore_all_pending,
            bold=False,
        )
        self.btn_ignore_all.pack(side="right", padx=(0, 8))

        # 6. Split PanedWindow: Top = Jobs Table, Bottom = Files inside 3 - OFICINA
        self.main_pane = tk.PanedWindow(self.root, orient="vertical", bg=BG_MAIN, sashwidth=6, bd=0)
        self.main_pane.pack(fill="both", expand=True, padx=18, pady=(0, 12))

        # Top Jobs Table
        jobs_frame = tk.Frame(self.main_pane, bg=BG_CARD)
        cols = ("name", "status", "files", "size", "cats", "updated")
        self.tree_jobs = ttk.Treeview(jobs_frame, columns=cols, show="headings", selectmode="browse")
        self.tree_jobs.heading("name", text="Projeto (Jobs Ativos)")
        self.tree_jobs.heading("status", text="Situação")
        self.tree_jobs.heading("files", text="Arquivos")
        self.tree_jobs.heading("size", text="Tamanho")
        self.tree_jobs.heading("cats", text="Pastas em 3 - OFICINA")
        self.tree_jobs.heading("updated", text="Último Arquivo")

        self.tree_jobs.column("name", width=330, anchor="w")
        self.tree_jobs.column("status", width=185, anchor="w")
        self.tree_jobs.column("files", width=85, anchor="center")
        self.tree_jobs.column("size", width=95, anchor="e")
        self.tree_jobs.column("cats", width=210, anchor="w")
        self.tree_jobs.column("updated", width=135, anchor="center")

        self.tree_jobs.tag_configure("novo", foreground=AMBER)
        self.tree_jobs.tag_configure("atualizacao", foreground=SKY)
        self.tree_jobs.tag_configure("sincronizado", foreground=EMERALD)
        self.tree_jobs.tag_configure("aguardando", foreground=FG_MUTED)
        self.tree_jobs.tag_configure("ignorado", foreground="#64748b")

        vsb_jobs = ttk.Scrollbar(jobs_frame, orient="vertical", command=self.tree_jobs.yview)
        self.tree_jobs.configure(yscrollcommand=vsb_jobs.set)
        self.tree_jobs.pack(side="left", fill="both", expand=True)
        vsb_jobs.pack(side="right", fill="y")

        self.tree_jobs.bind("<<TreeviewSelect>>", self._on_select_job)
        self.tree_jobs.bind("<Double-1>", lambda e: self._on_copy_selected())

        self.main_pane.add(jobs_frame, minsize=220)

        # Bottom Files Table
        files_frame = tk.Frame(self.main_pane, bg=BG_CARD)
        self.lbl_files_header = tk.Label(
            files_frame,
            text="Selecione um projeto acima para inspecionar os arquivos de 3 - OFICINA",
            bg=BG_ELEV,
            fg=FG_MAIN,
            anchor="w",
            padx=10,
            pady=5,
            font=("Segoe UI Semibold", 9),
        )
        self.lbl_files_header.pack(fill="x")

        fcols = ("rel_path", "size", "cloud", "state")
        self.tree_files = ttk.Treeview(files_frame, columns=fcols, show="headings", selectmode="none")
        self.tree_files.heading("rel_path", text="Arquivo dentro de 3 - OFICINA")
        self.tree_files.heading("size", text="Tamanho")
        self.tree_files.heading("cloud", text="Origem OneDrive")
        self.tree_files.heading("state", text="Status em ARQUIVOS 2026")

        self.tree_files.column("rel_path", width=560, anchor="w")
        self.tree_files.column("size", width=110, anchor="e")
        self.tree_files.column("cloud", width=140, anchor="center")
        self.tree_files.column("state", width=210, anchor="w")

        self.tree_files.tag_configure("new_file", foreground=AMBER)
        self.tree_files.tag_configure("local_ok", foreground=EMERALD)
        self.tree_files.tag_configure("seen_file", foreground=FG_MUTED)

        vsb_files = ttk.Scrollbar(files_frame, orient="vertical", command=self.tree_files.yview)
        self.tree_files.configure(yscrollcommand=vsb_files.set)
        self.tree_files.pack(side="left", fill="both", expand=True)
        vsb_files.pack(side="right", fill="y")

        self.main_pane.add(files_frame, minsize=150)

        # History Frame (shown only when tab == 'historico')
        self.history_frame = tk.Frame(self.root, bg=BG_CARD)
        hcols = ("time", "job", "msg")
        self.tree_history = ttk.Treeview(self.history_frame, columns=hcols, show="headings")
        self.tree_history.heading("time", text="Data / Hora")
        self.tree_history.heading("job", text="Projeto")
        self.tree_history.heading("msg", text="Evento")
        self.tree_history.column("time", width=155, anchor="center")
        self.tree_history.column("job", width=280, anchor="w")
        self.tree_history.column("msg", width=600, anchor="w")
        vsb_hist = ttk.Scrollbar(self.history_frame, orient="vertical", command=self.tree_history.yview)
        self.tree_history.configure(yscrollcommand=vsb_hist.set)
        self.tree_history.pack(side="left", fill="both", expand=True)
        vsb_hist.pack(side="right", fill="y")

    # ---------------- UI Polling & Updates ----------------
    def _poll_loop(self) -> None:
        try:
            self._poll_once()
        except Exception:
            logging.exception("Erro no ciclo de atualização")
        # Always reschedule, even after an error, so the panel never freezes
        self.root.after(600, self._poll_loop)

    def _poll_once(self) -> None:
        # Another launch of the .bat asks this instance to show the panel
        if SHOW_SIGNAL.exists():
            try:
                SHOW_SIGNAL.unlink()
            except OSError:
                pass
            self._restore_from_mini_or_minimized()

        while not self.ui_queue.empty():
            try:
                kind, payload = self.ui_queue.get_nowait()
                if kind == "notify":
                    if len(payload) >= 4:
                        title, msg, folder_path, job_name = payload[:4]
                    elif len(payload) == 3:
                        title, msg, folder_path = payload
                        job_name = None
                    else:
                        title, msg = payload
                        folder_path, job_name = None, None
                    self._show_toast_popup(title, msg, folder_path=folder_path, job_name=job_name)
                elif kind == "msg":
                    title, msg, is_err = payload
                    if is_err:
                        messagebox.showwarning(title, msg, parent=self.root)
                    else:
                        self._show_toast_popup(title, msg, play_sound=False)
            except queue.Empty:
                break

        self._update_top_bar_and_progress()
        self._refresh_views(force=False)
        self._update_mini_widget()

    def _update_top_bar_and_progress(self) -> None:
        cfg = load_config()
        interval = cfg.get("scan_interval_seconds", 25)
        if self.engine.last_scan_error:
            self.lbl_scan_status.configure(text=f"⚠ {self.engine.last_scan_error}", fg=DANGER)
        elif self.engine.last_scan_time:
            self.lbl_scan_status.configure(
                text=f"● Monitorando OneDrive a cada {interval}s • Última verificação: {self.engine.last_scan_time}",
                fg=EMERALD,
            )

        cs = self.engine.copy_status
        if cs.get("active"):
            if not self.progress_frame.winfo_ismapped():
                self.progress_frame.pack(fill="x", before=self.main_pane)
            total = max(1, cs.get("total_count", 1))
            done = cs.get("copied_count", 0)
            self.lbl_progress_title.configure(
                text=f"Copiando para ARQUIVOS 2026: {cs.get('job', '')} ({done} de {total})"
            )
            self.progress_bar["maximum"] = total
            self.progress_bar["value"] = done
            self.lbl_progress_file.configure(text=f"Baixando/copiando: {cs.get('current_file') or '...'}")
        else:
            if self.progress_frame.winfo_ismapped():
                self.progress_frame.pack_forget()

    def _status_text(self, job: dict) -> str:
        st = job["status"]
        if st == "novo":
            return f"★ NOVO SERVIÇO ({job['new_files_count']} arq)"
        if st == "atualizacao":
            return f"★ +{job['new_files_count']} ARQUIVO(S) NOVO(S)"
        if st == "sincronizado":
            return "✓ Na Pasta 2026"
        if st == "aguardando":
            return "⏳ Aguardando (Vazia)"
        if st == "ignorado":
            return "Já Atendido / Antigo"
        return st

    def _refresh_views(self, force: bool = False) -> None:
        jobs = self.engine.jobs_snapshot
        pendentes = sum(1 for j in jobs if j["status"] in ("novo", "atualizacao"))
        aguardando = sum(1 for j in jobs if j["status"] == "aguardando")
        sinc = sum(1 for j in jobs if j["status"] == "sincronizado")
        ign = sum(1 for j in jobs if j["status"] == "ignorado")

        self.tab_buttons["pendentes"].configure(text=f"Novos / Pendentes ({pendentes})")
        self.tab_buttons["aguardando"].configure(text=f"Aguardando 3 - OFICINA ({aguardando})")
        self.tab_buttons["sincronizado"].configure(text=f"Na Pasta 2026 ({sinc})")
        self.tab_buttons["ignorado"].configure(text=f"Já Feitos / Antigos ({ign})")
        self.tab_buttons["todos"].configure(text=f"Todos ({len(jobs)})")

        search_q = self.var_search.get().strip().lower()
        sig = repr(
            (
                self.active_tab,
                search_q,
                [(j["name"], j["status"], j["total_files"], j["new_files_count"], j["dest_exists"]) for j in jobs],
            )
        )
        if not force and sig == self.last_signature:
            return
        self.last_signature = sig

        if self.active_tab == "historico":
            if self.main_pane.winfo_ismapped():
                self.main_pane.pack_forget()
            if not self.history_frame.winfo_ismapped():
                self.history_frame.pack(fill="both", expand=True, padx=18, pady=(0, 12))
            self._populate_history()
            return
        else:
            if self.history_frame.winfo_ismapped():
                self.history_frame.pack_forget()
            if not self.main_pane.winfo_ismapped():
                self.main_pane.pack(fill="both", expand=True, padx=18, pady=(0, 12))

        filtered = []
        for j in jobs:
            if self.active_tab == "pendentes" and j["status"] not in ("novo", "atualizacao"):
                continue
            if self.active_tab == "aguardando" and j["status"] != "aguardando":
                continue
            if self.active_tab == "sincronizado" and j["status"] != "sincronizado":
                continue
            if self.active_tab == "ignorado" and j["status"] != "ignorado":
                continue
            if search_q and search_q not in j["name"].lower():
                continue
            filtered.append(j)

        self.tree_jobs.delete(*self.tree_jobs.get_children())
        selected_iid = None
        for j in filtered:
            iid = j["name"]
            cats = ", ".join(j["categories"]) if j["categories"] else "—"
            self.tree_jobs.insert(
                "",
                "end",
                iid=iid,
                values=(
                    j["name"],
                    self._status_text(j),
                    j["total_files"],
                    format_bytes(j["total_bytes"]),
                    cats,
                    j["latest_date_str"],
                ),
                tags=(j["status"],),
            )
            if iid == self.selected_job_name:
                selected_iid = iid

        if selected_iid:
            self.tree_jobs.selection_set(selected_iid)
            self._populate_files_for_job(selected_iid)
        elif filtered:
            first_iid = filtered[0]["name"]
            self.selected_job_name = first_iid
            self.tree_jobs.selection_set(first_iid)
            self._populate_files_for_job(first_iid)
        else:
            self.selected_job_name = None
            self.tree_files.delete(*self.tree_files.get_children())
            self.lbl_files_header.configure(text="Nenhum projeto listado nesta aba.")
            self._update_action_buttons(None)

    def _populate_history(self) -> None:
        st = load_state()
        self.tree_history.delete(*self.tree_history.get_children())
        for h in st.get("history", [])[:100]:
            self.tree_history.insert("", "end", values=(h.get("timestamp", ""), h.get("job", ""), h.get("message", "")))

    def _on_select_job(self, _event=None) -> None:
        sel = self.tree_jobs.selection()
        if not sel:
            return
        jname = sel[0]
        self.selected_job_name = jname
        self._populate_files_for_job(jname)

    def _get_job(self, job_name: str | None) -> dict | None:
        if not job_name:
            return None
        return next((j for j in self.engine.jobs_snapshot if j["name"] == job_name), None)

    def _populate_files_for_job(self, job_name: str) -> None:
        job = self._get_job(job_name)
        self.tree_files.delete(*self.tree_files.get_children())
        self._update_action_buttons(job)
        if not job:
            return

        self.lbl_files_header.configure(
            text=f"Arquivos em '{job_name} \\ 3 - OFICINA' ({job['total_files']} arquivo(s))"
        )
        for f in job.get("files", []):
            if f["exists_local"]:
                st_lbl = "✓ Já está em ARQUIVOS 2026"
                tag = "local_ok"
            elif f["is_new"]:
                st_lbl = "★ Novo p/ copiar"
                tag = "new_file"
            else:
                st_lbl = "Já atendido anteriormente"
                tag = "seen_file"

            cloud_lbl = "☁ Nuvem OneDrive" if f["is_cloud"] else "No disco"
            self.tree_files.insert(
                "",
                "end",
                values=(f["rel_path"], format_bytes(f["size"]), cloud_lbl, st_lbl),
                tags=(tag,),
            )

    def _update_action_buttons(self, job: dict | None) -> None:
        if not job:
            self.btn_copy_selected.configure(state="disabled", text="⬇ Copiar Selecionado p/ 2026")
            self.btn_open_2026.configure(state="disabled")
            self.btn_open_src.configure(state="disabled")
            self.btn_toggle_ignore.configure(state="disabled")
            return

        self.btn_open_src.configure(state="normal")
        self.btn_open_2026.configure(state="normal" if job["dest_exists"] else "disabled")

        st = job["status"]
        if st == "novo":
            self.btn_copy_selected.configure(state="normal", text=f"⬇ Copiar p/ 2026 ({job['new_files_count']} arq)")
        elif st == "atualizacao":
            self.btn_copy_selected.configure(state="normal", text=f"⬇ Copiar +{job['new_files_count']} Novo(s)")
        elif st in ("sincronizado", "ignorado") and job["missing_local_count"] > 0:
            self.btn_copy_selected.configure(
                state="normal", text=f"⬇ Copiar Faltantes ({job['missing_local_count']})"
            )
        else:
            self.btn_copy_selected.configure(state="disabled", text="✓ Já Copiado")

        if st == "ignorado":
            self.btn_toggle_ignore.configure(state="normal", text="↺ Reativar p/ Pendentes")
        elif st in ("novo", "atualizacao") and not job["dest_exists"]:
            self.btn_toggle_ignore.configure(state="normal", text="✓ Marcar Já Feito")
        else:
            self.btn_toggle_ignore.configure(state="disabled", text="✓ Marcar Já Feito")

    # ---------------- Actions ----------------
    def _switch_tab(self, tab_key: str) -> None:
        self.active_tab = tab_key
        for k, b in self.tab_buttons.items():
            if k == tab_key:
                b.configure(bg=BG_ELEV, fg=AMBER)
            else:
                b.configure(bg=BG_CARD, fg=FG_MUTED)
        self._refresh_views(force=True)

    def _on_scan_now(self) -> None:
        threading.Thread(target=self.engine.scan_once, daemon=True).start()

    def _on_toggle_auto_copy(self) -> None:
        enabled = self.var_auto_copy.get()
        pendentes = [j for j in self.engine.jobs_snapshot if j["status"] in ("novo", "atualizacao")]
        if enabled and pendentes:
            ans = messagebox.askyesno(
                "Ativar Cópia Automática",
                f"Existem {len(pendentes)} projeto(s) na aba 'Novos / Pendentes' agora.\n\n"
                f"Se ativar agora, esses {len(pendentes)} projetos serão copiados automaticamente para ARQUIVOS 2026.\n\n"
                f"DICA: Se eles forem serviços antigos já cortados, clique em 'Não', use o botão "
                f"'Marcar Pendentes Atuais como Já Feitos' e depois ative a Cópia Automática!\n\n"
                f"Deseja ativar e copiar esses {len(pendentes)} pendentes agora?",
                parent=self.root,
            )
            if not ans:
                self.var_auto_copy.set(False)
                return

        cfg = load_config()
        cfg["auto_copy_new"] = enabled
        save_config(cfg)
        if enabled:
            threading.Thread(target=self.engine.scan_once, kwargs={"allow_auto_copy": True}, daemon=True).start()

    def _on_copy_selected(self) -> None:
        job = self._get_job(self.selected_job_name)
        if not job or job["total_files"] == 0:
            return
        force_missing = job["status"] in ("sincronizado", "ignorado")
        jname = job["name"]

        def _work():
            res = self.engine.copy_job(jname, force_missing=force_missing, triggered_by="manual")
            if res.get("ok"):
                self.ui_queue.put(
                    ("msg", ("Cópia Concluída!", f"{jname}: {res.get('copied', 0)} arquivo(s) copiado(s).", False))
                )
            else:
                err_txt = res.get("error") or "\n".join(res.get("errors", [])[:5])
                self.ui_queue.put(("msg", ("Aviso na cópia", err_txt, True)))

        threading.Thread(target=_work, daemon=True).start()

    def _on_copy_all_pending(self) -> None:
        pending = [j["name"] for j in self.engine.jobs_snapshot if j["status"] in ("novo", "atualizacao")]
        if not pending:
            messagebox.showinfo("Tudo em dia", "Não há projetos pendentes para copiar.", parent=self.root)
            return

        def _work():
            total_copied = 0
            for jname in pending:
                res = self.engine.copy_job(jname, force_missing=False, triggered_by="manual")
                total_copied += res.get("copied", 0)
            self.ui_queue.put(
                ("msg", ("Lote Concluído!", f"{len(pending)} projeto(s) processado(s) ({total_copied} arquivos).", False))
            )

        threading.Thread(target=_work, daemon=True).start()

    def _on_ignore_all_pending(self) -> None:
        pending = [j for j in self.engine.jobs_snapshot if j["status"] in ("novo", "atualizacao") and not j["dest_exists"]]
        if not pending:
            return
        ok = messagebox.askyesno(
            "Marcar Pendentes como Já Feitos",
            f"Deseja marcar os {len(pending)} projeto(s) pendentes atuais como 'Já Feitos'?\n\n"
            f"• Eles NÃO serão copiados agora.\n"
            f"• Se alguém jogar arquivos NOVOS dentro de '3 - OFICINA' deles no futuro, o assistente continuará te avisando!",
            parent=self.root,
        )
        if not ok:
            return
        self.engine.mark_all_current_pending_as_ignored()
        self._refresh_views(force=True)

    def _on_toggle_ignore_selected(self) -> None:
        job = self._get_job(self.selected_job_name)
        if not job:
            return
        target_ignore = job["status"] != "ignorado"
        self.engine.set_job_ignored(job["name"], target_ignore)
        self._refresh_views(force=True)

    def _open_folder(self, path_str: str) -> None:
        res = self.engine.open_in_explorer(path_str)
        if not res.get("ok"):
            messagebox.showwarning("Pasta não encontrada", res.get("error", ""), parent=self.root)

    def _on_open_selected_dest(self) -> None:
        job = self._get_job(self.selected_job_name)
        if job:
            self._open_folder(job["dest_path"])

    def _on_open_selected_src(self) -> None:
        job = self._get_job(self.selected_job_name)
        if job:
            self._open_folder(job["oficina_path"] or job["source_path"])

    def _on_test_robo(self) -> None:
        """Testa o Robô Notificador abrindo a pasta real do job ativo ao clicar no balão."""
        job = self._get_job(self.selected_job_name) if self.selected_job_name else None
        if not job and self.engine.jobs_snapshot:
            job = self.engine.jobs_snapshot[0]

        target_folder = None
        job_name = None
        if job:
            job_name = job.get("name")
            target_folder = job.get("oficina_path") or job.get("dest_path") or job.get("source_path")
        if not target_folder:
            cfg = load_config()
            target_folder = cfg.get("source_dir") or cfg.get("dest_dir")

        self._show_toast_popup(
            title="Novo serviço liberado na Oficina!",
            message=f"{job_name or '2640 - EXPRESSO HOGWARTS'}\nArquivos em 3 - OFICINA prontos para copiar.",
            folder_path=target_folder,
            job_name=job_name,
        )

    # ---------------- Corner Toast Notification & Mini Mode ----------------
    def _show_toast_popup(
        self,
        title: str,
        message: str,
        play_sound: bool = True,
        folder_path: str | None = None,
        job_name: str | None = None,
    ) -> None:
        cfg = load_config()
        if not cfg.get("notify_popup", True):
            return

        def _handle_click():
            logging.info(f"Clique no balão de notificação: folder_path={folder_path}, job_name={job_name}")
            target_to_open = None

            # 1. Testa folder_path recebido
            if folder_path:
                try:
                    p = Path(folder_path)
                    if p.exists():
                        target_to_open = p if p.is_dir() else p.parent
                    elif p.parent.exists():
                        target_to_open = p.parent
                except Exception as e:
                    logging.warning(f"Erro ao testar folder_path '{folder_path}': {e}")

            # 2. Se ainda não achou, busca caminhos do job selecionado ou informado
            if not target_to_open and job_name:
                job = self._get_job(job_name)
                if job:
                    for k in ("dest_path", "oficina_path", "source_path"):
                        val = job.get(k)
                        if val:
                            try:
                                jp = Path(val)
                                if jp.exists():
                                    target_to_open = jp if jp.is_dir() else jp.parent
                                    break
                            except Exception:
                                pass

            # 3. Fallback: tenta diretório de destino padrão ou origem configurado
            if not target_to_open:
                try:
                    cfg_local = load_config()
                    for fallback_key in ("dest_dir", "source_dir"):
                        fdir = cfg_local.get(fallback_key)
                        if fdir:
                            fp = Path(fdir)
                            if fp.exists():
                                target_to_open = fp
                                break
                except Exception as e:
                    logging.warning(f"Erro ao buscar fallback de pasta: {e}")

            # 4. Abre a pasta encontrada no Windows Explorer
            if target_to_open:
                target_str = str(target_to_open)
                try:
                    os.startfile(target_str)
                    logging.info(f"Pasta aberta com sucesso no Explorer (os.startfile): {target_str}")
                except Exception as e:
                    logging.warning(f"os.startfile falhou para '{target_str}' ({e}), tentando subprocess...")
                    try:
                        subprocess.Popen(["explorer.exe", target_str])
                        logging.info(f"Pasta aberta com sucesso via explorer.exe: {target_str}")
                    except Exception as e2:
                        logging.error(f"Falha total ao abrir pasta no Explorer '{target_str}': {e2}")
            else:
                logging.warning(f"Nenhum caminho válido encontrado para abrir: folder_path={folder_path}, job={job_name}")

            # 5. Seleciona o job na lista do painel e restaura a janela
            if job_name:
                self.selected_job_name = job_name
            self._restore_from_mini_or_minimized()

        # Notificador animado: Robô Transformer da Router CNC (estilo Mordomo Bob)
        try:
            self.robo.show(
                title=title,
                message=message,
                on_click=_handle_click,
                play_sound=play_sound,
                action_label="📁 Clique no balão para abrir a pasta",
            )
            return
        except Exception:
            logging.exception("Falha ao invocar robo notificador; usando fallback simples")

        if play_sound and cfg.get("sound_alert", True):
            try:
                winsound.MessageBeep(winsound.MB_ICONASTERISK)
            except Exception:
                pass

        toast = tk.Toplevel(self.root)
        toast.overrideredirect(True)
        toast.attributes("-topmost", True)
        toast.configure(bg=AMBER)

        inner = tk.Frame(toast, bg=BG_CARD, padx=14, pady=10)
        inner.pack(fill="both", expand=True, padx=2, pady=2)

        lbl_t = tk.Label(inner, text=title, bg=BG_CARD, fg=AMBER, font=("Segoe UI Bold", 10), anchor="w")
        lbl_t.pack(fill="x")
        lbl_m = tk.Label(
            inner, text=message, bg=BG_CARD, fg=FG_MAIN, font=("Segoe UI", 9), wraplength=320, justify="left", anchor="w"
        )
        lbl_m.pack(fill="x", pady=(3, 0))
        lbl_action = tk.Label(
            inner, text="📁 Clique para abrir a pasta do arquivo", bg=BG_CARD, fg=SKY, font=("Segoe UI Semibold", 8), anchor="w"
        )
        lbl_action.pack(fill="x", pady=(4, 0))

        toast.update_idletasks()
        w = max(340, toast.winfo_reqwidth())
        h = max(80, toast.winfo_reqheight())
        sw = toast.winfo_screenwidth()
        sh = toast.winfo_screenheight()
        toast.geometry(f"{w}x{h}+{sw - w - 22}+{sh - h - 58}")

        def _click_toast(_e=None):
            toast.destroy()
            _handle_click()

        for widget in (toast, inner, lbl_t, lbl_m, lbl_action):
            widget.config(cursor="hand2")
            widget.bind("<Button-1>", _click_toast)

        toast.after(6500, lambda: toast.destroy() if toast.winfo_exists() else None)

    def _enter_mini_mode(self) -> None:
        if self.mini_widget and self.mini_widget.winfo_exists():
            return
        # Minimize (keeps the icon in the taskbar) instead of hiding completely
        self.root.iconify()

        mw = tk.Toplevel(self.root)
        mw.overrideredirect(True)
        mw.attributes("-topmost", True)
        mw.configure(bg="#334155")

        inner = tk.Frame(mw, bg=BG_CARD, padx=12, pady=7, cursor="hand2")
        inner.pack(fill="both", expand=True, padx=1, pady=1)

        self.lbl_mini = tk.Label(
            inner,
            text="● Oficina: Monitorando...",
            bg=BG_CARD,
            fg=EMERALD,
            font=("Segoe UI Semibold", 9),
            cursor="hand2",
        )
        self.lbl_mini.pack(side="left")

        btn_expand = tk.Button(
            inner,
            text="Abrir",
            command=self._restore_from_mini_or_minimized,
            bg=BG_ELEV,
            fg=FG_MAIN,
            relief="flat",
            bd=0,
            padx=8,
            pady=2,
            cursor="hand2",
            font=("Segoe UI", 8),
        )
        btn_expand.pack(side="right", padx=(10, 0))

        # Allow dragging mini widget
        def _start_drag(e):
            mw._drag_x = e.x
            mw._drag_y = e.y

        def _do_drag(e):
            x = mw.winfo_x() + e.x - getattr(mw, "_drag_x", 0)
            y = mw.winfo_y() + e.y - getattr(mw, "_drag_y", 0)
            mw.geometry(f"+{x}+{y}")

        for wdg in (inner, self.lbl_mini):
            wdg.bind("<ButtonPress-1>", _start_drag)
            wdg.bind("<B1-Motion>", _do_drag)
            wdg.bind("<Double-Button-1>", lambda e: self._restore_from_mini_or_minimized())

        mw.update_idletasks()
        sw = mw.winfo_screenwidth()
        mw.geometry(f"+{sw - 290}+24")
        self.mini_widget = mw
        self._update_mini_widget()

    def _update_mini_widget(self) -> None:
        if not self.mini_widget or not self.mini_widget.winfo_exists():
            return
        pendentes = sum(1 for j in self.engine.jobs_snapshot if j["status"] in ("novo", "atualizacao"))
        if pendentes > 0:
            self.lbl_mini.configure(text=f"★ {pendentes} SERVIÇO(S) NOVO(S)!", fg=AMBER)
            self.mini_widget.configure(bg=AMBER)
        else:
            self.lbl_mini.configure(text="● Oficina em dia (0 novos)", fg=EMERALD)
            self.mini_widget.configure(bg="#334155")

    def _on_root_mapped(self, event=None) -> None:
        if event is not None and event.widget is not self.root:
            return
        if self.root.state() == "normal" and self.mini_widget and self.mini_widget.winfo_exists():
            self.mini_widget.destroy()
            self.mini_widget = None

    def _restore_from_mini_or_minimized(self) -> None:
        if self.mini_widget and self.mini_widget.winfo_exists():
            self.mini_widget.destroy()
            self.mini_widget = None
        self.root.deiconify()
        self.root.state("normal")
        self.root.lift()
        self.root.attributes("-topmost", True)
        self.root.after(400, lambda: self.root.attributes("-topmost", False))
        self.root.focus_force()

    # ---------------- Settings & Close ----------------
    def _open_settings_dialog(self) -> None:
        cfg = load_config()
        dlg = tk.Toplevel(self.root)
        dlg.title("Configurações do Assistente")
        dlg.geometry("580x410")
        dlg.configure(bg=BG_CARD)
        dlg.transient(self.root)
        dlg.grab_set()

        body = tk.Frame(dlg, bg=BG_CARD, padx=20, pady=16)
        body.pack(fill="both", expand=True)

        tk.Label(body, text="Pasta de Origem (OneDrive - Jobs Ativos):", bg=BG_CARD, fg=FG_MUTED).pack(anchor="w")
        v_src = tk.StringVar(value=cfg.get("source_dir", ""))
        tk.Entry(body, textvariable=v_src, bg=BG_MAIN, fg=FG_MAIN, insertbackground=FG_MAIN, relief="flat").pack(
            fill="x", ipady=5, pady=(3, 10)
        )

        tk.Label(body, text="Pasta de Destino (ARQUIVOS 2026):", bg=BG_CARD, fg=FG_MUTED).pack(anchor="w")
        v_dst = tk.StringVar(value=cfg.get("dest_dir", ""))
        tk.Entry(body, textvariable=v_dst, bg=BG_MAIN, fg=FG_MAIN, insertbackground=FG_MAIN, relief="flat").pack(
            fill="x", ipady=5, pady=(3, 10)
        )

        row = tk.Frame(body, bg=BG_CARD)
        row.pack(fill="x", pady=(2, 8))
        tk.Label(row, text="Intervalo de verificação (seg):", bg=BG_CARD, fg=FG_MUTED).pack(side="left")
        v_int = tk.StringVar(value=str(cfg.get("scan_interval_seconds", 25)))
        tk.Entry(row, textvariable=v_int, width=8, bg=BG_MAIN, fg=FG_MAIN, insertbackground=FG_MAIN, relief="flat").pack(
            side="left", padx=8, ipady=4
        )

        v_pop = tk.BooleanVar(value=bool(cfg.get("notify_popup", True)))
        tk.Checkbutton(
            body,
            text="Mostrar alerta visual (Robô Router) quando surgir serviço novo",
            variable=v_pop,
            bg=BG_CARD,
            fg=FG_MAIN,
            selectcolor=BG_MAIN,
            activebackground=BG_CARD,
        ).pack(anchor="w", pady=(0, 4))

        v_gcode = tk.BooleanVar(value=bool(cfg.get("patch_gcode_macros", True)))
        tk.Checkbutton(
            body,
            text="Ajustar arquivos de Código G (.txt/.tap/etc) injetando M101 e M102 (Mach3 Tracker)",
            variable=v_gcode,
            bg=BG_CARD,
            fg=AMBER,
            selectcolor=BG_MAIN,
            activebackground=BG_CARD,
            font=("Segoe UI Semibold", 9),
        ).pack(anchor="w", pady=(0, 4))

        row_spindle = tk.Frame(body, bg=BG_CARD)
        row_spindle.pack(fill="x", pady=(2, 4))
        tk.Label(row_spindle, text="Velocidade padrão do Spindle (ex: 18000):", bg=BG_CARD, fg=FG_MUTED).pack(side="left")
        v_speed = tk.StringVar(value=str(cfg.get("target_spindle_speed", "18000")))
        tk.Entry(row_spindle, textvariable=v_speed, width=10, bg=BG_MAIN, fg=FG_MAIN, insertbackground=FG_MAIN, relief="flat").pack(
            side="left", padx=8, ipady=4
        )

        foot = tk.Frame(dlg, bg=BG_CARD, padx=20, pady=12)
        foot.pack(fill="x")

        def _save():
            try:
                iv = max(10, int(v_int.get().strip()))
            except ValueError:
                iv = 25
            cfg["source_dir"] = v_src.get().strip()
            cfg["dest_dir"] = v_dst.get().strip()
            cfg["scan_interval_seconds"] = iv
            cfg["notify_popup"] = v_pop.get()
            cfg["patch_gcode_macros"] = v_gcode.get()
            cfg["target_spindle_speed"] = v_speed.get().strip() or "18000"
            save_config(cfg)
            self.btn_src_path.configure(text=f"ORIGEM: {cfg['source_dir']}")
            self.btn_dst_path.configure(text=f"DESTINO: {cfg['dest_dir']}")
            dlg.destroy()
            self._on_scan_now()

        self._make_btn(foot, "Salvar", _save, bg=AMBER, fg="#0b0f17", hover_bg=AMBER_HOVER).pack(side="right")
        self._make_btn(foot, "Cancelar", dlg.destroy).pack(side="right", padx=(0, 8))

    def _on_close_button(self) -> None:
        ans = messagebox.askyesnocancel(
            "Manter monitorando em segundo plano?",
            "Deseja mudar para a Mini-Barra Flutuante e continuar monitorando novos serviços?\n\n"
            "• SIM: Vai para o Modo Mini-Barra (continua vigiando o OneDrive).\n"
            "• NÃO: Encerra o assistente completamente.\n"
            "• CANCELAR: Volta ao painel.",
            parent=self.root,
        )
        if ans is True:
            self._enter_mini_mode()
        elif ans is False:
            self.engine.stop()
            self.root.destroy()


def _find_visible_panel_window() -> int:
    """Looks for the panel window on the CURRENT user desktop (returns hwnd or 0)."""
    try:
        import ctypes

        return ctypes.windll.user32.FindWindowW(None, WINDOW_TITLE) or 0
    except Exception:
        return 0


def _bring_window_to_front(hwnd: int) -> None:
    try:
        import ctypes

        user32 = ctypes.windll.user32
        user32.ShowWindow(hwnd, 9)  # SW_RESTORE
        user32.SetForegroundWindow(hwnd)
    except Exception:
        pass


def main() -> None:
    lock = FileLock(str(LOCK_FILE), timeout=0.2)
    try:
        lock.acquire()
    except Timeout:
        # Already running: ask the open instance to bring the panel to the front
        try:
            SHOW_SIGNAL.write_text("show", encoding="utf-8")
        except OSError:
            pass
        time.sleep(1.5)
        hwnd = _find_visible_panel_window()
        if hwnd:
            _bring_window_to_front(hwnd)
            return

        # The other instance is running somewhere the user cannot see it
        # (e.g. a hidden desktop). Close it and open a fresh panel here.
        logging.warning("Instância anterior invisível para o usuário; reiniciando o painel.")
        try:
            old_pid = int(PID_FILE.read_text(encoding="utf-8").strip())
            if old_pid != os.getpid():
                os.kill(old_pid, 9)
        except Exception:
            logging.exception("Não foi possível encerrar a instância anterior")
        try:
            lock.acquire(timeout=5)
        except Timeout:
            logging.error("Não foi possível obter o bloqueio de instância.")
            return

    try:
        PID_FILE.write_text(str(os.getpid()), encoding="utf-8")
        SHOW_SIGNAL.unlink(missing_ok=True)
    except OSError:
        pass
    logging.info("Painel iniciado (PID %s).", os.getpid())

    try:
        root = tk.Tk()

        def _report_tk_error(exc_type, exc_value, exc_tb):
            logging.error("Erro na interface:\n%s", "".join(traceback.format_exception(exc_type, exc_value, exc_tb)))

        root.report_callback_exception = _report_tk_error
        app = FolderAssistantApp(root)

        def _heartbeat():
            try:
                logging.info(
                    "janela: state=%s visivel=%s geo=%s mini=%s jobs=%d",
                    root.state(),
                    root.winfo_viewable(),
                    root.geometry(),
                    bool(app.mini_widget and app.mini_widget.winfo_exists()),
                    len(app.engine.jobs_snapshot),
                )
            except Exception:
                logging.exception("heartbeat")
            root.after(30000, _heartbeat)

        root.after(3000, _heartbeat)
        root.mainloop()
        logging.info("Painel encerrado normalmente.")
    except Exception:
        logging.exception("Falha fatal no painel")
    finally:
        lock.release()


if __name__ == "__main__":
    main()
