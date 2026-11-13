const fs = require('fs');
const path = require('path');

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  const resp = await fetch('http://localhost:9222/json');
  const tabs = await resp.json();
  const pageTab = tabs.find(t => t.type === 'page' && t.url.includes('mach3tracker'));
  
  if (!pageTab) {
    console.error('Aba não encontrada!');
    return;
  }
  
  const ws = new WebSocket(pageTab.webSocketDebuggerUrl);
  let msgId = 1;
  const pending = new Map();
  
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.id && pending.has(data.id)) {
      pending.get(data.id)(data);
      pending.delete(data.id);
    }
  };
  
  function send(method, params = {}) {
    return new Promise((resolve) => {
      const id = msgId++;
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }
  
  await new Promise(r => ws.onopen = r);
  console.log('Conectado via CDP para capturas completas da conta DEMO!');
  
  // Set 1920x1080 viewport
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    mobile: false
  });

  const outputDir = 'C:\\DASHBOARD\\video_assets_demo';
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  async function evalJs(expr) {
    const res = await send('Runtime.evaluate', {
      expression: expr,
      returnByValue: true
    });
    return res.result ? res.result.value : null;
  }

  // 1. Fechar modal se estiver aberto
  await evalJs(`(() => {
    const backdrop = document.querySelector('.fixed.inset-0 .bg-black\\\\/80');
    if (backdrop) backdrop.click();
  })()`);
  await wait(500);

  // Helper de captura
  async function capture(fileName) {
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
      mobile: false
    });
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    if (shot.result && shot.result.data) {
      fs.writeFileSync(path.join(outputDir, fileName), Buffer.from(shot.result.data, 'base64'));
      console.log(`Salvo: ${fileName}`);
    }
  }

  // 2. Capturar Páginas Limpas Principais
  const sections = [
    { name: 'dashboard', label: 'Dashboard' },
    { name: 'operador', label: 'Operador' },
    { name: 'encarregado', label: 'Encarregado' },
    { name: 'jobs', label: 'Histórico' },
    { name: 'charts', label: 'Gráficos' },
    { name: 'materials', label: 'Materiais' },
    { name: 'maintenance', label: 'Manutenção' },
    { name: 'settings', label: 'Configurações' }
  ];

  for (const sec of sections) {
    console.log(`Navegando para: ${sec.label}...`);
    await evalJs(`(() => {
      const btns = Array.from(document.querySelectorAll('aside button, nav button, button'));
      const btn = btns.find(b => b.innerText.trim().startsWith('${sec.label}'));
      if (btn) btn.click();
    })()`);
    await wait(1200);
    await capture(`clean_${sec.name}.png`);
  }

  // 3. Capturas Detalhadas (scrolled/views)
  // Operador Timesheet (scroll down)
  console.log('Capturando timesheet do Operador (demo)...');
  await evalJs(`(() => {
    const btns = Array.from(document.querySelectorAll('aside button, nav button, button'));
    const btn = btns.find(b => b.innerText.trim().startsWith('Operador'));
    if (btn) btn.click();
  })()`);
  await wait(800);
  await evalJs(`(() => {
    const scrollContainer = document.querySelector('main > div.overflow-y-auto') || window;
    scrollContainer.scrollTop = 380;
  })()`);
  await wait(800);
  await capture('clean_operador_timesheet.png');

  // Encarregado Kanban
  console.log('Capturando Kanban do Encarregado (demo)...');
  await evalJs(`(() => {
    const btns = Array.from(document.querySelectorAll('aside button, nav button, button'));
    const btn = btns.find(b => b.innerText.trim().startsWith('Encarregado'));
    if (btn) btn.click();
  })()`);
  await wait(800);
  await evalJs(`(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const kanbanBtn = btns.find(b => b.innerText.includes('Painel Kanban'));
    if (kanbanBtn) kanbanBtn.click();
  })()`);
  await wait(800);
  await capture('clean_encarregado_kanban.png');

  // Settings Automação de Relatórios
  console.log('Capturando Configurações Automação (demo)...');
  await evalJs(`(() => {
    const btns = Array.from(document.querySelectorAll('aside button, nav button, button'));
    const btn = btns.find(b => b.innerText.trim().startsWith('Configurações'));
    if (btn) btn.click();
  })()`);
  await wait(800);
  await evalJs(`(() => {
    const scrollContainer = document.querySelector('main > div.overflow-y-auto') || window;
    scrollContainer.scrollTop = 700;
  })()`);
  await wait(800);
  await capture('clean_settings_reports.png');

  // Settings Níveis de Acesso
  console.log('Capturando Configurações Níveis de Acesso (demo)...');
  await evalJs(`(() => {
    const scrollContainer = document.querySelector('main > div.overflow-y-auto') || window;
    scrollContainer.scrollTop = 1200;
  })()`);
  await wait(800);
  await capture('clean_settings_pins.png');

  // Reset scroll
  await evalJs(`(() => {
    const scrollContainer = document.querySelector('main > div.overflow-y-auto') || window;
    scrollContainer.scrollTop = 0;
  })()`);
  await wait(500);

  // 4. Abrir Guia de Apresentação e capturar as 11 etapas
  console.log('Abrindo Guia de Apresentação (demo)...');
  await evalJs(`(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const btn = btns.find(b => b.innerText.includes('Guia de Apresentação'));
    if (btn) btn.click();
  })()`);
  await wait(1000);

  for (let step = 1; step <= 11; step++) {
    console.log(`Selecionando Etapa ${step} de 11 (demo)...`);
    await evalJs(`(() => {
      const modal = document.querySelector('.fixed.inset-0');
      if (!modal) return false;
      const stepBtns = Array.from(modal.querySelectorAll('button')).filter(b => b.innerText.trim() === '${step}');
      if (stepBtns.length > 0) {
        stepBtns[0].click();
        return true;
      }
      return false;
    })()`);
    await wait(1000);
    await capture(`step_${step}.png`);
  }

  console.log('Todas as capturas da conta DEMO finalizadas com sucesso!');
  ws.close();
}

run().catch(console.error);
