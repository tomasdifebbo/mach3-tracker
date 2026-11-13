import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import os
import math

width, height = 1920, 1080
fps = 30
out_path = r"c:\DASHBOARD\Apresentacao_MACH3_Tracker.mp4"

# Cores Exatas do Sistema MACH3 Tracker (dashboard-v2)
BG_MAIN = (10, 14, 26)        # --color-bg-main: #0a0e1a
BG_SIDEBAR = (15, 21, 36)     # --color-bg-sidebar: #0f1524
BG_CARD = (15, 23, 42)        # --color-bg-card: rgba(15, 21, 36, 0.7)
BG_CARD_SOLID = (18, 26, 48)
BORDER_COLOR = (55, 75, 110)  # --color-border: rgba(65, 84, 126, 0.3)
BORDER_LIGHT = (40, 56, 84)

ACCENT_CYAN = (6, 182, 212)    # #06b6d4
ACCENT_GREEN = (16, 185, 129)  # #10b981
ACCENT_AMBER = (245, 158, 11)  # #f59e0b
ACCENT_BLUE = (59, 130, 246)   # #3b82f6
ACCENT_PURPLE = (168, 85, 247) # #a855f7
ACCENT_RED = (239, 68, 68)     # #ef4444
TEXT_WHITE = (255, 255, 255)
TEXT_LIGHT = (226, 232, 240)   # #e2e8f0
TEXT_MUTED = (148, 163, 184)   # #94a3b8

# Fontes Windows Segoe UI
font_huge = ImageFont.truetype(r"C:\Windows\Fonts\segoeuib.ttf", 52)
font_title = ImageFont.truetype(r"C:\Windows\Fonts\segoeuib.ttf", 36)
font_section = ImageFont.truetype(r"C:\Windows\Fonts\segoeuib.ttf", 26)
font_body = ImageFont.truetype(r"C:\Windows\Fonts\segoeui.ttf", 21)
font_bold = ImageFont.truetype(r"C:\Windows\Fonts\segoeuib.ttf", 21)
font_small = ImageFont.truetype(r"C:\Windows\Fonts\segoeui.ttf", 17)
font_small_bold = ImageFont.truetype(r"C:\Windows\Fonts\segoeuib.ttf", 17)
font_code = ImageFont.truetype(r"C:\Windows\Fonts\consola.ttf", 19)
font_code_bold = ImageFont.truetype(r"C:\Windows\Fonts\consolab.ttf", 20)
font_subtitle = ImageFont.truetype(r"C:\Windows\Fonts\segoeuib.ttf", 24)

# ==================== COMPONENTES VISUAIS DO SISTEMA REAL ====================

def draw_real_system_shell(draw, active_section_id):
    # 1. Background Principal
    draw.rectangle([(0, 0), (width, height)], fill=BG_MAIN)
    
    # 2. Sidebar Lateral Esquerda (260px)
    sw = 260
    draw.rectangle([(0, 0), (sw, height - 90)], fill=BG_SIDEBAR)
    draw.line([(sw, 0), (sw, height - 90)], fill=BORDER_COLOR, width=2)
    
    # Topo da Sidebar: Logo do Sistema
    draw.ellipse([(24, 24), (54, 54)], fill=ACCENT_CYAN)
    draw.text((32, 28), "M", font=font_section, fill=(0, 0, 0))
    draw.text((68, 20), "MACH3", font=font_section, fill=ACCENT_CYAN)
    draw.text((68, 48), "TRACKER", font=font_small_bold, fill=TEXT_MUTED)
    draw.rounded_rectangle([(180, 24), (245, 46)], radius=6, fill=(6, 182, 212, 35), outline=ACCENT_CYAN)
    draw.text((190, 28), "v2.6", font=ImageFont.truetype(r"C:\Windows\Fonts\segoeuib.ttf", 13), fill=ACCENT_CYAN)
    
    draw.line([(16, 75), (sw - 16, 75)], fill=BORDER_LIGHT, width=1)
    
    # Itens de Navegacao da Sidebar Real
    nav_items = [
        ('dashboard', '📊 Dashboard'),
        ('operador', '👷 Operador'),
        ('jobs', '📁 Histórico'),
        ('charts', '📈 Gráficos'),
        ('materials', '📦 Materiais'),
        ('maintenance', '🛠️ Manutenção'),
        ('encarregado', '📋 Encarregado'),
        ('settings', '⚙️ Configurações')
    ]
    
    ny = 95
    for nid, label in nav_items:
        is_active = (nid == active_section_id)
        if is_active:
            draw.rounded_rectangle([(14, ny), (sw - 14, ny + 46)], radius=12, fill=(6, 182, 212, 45), outline=ACCENT_CYAN, width=1)
            draw.text((32, ny + 11), label, font=font_bold, fill=ACCENT_CYAN)
        else:
            draw.text((32, ny + 11), label, font=font_body, fill=TEXT_MUTED)
        ny += 54
        
    # Perfil do Operador na Base da Sidebar
    uy = height - 190
    draw.line([(16, uy - 15), (sw - 16, uy - 15)], fill=BORDER_LIGHT, width=1)
    draw.rounded_rectangle([(20, uy), (sw - 20, uy + 75)], radius=12, fill=(20, 28, 48), outline=BORDER_COLOR)
    draw.ellipse([(32, uy + 18), (70, uy + 56)], fill=(6, 182, 212, 40), outline=ACCENT_CYAN)
    draw.text((42, uy + 25), "TD", font=font_bold, fill=ACCENT_CYAN)
    draw.text((82, uy + 16), "Tomas Di Febbo", font=font_bold, fill=TEXT_WHITE)
    draw.text((82, uy + 42), "👑 Gerente Geral", font=font_small, fill=ACCENT_GREEN)

    # 3. Header Superior (sw ate width)
    hw = width - sw
    draw.rectangle([(sw, 0), (width, 80)], fill=(12, 17, 30))
    draw.line([(sw, 80), (width, 80)], fill=BORDER_COLOR, width=2)
    
    # Titulo da Secao Ativa
    titles = {
        'dashboard': 'Painel de Telemetria em Tempo Real',
        'operador': 'Terminal do Operador & Timesheet Diário',
        'encarregado': 'Painel do Encarregado & Quadro Kanban',
        'jobs': 'Histórico de Produção & Rastreabilidade',
        'charts': 'Gráficos de Produtividade & Métricas OEE (6 Meses)',
        'materials': 'Cadastro de Materiais & Calculadora de Insumos',
        'maintenance': 'Manutenção Preventiva & Horímetro de Máquinas',
        'settings': 'Configurações do Sistema & Automação de E-mails'
    }
    sec_title = titles.get(active_section_id, 'MACH3 Tracker')
    
    # Logo da Empresa no Header
    draw.rounded_rectangle([(sw + 24, 18), (sw + 220, 62)], radius=10, fill=(255, 255, 255, 10), outline=BORDER_COLOR)
    draw.text((sw + 36, 26), "🔩 CASA DO TREM", font=font_bold, fill=TEXT_WHITE)
    draw.text((sw + 240, 26), f"• {sec_title}", font=font_title, fill=ACCENT_CYAN)
    
    # Botoes do Header Direito
    # Botao Guia de Apresentacao
    draw.rounded_rectangle([(width - 480, 20), (width - 240, 60)], radius=20, fill=(6, 182, 212, 40), outline=ACCENT_CYAN, width=1)
    draw.text((width - 460, 27), "✨ Guia de Apresentação", font=font_bold, fill=ACCENT_CYAN)
    
    # Notificacao
    draw.rounded_rectangle([(width - 220, 20), (width - 170, 60)], radius=12, fill=(20, 28, 48), outline=BORDER_COLOR)
    draw.text((width - 200, 27), "🔔", font=font_bold, fill=TEXT_MUTED)
    draw.ellipse([(width - 182, 24), (width - 170, 36)], fill=ACCENT_RED)
    
    # Badge Online
    draw.rounded_rectangle([(width - 150, 20), (width - 30, 60)], radius=12, fill=(16, 185, 129, 30), outline=ACCENT_GREEN)
    draw.ellipse([(width - 138, 35), (width - 128, 45)], fill=ACCENT_GREEN)
    draw.text((width - 120, 28), "ONLINE", font=font_small_bold, fill=ACCENT_GREEN)

