def ensure_default_desktop():
    try:
        import ctypes
        user32 = ctypes.windll.user32
        hdesk = user32.OpenDesktopW("Default", 0, False, 0x01FF)
        if hdesk:
            user32.SetThreadDesktop(hdesk)
    except Exception:
        pass

ensure_default_desktop()

"""
Robô Router — notificador animado estilo "Mordomo Bob" (IncrediMail).

Uma Router CNC sobe pelo canto da tela, liga o spindle (faíscas),
transforma-se num robô e mostra a mensagem num balão.
Feito 100% em tkinter (sem vídeos, sem web, sem bibliotecas externas).
"""

import logging
import math
import random
import threading
import time
import tkinter as tk

try:
    import winsound
except ImportError:  # pragma: no cover
    winsound = None

TRANSPARENT = "#ff00fe"  # cor-chave que fica invisível na janela
W, H = 470, 320
DX = 70                   # deslocamento horizontal do robô dentro da janela
SLIDE_DIST = 230

# Durações (segundos)
T_IN = 0.45
T_SPIN = 0.75
T_TRANS = 1.35
T_WAKE = 0.45
T_OUT = 0.75
T_SLIDE_OUT = 0.35
CPS = 45.0                # caracteres por segundo no efeito "digitando"
HOLD = 14.0               # tempo que o balão fica após terminar de digitar (14s para dar tempo de ver com calma)

OUTLINE = "#0b0f17"
AMBER = "#f59e0b"
CYAN = "#38e8ff"


# ---------------------------------------------------------------- helpers
def clamp(v, a=0.0, b=1.0):
    return a if v < a else b if v > b else v


def lerp(a, b, t):
    return a + (b - a) * t


def ease_io(t):
    t = clamp(t)
    return 4 * t * t * t if t < 0.5 else 1 - pow(-2 * t + 2, 3) / 2


def ease_out_cubic(t):
    t = clamp(t)
    return 1 - pow(1 - t, 3)


def ease_in_cubic(t):
    t = clamp(t)
    return t * t * t


def ease_out_back(t):
    t = clamp(t)
    c1 = 1.70158
    c3 = c1 + 1
    return 1 + c3 * pow(t - 1, 3) + c1 * pow(t - 1, 2)


def mix_color(c1, c2, t):
    t = clamp(t)
    a = [int(c1[i:i + 2], 16) for i in (1, 3, 5)]
    b = [int(c2[i:i + 2], 16) for i in (1, 3, 5)]
    return "#%02x%02x%02x" % tuple(int(lerp(a[i], b[i], t)) for i in range(3))


def rect_c(w, h, ox=0.0, oy=0.0):
    return [(ox - w / 2, oy - h / 2), (ox + w / 2, oy - h / 2), (ox + w / 2, oy + h / 2), (ox - w / 2, oy + h / 2)]


def rect_l(w, h):
    return [(0, -h / 2), (w, -h / 2), (w, h / 2), (0, h / 2)]


def circle_pts(r, ox=0.0, oy=0.0, n=14):
    return [(ox + r * math.cos(2 * math.pi * i / n), oy + r * math.sin(2 * math.pi * i / n)) for i in range(n)]


def transform(pts, pose):
    x, y, ang, sx, sy = pose
    ca, sa = math.cos(math.radians(ang)), math.sin(math.radians(ang))
    out = []
    for px, py in pts:
        px *= sx
        py *= sy
        out.append((x + px * ca - py * sa, y + px * sa + py * ca))
    return out


def flat(pts):
    return [c for p in pts for c in p]


class Part:
    def __init__(self, name, pts, fill, pose_a, pose_b, window, subs=None, lines=None):
        self.name = name
        self.pts = pts
        self.fill = fill
        self.a = self._norm(pose_a)
        self.b = self._norm(pose_b)
        self.w0, self.w1 = window
        self.subs = subs or []    # [(pts, fill)]
        self.lines = lines or []  # [((x1,y1),(x2,y2), color)]

    @staticmethod
    def _norm(p):
        x, y, ang = p[0] + DX, p[1], p[2]
        sx = p[3] if len(p) > 3 else 1.0
        sy = p[4] if len(p) > 4 else 1.0
        return (x, y, ang, sx, sy)

    def local_t(self, trans):
        return clamp((trans - self.w0) / (self.w1 - self.w0))

    def pose(self, trans):
        lt = self.local_t(trans)
        e = ease_io(lt)
        x, y, ang, sx, sy = (lerp(self.a[i], self.b[i], e) for i in range(5))
        y -= 26 * math.sin(math.pi * lt)  # "pulo" mecânico enquanto encaixa
        return (x, y, ang, sx, sy), lt


