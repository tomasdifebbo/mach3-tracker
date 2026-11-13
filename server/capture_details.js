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
  console.log('Conectado via CDP para capturas detalhadas!');
  
  const outputDir = 'C:\\DASHBOARD\\video_assets';

  async function evalJs(expr) {
    const res = await send('Runtime.evaluate', {
      expression: expr,
      returnByValue: true
    });
    return res.result ? res.result.value : null;
  }

  // 1. Close modal if open
  await evalJs(`(() => {
    const backdrop = document.querySelector('.fixed.inset-0 .bg-black\\\\/80');
    if (backdrop) backdrop.click();
  })()`);
  await wait(500);

  // 2. Operador scrolled to timesheet
  console.log('Capturando timesheet do Operador...');
  await evalJs(`(() => {
    const btns = Array.from(document.querySelectorAll('aside button, nav button, button'));
    const btn = btns.find(b => b.innerText.trim().startsWith('Operador'));
    if (btn) btn.click();
  })()`);
  await wait(1000);
  await evalJs(`(() => {
    const scrollContainer = document.querySelector('main > div.overflow-y-auto') || window;
    scrollContainer.scrollTop = 380;
  })()`);
  await wait(800);
  let shot = await send('Page.captureScreenshot', { format: 'png' });
  if (shot.result && shot.result.data) {
    fs.writeFileSync(path.join(outputDir, 'clean_operador_timesheet.png'), Buffer.from(shot.result.data, 'base64'));
    console.log('Salvo: clean_operador_timesheet.png');
  }

  // 3. Encarregado Kanban
  console.log('Capturando Kanban do Encarregado...');
  await evalJs(`(() => {
    const btns = Array.from(document.querySelectorAll('aside button, nav button, button'));
    const btn = btns.find(b => b.innerText.trim().startsWith('Encarregado'));
    if (btn) btn.click();
  })()`);
  await wait(1000);
  await evalJs(`(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const kanbanBtn = btns.find(b => b.innerText.includes('Painel Kanban'));
    if (kanbanBtn) kanbanBtn.click();
  })()`);
  await wait(800);
  shot = await send('Page.captureScreenshot', { format: 'png' });
  if (shot.result && shot.result.data) {
    fs.writeFileSync(path.join(outputDir, 'clean_encarregado_kanban.png'), Buffer.from(shot.result.data, 'base64'));
    console.log('Salvo: clean_encarregado_kanban.png');
  }

  // 4. Settings Automação de Relatórios
  console.log('Capturando Settings Automação...');
  await evalJs(`(() => {
    const btns = Array.from(document.querySelectorAll('aside button, nav button, button'));
    const btn = btns.find(b => b.innerText.trim().startsWith('Configurações'));
    if (btn) btn.click();
  })()`);
  await wait(1000);
  await evalJs(`(() => {
    const scrollContainer = document.querySelector('main > div.overflow-y-auto') || window;
    scrollContainer.scrollTop = 700;
  })()`);
  await wait(800);
  shot = await send('Page.captureScreenshot', { format: 'png' });
  if (shot.result && shot.result.data) {
    fs.writeFileSync(path.join(outputDir, 'clean_settings_reports.png'), Buffer.from(shot.result.data, 'base64'));
    console.log('Salvo: clean_settings_reports.png');
  }

  // 5. Settings Níveis de Acesso
  console.log('Capturando Settings Níveis de Acesso...');
  await evalJs(`(() => {
    const scrollContainer = document.querySelector('main > div.overflow-y-auto') || window;
    scrollContainer.scrollTop = 1200;
  })()`);
  await wait(800);
  shot = await send('Page.captureScreenshot', { format: 'png' });
  if (shot.result && shot.result.data) {
    fs.writeFileSync(path.join(outputDir, 'clean_settings_pins.png'), Buffer.from(shot.result.data, 'base64'));
    console.log('Salvo: clean_settings_pins.png');
  }

  console.log('Capturas detalhadas concluídas!');
  ws.close();
}

run().catch(console.error);
