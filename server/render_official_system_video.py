import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import os
import shutil
import time

width, height = 1920, 1080
fps = 30
out_path = r"c:\DASHBOARD\Apresentacao_MACH3_Tracker.mp4"
artifact_path = r"C:\Users\Atelier Arte\.gemini\antigravity\brain\8f090ab8-74bd-4612-87a2-ab2800f39185\Apresentacao_MACH3_Tracker.mp4"
public_path = r"c:\DASHBOARD\server\public\Apresentacao_MACH3_Tracker.mp4"

# Windows Fonts
font_badge = ImageFont.truetype(r"C:\Windows\Fonts\segoeuib.ttf", 15)
font_title = ImageFont.truetype(r"C:\Windows\Fonts\segoeuib.ttf", 26)
font_sub = ImageFont.truetype(r"C:\Windows\Fonts\segoeui.ttf", 18)
font_huge = ImageFont.truetype(r"C:\Windows\Fonts\segoeuib.ttf", 50)
font_card_title = ImageFont.truetype(r"C:\Windows\Fonts\segoeuib.ttf", 20)
font_card_sub = ImageFont.truetype(r"C:\Windows\Fonts\segoeui.ttf", 15)

# Load Mach3 Tracker logo
logo_path = r"c:\DASHBOARD\dashboard-v2\public\icon-512.png"
logo_img = None
if os.path.exists(logo_path):
    logo_img = Image.open(logo_path).convert("RGBA")