def build_parts():
    slot = "#4b5563"
    return [
        # Mesa (duas metades) -> pernas
        Part("mesa_e", rect_c(90, 16), "#7b8794", (255, 274, 0), (284, 245, 90, 1, 1.05), (0.05, 0.55),
             lines=[((-42, -3), (42, -3), slot), ((-42, 3), (42, 3), slot)]),
        Part("mesa_d", rect_c(90, 16), "#7b8794", (345, 274, 0), (316, 245, 90, 1, 1.05), (0.05, 0.55),
             lines=[((-42, -3), (42, -3), slot), ((-42, 3), (42, 3), slot)]),
        # Pés da mesa -> pés
        Part("pe_e", rect_c(10, 18), "#374151", (218, 291, 0), (282, 296, 90, 1, 1.5), (0.0, 0.45)),
        Part("pe_d", rect_c(10, 18), "#374151", (382, 291, 0), (318, 296, 90, 1, 1.5), (0.0, 0.45)),
        # Placas do pórtico -> peito
        Part("placa_e", rect_c(14, 56), "#4b5563", (222, 233, 0), (284, 180, 0, 1.45, 1), (0.25, 0.75),
             subs=[(rect_c(6, 6, 0, -20), "#9ca3af"), (rect_c(6, 6, 0, 20), "#9ca3af")]),
        Part("placa_d", rect_c(14, 56), "#4b5563", (378, 233, 0), (316, 180, 0, 1.45, 1), (0.25, 0.75),
             subs=[(rect_c(6, 6, 0, -20), "#9ca3af"), (rect_c(6, 6, 0, 20), "#9ca3af")]),
        # Viga do pórtico (eixo X) -> ombros
        Part("viga", rect_c(170, 16), "#9aa4b1", (300, 200, 0), (300, 147, 0, 0.68, 1.15), (0.35, 0.85),
             lines=[((-80, -3), (80, -3), "#6b7280"), ((-80, 3), (80, 3), "#6b7280")]),
        # Motor de passo -> núcleo do peito
        Part("motor", rect_c(24, 24), "#1f2937", (365, 182, 0), (300, 180, 0, 1.15, 1.15), (0.42, 0.88)),
        # Guias lineares (com patins) -> braços (pivô no ombro)
        Part("guia_e", rect_l(80, 7), "#cbd5e1", (215, 262, 0), (250, 150, 100), (0.15, 0.70),
             subs=[([(62, -7), (80, -7), (80, 7), (62, 7)], AMBER)]),
        Part("guia_d", rect_l(80, 7), "#cbd5e1", (305, 262, 0), (350, 150, 80), (0.15, 0.70),
             subs=[([(62, -7), (80, -7), (80, 7), (62, 7)], AMBER)]),
        # Carro do eixo Z -> cabeça
        Part("carro_z", rect_c(34, 40), "#d1d5db", (300, 222, 0), (300, 116, 0, 1.1, 0.85), (0.50, 1.0),
             subs=[(rect_c(26, 9, 0, -5), "#0b1220"),
                   (rect_c(4, 4, -12, 13), "#6b7280"), (rect_c(4, 4, 12, 13), "#6b7280")]),
        # Spindle -> antena
        Part("spindle", rect_c(14, 30), "#94a3b8", (300, 256, 0), (300, 86, 0, 0.45, 0.75), (0.55, 1.0)),
    ]


