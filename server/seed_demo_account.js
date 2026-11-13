const { Pool } = require('pg');
require('dotenv').config({ path: 'server/.env' });
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function seedDemo() {
  console.log('--- INICIANDO SEEDING COMPLETO DA CONTA DEMO (userId = 3) ---');
  const demoId = 3;

  // 1. Atualizar Usuário Demo
  console.log('1. Atualizando perfil demo...');
  await pool.query(`
    UPDATE users SET
      plan = 'business',
      role = 'admin',
      company_role = 'gerente',
      payment_status = 'active',
      trial_expiry = '2028-01-01',
      company_legal_name = 'MACH3 TRACKER INDUSTRIAL LTDA',
      cnpj_cpf = '34.892.114/0001-75',
      billing_email = 'financeiro@mach3tracker.com',
      plan_renewal = '2026-11-15',
      theme = 'Escuro',
      daily_report = true,
      idle_alert = true,
      weekly_report = true,
      report_email = 'demo@mach3tracker.com',
      gerente_pin = '1234',
      supervisor_pin = '5678',
      "costPerHour" = 75.0,
      "plannedHours" = 8,
      company_logo = NULL
    WHERE id = $1
  `, [demoId]);

  // 2. Garantir 4 Máquinas
  console.log('2. Atualizando máquinas...');
  await pool.query('DELETE FROM routers WHERE "userId" = $1', [demoId]);
  
  const r1 = (await pool.query(`
    INSERT INTO routers (name, status, status_note, "userId", operator_name)
    VALUES ('CNC Router Central 1325', 'active', 'Cortando em alta velocidade', $1, 'Tomás')
    RETURNING id
  `, [demoId])).rows[0].id;

  const r2 = (await pool.query(`
    INSERT INTO routers (name, status, status_note, "userId", operator_name)
    VALUES ('Router 2 (Precisão)', 'active', 'Pronta para usinagem', $1, 'Lucas')
    RETURNING id
  `, [demoId])).rows[0].id;

  const r3 = (await pool.query(`
    INSERT INTO routers (name, status, status_note, "userId", operator_name)
    VALUES ('Laser Ruida CO2 1390', 'active', 'Online (IP 192.168.0.174)', $1, 'Carlos')
    RETURNING id
  `, [demoId])).rows[0].id;

  const r4 = (await pool.query(`
    INSERT INTO routers (name, status, status_note, "userId", operator_name)
    VALUES ('Máquina a Vácuo Industrial', 'active', 'Aquecimento e vácuo calibrados', $1, 'Marcos')
    RETURNING id
  `, [demoId])).rows[0].id;

  // 3. Garantir Operadores
  console.log('3. Atualizando operadores...');
  await pool.query('DELETE FROM operators WHERE "userId" = $1', [demoId]);
  
  const op1 = (await pool.query(`
    INSERT INTO operators (name, shift, "userId", status, location)
    VALUES ('Tomás', 'Manhã', $1, 'disponivel', '⚙️ CNC Router Central 1325')
    RETURNING id
  `, [demoId])).rows[0].id;

  const op2 = (await pool.query(`
    INSERT INTO operators (name, shift, "userId", status, location)
    VALUES ('Lucas', 'Manhã', $1, 'disponivel', '⚙️ Router 2 (Precisão)')
    RETURNING id
  `, [demoId])).rows[0].id;

  const op3 = (await pool.query(`
    INSERT INTO operators (name, shift, "userId", status, location)
    VALUES ('Carlos', 'Tarde', $1, 'almoco', 'Horário de Almoço')
    RETURNING id
  `, [demoId])).rows[0].id;

  const op4 = (await pool.query(`
    INSERT INTO operators (name, shift, "userId", status, location)
    VALUES ('Marcos', 'Geral', $1, 'limpeza', 'Limpeza do Setor')
    RETURNING id
  `, [demoId])).rows[0].id;

  const op5 = (await pool.query(`
    INSERT INTO operators (name, shift, "userId", status, location)
    VALUES ('Gabriel', 'Noite', $1, 'externo', 'Serviço Externo (Instalação)')
    RETURNING id
  `, [demoId])).rows[0].id;

  // 4. Materiais
  console.log('4. Atualizando materiais...');
  await pool.query('DELETE FROM materials WHERE "userId" = $1', [demoId]);
  
  const mats = [
    { name: 'ACM Prata 3mm', price: 210, feed: 4000, w: 1220, h: 2440 },
    { name: 'Acrílico Cristal 4mm', price: 185, feed: 2500, w: 2000, h: 1000 },
    { name: 'MDF Cru 15mm', price: 130, feed: 3500, w: 2750, h: 1850 },
    { name: 'PVC Expandido 10mm', price: 155, feed: 3000, w: 2000, h: 1000 },
    { name: 'Isopor T5 Alta Densidade', price: 85, feed: 6000, w: 2000, h: 1000 },
    { name: 'Chapa Inox 304 1.2mm', price: 380, feed: 1800, w: 1250, h: 2500 }
  ];

  for (const m of mats) {
    await pool.query(`
      INSERT INTO materials (name, price, feed_rate, pass_width, sheet_width_mm, sheet_height_mm, "userId")
      VALUES ($1, $2, $3, 100, $4, $5, $6)
    `, [m.name, m.price, m.feed, m.w, m.h, demoId]);
  }

  // 5. Linha do Tempo da Equipe Hoje (Timesheet)
  console.log('5. Atualizando Linha do Tempo Diária (operator_time_logs)...');
  await pool.query('DELETE FROM operator_time_logs WHERE "userId" = $1', [demoId]);
  
  // Helper to create timestamp for today
  const timeToday = (h, m) => {
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  };

  const logs = [
    // Tomás
    { opId: op1, name: 'Tomás', st: 'disponivel', loc: 'Na Fábrica', title: 'Setup e Inspeção de Fresa', start: timeToday(8, 0), end: timeToday(8, 30), dur: 30.0 },
    { opId: op1, name: 'Tomás', st: 'disponivel', loc: '⚙️ CNC Router Central 1325', title: '2668A - Painel Ripada Royal.tap', start: timeToday(8, 30), end: timeToday(10, 15), dur: 105.0 },
    { opId: op1, name: 'Tomás', st: 'disponivel', loc: 'Na Fábrica', title: 'Troca de Chapa ACM', start: timeToday(10, 15), end: timeToday(10, 40), dur: 25.0 },
    { opId: op1, name: 'Tomás', st: 'disponivel', loc: '⚙️ CNC Router Central 1325', title: 'PAINEL_FACHADA_ROYAL_ACM.TAP', start: timeToday(10, 40), end: null, dur: null },

    // Lucas
    { opId: op2, name: 'Lucas', st: 'disponivel', loc: 'Na Fábrica', title: 'Conferência de O.S.', start: timeToday(8, 15), end: timeToday(8, 50), dur: 35.0 },
    { opId: op2, name: 'Lucas', st: 'disponivel', loc: '⚙️ Router 2 (Precisão)', title: '2665B - Molde Termoformagem.tap', start: timeToday(8, 50), end: timeToday(11, 20), dur: 150.0 },
    { opId: op2, name: 'Lucas', st: 'disponivel', loc: '⚙️ Router 2 (Precisão)', title: '2670A - Totem Iluminado ACM.tap', start: timeToday(13, 0), end: null, dur: null },

    // Carlos
    { opId: op3, name: 'Carlos', st: 'disponivel', loc: '⚙️ Laser Ruida CO2 1390', title: 'LETRAS_ACRILICO_FARMACIA.cdr', start: timeToday(9, 0), end: timeToday(11, 45), dur: 165.0 },
    { opId: op3, name: 'Carlos', st: 'almoco', loc: 'Horário de Almoço', title: '🍱 Intervalo de Almoço', start: timeToday(12, 0), end: null, dur: null },

    // Marcos
    { opId: op4, name: 'Marcos', st: 'disponivel', loc: '⚙️ Máquina a Vácuo Industrial', title: 'Moldagem Bandejas PS 2mm', start: timeToday(8, 0), end: timeToday(11, 30), dur: 210.0 },
    { opId: op4, name: 'Marcos', st: 'limpeza', loc: 'Limpeza do Setor', title: '🧹 Limpeza de Cavacos e Oficina', start: timeToday(13, 30), end: null, dur: null },

    // Gabriel
    { opId: op5, name: 'Gabriel', st: 'externo', loc: 'Serviço Externo (Instalação)', title: '🟡 Montagem Letra Caixa Fachada', start: timeToday(14, 0), end: null, dur: null }
  ];

  for (const l of logs) {
    await pool.query(`
      INSERT INTO operator_time_logs (
        "userId", operator_id, operator_name, status, location, kanban_title, start_time, end_time, duration_minutes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [demoId, l.opId, l.name, l.st, l.loc, l.title, l.start, l.end, l.dur]);
  }

  // 6. Manutenção Preventiva & Alertas
  console.log('6. Atualizando Manutenção Preventiva (maintenance_schedule)...');
  await pool.query('DELETE FROM maintenance_schedule WHERE "userId" = $1', [demoId]);

  await pool.query(`
    INSERT INTO maintenance_schedule (
      "userId", router_id, router_name, description, technician, scheduled_date, scheduled_time, type, status, parts_replaced
    ) VALUES 
      ($1, $2, 'CNC Router Central 1325', 'Lubrificação das Guias Lineares e Fusos de Esferas', 'Carlos Silva', CURRENT_DATE - INTERVAL '1 day', '09:00:00', 'preventive', 'pending', 'Graxa de Lítio EP-2'),
      ($1, $3, 'Laser Ruida CO2 1390', 'Troca de Fluido e Inspeção do Chiller Industrial CW-5200', 'Refrigeração Express', CURRENT_DATE + INTERVAL '5 days', '14:30:00', 'preventive', 'pending', 'Fluido Térmico Deionizado'),
      ($1, $4, 'Máquina a Vácuo Industrial', 'Limpeza dos Filtros e Troca de Óleo da Bomba de Vácuo', 'Equipe Técnica', CURRENT_DATE + INTERVAL '12 days', '10:00:00', 'preventive', 'pending', 'Óleo Sintético ISO 68'),
      ($1, $5, 'Router 2 (Precisão)', 'Substituição de Pinça ER20 e Porca de Travamento', 'Tomás', CURRENT_DATE - INTERVAL '15 days', '11:00:00', 'corrective', 'completed', 'Pinça 6mm e Porca Balanceada')
  `, [demoId, r1, r3, r4, r2]);

  // 7. Kanban Tasks
  console.log('7. Atualizando Kanban...');
  await pool.query('DELETE FROM kanban_tasks WHERE "userId" = $1', [demoId]);

  const kanbanItems = [
    { title: '2670A - Totem Iluminado ACM 4mm', machine: 'CNC Router Central 1325', op: 'Tomás', prio: 'urgente', col: 'todo', est: 45 },
    { title: '2671B - Letras Bloco Acrílico 20mm', machine: 'Laser Ruida CO2 1390', op: 'Carlos', prio: 'alta', col: 'todo', est: 30 },
    { title: '2672C - Gabarito de Furação MDF 15mm', machine: 'Router 2 (Precisão)', op: 'Lucas', prio: 'media', col: 'todo', est: 25 },
    { title: 'PAINEL_FACHADA_ROYAL_ACM.TAP', machine: 'CNC Router Central 1325', op: 'Tomás', prio: 'urgente', col: 'in_progress', est: 40 },
    { title: '2665B - Molde Termoformagem PS 2mm', machine: 'Máquina a Vácuo Industrial', op: 'Marcos', prio: 'alta', col: 'in_progress', est: 50 },
    { title: '2660A - Fachada Letra Caixa Inox', machine: 'Router 2 (Precisão)', op: 'Lucas', prio: 'alta', col: 'done', est: 65 },
    { title: '2655C - Painel Decorativo MDF Vazado', machine: 'CNC Router Central 1325', op: 'Tomás', prio: 'media', col: 'done', est: 35 },
    { title: '2652B - Letras Farmácia Acrílico 3mm', machine: 'Laser Ruida CO2 1390', op: 'Carlos', prio: 'alta', col: 'done', est: 28 }
  ];

  for (const k of kanbanItems) {
    await pool.query(`
      INSERT INTO kanban_tasks (title, machine, operator, date, priority, column_id, "userId", estimated_minutes)
      VALUES ($1, $2, $3, CURRENT_DATE, $4, $5, $6, $7)
    `, [k.title, k.machine, k.op, k.prio, k.col, demoId, k.est]);
  }

  // 8. Jobs History (Active Cut + Realistic Historical Jobs)
  console.log('8. Atualizando Jobs de Produção...');
  await pool.query('DELETE FROM jobs WHERE "userId" = $1', [demoId]);

  // Active cutting job on CNC Router Central 1325
  const activeJobStart = new Date(Date.now() - 24 * 60000);
  await pool.query(`
    INSERT INTO jobs (
      file_name, folder, file_path, start_time, end_time, duration_minutes,
      day, month, year, "userId", material_name, material_price, router_name,
      estimated_minutes, max_x, max_y, bounding_area_m2, operator_name, quantity
    ) VALUES (
      'PAINEL_FACHADA_ROYAL_ACM.TAP', '2660A - FACHADA SHOPPING', 'C:\\CNC_JOBS\\2660A\\PAINEL_FACHADA_ROYAL_ACM.TAP',
      $1, NULL, 24.5,
      EXTRACT(DAY FROM CURRENT_DATE), EXTRACT(MONTH FROM CURRENT_DATE), EXTRACT(YEAR FROM CURRENT_DATE),
      $2, 'ACM Prata 3mm', 210, 'CNC Router Central 1325',
      38.0, 2440, 1220, 2.9768, 'Tomás', 1
    )
  `, [activeJobStart.toISOString(), demoId]);

  // Insert 60 historic completed jobs across past 6 months
  const historicTemplates = [
    { file: '18 PVC100MM B12MM.TXT', folder: '2662A - CAPACETE SENNA', mat: 'PVC Expandido 10mm', price: 155, router: 'Router 2 (Precisão)', op: 'Lucas', est: 28, dur: 27.5, x: 1000, y: 1000, area: 1.0 },
    { file: '17 PVC100MM B12MM.TXT', folder: '2662A - CAPACETE SENNA', mat: 'PVC Expandido 10mm', price: 155, router: 'CNC Router Central 1325', op: 'Tomás', est: 32, dur: 31.6, x: 1200, y: 1000, area: 1.2 },
    { file: '16 PVC100MM B12MM.TXT', folder: '2662A - CAPACETE SENNA', mat: 'PVC Expandido 10mm', price: 155, router: 'Router 2 (Precisão)', op: 'Lucas', est: 30, dur: 32.1, x: 1200, y: 1000, area: 1.2 },
    { file: 'PAINEL_RIPADO_MDF_15MM.TAP', folder: '2658 - DECORACAO HOTEL', mat: 'MDF Cru 15mm', price: 130, router: 'CNC Router Central 1325', op: 'Tomás', est: 45, dur: 44.2, x: 2750, y: 1850, area: 5.08 },
    { file: 'LETRAS_LOGO_ACRILICO_CRISTAL.CDR', folder: '2650C - FACHADA LOJA', mat: 'Acrílico Cristal 4mm', price: 185, router: 'Laser Ruida CO2 1390', op: 'Carlos', est: 22, dur: 21.0, x: 1200, y: 600, area: 0.72 },
    { file: 'BANDEJA_VACUUM_FORMING_PS.DXF', folder: '2645 - EMBALAGENS', mat: 'PVC Expandido 10mm', price: 155, router: 'Máquina a Vácuo Industrial', op: 'Marcos', est: 15, dur: 14.8, x: 800, y: 600, area: 0.48 },
    { file: 'RECORTE_INOX_LETRA_CAIXA.TAP', folder: '2639 - ADVOCACIA VIP', mat: 'Chapa Inox 304 1.2mm', price: 380, router: 'Router 2 (Precisão)', op: 'Lucas', est: 55, dur: 58.4, x: 1250, y: 1000, area: 1.25 }
  ];

  for (let i = 1; i <= 60; i++) {
    const t = historicTemplates[i % historicTemplates.length];
    // Spread over past 150 days
    const daysAgo = Math.floor((i / 60) * 150);
    const jobDate = new Date(Date.now() - daysAgo * 86400000 - Math.random() * 36000000);
    const durMin = parseFloat((t.dur * (0.9 + Math.random() * 0.2)).toFixed(1));
    const jobEnd = new Date(jobDate.getTime() + durMin * 60000);

    await pool.query(`
      INSERT INTO jobs (
        file_name, folder, file_path, start_time, end_time, duration_minutes,
        day, month, year, "userId", material_name, material_price, router_name,
        estimated_minutes, max_x, max_y, bounding_area_m2, operator_name, quantity
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12, $13,
        $14, $15, $16, $17, $18, 1
      )
    `, [
      t.file, t.folder, `C:\\CNC_JOBS\\${t.file}`,
      jobDate.toISOString(), jobEnd.toISOString(), durMin,
      jobDate.getDate(), jobDate.getMonth() + 1, jobDate.getFullYear(), demoId,
      t.mat, t.price, t.router,
      t.est, t.x, t.y, t.area, t.op
    ]);
  }

  console.log('--- SEEDING CONCLUÍDO COM SUCESSO PARA CONTA DEMO! ---');
  await pool.end();
}

seedDemo().catch(console.error);
