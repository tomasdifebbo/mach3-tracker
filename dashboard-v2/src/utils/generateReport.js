import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Extracts the clean project name from a folder path
 * using the "After-Router" strategy.
 */
function extractProjectName(folder) {
  const pathParts = (folder || 'Geral').replace(/^Router \d+ \| /, '').split('\\');
  const routerIdx = pathParts.findIndex(p => p.toUpperCase() === 'ROUTER');
  
  if (routerIdx !== -1 && routerIdx < pathParts.length - 1) {
    return pathParts[routerIdx + 1];
  }
  
  const folderOnlyParts = pathParts.filter(p => 
    !p.toUpperCase().includes('.TXT') && 
    !p.toUpperCase().includes('.TAP') && 
    !p.toUpperCase().includes('.NC')
  );
  const cleanPath = folderOnlyParts.join('\\').replace(/^\\\\.*?\\/, '').replace(/^[A-Z]:\\/, '');
  const parts = cleanPath.split('\\').filter(p => {
    const up = p.toUpperCase();
    const isGeneric = up.includes('TOMAS') || up.includes('ARQUIVOS') || up.includes('ROUTER') || 
                      up.includes('ISOPOR') || up.includes('2024') || up.includes('2026') || 
                      up === 'CNC' || up === 'PROGRAMA' || up === 'FILES';
    return p && !isGeneric;
  });
  return parts.length > 0 ? parts[0] : (folderOnlyParts.pop() || 'Producao Geral');
}

/**
 * Formats minutes into HH:MM:SS string
 */