def draw_footer_narration(draw, text):
    draw.rectangle([(0, height - 90), (width, height)], fill=(8, 12, 22))
    draw.line([(0, height - 90), (width, height - 90)], fill=BORDER_COLOR, width=2)
    draw.rounded_rectangle([(40, height - 72), (160, height - 32)], radius=12, fill=(6, 182, 212, 40), outline=ACCENT_CYAN, width=1)
    draw.text((56, height - 64), "LOCUÇÃO", font=font_small_bold, fill=ACCENT_CYAN)
    draw.text((180, height - 65), text, font=font_subtitle, fill=TEXT_WHITE)

def draw_tour_modal(draw, step_idx, total_steps, badge, title, desc, tip):
    # Modal flutuante semi-transparente identico ao DemoTourModal.jsx
    mw = 1000
    mh = 380
    mx = 260 + (width - 260 - mw) // 2
    my = height - 90 - mh - 25
    
    # Sombra do modal
    draw.rounded_rectangle([(mx - 6, my - 6), (mx + mw + 6, my + mh + 6)], radius=26, fill=(0, 0, 0, 180))
    # Caixa principal com borda cyan brilhante
    draw.rounded_rectangle([(mx, my), (mx + mw, my + mh)], radius=24, fill=(13, 19, 36), outline=ACCENT_CYAN, width=2)
    
    # Topo do Modal: Badge da Etapa
    draw.rounded_rectangle([(mx + 30, my + 24), (mx + 30 + len(badge)*10 + 20, my + 54)], radius=10, fill=(6, 182, 212, 35), outline=ACCENT_CYAN)
    draw.text((mx + 42, my + 30), badge, font=font_small_bold, fill=ACCENT_CYAN)
    
    # Titulo
    draw.text((mx + 30, my + 72), title, font=font_title, fill=TEXT_WHITE)
    
    # Descricao (quebra em 2 ou 3 linhas)
    words = desc.split()
    lines = []
    curr = []
    for w in words:
        curr.append(w)
        if len(" ".join(curr)) > 75:
            lines.append(" ".join(curr))
            curr = []
    if curr:
        lines.append(" ".join(curr))
        
    dy = my + 130
    for l in lines[:3]:
        draw.text((mx + 30, dy), l, font=font_body, fill=TEXT_LIGHT)
        dy += 32
        
    # Box Dica para o Cliente
    draw.rounded_rectangle([(mx + 30, my + 240), (mx + mw - 30, my + 305)], radius=14, fill=(245, 158, 11, 20), outline=ACCENT_AMBER)
    draw.text((mx + 46, my + 258), tip, font=font_bold, fill=ACCENT_AMBER)
    
    # Rodape do Modal: Indicador de Passos e Botoes
    dots_text = " ".join(["●" if i == step_idx else "○" for i in range(total_steps)])
    draw.text((mx + 30, my + 328), dots_text, font=font_section, fill=ACCENT_CYAN)
    
    draw.rounded_rectangle([(mx + mw - 250, my + 320), (mx + mw - 140, my + 360)], radius=10, fill=(20, 28, 48), outline=BORDER_COLOR)
    draw.text((mx + mw - 225, my + 328), "◀ Anterior", font=font_small, fill=TEXT_MUTED)
    
    draw.rounded_rectangle([(mx + mw - 125, my + 320), (mx + mw - 30, my + 360)], radius=10, fill=ACCENT_CYAN)
    draw.text((mx + mw - 110, my + 328), "Próximo ▶", font=font_small_bold, fill=(0, 0, 0))

# ==================== TELAS REAIS DE CADA MÓDULO ====================

