const SEED_CHECKLIST_ITEMS = {
    router: [
        '[Operador] Verificar fixação e nivelamento do material na mesa (vácuo ou garras)',
        '[Operador] Inspecionar desgaste da fresa — fresas cegas causam rebarba e vibração',
        '[Operador] Efetuar referenciamento nos três eixos (Zero XY e Z-Probe)',
        '[Operador] Ligar exaustor/coletor de pó antes do início da usinagem',
        '[Operador] Limpar e lubrificar cremalheiras e fusos de esferas com óleo recomendado',
        '[Encarregado] 👔 AUDITORIA: Conferir espessura real do lote de chapas com paquímetro antes de liberar a usinagem',
        '[Encarregado] 👔 SEGURANÇA: Auditar uso obrigatório de óculos de proteção, protetor auricular e calçado fechado do operador',
        '[Encarregado] 👔 VALIDAÇÃO: Conferir se o diâmetro e tipo da fresa instalada confere exatamente com a O.S.',
        '[Encarregado] 👔 VÁCUO: Verificar manômetro da bomba de vácuo (Mínimo -0.7 a -0.8 bar) para retenção total da chapa',
        '[Encarregado] 👔 LIBERAÇÃO: Inspecionar dimensões X/Y e esquadro da 1ª peça cortada antes de autorizar lote'
    ],
    router1: [
        '[Operador] Nível de óleo do Spindle e lubrificação das guias lineares',
        '[Operador] Limpeza das calhas, mesa de alumínio e duto de sucção de cavacos',
        '[Operador] Pressão do ar comprimido da linha (Mínimo 6 bar / 87 PSI)',
        '[Operador] Verificação e aperto do porta-ferramentas / pinça ER32',
        '[Operador] Teste do botão de parada de emergência do painel',
        '[Operador] Conferência do ponto de zero peça (X0, Y0, Z0)',
        '[Encarregado] 👔 AUDITORIA: Conferir espessura real do lote de chapas com paquímetro antes de liberar a usinagem',
        '[Encarregado] 👔 SEGURANÇA: Auditar uso de EPIs e organização da bancada de trabalho',
        '[Encarregado] 👔 LIBERAÇÃO: Inspecionar dimensões X/Y e acabamento da 1ª peça cortada'
    ],
    router2: [
        '[Operador] Inspeção do nível de água do reservatório / Chiller do Spindle',
        '[Operador] Verificação visual de folga e sujeira nos eixos X, Y e Z',
        '[Operador] Limpeza geral da caixa de resíduos e exaustor',
        '[Operador] Verificação de funcionamento dos sensores de fim de curso (homing)',
        '[Operador] Checagem do estado físico da fresa instalada',
        '[Encarregado] 👔 AUDITORIA: Conferir alinhamento da mesa e fixação da chapa',
        '[Encarregado] 👔 LIBERAÇÃO: Validar parâmetros de corte da O.S. (Feed rate & Spindle RPM)'
    ],
    laser: [
        '[Operador] Limpar a lente focal e espelhos defletores (álcool isopropílico + lenço óptico)',
        '[Operador] Verificar temperatura do Chiller — ideal entre 18°C e 22°C',
        '[Operador] Ligar exaustor e testar sucção da colmeia/mesa de corte',
        '[Operador] Testar fluxo do gás de assistência (Air Assist) antes de iniciar',
        '[Operador] Inspecionar trilhos lineares quanto a acúmulo de fuligem e resíduos',
        '[Encarregado] 👔 ANTI-INCÊNDIO: Checar extintor de incêndio CO2/Pó Químico carregado e desobstruído ao lado do laser',
        '[Encarregado] 👔 ALINHAMENTO: Realizar teste de pulso (Beam Alignment) nos 4 cantos da mesa para focar potência do tubo',
        '[Encarregado] 👔 TRIAGEM: Auditar lote de material liberado garantindo que NENHUM plástico tóxico (ex: PVC) vá para o laser',
        '[Encarregado] 👔 REFRIGERAÇÃO: Testar sensor de travamento automático do Chiller e conferir nível de água desmineralizada',
        '[Encarregado] 👔 QUALIDADE: Validar transparência do canto da 1ª peça cortada (sem ranhuras ou queima)'
    ],
    vacuo: [
        '[Operador] Inspecionar borrachas de vedação da moldura de aperto (evita perda de sucção)',
        '[Operador] Ligar resistências e verificar aquecimento uniforme da chapa plástica',
        '[Operador] Confirmar nível de óleo da bomba de vácuo (visor de nível)',
        '[Operador] Limpar moldes de resina/MDF, retirando rebarbas e poeiras do ciclo anterior',
        '[Encarregado] 👔 GABARITO & MOLDE: Verificar se o molde possui ângulos de saída suficientes (draft angle) e alívio de ar',
        '[Encarregado] 👔 PULMÃO DE VÁCUO: Checar pressão negativa acumulada no reservatório para sucção de impacto perfeita',
        '[Encarregado] 👔 TEMPERATURA & TEMPO: Auditar pirômetro infravermelho e tempo de forno para o polímero (PSAI/PETG/ABS)',
        '[Encarregado] 👔 PROTEÇÃO PNEUMÁTICA: Validar funcionamento do acionamento bimanual e travas de segurança da mesa pneumática',
        '[Encarregado] 👔 INSPEÇÃO DE ESTICAMENTO: Inspecionar 1ª peça moldada garantindo que não haja afinamento crítico nem bolhas'
    ],
    impressao3d: [
        '[Operador] Verificar nivelamento da mesa de impressão (Bed Leveling manual ou automático)',
        '[Operador] Limpar a mesa com álcool isopropílico para adesão correta da primeira camada',
        '[Operador] Inspecionar bico (nozzle) por resíduos e entupimentos de filamento queimado',
        '[Operador] Confirmar que os filamentos estão armazenados em ambiente seco (caixa selada ou estufa)',
        '[Encarregado] 👔 FATIAMENTO & INFILL: Validar no arquivo fatiado a densidade de preenchimento (Infill %) e suportes da O.S.',
        '[Encarregado] 👔 DESUMIDIFICAÇÃO: Auditar se os carretéis de filamento (PLA/PETG/ABS) estão no desumidificador com sílica',
        '[Encarregado] 👔 PRIMEIRA CAMADA: Inspecionar a adesão e o Z-Offset da 1ª camada antes de liberar para execução longa',
        '[Encarregado] 👔 LAVAGEM E CURA (SLA): Auditar tempos de banho de IPA e câmara de cura UV para peças em resina'
    ],
    encarregado_geral: [
        '[Encarregado] 👔 PRESENÇA DA EQUIPE: Auditar no sistema se todos os operadores estão com status correto (Na Fábrica, Almoço, Externo, Limpeza)',
        '[Encarregado] 👔 COMPRESSOR DE AR: Drenar purgadores de água condensada dos compressores e conferir pressão da linha (6 a 8 bar)',
        '[Encarregado] 👔 SEGURANÇA 5S: Realizar ronda nas bancadas garantindo corredores limpos, saídas livres e ferramentas organizadas',
        '[Encarregado] 👔 QUADRO KANBAN: Auditar Ordens de Serviço prioritárias do dia e resolver gargalos/bloqueios com a produção',
        '[Encarregado] 👔 QUADRO ELÉTRICO: Checar temperatura e ausência de aquecimento nos disjuntores e nobreaks das CNCs',
        '[Encarregado] 👔 REUSO DE MATÉRIA-PRIMA: Inspecionar área de descarte e garantir reaproveitamento inteligente de sobras de chapas'
    ],
    geral: [
        '[Operador] Uso obrigatório de EPIs (Óculos de proteção, protetor auricular e calçado)',
        '[Operador] Conferência da lista de Ordens de Serviço (O.S.) prioritárias do dia',
        '[Operador] Organização da área de estoque de materiais (chapas MDF, ACM e Isopor)',
        '[Operador] Descarte correto de retalhos e limpeza da bancada ao final do turno',
        '[Encarregado] 👔 AUDITORIA DE SEGURANÇA: Passagem geral de segurança e liberação do turno'
    ],
    qualidade: [
        '[Operador] Medição dimensional da primeira peça cortada com paquímetro',
        '[Operador] Verificação de rebarbas nos cantos inferiores do material',
        '[Operador] Inspeção visual da superfície de acabamento e riscos',
        '[Encarregado] 👔 LAUDO DE QUALIDADE: Assinatura de conformidade do lote de produção'
    ]
};

module.exports = { SEED_CHECKLIST_ITEMS };