function formatDuration(minutes) {
  if (!minutes || minutes <= 0) return '00:00:00';
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  const s = Math.floor((minutes * 60) % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * Generates a professional PDF production report.
 * 
 * @param {Object} options
 * @param {Array} options.jobs - All job records
 * @param {Object} options.user - User info (for settings like costPerHour)
 * @param {string} options.filterType - 'all', 'today', 'week', 'month', or 'custom'
 * @param {Date} [options.startDate] - Start of custom date range
 * @param {Date} [options.endDate] - End of custom date range
 */
export function generateProductionReport({ jobs = [], user = {}, filterType = 'all', startDate, endDate }) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const now = new Date();
  const costPerHour = user?.settings?.costPerHour || 50;

  // ===== FILTER JOBS =====
  let filtered = [...jobs];
  let periodLabel = 'Historico Completo';

  if (filterType === 'today') {
    filtered = jobs.filter(j => {
      const d = new Date(j.start_time);
      return d.toDateString() === now.toDateString();
    });
    periodLabel = `Hoje - ${now.toLocaleDateString('pt-BR')}`;
  } else if (filterType === 'week') {
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    filtered = jobs.filter(j => new Date(j.start_time) >= weekAgo);
    periodLabel = `Ultimos 7 dias`;
  } else if (filterType === 'month') {
    filtered = jobs.filter(j => {
      const d = new Date(j.start_time);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    periodLabel = `${now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`;
  } else if (filterType === 'custom' && startDate && endDate) {
    const s = new Date(startDate);
    s.setHours(0, 0, 0, 0);
    const e = new Date(endDate);
    e.setHours(23, 59, 59, 999);
    filtered = jobs.filter(j => {
      const d = new Date(j.start_time);
      return d >= s && d <= e;
    });
    periodLabel = `${s.toLocaleDateString('pt-BR')} a ${e.toLocaleDateString('pt-BR')}`;
  }

  // Sort by date
  filtered.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

  // ===== CALCULATE STATS =====
  const totalMinutes = filtered.reduce((acc, j) => {
    const dur = j.duration_minutes || (j.end_time ? (new Date(j.end_time) - new Date(j.start_time)) / 60000 : 0);
    return acc + Math.max(0, dur);
  }, 0);

  const totalCost = filtered.reduce((acc, j) => {
    const dur = j.duration_minutes || (j.end_time ? (new Date(j.end_time) - new Date(j.start_time)) / 60000 : 0);
    const machineCost = (Math.max(0, dur) / 60) * costPerHour;
    const matCost = j.material_price || 0;
    return acc + machineCost + matCost;
  }, 0);

  // Group by project
  const projectMap = {};
  filtered.forEach(j => {
    const pName = extractProjectName(j.folder);
    if (!projectMap[pName]) projectMap[pName] = { name: pName, count: 0, totalMinutes: 0, cost: 0 };
    const dur = j.duration_minutes || (j.end_time ? (new Date(j.end_time) - new Date(j.start_time)) / 60000 : 0);
    projectMap[pName].count += 1;
    projectMap[pName].totalMinutes += Math.max(0, dur);
    projectMap[pName].cost += (Math.max(0, dur) / 60) * costPerHour + (j.material_price || 0);
  });
  const projectSummary = Object.values(projectMap).sort((a, b) => b.totalMinutes - a.totalMinutes);

  // ===== PAGE 1: COVER & SUMMARY =====
  // Dark header bar
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 45, 'F');
  
  // Accent line
  doc.setFillColor(6, 182, 212); // cyan-500
  doc.rect(0, 45, pageWidth, 2, 'F');

  // Title
  doc.setTextColor(6, 182, 212);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text('MACH3 TRACKER', 20, 22);

  doc.setTextColor(148, 163, 184); // slate-400
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('Relatorio de Producao', 20, 32);

  // Period & Date on right side
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(periodLabel.toUpperCase(), pageWidth - 20, 22, { align: 'right' });
  
  doc.setTextColor(148, 163, 184);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Gerado em: ${now.toLocaleDateString('pt-BR')} as ${now.toLocaleTimeString('pt-BR')}`, pageWidth - 20, 32, { align: 'right' });

  // ===== KPI CARDS =====
  const cardY = 55;
  const cardH = 28;
  const gap = 8;
  const cardW = (pageWidth - 40 - gap * 3) / 4;
  
  const kpis = [
    { label: 'TOTAL DE JOBS', value: `${filtered.length}`, color: [59, 130, 246] },
    { label: 'HORAS DE MAQUINA', value: `${(totalMinutes / 60).toFixed(1)}h`, color: [6, 182, 212] },
    { label: 'PRODUCAO ESTIMADA', value: `R$ ${totalCost.toFixed(2)}`, color: [245, 158, 11] },
    { label: 'PROJETOS ATIVOS', value: `${projectSummary.length}`, color: [16, 185, 129] },
  ];

  kpis.forEach((kpi, i) => {
    const x = 20 + i * (cardW + gap);
    // Card background
    doc.setFillColor(30, 41, 59); // slate-800
    doc.roundedRect(x, cardY, cardW, cardH, 3, 3, 'F');
    // Accent bar at top
    doc.setFillColor(...kpi.color);
    doc.rect(x, cardY, cardW, 2, 'F');
    // Label
    doc.setTextColor(148, 163, 184);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text(kpi.label, x + cardW / 2, cardY + 10, { align: 'center' });
    // Value
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(kpi.value, x + cardW / 2, cardY + 22, { align: 'center' });
  });

  // ===== PROJECT SUMMARY TABLE =====
  const tableStartY = cardY + cardH + 15;

  doc.setTextColor(6, 182, 212);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('Resumo por Projeto', 20, tableStartY);

  autoTable(doc, {
    startY: tableStartY + 5,
    head: [['Projeto', 'Jobs', 'Tempo Total', 'Custo Estimado', '% do Total']],
    body: projectSummary.map(p => [
      p.name.toUpperCase(),
      `${p.count}`,
      formatDuration(p.totalMinutes),
      `R$ ${p.cost.toFixed(2)}`,
      `${totalMinutes > 0 ? ((p.totalMinutes / totalMinutes) * 100).toFixed(1) : 0}%`
    ]),
    theme: 'plain',
    styles: {
      fontSize: 8,
      cellPadding: 3,
      textColor: [226, 232, 240], // slate-200
      lineColor: [51, 65, 85], // slate-700
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [30, 41, 59], // slate-800
      textColor: [6, 182, 212], // cyan
      fontStyle: 'bold',
      fontSize: 7,
      cellPadding: 4,
    },
    alternateRowStyles: {
      fillColor: [15, 23, 42], // slate-900
    },
    columnStyles: {
      0: { cellWidth: 80 },
      1: { halign: 'center', cellWidth: 25 },
      2: { halign: 'center', cellWidth: 40 },
      3: { halign: 'right', cellWidth: 45 },
      4: { halign: 'center', cellWidth: 30 },
    },
    margin: { left: 20, right: 20 },
    didDrawPage: (data) => {
      // Footer on every page
      drawFooter(doc, pageWidth, pageHeight);
    }
  });

  // ===== PAGE 2+: DETAILED JOB LIST =====
  doc.addPage('landscape');
  
  // Header bar for detail page
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 30, 'F');
  doc.setFillColor(6, 182, 212);
  doc.rect(0, 30, pageWidth, 1.5, 'F');

  doc.setTextColor(6, 182, 212);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Historico Detalhado de Producao', 20, 18);

  doc.setTextColor(148, 163, 184);
  doc.setFontSize(9);
  doc.text(`${filtered.length} registros | ${periodLabel}`, pageWidth - 20, 18, { align: 'right' });

  autoTable(doc, {
    startY: 38,
    head: [['#', 'Data', 'Hora Inicio', 'Hora Fim', 'Arquivo', 'Projeto', 'Router', 'Duracao', 'Custo Est.']],
    body: filtered.map((j, idx) => {
      const startDt = new Date(j.start_time);
      const endDt = j.end_time ? new Date(j.end_time) : null;
      const dur = j.duration_minutes || (endDt ? (endDt - startDt) / 60000 : 0);
      const cost = (Math.max(0, dur) / 60) * costPerHour + (j.material_price || 0);
      const pName = extractProjectName(j.folder);

      return [
        `${idx + 1}`,
        startDt.toLocaleDateString('pt-BR'),
        startDt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        endDt ? endDt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'Em andamento',
        j.file_name || 'Desconhecido',
        pName.toUpperCase(),
        j.router_name || 'Central',
        formatDuration(Math.max(0, dur)),
        `R$ ${cost.toFixed(2)}`
      ];
    }),
    theme: 'plain',
    styles: {
      fontSize: 7,
      cellPadding: 2.5,
      textColor: [226, 232, 240],
      lineColor: [51, 65, 85],
      lineWidth: 0.1,
      overflow: 'ellipsize',
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [6, 182, 212],
      fontStyle: 'bold',
      fontSize: 6.5,
      cellPadding: 3,
    },
    alternateRowStyles: {
      fillColor: [15, 23, 42],
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 22 },
      2: { cellWidth: 22, halign: 'center' },
      3: { cellWidth: 22, halign: 'center' },
      4: { cellWidth: 55 },
      5: { cellWidth: 55 },
      6: { cellWidth: 28, halign: 'center' },
      7: { cellWidth: 25, halign: 'center' },
      8: { cellWidth: 28, halign: 'right' },
    },
    margin: { left: 10, right: 10 },
    didDrawPage: (data) => {
      drawFooter(doc, pageWidth, pageHeight);
    }
  });

  // ===== SAVE =====
  const dateStr = now.toISOString().split('T')[0];
  const filename = `Mach3_Relatorio_${periodLabel.replace(/[^a-zA-Z0-9]/g, '_')}_${dateStr}.pdf`;
  doc.save(filename);
}

/**
 * Draws a consistent footer on every page.
 */
function drawFooter(doc, pageWidth, pageHeight) {
  const pageNum = doc.internal.getNumberOfPages();
  doc.setFillColor(15, 23, 42);
  doc.rect(0, pageHeight - 12, pageWidth, 12, 'F');
  doc.setFillColor(6, 182, 212);
  doc.rect(0, pageHeight - 12, pageWidth, 0.5, 'F');

  doc.setTextColor(100, 116, 139);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('Mach3 Tracker - Sistema de Rastreamento de Producao CNC', 20, pageHeight - 5);
  doc.text(`Pagina ${pageNum}`, pageWidth - 20, pageHeight - 5, { align: 'right' });
}