def render_screen_telemetria(draw):
    bx = 290
    by = 100
    bw = 1590
    
    # 3 Cards de Maquinas da Dashboard Real
    cw = 490
    ch = 440
    gap = 40
    
    # Card 1: Router Central (Usinando)
    draw.rounded_rectangle([(bx, by), (bx + cw, by + ch)], radius=20, fill=BG_CARD_SOLID, outline=ACCENT_GREEN, width=2)
    draw.ellipse([(bx + 20, by + 20), (bx + 34, by + 34)], fill=ACCENT_GREEN)
    draw.text((bx + 45, by + 16), "⚙️ Router Central", font=font_section, fill=TEXT_WHITE)
    draw.rounded_rectangle([(bx + cw - 120, by + 16), (bx + cw - 20, by + 46)], radius=10, fill=(16, 185, 129, 40), outline=ACCENT_GREEN)
    draw.text((bx + cw - 110, by + 22), "USINANDO", font=font_small_bold, fill=ACCENT_GREEN)
    
    draw.text((bx + 20, by + 75), "Arquivo: 16 pvc100mm b12mm.txt", font=font_code_bold, fill=ACCENT_CYAN)
    draw.text((bx + 20, by + 115), "Operador: Tomas Di Febbo", font=font_bold, fill=TEXT_WHITE)
    draw.text((bx + 20, by + 150), "Material: Isopor EPS 100mm", font=font_body, fill=ACCENT_AMBER)
    
    # Barra de Progresso Real
    draw.text((bx + 20, by + 200), "Progresso do Corte: 72%", font=font_bold, fill=TEXT_WHITE)
    draw.rounded_rectangle([(bx + 20, by + 235), (bx + cw - 20, by + 255)], radius=10, fill=(30, 41, 65))
    draw.rounded_rectangle([(bx + 20, by + 235), (bx + 20 + int((cw - 40)*0.72), by + 255)], radius=10, fill=ACCENT_GREEN)
    draw.text((bx + 20, by + 275), "Tempo: 18m 42s / Est: 25m", font=font_code, fill=TEXT_MUTED)
    draw.text((bx + 20, by + 315), "Spindle: 15.000 RPM | Feed: 16.000 mm/min", font=font_small_bold, fill=TEXT_MUTED)

    # Card 2: Router 2 (Disponivel)
    rx2 = bx + cw + gap
    draw.rounded_rectangle([(rx2, by), (rx2 + cw, by + ch)], radius=20, fill=BG_CARD_SOLID, outline=BORDER_COLOR, width=2)
    draw.ellipse([(rx2 + 20, by + 20), (rx2 + 34, by + 34)], fill=ACCENT_CYAN)
    draw.text((rx2 + 45, by + 16), "⚙️ Router 2", font=font_section, fill=TEXT_WHITE)
    draw.rounded_rectangle([(rx2 + cw - 130, by + 16), (rx2 + cw - 20, by + 46)], radius=10, fill=(6, 182, 212, 40), outline=ACCENT_CYAN)
    draw.text((rx2 + cw - 120, by + 22), "DISPONÍVEL", font=font_small_bold, fill=ACCENT_CYAN)
    draw.text((rx2 + 20, by + 75), "Último: 15 pvc100mm b12mm.txt", font=font_code_bold, fill=TEXT_WHITE)
    draw.text((rx2 + 20, by + 115), "Operador: Brenno Silva", font=font_bold, fill=TEXT_WHITE)
    draw.text((rx2 + 20, by + 150), "Concluído com sucesso às 19:16", font=font_body, fill=ACCENT_GREEN)
    draw.text((rx2 + 20, by + 200), "Duração Total: 29.8 min", font=font_bold, fill=TEXT_WHITE)

    # Card 3: Laser Ruida (Alerta de Ociosidade)
    rx3 = rx2 + cw + gap
    draw.rounded_rectangle([(rx3, by), (rx3 + cw, by + ch)], radius=20, fill=BG_CARD_SOLID, outline=ACCENT_AMBER, width=2)
    draw.ellipse([(rx3 + 20, by + 20), (rx3 + 34, by + 34)], fill=ACCENT_AMBER)
    draw.text((rx3 + 45, by + 16), "🔴 Laser Ruida CO2", font=font_section, fill=TEXT_WHITE)
    draw.rounded_rectangle([(rx3 + cw - 160, by + 16), (rx3 + cw - 20, by + 46)], radius=10, fill=(245, 158, 11, 40), outline=ACCENT_AMBER)
    draw.text((rx3 + cw - 150, by + 22), "PARADA (1h 15m)", font=font_small_bold, fill=ACCENT_AMBER)
    
    # Banner de alerta
    draw.rounded_rectangle([(rx3 + 20, by + 70), (rx3 + cw - 20, by + 160)], radius=12, fill=(239, 68, 68, 30), outline=ACCENT_RED)
    draw.text((rx3 + 35, by + 85), "⚠️ Alerta de Ociosidade Ativo", font=font_bold, fill=ACCENT_RED)
    draw.text((rx3 + 35, by + 115), "Máquina sem corte há mais de 1 hora.", font=font_small, fill=TEXT_WHITE)
    draw.text((rx3 + 20, by + 180), "Último Arquivo: logo_acrilico_3mm.txt", font=font_code, fill=TEXT_MUTED)

def render_screen_operador_equipe(draw):
    bx = 290
    by = 100
    
    # Barra de Status da Equipe Hoje
    draw.rounded_rectangle([(bx, by), (bx + 1550, by + 70)], radius=16, fill=BG_CARD_SOLID, outline=BORDER_COLOR)
    draw.text((bx + 24, by + 22), "👷 Painel da Equipe Hoje:", font=font_section, fill=TEXT_WHITE)
    
    status_pills = [
        ("🟢 Na Fábrica (1)", ACCENT_GREEN),
        ("🍱 Almoço (0)", TEXT_MUTED),
        ("🧹 Limpeza (0)", TEXT_MUTED),
        ("🟡 Serviço Externo (1)", ACCENT_AMBER),
        ("🔵 Outro Setor (1)", ACCENT_BLUE),
        ("⚫ Folga / Ausente (0)", TEXT_MUTED)
    ]
    px = bx + 360
    for pill, col in status_pills:
        draw.rounded_rectangle([(px, by + 16), (px + 180, by + 54)], radius=10, fill=(255, 255, 255, 10), outline=BORDER_LIGHT)
        draw.text((px + 14, by + 25), pill, font=font_small_bold, fill=col)
        px += 195
        
    # Cards dos 3 Operadores
    cw = 490
    ch = 360
    gap = 40
    y_card = by + 90
    
    # Tomas
    draw.rounded_rectangle([(bx, y_card), (bx + cw, y_card + ch)], radius=18, fill=BG_CARD_SOLID, outline=ACCENT_GREEN)
    draw.text((bx + 20, y_card + 20), "Tomas Di Febbo", font=font_section, fill=TEXT_WHITE)
    draw.text((bx + 20, y_card + 55), "🟢 Status: Usinando na Router Central", font=font_bold, fill=ACCENT_GREEN)
    draw.text((bx + 20, y_card + 100), "• 15 cortes executados hoje", font=font_body, fill=TEXT_MUTED)
    draw.text((bx + 20, y_card + 135), "• 6.4h de usinagem produtiva", font=font_body, fill=TEXT_MUTED)
    draw.text((bx + 20, y_card + 170), "• Bloqueio automático de sobreposição ativo", font=font_small, fill=ACCENT_CYAN)

    # Brenno
    ox2 = bx + cw + gap
    draw.rounded_rectangle([(ox2, y_card), (ox2 + cw, y_card + ch)], radius=18, fill=BG_CARD_SOLID, outline=ACCENT_BLUE)
    draw.text((ox2 + 20, y_card + 20), "Brenno Silva", font=font_section, fill=TEXT_WHITE)
    draw.text((ox2 + 20, y_card + 55), "🔵 Status: Outros Setores (Serralheria)", font=font_bold, fill=ACCENT_BLUE)
    draw.text((ox2 + 20, y_card + 100), "• Estrutura metálica do capacete", font=font_body, fill=TEXT_MUTED)
    draw.text((ox2 + 20, y_card + 135), "• 2.5h apontadas no setor de solda", font=font_body, fill=TEXT_MUTED)
    draw.text((ox2 + 20, y_card + 170), "• Bloqueado para início de usinagem", font=font_small, fill=ACCENT_AMBER)

    # Italo
    ox3 = ox2 + cw + gap
    draw.rounded_rectangle([(ox3, y_card), (ox3 + cw, y_card + ch)], radius=18, fill=BG_CARD_SOLID, outline=ACCENT_AMBER)
    draw.text((ox3 + 20, y_card + 20), "Ítalo Mendes", font=font_section, fill=TEXT_WHITE)
    draw.text((ox3 + 20, y_card + 55), "🟡 Status: Serviço Externo (Montagem)", font=font_bold, fill=ACCENT_AMBER)
    draw.text((ox3 + 20, y_card + 100), "• Montagem de Cenário no Cliente", font=font_body, fill=TEXT_MUTED)
    draw.text((ox3 + 20, y_card + 135), "• 3.9h de trabalho externo computadas", font=font_body, fill=TEXT_MUTED)
    draw.text((ox3 + 20, y_card + 170), "• Integrado no Relatório Semanal", font=font_small, fill=ACCENT_GREEN)