STEPS = [
    {
        "step": 1,
        "clean_img": r"C:\DASHBOARD\video_assets_demo\clean_dashboard.png",
        "modal_img": r"C:\DASHBOARD\video_assets_demo\step_1.png",
        "badge": "ETAPA 01 DE 11 • TELEMETRIA AO VIVO",
        "title": "Status & Telemetria em Tempo Real (CNC, Laser & Vácuo)",
        "desc": "Acompanhamento simultâneo de Router Central, Router 2, Laser Ruida e Termoformadora a Vácuo com ETA e G-code."
    },
    {
        "step": 2,
        "clean_img": r"C:\DASHBOARD\video_assets_demo\clean_operador.png",
        "modal_img": r"C:\DASHBOARD\video_assets_demo\step_2.png",
        "badge": "ETAPA 02 DE 11 • ALOCAÇÃO DA EQUIPE",
        "title": "Painel Equipe Hoje, Almoço & Limpeza do Setor",
        "desc": "Gestão visual de alocação de operadores: Na Fábrica, Almoço, Limpeza, Serviços Externos e Outros Setores."
    },
    {
        "step": 3,
        "clean_img": r"C:\DASHBOARD\video_assets_demo\clean_operador_timesheet.png",
        "modal_img": r"C:\DASHBOARD\video_assets_demo\step_3.png",
        "badge": "ETAPA 03 DE 11 • RASTREAMENTO DIÁRIO",
        "title": "Linha do Tempo Diária (Cards Individuais por Trabalho)",
        "desc": "Rastreamento automático por período com cards individuais de início, término e duração exata de cada tarefa."
    },
    {
        "step": 4,
        "clean_img": r"C:\DASHBOARD\video_assets_demo\clean_encarregado_kanban.png",
        "modal_img": r"C:\DASHBOARD\video_assets_demo\step_4.png",
        "badge": "ETAPA 04 DE 11 • GESTÃO DE PRODUÇÃO",
        "title": "Quadro Kanban de O.S. & Apontamentos Operacionais",
        "desc": "Painel Kanban interativo para gerenciar o fluxo da fábrica com direcionamento e avanço automático de corte."
    },
    {
        "step": 5,
        "clean_img": r"C:\DASHBOARD\video_assets_demo\clean_jobs.png",
        "modal_img": r"C:\DASHBOARD\video_assets_demo\step_5.png",
        "badge": "ETAPA 05 DE 11 • RASTREABILIDADE & PDF",
        "title": "Histórico de Produção, Coluna Qtd & PDF Executivo",
        "desc": "Rastreio completo com m², custos em R$, coluna ajustável de quantidade e Relatório Executivo de 6 páginas."
    },
    {
        "step": 6,
        "clean_img": r"C:\DASHBOARD\video_assets_demo\clean_charts.png",
        "modal_img": r"C:\DASHBOARD\video_assets_demo\step_6.png",
        "badge": "ETAPA 06 DE 11 • PRODUTIVIDADE & HISTÓRICO",
        "title": "Produtividade Semestral, Métricas OEE & Ranking",
        "desc": "Análise aprofundada dos últimos 6 meses com Disponibilidade, Desempenho, Qualidade e comparação real vs. estimado."
    },
    {
        "step": 7,
        "clean_img": r"C:\DASHBOARD\video_assets_demo\clean_materials.png",
        "modal_img": r"C:\DASHBOARD\video_assets_demo\step_7.png",
        "badge": "ETAPA 07 DE 11 • GESTÃO DE CUSTOS",
        "title": "Cadastro de Materiais & Calculadora de Insumos",
        "desc": "Precificação inteligente por m² de chapas (MDF, Acrílico, ACM, PVC) com cálculo automático de custo por lote."
    },
    {
        "step": 8,
        "clean_img": r"C:\DASHBOARD\video_assets_demo\clean_maintenance.png",
        "modal_img": r"C:\DASHBOARD\video_assets_demo\step_8.png",
        "badge": "ETAPA 08 DE 11 • CONSERVAÇÃO & FALHAS",
        "title": "Manutenção Preventiva, Horímetro & Ocorrências",
        "desc": "Controle de horímetro acumulado, alertas de lubrificação, controle de chillers e reporte direto de falhas."
    },
    {
        "step": 9,
        "clean_img": r"C:\DASHBOARD\video_assets_demo\clean_settings_reports.png",
        "modal_img": r"C:\DASHBOARD\video_assets_demo\step_9.png",
        "badge": "ETAPA 09 DE 11 • AUTOMAÇÃO & ALERTAS",
        "title": "Automação de Relatórios por E-mail & Alerta de Máquina Parada",
        "desc": "Disparo diário às 18:00 com fechamento por e-mail e alerta imediato caso alguma máquina fique inativa por >1h."
    },
    {
        "step": 10,
        "clean_img": r"C:\DASHBOARD\video_assets_demo\clean_settings.png",
        "modal_img": r"C:\DASHBOARD\video_assets_demo\step_10.png",
        "badge": "ETAPA 10 DE 11 • FATURAMENTO & MARCA",
        "title": "Gestão de Assinatura, Recibos Oficiais & Marca da Empresa",
        "desc": "Recibos timbrados com CNPJ e autenticação digital, integração Mercado Pago, logo personalizada e temas."
    },
    {
        "step": 11,
        "clean_img": r"C:\DASHBOARD\video_assets_demo\clean_settings_pins.png",
        "modal_img": r"C:\DASHBOARD\video_assets_demo\step_11.png",
        "badge": "ETAPA 11 DE 11 • CONTROLE DE ACESSO",
        "title": "Níveis de Acesso com Senha PIN (Gerente, Supervisor, Operador)",
        "desc": "Interface blindada para tablets no chão de fábrica com proteção por senha PIN para áreas sensíveis."
    }
]

def apply_ken_burns(img, scale):
    if scale <= 1.0001:
        return img
    h, w = img.shape[:2]
    new_w = int(w * scale)
    new_h = int(h * scale)
    resized = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_LINEAR)
    dw = new_w - w
    dh = new_h - h
    x0 = dw // 2
    y0 = dh // 2
    cropped = resized[y0:y0+h, x0:x0+w]
    if cropped.shape[0] != h or cropped.shape[1] != w:
        cropped = cv2.resize(cropped, (w, h))
    return cropped