# ---------------------------------------------------------------- notifier
class RoboNotificador:
    def __init__(self, master: tk.Misc, sound_enabled_fn=None):
        self.master = master
        self.sound_enabled_fn = sound_enabled_fn or (lambda: True)
        self.win = None
        self.canvas = None
        self.pending = []
        self.parts = build_parts()
        self.state = None

    # ---- API pública
    def show(self, title: str, message: str, on_click=None, play_sound: bool = True, action_label: str | None = None) -> None:
        self.action_label = action_label or "📁 Clique no balão para abrir a pasta"
        msg_flat = message.replace("\n", " • ")
        logging.info(f"RoboNotificador.show: {title} | {msg_flat}")
        if self.win is not None and self.win.winfo_exists():
            if self.state in ("out_trans", "out_slide"):
                self.pending.append((title, message, on_click, play_sound, self.action_label))
                return
            # Já está na tela: só troca a fala
            self.title, self.message, self.on_click = title, message, on_click
            self.text_t0 = time.perf_counter() + 0.1
            if play_sound:
                self._sound("chegada")
            return
        self._start(title, message, on_click, play_sound)

    def demo(self, on_click=None) -> None:
        self.show(
            "Novo serviço liberado na Oficina!",
            "2640 - TESTE ROBÔ ROUTER\n12 arquivo(s) em 3 - OFICINA prontos para copiar.",
            on_click=on_click,
            action_label="📁 Clique no balão para abrir a pasta",
        )

    # ---- ciclo de vida
    def _start(self, title, message, on_click, play_sound):
        self.title, self.message, self.on_click = title, message, on_click
        self.hover = False
        self.balloon_hover = False
        self.close_hover = False
        self.sparks = []
        self.snapped = set()
        self.text_t0 = None

        win = tk.Toplevel(self.master)
        win.overrideredirect(True)
        win.attributes("-topmost", True)
        try:
            win.attributes("-transparentcolor", TRANSPARENT)
        except tk.TclError:
            pass
        win.configure(bg=TRANSPARENT)
        sw, sh = win.winfo_screenwidth(), win.winfo_screenheight()
        win.geometry(f"{W}x{H}+{sw - W - 8}+{sh - H - 46}")
        ensure_default_desktop()
        win.lift()
        try:
            import ctypes
            user32 = ctypes.windll.user32
            hwnd = user32.GetParent(win.winfo_id()) or win.winfo_id()
            user32.SetWindowPos(hwnd, -1, 0, 0, 0, 0, 0x0001 | 0x0002 | 0x0040)
        except Exception:
            pass

        cv = tk.Canvas(win, width=W, height=H, bg=TRANSPARENT, highlightthickness=0, bd=0)
        cv.pack()
        cv.bind("<Button-1>", self._on_click)
        cv.bind("<Motion>", self._on_motion)
        cv.bind("<Enter>", lambda e: setattr(self, "hover", True))
        cv.bind("<Leave>", self._on_leave)

        self.win, self.canvas = win, cv
        self._goto("in")
        if play_sound:
            self._sound("chegada")
        self._tick()

    def _goto(self, state):
        self.state = state
        self.state_t0 = time.perf_counter()

    def _close(self):
        try:
            if self.win is not None:
                self.win.destroy()
        except tk.TclError:
            pass
        self.win = None
        self.state = None
        if self.pending:
            item = self.pending.pop(0)
            if len(item) == 5:
                t, m, c, s, a = item
            else:
                t, m, c, s = item
                a = None
            self.master.after(150, lambda: self.show(t, m, c, s, a))

    def _on_motion(self, event):
        if self.state != "talk":
            return
        # Bounding box do botão fechar X
        is_close = (244 <= event.x <= 272 and 10 <= event.y <= 36)
        # Bounding box do balão
        is_balloon = (8 <= event.x <= 280 and 10 <= event.y <= 160)

        self.close_hover = is_close
        self.balloon_hover = is_balloon and not is_close

        if is_balloon or is_close:
            try:
                self.canvas.config(cursor="hand2")
            except Exception:
                pass
        else:
            try:
                self.canvas.config(cursor="")
            except Exception:
                pass

    def _on_leave(self, event):
        self.hover = False
        self.balloon_hover = False
        self.close_hover = False
        if self.canvas:
            try:
                self.canvas.config(cursor="")
            except Exception:
                pass

    def _on_click(self, event):
        if self.state == "talk":
            # Clicou no X (fechar sem abrir pasta)
            if 244 <= event.x <= 276 and 8 <= event.y <= 38:
                if self.state not in ("out_trans", "out_slide"):
                    self._goto("out_trans")
                return

            # Clicou em cima do balão de notificação ou seus textos/botões -> abre a pasta do arquivo!
            if 4 <= event.x <= 295 and 6 <= event.y <= 165:
                if self.on_click:
                    try:
                        self.on_click()
                    except Exception as err:
                        import logging
                        logging.warning(f"Erro ao executar on_click do robô: {err}")

        if self.state not in ("out_trans", "out_slide"):
            self._goto("out_trans")

    # ---- som estilo "transformação"
    def _sound(self, kind):
        if winsound is None or not self.sound_enabled_fn():
            return
        seqs = {
            "chegada": [(392, 70), (523, 70), (659, 110)],
            "trans": [(180, 45), (240, 45), (200, 40), (320, 45), (260, 40), (420, 50), (640, 60), (880, 90)],
        }
        seq = seqs.get(kind, [])

        def _play():
            for f, d in seq:
                try:
                    winsound.Beep(f, d)
                except Exception:
                    return

        threading.Thread(target=_play, daemon=True).start()

    # ---- loop de animação
    def _tick(self):
        if self.win is None or not self.win.winfo_exists():
            return
        now = time.perf_counter()
        el = now - self.state_t0
        st = self.state
        slide, trans, wake, wave, spin = 0.0, 0.0, 0.0, 0.0, False

        if st == "in":
            p = clamp(el / T_IN)
            slide = (1 - ease_out_cubic(p)) * SLIDE_DIST
            if p >= 1:
                self._goto("spin")
        elif st == "spin":
            spin = True
            if el >= T_SPIN:
                self._goto("trans")
                self._sound("trans")
        elif st == "trans":
            trans = clamp(el / T_TRANS)
            if trans >= 1:
                self._goto("wake")
        elif st == "wake":
            trans, wake = 1.0, clamp(el / T_WAKE)
            if wake >= 1:
                self._goto("talk")
                self.text_t0 = now + 0.25
        elif st == "talk":
            trans, wake, wave = 1.0, 1.0, clamp(el / 0.35)
            end = self.text_t0 + len(self.message) / CPS + HOLD
            max_end = self.text_t0 + len(self.message) / CPS + 30.0
            if (now >= end and not self.hover) or (now >= max_end):
                self._goto("out_trans")
        elif st == "out_trans":
            wake = clamp(1 - el / 0.2)
            wave = clamp(1 - el / 0.25)
            trans = clamp(1 - el / T_OUT)
            if trans <= 0:
                self._goto("out_slide")
        elif st == "out_slide":
            p = clamp(el / T_SLIDE_OUT)
            slide = ease_in_cubic(p) * SLIDE_DIST
            if p >= 1:
                self._close()
                return

        try:
            self._draw(now, slide, trans, wake, wave, spin)
        except tk.TclError:
            return
        except Exception as exc:
            logging.exception(f"Erro em _draw do robo: {exc}")
            self._close()
            return
        self.win.after(16, self._tick)

    # ---- desenho
    def _draw(self, now, slide, trans, wake, wave, spin):
        cv = self.canvas
        cv.delete("all")
        shake = random.uniform(-1.4, 1.4) if spin else 0.0
        poses = {}

        for part in self.parts:
            pose, lt = part.pose(trans)
            x, y, ang, sx, sy = pose
            y += slide
            x += shake
            if part.name == "guia_d":
                ang += wave * (-120 + 18 * math.sin(now * 9))
            elif part.name == "guia_e":
                ang += wave * 4 * math.sin(now * 3)
            elif part.name in ("carro_z", "spindle") and self.state == "talk":
                y += 1.5 * math.sin(now * 4)
            pose = (x, y, ang, sx, sy)
            poses[part.name] = pose

            # faíscas quando a peça "encaixa"
            if self.state == "trans" and lt >= 1 and part.name not in self.snapped:
                self.snapped.add(part.name)
                self._burst(x, y, 7)

            cv.create_polygon(flat(transform(part.pts, pose)), fill=part.fill, outline=OUTLINE, width=2)
            for (p1, p2, col) in part.lines:
                cv.create_line(flat(transform([p1, p2], pose)), fill=col, width=1)
            for (pts, col) in part.subs:
                cv.create_polygon(flat(transform(pts, pose)), fill=col, outline=OUTLINE, width=1)

            if part.name == "motor":
                pulse = 0.5 + 0.5 * math.sin(now * 5)
                core = mix_color("#7c4a03", AMBER, wake * (0.55 + 0.45 * pulse)) if wake > 0 else "#4b5563"
                cv.create_polygon(flat(transform(circle_pts(7), pose)), fill=core, outline=OUTLINE, width=1)

            if part.name == "spindle":
                # listras girando no spindle
                if spin or trans < 0.05:
                    phase = (now * (90 if spin else 0)) % 10
                    for k in range(3):
                        ly = -12 + ((k * 10 + phase) % 26)
                        cv.create_line(flat(transform([(-6, ly), (6, ly)], pose)), fill="#e2e8f0", width=2)
                # fresa (só no modo router)
                if trans < 0.55:
                    bit = transform([(-3, 15), (3, 15), (0, 24)], pose)
                    cv.create_polygon(flat(bit), fill="#e2e8f0", outline=OUTLINE, width=1)
                    if spin:
                        bx, by = transform([(0, 24)], pose)[0]
                        for _ in range(3):
                            self.sparks.append(self._spark(bx, by, up=True))
                # luz da antena
                if wake > 0:
                    tip = transform([(0, -17)], pose)[0]
                    on = (int(now * 2.5) % 2 == 0)
                    col = mix_color("#3f1d1d", "#ef4444" if on else "#7f1d1d", wake)
                    cv.create_oval(tip[0] - 4, tip[1] - 4, tip[0] + 4, tip[1] + 4, fill=col, outline=OUTLINE)

        # olhos de "lente laser" na cabeça
        if wake > 0 and "carro_z" in poses:
            hp = poses["carro_z"]
            blink = (now % 3.2) < 0.12 and self.state == "talk"
            eye_col = mix_color("#0b1220", CYAN, wake)
            eh = 1.5 if blink else 5
            for ex in (-7, 7):
                cv.create_polygon(flat(transform(rect_c(8, eh, ex, -5), hp)), fill=eye_col, outline="")

        self._draw_sparks(cv)

        if self.state == "talk":
            self._draw_bubble(cv, now)

    def _spark(self, x, y, up=False):
        ang = random.uniform(math.pi * 1.1, math.pi * 1.9) if up else random.uniform(0, 2 * math.pi)
        spd = random.uniform(1.5, 4.5)
        return [x, y, math.cos(ang) * spd, math.sin(ang) * spd, random.randint(10, 22),
                random.choice([AMBER, "#fde68a", CYAN, "#ffffff"])]

    def _burst(self, x, y, n):
        for _ in range(n):
            self.sparks.append(self._spark(x, y))

    def _draw_sparks(self, cv):
        alive = []
        for s in self.sparks:
            s[0] += s[2]
            s[1] += s[3]
            s[3] += 0.25
            s[4] -= 1
            if s[4] > 0:
                cv.create_line(s[0], s[1], s[0] - s[2] * 1.8, s[1] - s[3] * 1.8, fill=s[5], width=2)
                alive.append(s)
        self.sparks = alive[-120:]

    def _draw_bubble(self, cv, now):
        el = time.perf_counter() - self.state_t0
        k = ease_out_back(el / 0.25)
        ax, ay = 300, 110  # âncora (ponta do balão, perto da cabeça)

        def sc(x, y):
            return (ax + (x - ax) * k, ay + (y - ay) * k)

        x1, y1, x2, y2, r = 10, 12, 270, 150, 14
        rr = [
            (x1 + r, y1), (x2 - r, y1), (x2, y1), (x2, y1 + r),
            (x2, 78), (ax + DX - 40, 104), (x2, 104),  # rabicho apontando para o robô
            (x2, y2 - r), (x2, y2), (x2 - r, y2), (x1 + r, y2), (x1, y2), (x1, y2 - r), (x1, y1 + r), (x1, y1),
        ]
        pts = [sc(x, y) for x, y in rr]
        border_col = CYAN if getattr(self, "balloon_hover", False) else AMBER
        cv.create_polygon(flat(pts), fill="#1e293b", outline=border_col, width=2, smooth=True)
        if k < 0.95:
            return

        cv.create_text(24, 24, anchor="nw", text="🤖 " + self.title, fill=AMBER,
                       font=("Segoe UI Bold", 10), width=232)
        shown = 0
        if self.text_t0 is not None:
            shown = int(max(0.0, now - self.text_t0) * CPS)
        cv.create_text(24, 50, anchor="nw", text=self.message[:shown], fill="#f1f5f9",
                       font=("Segoe UI", 9), width=236)
        
        # Rodapé de ação rápida: clicar no balão abre a pasta do arquivo
        action_str = getattr(self, "action_label", "📁 Clique no balão para abrir a pasta")
        is_hover = getattr(self, "balloon_hover", False)
        footer_col = CYAN if is_hover else "#94a3b8"
        footer_font = ("Segoe UI Bold" if is_hover else "Segoe UI", 8)
        cv.create_text(24, 136, anchor="sw", text=action_str, fill=footer_col, font=footer_font)
        
        is_close_hover = getattr(self, "close_hover", False)
        close_col = "#ef4444" if is_close_hover else "#94a3b8"
        cv.create_text(258, 22, text="✕", fill=close_col, font=("Segoe UI", 9))


if __name__ == "__main__":
    # Teste isolado: python robo_notificador.py
    root = tk.Tk()
    root.withdraw()
    robo = RoboNotificador(root)
    robo.demo()
    root.after(16000, root.destroy)
    root.mainloop()