def render_screen_timesheet(draw):
    bx = 290
    by = 100
    draw.rounded_rectangle([(bx, by), (bx + 1550, by + 460)], radius=20, fill=BG_CARD_SOLID, outline=BORDER_COLOR)
    draw.text((bx + 30, by + 24), "⏱️ Linha do Tempo Diária (Cards Individuais por Trabalho)", font=font_section, fill=TEXT_WHITE)
    draw.text((bx + 30, by + 60), "Sem sobreposição de horários: cada troca de tarefa ou peça gera um novo card rastreável.", font=font_small, fill=TEXT_MUTED)
    
    times = [
        ("13:38 → 17:33", "Ítalo Mendes", "🟡 Serviço Externo (Montagem)", "235.8 min (3.9h)", ACCENT_AMBER),
        ("14:40 → 15:10", "Tomas Di Febbo", "⚙️ Router 2: 1 pvc100mm b12mm.txt", "30.2 min", ACCENT_GREEN),
        ("15:10 → 15:50", "Tomas Di Febbo", "⚙️ Router 2: 2 pvc100mm b12mm.txt", "41.4 min", ACCENT_GREEN),
        ("17:40 → 17:55", "Brenno Silva", "⚙️ Router 2: Setup e Encaixe", "14.1 min", ACCENT_CYAN),
        ("19:16 → 19:45", "Tomas Di Febbo", "⚙️ Router Central: 16 pvc100mm b12mm.txt", "29.0 min (Ativo)", ACCENT_GREEN)
    ]
    
    ty = by + 105
    for t_range, op, desc, dur, col in times:
        draw.rounded_rectangle([(bx + 30, ty), (bx + 1520, ty + 56)], radius=12, fill=(20, 28, 48), outline=BORDER_LIGHT)
        draw.text((bx + 50, ty + 16), t_range, font=font_code_bold, fill=ACCENT_CYAN)
        draw.text((bx + 260, ty + 16), op, font=font_bold, fill=TEXT_WHITE)
        draw.text((bx + 480, ty + 16), desc, font=font_body, fill=TEXT_LIGHT)
        draw.text((bx + 1320, ty + 16), dur, font=font_bold, fill=col)
        ty += 68

def render_screen_kanban(draw):
    bx = 290
    by = 100
    cols = [
        ("📋 A Fazer (4 O.S.)", ACCENT_CYAN, [
            ("O.S. 2662A - Capacete Senna (Peças 21 a 53)", "Router Central • Isopor EPS 100mm", "Prioridade Alta 🔴"),
            ("O.S. 2652C - Parede A Aqualume", "Router 2 • PVC Expandido 10mm", "Normal 🟡")
        ]),
        ("⚙️ Em Produção (2 O.S.)", ACCENT_GREEN, [
            ("16 pvc100mm b12mm.txt", "Router Central • Tomas • ETA 19:41", "Usinando 🟢"),
            ("Estruturas Metálicas Capacete", "Serralheria • Brenno • 2.5h", "Em Andamento 🔵")
        ]),
        ("✅ Concluído Hoje (15 O.S.)", ACCENT_PURPLE, [
            ("1 pvc100mm ao 15 pvc100mm", "Router Central & Router 2 • Tomas", "Finalizado 19:16 🏁"),
            ("Montagem de Cenário Cliente", "Serviço Externo • Ítalo (3.9h)", "Aprovado 🏁")
        ])
    ]
    
    cw = 490
    gap = 40
    for i, (col_title, col_color, cards) in enumerate(cols):
        cx = bx + i * (cw + gap)
        draw.rounded_rectangle([(cx, by), (cx + cw, by + 460)], radius=18, fill=BG_CARD_SOLID, outline=col_color, width=1)
        draw.text((cx + 20, by + 20), col_title, font=font_section, fill=col_color)
        
        cy = by + 70
        for card_title, sub1, badge in cards:
            draw.rounded_rectangle([(cx + 16, cy), (cx + cw - 16, cy + 120)], radius=14, fill=(24, 34, 58), outline=BORDER_COLOR)
            draw.text((cx + 30, cy + 16), card_title, font=font_bold, fill=TEXT_WHITE)
            draw.text((cx + 30, cy + 48), sub1, font=font_small, fill=TEXT_MUTED)
            draw.rounded_rectangle([(cx + 30, cy + 78), (cx + 200, cy + 106)], radius=8, fill=(255, 255, 255, 10))
            draw.text((cx + 42, cy + 82), badge, font=font_small_bold, fill=col_color)
            cy += 140