def draw_lower_third(frame_bgr, badge_text, title_text, desc_text, step_num, total_steps=11):
    img_pil = Image.fromarray(cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB))
    W, H = img_pil.size
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    bx0, by0, bx1, by1 = 50, H - 145, W - 50, H - 25

    # Glass background
    draw.rounded_rectangle([bx0, by0, bx1, by1], radius=16, fill=(8, 14, 28, 240), outline=(6, 182, 212, 190), width=2)

    # Top glowing accent line
    draw.line([(bx0 + 20, by0), (bx1 - 20, by0)], fill=(6, 182, 212, 255), width=2)

    # Badge pill
    badge_w = 340
    draw.rounded_rectangle([bx0 + 25, by0 + 16, bx0 + 25 + badge_w, by0 + 44], radius=8, fill=(6, 182, 212, 45), outline=(6, 182, 212, 220), width=1)
    draw.text((bx0 + 40, by0 + 21), badge_text, font=font_badge, fill=(6, 182, 212, 255))

    # System tag on right
    draw.text((bx1 - 230, by0 + 21), "MACH3 TRACKER V2.0", font=font_badge, fill=(148, 163, 184, 255))

    # Title
    draw.text((bx0 + 25, by0 + 52), title_text, font=font_title, fill=(255, 255, 255, 255))

    # Description
    draw.text((bx0 + 25, by0 + 88), desc_text, font=font_sub, fill=(203, 213, 225, 255))

    # Progress bar along bottom of banner
    pb_y = by1 - 4
    draw.line([(bx0 + 16, pb_y), (bx1 - 16, pb_y)], fill=(255, 255, 255, 30), width=3)
    progress_w = int((bx1 - bx0 - 32) * (step_num / total_steps))
    draw.line([(bx0 + 16, pb_y), (bx0 + 16 + progress_w, pb_y)], fill=(6, 182, 212, 255), width=3)

    comp = Image.alpha_composite(img_pil.convert("RGBA"), overlay).convert("RGB")
    return cv2.cvtColor(np.array(comp), cv2.COLOR_RGB2BGR)

