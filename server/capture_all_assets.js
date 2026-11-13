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
  console.log('Conectado via CDP!');
  
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    mobile: false
  });
  
  const outputDir = 'C:\\DASHBOARD\\video_assets';
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Helper to evaluate JS and return value
  async function evalJs(expr) {
    const res = await send('Runtime.evaluate', {
      expression: expr,
      returnByValue: true
    });
    return res.result ? res.result.value : null;
  }

  // 1. Close modal if open
  console.log('Fechando modal se estiver aberto...');
  await evalJs(`(() => {
    const closeBtn = document.querySelector('.fixed.inset-0 button');
    // or backdrop
    const backdrop = document.querySelector('.fixed.inset-0 .bg-black\\\\/80');
    if (backdrop) backdrop.click();
  })()`);
  await wait(500);

  // 2. Sections to capture clean
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

  console.log('Capturando páginas limpas (sem modal)...');
  for (const sec of sections) {
    console.log(`Navegando para: ${sec.label}...`);
    // Click the sidebar button corresponding to sec.label
    await evalJs(`(() => {
      const btns = Array.from(document.querySelectorAll('aside button, nav button, button'));
      const btn = btns.find(b => b.innerText.trim().startsWith('${sec.label}'));
      if (btn) btn.click();
    })()`);
    
    await wait(1200); // wait for data render
    
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    if (shot.result && shot.result.data) {
      const filePath = path.join(outputDir, `clean_${sec.name}.png`);
      fs.writeFileSync(filePath, Buffer.from(shot.result.data, 'base64'));
      console.log(`Salvo: clean_${sec.name}.png`);
    }
  }

  // 3. Open DemoTourModal
  console.log('Abrindo Guia de Apresentação...');
  await evalJs(`(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const btn = btns.find(b => b.innerText.includes('Guia de Apresentação'));
    if (btn) btn.click();
  })()`);
  await wait(1000);

  // 4. Capture each of the 11 steps of the tour modal
  console.log('Capturando as 11 etapas do Guia de Apresentação...');
  for (let step = 1; step <= 11; step++) {
    console.log(`Selecionando Etapa ${step} de 11...`);
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
    
    await wait(1000); // wait for step transition & background section update
    
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    if (shot.result && shot.result.data) {
      const filePath = path.join(outputDir, `step_${step}.png`);
      fs.writeFileSync(filePath, Buffer.from(shot.result.data, 'base64'));
      console.log(`Salvo: step_${step}.png`);
    }
  }

  console.log('Todas as capturas finalizadas com sucesso!');
  ws.close();
}

run().catch(console.error);