def render_screen_historico(draw):
    bx = 290
    by = 100
    draw.rounded_rectangle([(bx, by), (bx + 1550, by + 460)], radius=20, fill=BG_CARD_SOLID, outline=BORDER_COLOR)
    draw.text((bx + 30, by + 24), "📁 Histórico de Produção, Dimensões e Exportação PDF", font=font_section, fill=TEXT_WHITE)
    
    # Botao Exportar PDF 6 Paginas
    draw.rounded_rectangle([(bx + 1240, by + 18), (bx + 1520, by + 60)], radius=12, fill=ACCENT_RED)
    draw.text((bx + 1260, by + 26), "📄 Exportar PDF (6 Págs)", font=font_bold, fill=TEXT_WHITE)
    
    # Cabecalho da Tabela Real
    headers = [("Data/Hora", 140), ("Arquivo", 340), ("Máquina", 180), ("Operador", 160), ("Material", 220), ("Qtd", 80), ("Dimensões X/Y", 180), ("Custo", 120)]
    hx = bx + 30
    hy = by + 85
    draw.rounded_rectangle([(bx + 20, hy), (bx + 1530, hy + 38)], radius=8, fill=(24, 34, 58))
    for hname, hw in headers:
        draw.text((hx, hy + 8), hname, font=font_small_bold, fill=ACCENT_CYAN)
        hx += hw
        
    rows = [
        ("03/10 14:40", "1 pvc100mm b12mm.txt", "Router Central", "Tomas", "Isopor EPS 100mm", "1", "1822 x 858 mm", "R$ 38,50"),
        ("03/10 15:10", "2 pvc100mm b12mm.txt", "Router Central", "Tomas", "Isopor EPS 100mm", "1", "1820 x 856 mm", "R$ 42,00"),
        ("03/10 15:50", "3 pvc100mm b12mm.txt", "Router 2", "Tomas", "Isopor EPS 100mm", "1", "1815 x 850 mm", "R$ 36,00"),
        ("03/10 16:21", "4 pvc100mm b12mm.txt", "Router Central", "Tomas", "Isopor EPS 100mm", "1", "1810 x 845 mm", "R$ 28,00"),
        ("03/10 19:16", "16 pvc100mm b12mm.txt", "Router Central", "Tomas", "Isopor EPS 100mm", "1", "1821 x 850 mm", "R$ 39,20")
    ]
    ry = hy + 50
    for r in rows:
        rx = bx + 30
        for val, hw in zip(r, [140, 340, 180, 160, 220, 80, 180, 120]):
            draw.text((rx, ry), val, font=font_small, fill=TEXT_WHITE)
            rx += hw
        draw.line([(bx + 20, ry + 32), (bx + 1530, ry + 32)], fill=BORDER_LIGHT, width=1)
        ry += 42

def render_screen_graficos(draw):
    bx = 290
    by = 100
    # KPIs Topo
    draw.rounded_rectangle([(bx, by), (bx + 360, by + 100)], radius=16, fill=BG_CARD_SOLID, outline=ACCENT_CYAN)
    draw.text((bx + 20, by + 16), "DISPONIBILIDADE OEE", font=font_small_bold, fill=TEXT_MUTED)
    draw.text((bx + 20, by + 46), "91.4%", font=font_title, fill=ACCENT_CYAN)

    draw.rounded_rectangle([(bx + 390, by), (bx + 750, by + 100)], radius=16, fill=BG_CARD_SOLID, outline=ACCENT_GREEN)
    draw.text((bx + 410, by + 16), "DESEMPENHO OEE", font=font_small_bold, fill=TEXT_MUTED)
    draw.text((bx + 410, by + 46), "88.7%", font=font_title, fill=ACCENT_GREEN)

    draw.rounded_rectangle([(bx + 780, by), (bx + 1140, by + 100)], radius=16, fill=BG_CARD_SOLID, outline=ACCENT_AMBER)
    draw.text((bx + 800, by + 16), "QUALIDADE OEE", font=font_small_bold, fill=TEXT_MUTED)
    draw.text((bx + 800, by + 46), "99.2%", font=font_title, fill=ACCENT_AMBER)

    draw.rounded_rectangle([(bx + 1170, by), (bx + 1550, by + 100)], radius=16, fill=BG_CARD_SOLID, outline=ACCENT_PURPLE)
    draw.text((bx + 1190, by + 16), "HISTÓRICO CONSOLIDADO", font=font_small_bold, fill=TEXT_MUTED)
    draw.text((bx + 1190, by + 46), "Últimos 6 Meses", font=font_title, fill=ACCENT_PURPLE)

    # Grafico Semestral
    gy = by + 125
    draw.rounded_rectangle([(bx, gy), (bx + 1550, gy + 335)], radius=18, fill=BG_CARD_SOLID, outline=BORDER_COLOR)
    draw.text((bx + 30, gy + 20), "📈 Produtividade e Horas de Corte Semestrais (Últimos 6 Meses)", font=font_section, fill=TEXT_WHITE)
    
    # Barras simuladas dos 6 meses
    months = [("Maio", 140, 110), ("Junho", 165, 140), ("Julho", 190, 165), ("Agosto", 210, 185), ("Setembro", 240, 220), ("Outubro", 280, 260)]
    bar_x = bx + 120
    for m_name, hrs, h_px in months:
        # Barra de fundo
        draw.rounded_rectangle([(bar_x, gy + 270 - h_px), (bar_x + 90, gy + 270)], radius=8, fill=ACCENT_CYAN)
        draw.text((bar_x + 10, gy + 240 - h_px), f"{hrs}h", font=font_bold, fill=TEXT_WHITE)
        draw.text((bar_x + 15, gy + 285), m_name, font=font_bold, fill=TEXT_MUTED)
        bar_x += 230

def render_screen_materiais(draw):
    bx = 290
    by = 100
    draw.rounded_rectangle([(bx, by), (bx + 1550, by + 460)], radius=20, fill=BG_CARD_SOLID, outline=BORDER_COLOR)
    draw.text((bx + 30, by + 24), "📦 Cadastro de Materiais & Calculadora de Insumo por m²", font=font_section, fill=TEXT_WHITE)
    
    # Lista de materiais
    mats = [
        ("Isopor EPS Alta Densidade 100mm", "100 mm", "R$ 48,00 / m²", "Fresa Topo 12mm", "16.000 mm/min", "15.000 RPM", ACCENT_CYAN),
        ("PVC Expandido 10mm", "10 mm", "R$ 85,00 / m²", "Fresa 1 Corte 6mm", "9.000 mm/min", "18.000 RPM", ACCENT_GREEN),
        ("MDF Cru 15mm", "15 mm", "R$ 62,00 / m²", "Fresa 2 Cortes 6mm", "6.500 mm/min", "18.000 RPM", ACCENT_AMBER),
        ("Acrílico Cristal 3mm", "3 mm", "R$ 140,00 / m²", "Laser CO2 100W", "25 mm/s", "Potência 75%", ACCENT_PURPLE)
    ]
    my = by + 90
    for m_name, esp, preco, tool, feed, sp, col in mats:
        draw.rounded_rectangle([(bx + 30, my), (bx + 1520, my + 72)], radius=12, fill=(24, 34, 58), outline=BORDER_LIGHT)
        draw.text((bx + 50, my + 14), m_name, font=font_bold, fill=TEXT_WHITE)
        draw.text((bx + 50, my + 42), f"Espessura: {esp} • Ferramenta: {tool}", font=font_small, fill=TEXT_MUTED)
        draw.text((bx + 750, my + 24), f"Feed: {feed} | Spindle: {sp}", font=font_bold, fill=TEXT_LIGHT)
        draw.text((bx + 1300, my + 22), preco, font=font_section, fill=col)
        my += 86

