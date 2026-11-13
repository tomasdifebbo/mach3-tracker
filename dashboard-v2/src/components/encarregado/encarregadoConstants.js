export const DAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
export const DAYS_SHORT = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

export const MACHINE_CHECKLISTS = {
  router_central: {
    label: '🔩 Router Central',
    title: 'Router Central — Setup Operacional & Auditoria do Encarregado',
    supply: 'Fresas retas, fresas de acabamento, pontas de gravação, pinças ER sobressalentes.',
    items: [
      '[Operador] Verificar fixação e nivelamento do material na mesa (vácuo ou garras).',
      '[Operador] Inspecionar desgaste da fresa — fresas cegas causam rebarba e vibração.',
      '[Operador] Efetuar referenciamento nos três eixos (Zero XY e Z-Probe).',
      '[Operador] Ligar exaustor/coletor de pó antes do início da usinagem.',
      '[Operador] Limpar e lubrificar cremalheiras e fusos de esferas com óleo recomendado.',
      '[Encarregado] 👔 AUDITORIA: Conferir espessura real do lote de chapas com paquímetro antes de liberar a usinagem.',
      '[Encarregado] 👔 SEGURANÇA: Auditar uso obrigatório de óculos de proteção, protetor auricular e calçado fechado do operador.',
      '[Encarregado] 👔 VALIDAÇÃO: Conferir se o diâmetro e tipo da fresa instalada confere exatamente com a O.S.',
      '[Encarregado] 👔 VÁCUO: Verificar manômetro da bomba de vácuo (Mínimo -0.7 a -0.8 bar) para retenção total da chapa.',
      '[Encarregado] 👔 LIBERAÇÃO: Inspecionar dimensões X/Y e esquadro da 1ª peça cortada antes de autorizar lote.'
    ]
  },
  router_2: {
    label: '🔩 Router 2',
    title: 'Router 2 — Setup Operacional & Auditoria do Encarregado',
    supply: 'Fresas retas, fresas de acabamento, pontas de gravação, pinças ER sobressalentes.',
    items: [
      '[Operador] Verificar fixação e nivelamento do material na mesa.',
      '[Operador] Inspecionar desgaste da fresa — fresas cegas causam rebarba e vibração.',
      '[Operador] Efetuar referenciamento nos três eixos (Zero XY e Z-Probe).',
      '[Operador] Ligar exaustor/coletor de pó antes do início da usinagem.',
      '[Operador] Limpar e lubrificar guias lineares e fusos.',
      '[Encarregado] 👔 AUDITORIA: Conferir espessura real do material com paquímetro antes de liberar usinagem.',
      '[Encarregado] 👔 SEGURANÇA: Auditar EPI obrigatório do operador.',
      '[Encarregado] 👔 VALIDAÇÃO: Conferir diâmetro e tipo de fresa instalada com a O.S.',
      '[Encarregado] 👔 LIBERAÇÃO: Inspecionar 1ª peça cortada antes de autorizar o restante do lote.'
    ]
  },
  laser: {
    label: '🔴 Laser',
    title: 'Corte a Laser — Setup Operacional & Auditoria do Encarregado',
    supply: 'Lentes de foco ZnSe, espelhos refletores, filtros de carvão ativado.',
    items: [
      '[Operador] Limpar a lente focal e espelhos defletores (álcool isopropílico + lenço óptico).',
      '[Operador] Verificar temperatura do Chiller — ideal entre 18°C e 22°C.',
      '[Operador] Ligar exaustor e testar sucção da colmeia/mesa de corte.',
      '[Operador] Testar fluxo do gás de assistência (Air Assist) antes de iniciar.',
      '[Operador] Inspecionar trilhos lineares quanto a acúmulo de fuligem e resíduos.',
      '[Encarregado] 👔 ANTI-INCÊNDIO: Checar extintor de incêndio CO2/Pó Químico carregado e desobstruído ao lado do laser.',
      '[Encarregado] 👔 ALINHAMENTO: Realizar teste de pulso (Beam Alignment) nos 4 cantos da mesa para focar potência do tubo.',
      '[Encarregado] 👔 TRIAGEM: Auditar lote de material liberado garantindo que NENHUM plástico tóxico (ex: PVC) vá para o laser.',
      '[Encarregado] 👔 REFRIGERAÇÃO: Testar sensor de travamento automático do Chiller e conferir nível de água desmineralizada.',
      '[Encarregado] 👔 QUALIDADE: Validar transparência do canto da 1ª peça cortada (sem ranhuras ou queima).'
    ]
  },
  vacuo: {
    label: '💨 Mesa de Vácuo',
    title: 'Mesa de Vácuo — Setup Operacional & Auditoria do Encarregado',
    supply: 'Chapas PSA, ABS, PETG; resistências sobressalentes; óleo para bomba de vácuo.',
    items: [
      '[Operador] Inspecionar borrachas de vedação da moldura de aperto (evita perda de sucção).',
      '[Operador] Ligar resistências e verificar aquecimento uniforme da chapa plástica.',
      '[Operador] Confirmar nível de óleo da bomba de vácuo (visor de nível).',
      '[Operador] Limpar moldes de resina/MDF, retirando rebarbas e poeiras do ciclo anterior.',
      '[Encarregado] 👔 GABARITO & MOLDE: Verificar se o molde possui ângulos de saída suficientes (draft angle) e alívio de ar.',
      '[Encarregado] 👔 PULMÃO DE VÁCUO: Checar pressão negativa acumulada no reservatório para sucção de impacto perfeita.',
      '[Encarregado] 👔 TEMPERATURA & TEMPO: Auditar pirômetro infravermelho e tempo de forno para o polímero (PSAI/PETG/ABS).',
      '[Encarregado] 👔 PROTEÇÃO PNEUMÁTICA: Validar funcionamento do acionamento bimanual e travas de segurança da mesa pneumática.',
      '[Encarregado] 👔 INSPEÇÃO DE ESTICAMENTO: Inspecionar 1ª peça moldada garantindo que não haja afinamento crítico nem bolhas.'
    ]
  },
  encarregado_geral: {
    label: '👔 Ronda do Encarregado',
    title: 'Ronda Geral da Oficina — Verificações de Liderança do Encarregado',
    supply: 'Manômetros de ar, multímetro, paquímetro digital, prancha de O.S. e checklists.',
    items: [
      '[Encarregado] 👔 PRESENÇA DA EQUIPE: Auditar no sistema se todos os operadores estão com status correto (Na Fábrica, Almoço, Externo, Limpeza).',
      '[Encarregado] 👔 COMPRESSOR DE AR: Drenar purgadores de água condensada dos compressores e conferir pressão da linha (6 a 8 bar).',
      '[Encarregado] 👔 SEGURANÇA 5S: Realizar ronda nas bancadas garantindo corredores limpos, saídas livres e ferramentas organizadas.',
      '[Encarregado] 👔 QUADRO KANBAN: Auditar Ordens de Serviço prioritárias do dia e resolver gargalos/bloqueios com a produção.',
      '[Encarregado] 👔 QUADRO ELÉTRICO: Checar temperatura e ausência de aquecimento nos disjuntores e nobreaks das CNCs.',
      '[Encarregado] 👔 REUSO DE MATÉRIA-PRIMA: Inspecionar área de descarte e garantir reaproveitamento inteligente de sobras de chapas.'
    ]
  }
};