def create_intro_frame(f, total_frames):
    img = Image.new("RGB", (width, height), (7, 11, 22))
    draw = ImageDraw.Draw(img)

    for r in range(400, 50, -50):
        draw.ellipse([(width//2 - r, height//2 - 120 - r), (width//2 + r, height//2 - 120 + r)], outline=(6, 182, 212))

    card_w, card_h = 120, 120
    cx, cy = width // 2, height // 2 - 170
    draw.rounded_rectangle([cx - card_w//2, cy - card_h//2, cx + card_w//2, cy + card_h//2], radius=24, fill=(15, 23, 42), outline=(6, 182, 212), width=2)

    if logo_img:
        logo_resized = logo_img.resize((84, 84), Image.Resampling.LANCZOS)
        img.paste(logo_resized, (cx - 42, cy - 42), logo_resized)

    title1 = "MACH3 TRACKER INDUSTRIAL V2.0"
    w1 = draw.textlength(title1, font=font_huge)
    draw.text((width//2 - w1//2, height//2 - 75), title1, font=font_huge, fill=(6, 182, 212))

    title2 = "GUIA OFICIAL DE APRESENTAÇÃO DO SISTEMA"
    w2 = draw.textlength(title2, font=font_title)
    draw.text((width//2 - w2//2, height//2 + 10), title2, font=font_title, fill=(255, 255, 255))

    sub = "Telemetria em Tempo Real • Linha do Tempo da Equipe • OEE Semestral • Planner Kanban • Automação"
    wsub = draw.textlength(sub, font=font_sub)
    draw.text((width//2 - wsub//2, height//2 + 65), sub, font=font_sub, fill=(148, 163, 184))

    badge = "CONTA DEMONSTRAÇÃO OFICIAL  •  demo@mach3tracker.com  •  PLANO BUSINESS PREMIUM"
    wbadge = draw.textlength(badge, font=font_badge)
    bx = width // 2 - int(wbadge) // 2
    by = height // 2 + 125
    draw.rounded_rectangle([bx - 20, by - 8, bx + int(wbadge) + 20, by + 28], radius=10, fill=(6, 182, 212, 40), outline=(6, 182, 212), width=1)
    draw.text((bx, by), badge, font=font_badge, fill=(6, 182, 212))

    frame_bgr = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
    if f < 15:
        alpha = f / 15.0
        frame_bgr = (frame_bgr * alpha).astype(np.uint8)
    elif f > total_frames - 10:
        alpha = (total_frames - f) / 10.0
        frame_bgr = (frame_bgr * alpha).astype(np.uint8)

    return frame_bgr

def create_outro_frame(f, total_frames):
    img = Image.new("RGB", (width, height), (7, 11, 22))
    draw = ImageDraw.Draw(img)

    for r in range(400, 50, -50):
        draw.ellipse([(width//2 - r, height//2 - 140 - r), (width//2 + r, height//2 - 140 + r)], outline=(6, 182, 212))

    card_w, card_h = 110, 110
    cx, cy = width // 2, height // 2 - 250
    draw.rounded_rectangle([cx - card_w//2, cy - card_h//2, cx + card_w//2, cy + card_h//2], radius=22, fill=(15, 23, 42), outline=(6, 182, 212), width=2)
    if logo_img:
        logo_resized = logo_img.resize((76, 76), Image.Resampling.LANCZOS)
        img.paste(logo_resized, (cx - 38, cy - 38), logo_resized)

    t1 = "MACH3 TRACKER • DEMONSTRAÇÃO COMPLETA"
    w1 = draw.textlength(t1, font=font_huge)
    draw.text((width//2 - w1//2, height//2 - 165), t1, font=font_huge, fill=(255, 255, 255))

    t2 = "Todas as 11 etapas do Guia de Apresentação ativas com dados da Conta Demo"
    w2 = draw.textlength(t2, font=font_title)
    draw.text((width//2 - w2//2, height//2 - 100), t2, font=font_title, fill=(6, 182, 212))

    cards = [
        ("1. Telemetria ao Vivo", "Routers CNC, Laser Ruida e Termoformadora monitoradas em tempo real."),
        ("2. Gestão de Equipe & Timesheet", "Alocação inteligente, almoço, limpeza e cards por trabalho sem sobreposição."),
        ("3. Kanban & Relatórios Executivos", "Quadro Kanban interativo e relatórios executivos em PDF com 6 páginas."),
        ("4. Automação, Custos & Segurança", "Disparo diário por e-mail, cálculo por m² e proteção com senha PIN.")
    ]

    card_coords = [
        (width//2 - 580, height//2 - 30),
        (width//2 + 30, height//2 - 30),
        (width//2 - 580, height//2 + 90),
        (width//2 + 30, height//2 + 90),
    ]

    for (c_title, c_sub), (x, y) in zip(cards, card_coords):
        draw.rounded_rectangle([x, y, x + 550, y + 95], radius=14, fill=(15, 23, 42), outline=(55, 75, 110), width=1)
        draw.text((x + 20, y + 16), c_title, font=font_card_title, fill=(6, 182, 212))
        draw.text((x + 20, y + 48), c_sub, font=font_card_sub, fill=(203, 213, 225))

    footer = "Acesse a Demonstração Oficial: https://mach3tracker.up.railway.app  •  demo@mach3tracker.com"
    wf = draw.textlength(footer, font=font_sub)
    draw.text((width//2 - wf//2, height - 70), footer, font=font_sub, fill=(148, 163, 184))

    frame_bgr = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
    if f < 15:
        alpha = f / 15.0
        frame_bgr = (frame_bgr * alpha).astype(np.uint8)
    elif f > total_frames - 15:
        alpha = (total_frames - f) / 15.0
        frame_bgr = (frame_bgr * alpha).astype(np.uint8)

    return frame_bgr

def main():
    print("Iniciando renderização oficial do vídeo com a CONTA DEMO...")
    t0 = time.time()

    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(out_path, fourcc, fps, (width, height))

    if not out.isOpened():
        raise RuntimeError("Não foi possível abrir o VideoWriter do OpenCV!")

    # 1. INTRO (3.0 segundos = 90 frames)
    print("Renderizando Intro Executiva...")
    intro_frames = 90
    for f in range(intro_frames):
        frame = create_intro_frame(f, intro_frames)
        out.write(frame)

    total_steps = len(STEPS)
    
    # Pre-carregar e normalizar todas as imagens
    loaded_steps = []
    for s in STEPS:
        clean = cv2.imread(s["clean_img"])
        modal = cv2.imread(s["modal_img"])
        if clean is None:
            raise FileNotFoundError(f"Imagem limpa não encontrada: {s['clean_img']}")
        if modal is None:
            raise FileNotFoundError(f"Imagem modal não encontrada: {s['modal_img']}")
        
        clean = cv2.resize(clean, (width, height), interpolation=cv2.INTER_LANCZOS4)
        modal = cv2.resize(modal, (width, height), interpolation=cv2.INTER_LANCZOS4)
        
        loaded_steps.append({
            "step": s["step"],
            "clean": clean,
            "modal": modal,
            "badge": s["badge"],
            "title": s["title"],
            "desc": s["desc"]
        })

    # 2. OS 11 PASSOS DO GUIA DE APRESENTAÇÃO
    # Para cada passo:
    # - 65 frames (2.16s) da TELA REAL LIMPA com banner
    # - 6 frames fade para o MODAL DO GUIA
    # - 100 frames (3.33s) do MODAL DO GUIA OFICIAL
    # - 6 frames fade to black (dip-to-black entre etapas)
    clean_duration = 65
    modal_duration = 100
    fade_frames = 6

    for idx, s in enumerate(loaded_steps):
        print(f"Renderizando Etapa {s['step']} de {total_steps}: {s['title']}...")
        clean_img = s["clean"]
        modal_img = s["modal"]

        # Parte A: Tela Limpa (65 frames)
        for f in range(clean_duration):
            scale = 1.0 + 0.02 * (f / float(clean_duration))
            zoomed_clean = apply_ken_burns(clean_img, scale)
            clean_with_banner = draw_lower_third(zoomed_clean, s["badge"], s["title"], s["desc"], s["step"], total_steps)

            # Dip from black on start of step
            if f < 6:
                alpha = f / 6.0
                clean_with_banner = (clean_with_banner * alpha).astype(np.uint8)

            if f < clean_duration - fade_frames:
                out.write(clean_with_banner)
            else:
                # Transição suave para o modal da mesma tela
                alpha = (f - (clean_duration - fade_frames)) / float(fade_frames)
                blended = cv2.addWeighted(clean_with_banner, 1.0 - alpha, modal_img, alpha, 0)
                out.write(blended)

        # Parte B: Modal do Guia (100 frames)
        for f in range(modal_duration):
            scale = 1.0 + 0.015 * (f / float(modal_duration))
            zoomed_modal = apply_ken_burns(modal_img, scale)

            # No final do modal, dip to black suave antes da próxima etapa
            if f >= modal_duration - fade_frames:
                alpha = (modal_duration - 1 - f) / float(fade_frames)
                zoomed_modal = (zoomed_modal * alpha).astype(np.uint8)

            out.write(zoomed_modal)

    # 3. OUTRO (3.0 segundos = 90 frames)
    print("Renderizando Encerramento Oficial...")
    outro_frames = 90
    for f in range(outro_frames):
        frame = create_outro_frame(f, outro_frames)
        out.write(frame)

    out.release()
    t1 = time.time()
    print(f"Vídeo gravado com sucesso em {out_path} em {t1 - t0:.2f} segundos!")

    shutil.copyfile(out_path, artifact_path)
    shutil.copyfile(out_path, public_path)
    print(f"Vídeo copiado para {artifact_path} e {public_path}!")

if __name__ == "__main__":
    main()