def render_screen_manutencao(draw):
    bx = 290
    by = 100
    draw.rounded_rectangle([(bx, by), (bx + 1550, by + 460)], radius=20, fill=BG_CARD_SOLID, outline=BORDER_COLOR)
    draw.text((bx + 30, by + 24), "🛠️ Manutenção Preventiva, Horímetro & Ocorrências", font=font_section, fill=TEXT_WHITE)
    
    # 3 Cards de Horimetro
    machines = [
        ("⚙️ Router Central", "1.428h Usinadas", "Lubrificação de Guias Lineares em 72h", ACCENT_GREEN),
        ("⚙️ Router 2", "984h Usinadas", "Troca de Escovas do Spindle OK", ACCENT_CYAN),
        ("🔴 Laser Ruida CO2", "612h de Tubo Laser", "Limpeza de Lentes & Espelhos Recomendada", ACCENT_AMBER)
    ]
    mx = bx + 30
    for m_name, horim, status, col in machines:
        draw.rounded_rectangle([(mx, by + 90), (mx + 470, by + 250)], radius=16, fill=(24, 34, 58), outline=col)
        draw.text((mx + 20, by + 110), m_name, font=font_section, fill=TEXT_WHITE)
        draw.text((mx + 20, by + 155), horim, font=font_title, fill=col)
        draw.text((mx + 20, by + 205), status, font=font_small, fill=TEXT_MUTED)
        mx += 510

    # Botao Reporte de Falhas
    draw.rounded_rectangle([(bx + 30, by + 280), (bx + 1520, by + 420)], radius=16, fill=(239, 68, 68, 20), outline=ACCENT_RED)
    draw.text((bx + 60, by + 310), "🚨 Formulário de Reporte de Falhas para o Operador", font=font_section, fill=ACCENT_RED)
    draw.text((bx + 60, by + 350), "Permite registrar paradas de máquina por quebra de ferramenta, falta de ar ou pane elétrica.", font=font_body, fill=TEXT_WHITE)

def render_screen_automacao(draw):
    bx = 290
    by = 100
    draw.rounded_rectangle([(bx, by), (bx + 1550, by + 460)], radius=20, fill=BG_CARD_SOLID, outline=BORDER_COLOR)
    draw.text((bx + 30, by + 24), "⚡ Automação de Relatórios por E-mail & Alerta de Ociosidade", font=font_section, fill=TEXT_WHITE)
    
    # Toggles simulados
    toggles = [
        ("Resumo Diário de Produção por E-mail às 18:00", "Dispara fechamento consolidado para gerente@empresa.com", True),
        ("Alerta Imediato de Máquina Parada por mais de 1 Hora", "Notifica quando tolerância de ociosidade for ultrapassada", True),
        ("Relatório Semanal Consolidado (Toda Segunda-feira)", "Inclui evolução gráfica de usinagem e serviços externos", True)
    ]
    ty = by + 90
    for title, desc, active in toggles:
        draw.rounded_rectangle([(bx + 30, ty), (bx + 1520, ty + 80)], radius=14, fill=(24, 34, 58), outline=BORDER_LIGHT)
        draw.text((bx + 50, ty + 16), title, font=font_bold, fill=TEXT_WHITE)
        draw.text((bx + 50, ty + 46), desc, font=font_small, fill=TEXT_MUTED)
        # Toggle switch visual
        draw.rounded_rectangle([(bx + 1420, ty + 24), (bx + 1480, ty + 56)], radius=16, fill=ACCENT_CYAN)
        draw.ellipse([(bx + 1450, ty + 26), (bx + 1476, ty + 54)], fill=TEXT_WHITE)
        ty += 95
        
    # Botao Faca o Ciclo
    draw.rounded_rectangle([(bx + 30, by + 390), (bx + 400, by + 440)], radius=12, fill=ACCENT_GREEN)
    draw.text((bx + 60, by + 404), "🚀 Disparar Ciclo Agora ('Faça o Ciclo')", font=font_bold, fill=(0, 0, 0))

def render_screen_gestao_financeira(draw):
    bx = 290
    by = 100
    draw.rounded_rectangle([(bx, by), (bx + 1550, by + 460)], radius=20, fill=BG_CARD_SOLID, outline=BORDER_COLOR)
    draw.text((bx + 30, by + 24), "💎 Gestão de Assinatura, Recibos Oficiais Timbrados & Logotipo", font=font_section, fill=TEXT_WHITE)
    
    # Card Plano Atual
    draw.rounded_rectangle([(bx + 30, by + 90), (bx + 750, by + 430)], radius=16, fill=(24, 34, 58), outline=ACCENT_CYAN)
    draw.text((bx + 60, by + 120), "💎 Plano Atual: BUSINESS Premium", font=font_section, fill=ACCENT_CYAN)
    draw.text((bx + 60, by + 160), "Status: Ativo • Routers Ilimitadas • Suporte Prioritário", font=font_body, fill=TEXT_MUTED)
    draw.text((bx + 60, by + 220), "Recibos Oficiais Emitidos:", font=font_bold, fill=TEXT_WHITE)
    draw.text((bx + 60, by + 260), "• Recibo #1024 - R$ 149,00 (Pago via PIX) [Baixar PDF Timbrado]", font=font_small, fill=ACCENT_GREEN)
    draw.text((bx + 60, by + 295), "• Recibo #1023 - R$ 149,00 (Pago via Cartão) [Baixar PDF Timbrado]", font=font_small, fill=ACCENT_GREEN)
    
    # Personalizacao de Logo
    rx = bx + 780
    draw.rounded_rectangle([(rx, by + 90), (rx + 740, by + 430)], radius=16, fill=(24, 34, 58), outline=BORDER_COLOR)
    draw.text((rx + 40, by + 120), "🎨 Personalização da Empresa", font=font_section, fill=TEXT_WHITE)
    draw.rounded_rectangle([(rx + 40, by + 170), (rx + 300, by + 270)], radius=12, fill=(15, 23, 42), outline=BORDER_LIGHT)
    draw.text((rx + 70, by + 210), "🔩 CASA DO TREM", font=font_bold, fill=TEXT_WHITE)
    draw.text((rx + 330, by + 190), "Logotipo cadastrado com sucesso!", font=font_bold, fill=ACCENT_GREEN)
    draw.text((rx + 330, by + 225), "Exibido no cabeçalho do sistema e nos relatórios de e-mail.", font=font_small, fill=TEXT_MUTED)

def render_screen_seguranca(draw):
    bx = 290
    by = 100
    draw.rounded_rectangle([(bx, by), (bx + 1550, by + 460)], radius=20, fill=BG_CARD_SOLID, outline=BORDER_COLOR)
    draw.text((bx + 30, by + 24), "🔒 Níveis de Acesso & Segurança com Senha PIN", font=font_section, fill=TEXT_WHITE)
    
    cards = [
        ("Operador (Chão de Fábrica)", "Acesso exclusivo ao terminal simplificado de apontamentos. Bloqueio automático de custos e relatórios.", ACCENT_CYAN),
        ("Supervisor / Encarregado", "Acesso ao Quadro Kanban, fila de O.S., redistribuição de equipe e histórico de usinagem.", ACCENT_AMBER),
        ("Gerente Geral (Admin)", "Acesso irrestrito a faturamento, custos/hora, automações, parâmetros de máquina e auditoria.", ACCENT_GREEN)
    ]
    cx = bx + 30
    for role_name, role_desc, r_col in cards:
        draw.rounded_rectangle([(cx, by + 90), (cx + 470, by + 420)], radius=16, fill=(24, 34, 58), outline=r_col)
        draw.text((cx + 30, by + 120), role_name, font=font_bold, fill=r_col)
        draw.text((cx + 30, by + 170), "PIN de 4 Dígitos Configurado", font=font_small_bold, fill=TEXT_WHITE)
        
        words = role_desc.split()
        draw.text((cx + 30, by + 220), " ".join(words[:6]), font=font_body, fill=TEXT_MUTED)
        draw.text((cx + 30, by + 255), " ".join(words[6:13]), font=font_body, fill=TEXT_MUTED)
        draw.text((cx + 30, by + 290), " ".join(words[13:]), font=font_body, fill=TEXT_MUTED)
        cx += 510

# ==================== MAPA DOS 11 PASSOS DO GUIA DE USO ====================

tour_steps = [
    {
        'step_idx': 0,
        'section_id': 'dashboard',
        'badge': 'Etapa 1 de 11 • Telemetria ao Vivo',
        'title': '🚀 Status & Telemetria em Tempo Real (CNC, Laser & Vácuo)',
        'description': 'Acompanhe simultaneamente todas as suas Router CNC, Laser Ruida CO2 e a Máquina a Vácuo. Visualize em tempo real quem está operando cada equipamento, arquivo G-code, barra de progresso e tempo decorrido.',
        'tip': '💡 Dica para o Cliente: Permite ao gerente monitorar 100% da fábrica em uma única tela sem precisar caminhar até a oficina.',
        'narration': 'Etapa 1: Acompanhe em tempo real todas as suas Routers CNC e Laser com arquivo em corte, barra de progresso e operador.',
        'render_screen': render_screen_telemetria
    },
    {
        'step_idx': 1,
        'section_id': 'operador',
        'badge': 'Etapa 2 de 11 • Alocação da Equipe & Status',
        'title': '👷 Painel Equipe Hoje, Almoço 🍱 & Limpeza 🧹',
        'description': 'Gestão visual de alocação de operadores: Na Fábrica, Almoço, Limpeza, Serviço Externo, Outro Setor ou Folga. Operadores em almoço ou serviços externos são bloqueados de vínculo a máquinas automaticamente.',
        'tip': '💡 Dica para o Cliente: Garante que você saiba exatamente onde cada operador está no momento e evita apontamento incorreto de máquina.',
        'narration': 'Etapa 2: Saiba onde cada operador está: na máquina, em serviço externo de montagem, em outros setores ou almoço.',
        'render_screen': render_screen_operador_equipe
    },
    {
        'step_idx': 2,
        'section_id': 'operador',
        'badge': 'Etapa 3 de 11 • Rastreamento Diário',
        'title': '⏱️ Linha do Tempo Diária (Cards Individuais por Trabalho)',
        'description': 'Rastreamento 100% automático por período. A cada início de corte ou troca de tarefa, o sistema encerra o card anterior e abre um NOVO CARD INDEPENDENTE com horário de início, término e duração exata.',
        'tip': '💡 Dica para o Cliente: Histórico limpo sem sobreposição de horários, mostrando exatamente quanto tempo cada peça levou.',
        'narration': 'Etapa 3: Rastreamento automático por cards individuais sem sobreposição de horários para cada peça ou tarefa.',
        'render_screen': render_screen_timesheet
    },
    {
        'step_idx': 3,
        'section_id': 'encarregado',
        'badge': 'Etapa 4 de 11 • Gestão de Produção',
        'title': '📋 Quadro Kanban de O.S. & Apontamentos',
        'description': 'Painel Kanban interativo para gerenciar o fluxo da fábrica: A Fazer, Em Produção e Concluído. Permite direcionar trabalhos para Routers CNC, Laser, Vácuo, Serviços Externos e Outros Setores com prazos e prioridades.',
        'tip': '💡 Dica para o Cliente: Avanço automático de status quando o operador dispara o arquivo de corte na máquina.',
        'narration': 'Etapa 4: Quadro Kanban interativo com avanço automático quando o operador inicia o arquivo no Mach3.',
        'render_screen': render_screen_kanban
    },
    {
        'step_idx': 4,
        'section_id': 'jobs',
        'badge': 'Etapa 5 de 11 • Rastreabilidade & PDF',
        'title': '📊 Histórico de Produção, Coluna Qtd & PDF em 6 Páginas',
        'description': 'Rastreio de todas as peças cortadas com m², dimensões X/Y mm, insumo consumido e custo em R$. Conta com Coluna de Quantidade (Qtd) ajustável e Relatório PDF Executivo de 6 páginas com gráficos e peças.',
        'tip': '💡 Dica para o Cliente: Exporte relatórios executivos com timesheet completo, manutenções e gráficos prontos para reuniões.',
        'narration': 'Etapa 5: Histórico completo com dimensões das peças, cálculo de m², custos e exportação de PDF executivo de 6 páginas.',
        'render_screen': render_screen_historico
    },
    {
        'step_idx': 5,
        'section_id': 'charts',
        'badge': 'Etapa 6 de 11 • Produtividade & 6 Meses de Histórico',
        'title': '📈 Produtividade Semestral, Métricas OEE & Ranking',
        'description': 'Análise aprofundada dos últimos 6 meses com cálculo automático de OEE (Disponibilidade, Desempenho e Qualidade). Gráficos comparando tempo estimado vs. tempo real de corte, consumo de chapas e horas por máquina.',
        'tip': '💡 Dica para o Cliente: Identifique gargalos e máquinas ociosas para maximizar o faturamento diário da sua fábrica.',
        'narration': 'Etapa 6: Análise semestral dos últimos seis meses com métricas OEE, ranking de operadores e comparativo de tempo real.',
        'render_screen': render_screen_graficos
    },
    {
        'step_idx': 6,
        'section_id': 'materials',
        'badge': 'Etapa 7 de 11 • Gestão de Custos',
        'title': '📦 Cadastro de Materiais & Calculadora de Insumos',
        'description': 'Cadastre o custo por m² de chapas (MDF, Acrílico, PVC, Isopor EPS). O sistema identifica automaticamente o material pelo nome do projeto e calcula o custo consumido em Reais (R$) por lote cortado.',
        'tip': '💡 Dica para o Cliente: Elimine surpresas no custo final e saiba exatamente quanto gastou de matéria-prima em cada cliente.',
        'narration': 'Etapa 7: Cadastro de materiais com cálculo automático de custo por metro quadrado e parâmetros de corte recomendados.',
        'render_screen': render_screen_materiais
    },
    {
        'step_idx': 7,
        'section_id': 'maintenance',
        'badge': 'Etapa 8 de 11 • Conservação & Falhas',
        'title': '🛠️ Manutenção Preventiva, Horímetro & Ocorrências',
        'description': 'Controle de horímetro acumulado, alertas de lubrificação de guias lineares e troca de fluido. Formulário direto de Reporte de Falhas para o operador notificar paradas ao encarregado.',
        'tip': '💡 Dica para o Cliente: Proteja o investimento dos seus equipamentos prevenindo paradas não planejadas e quebras dispendiosas.',
        'narration': 'Etapa 8: Manutenção preventiva com controle de horímetro de cada máquina e reporte ágil de falhas operacionais.',
        'render_screen': render_screen_manutencao
    },
    {
        'step_idx': 8,
        'section_id': 'settings',
        'badge': 'Etapa 9 de 11 • Automação & Alertas',
        'title': '⚡ Automação de Relatórios por E-mail & Alerta de Máquina Parada',
        'description': 'Disparo automatizado às 18:00 com o resumo de tudo o que foi cortado no dia, custos de produção e eficiência dos operadores. Monitora ociosidade e envia alertas imediatos por e-mail caso alguma máquina fique >1h inativa.',
        'tip': '💡 Dica para o Cliente: A gerência recebe no smartphone o fechamento completo do dia sem precisar cobrar relatórios da equipe.',
        'narration': 'Etapa 9: Fechamento diário automático por e-mail às 18 horas e alertas inteligentes de máquinas paradas por mais de 1 hora.',
        'render_screen': render_screen_automacao
    },
    {
        'step_idx': 9,
        'section_id': 'settings',
        'badge': 'Etapa 10 de 11 • Faturamento & Marca',
        'title': '💎 Gestão de Assinatura, Recibos Oficiais & Logotipo da Empresa',
        'description': 'Painel completo de Faturamento com emissão e impressão de Recibos Oficiais Timbrados com CNPJ e autenticação digital. Personalize o sistema com a Logo da sua empresa e alterne temas visuais.',
        'tip': '💡 Dica para o Cliente: Gere comprovantes oficiais em PDF com 1 clique e apresente o sistema aos clientes com a marca da sua fábrica.',
        'narration': 'Etapa 10: Recibos oficiais timbrados com CNPJ, personalização com o logotipo da sua empresa e gestão da assinatura.',
        'render_screen': render_screen_gestao_financeira
    },
    {
        'step_idx': 10,
        'section_id': 'settings',
        'badge': 'Etapa 11 de 11 • Controle de Acesso',
        'title': '🔒 Níveis de Acesso com Senha PIN (Gerente, Supervisor, Operador)',
        'description': 'Segurança e controle de permissões por perfil. O perfil Operador tem acesso apenas ao terminal simplificado de produção; para acessar custos, relatórios e parâmetros, é exigida senha PIN de Gerente ou Supervisor.',
        'tip': '💡 Dica para o Cliente: Interface blindada para ser instalada em tablets ao lado de cada CNC/Laser no chão de fábrica sem risco.',
        'narration': 'Etapa 11: Níveis de acesso protegidos por senha PIN garantindo segurança total em tablets no chão de fábrica.',
        'render_screen': render_screen_seguranca
    }
]

# ==================== PIPELINE DE RENDERIZAÇÃO ====================

frames_per_step = 160  # ~5.3 segundos por etapa x 11 etapas = ~58s total
total_frames = len(tour_steps) * frames_per_step
total_sec = total_frames / fps

print(f"Iniciando Renderizacao do Video Oficial com o Guia de Uso e Sistema Real:")
print(f"Resolucao: {width}x{height} | FPS: {fps} | Etapas: {len(tour_steps)} | Frames: {total_frames} (~{total_sec:.1f}s)")

fourcc = cv2.VideoWriter_fourcc(*'mp4v')
out = cv2.VideoWriter(out_path, fourcc, fps, (width, height))

current_frame = 0

for step_info in tour_steps:
    s_idx = step_info['step_idx']
    print(f"-> Renderizando Etapa {s_idx + 1}/11: {step_info['badge']}...")
    
    for f_idx in range(frames_per_step):
        img = Image.new("RGB", (width, height), BG_MAIN)
        draw = ImageDraw.Draw(img)
        
        # 1. Desenhar a casca real do sistema (Sidebar + Header)
        draw_real_system_shell(draw, step_info['section_id'])
        
        # 2. Desenhar a tela real correspondente àquele módulo
        step_info['render_screen'](draw)
        
        # 3. Desenhar o Modal do Guia de Apresentacao flutuante
        draw_tour_modal(
            draw, 
            s_idx, 
            len(tour_steps), 
            step_info['badge'], 
            step_info['title'], 
            step_info['description'], 
            step_info['tip']
        )
        
        # 4. Barra de Narracao Inferior
        draw_footer_narration(draw, step_info['narration'])
        
        # Transicao suave entre etapas
        fade_frames = 8
        if f_idx < fade_frames and s_idx > 0:
            alpha = f_idx / fade_frames
            arr = np.array(img).astype(np.float32) * alpha
            arr = arr.astype(np.uint8)
            frame_bgr = cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)
        elif f_idx >= frames_per_step - fade_frames and s_idx < len(tour_steps) - 1:
            alpha = (frames_per_step - 1 - f_idx) / fade_frames
            arr = np.array(img).astype(np.float32) * alpha
            arr = arr.astype(np.uint8)
            frame_bgr = cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)
        else:
            frame_bgr = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
            
        out.write(frame_bgr)
        current_frame += 1

out.release()

file_size_mb = os.path.getsize(out_path) / (1024 * 1024)
print("\n==========================================")
print("[OK] NOVO VIDEO GERADO COM SUCESSO!")
print(f"Arquivo: {out_path}")
print(f"Tamanho: {file_size_mb:.2f} MB")
print(f"Duracao: {total_sec:.1f} segundos")
print("==========================================")
