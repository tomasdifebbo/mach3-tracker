/**
 * Utilitários para anexos (fotos/PDFs) e mapas de peças da Ficha Técnica CNC.
 */

export function normalizePathKey(p) {
  return String(p || '').replace(/\\/g, '/').toLowerCase().trim();
}

export function buildGroupAttachmentKey(jobName, subfolder) {
  return `group::${String(jobName || 'geral').toLowerCase().trim()}___${String(subfolder || 'raiz').toLowerCase().trim()}`;
}

export function buildFileAttachmentKey(task) {
  const fullPath = task?.fullPath || task?.fullFile?.fullPath || task?.fullFile?.path || '';
  if (fullPath) return fullPath.replace(/\//g, '\\').trim();
  const baseName = task?.baseName || task?.name || '';
  const sub = task?.subfolder || task?.subfolderName || '';
  return `${baseName}___${sub}`.trim();
}

/**
 * Encontra todos os anexos manuais (PostgreSQL) vinculados a uma chapa específica ou ao seu conjunto/subpasta.
 */
export function matchAttachmentsForTask(attachments = [], task) {
  if (!Array.isArray(attachments) || attachments.length === 0 || !task) return [];
  const fullPathNorm = normalizePathKey(task.fullPath || task.fullFile?.fullPath || task.fullFile?.path || '');
  const baseNameLower = String(task.baseName || task.name || '').toLowerCase().trim();
  const subLower = String(task.subfolder || task.subfolderName || '').toLowerCase().trim();
  const jobLower = String(task.jobName || '').toLowerCase().trim();
  const groupKey = buildGroupAttachmentKey(task.jobName, task.subfolder || task.subfolderName);

  return attachments.filter((att) => {
    if (!att) return false;
    const fkNorm = normalizePathKey(att.file_key);
    if (fkNorm === groupKey) return true;
    if (fullPathNorm && fkNorm && fkNorm === fullPathNorm) return true;

    const attFileLower = String(att.file_name || '').toLowerCase().trim();
    const attSubLower = String(att.subfolder || '').toLowerCase().trim();
    const attJobLower = String(att.job_name || '').toLowerCase().trim();

    if (attFileLower && baseNameLower && attFileLower === baseNameLower) {
      if (!subLower || !attSubLower || subLower === attSubLower) return true;
    }
    // Anexo vinculado à subpasta inteira
    if (!attFileLower && attSubLower && subLower && attSubLower === subLower && (!attJobLower || !jobLower || attJobLower === jobLower)) {
      return true;
    }
    return false;
  });
}

/**
 * Comprime imagens via Canvas (máx 1600px) para envio rápido e leve ao PostgreSQL,
 * ou lê PDFs em base64 (até 7MB).
 */
export function fileToOptimizedAttachment(file) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('Nenhum arquivo selecionado'));

    const mime = (file.type || '').toLowerCase();
    const isPdf = mime === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isImg = mime.startsWith('image/');

    if (!isPdf && !isImg) {
      return reject(new Error('Envie uma imagem (JPG, PNG, WEBP) ou um arquivo PDF.'));
    }

    if (isPdf) {
      if (file.size > 7 * 1024 * 1024) {
        return reject(new Error('O PDF excede o limite de 7 MB.'));
      }
      const reader = new FileReader();
      reader.onload = () => {
        resolve({
          attachment_name: file.name,
          mime_type: 'application/pdf',
          data_url: String(reader.result || '')
        });
      };
      reader.onerror = () => reject(new Error('Erro ao ler o arquivo PDF.'));
      reader.readAsDataURL(file);
      return;
    }

    // Imagem: redimensiona/comprime mantendo nitidez para anotação em folha A4
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxSide = 1600;
        let { width, height } = img;
        if (width > maxSide || height > maxSide) {
          const ratio = Math.min(maxSide / width, maxSide / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        const outMime = 'image/jpeg';
        const dataUrl = canvas.toDataURL(outMime, 0.85);
        resolve({
          attachment_name: file.name,
          mime_type: outMime,
          data_url: dataUrl
        });
      };
      img.onerror = () => reject(new Error('Erro ao processar a imagem selecionada.'));
      img.src = String(reader.result || '');
    };
    reader.onerror = () => reject(new Error('Erro ao ler a imagem.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Converte data:application/pdf;base64,... em Blob URL seguro para abrir/visualizar em iframe ou nova aba.
 */
export function dataUrlToBlobUrl(dataUrl) {
  try {
    const parts = String(dataUrl || '').split(',');
    if (parts.length < 2) return null;
    const mimeMatch = parts[0].match(/data:([^;]+);base64/i);
    const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
    const binStr = atob(parts[1]);
    const bytes = new Uint8Array(binStr.length);
    for (let i = 0; i < binStr.length; i++) {
      bytes[i] = binStr.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: mime });
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

/**
 * Gera HTML pronto para impressão A4 da folha de mapa de peças (Desenho G-Code + Fotos/PDFs + espaço para anotação à caneta).
 */
export function buildPieceMapsPrintSectionHtml(items = [], manualAttachments = [], escapeHtmlFn) {
  const esc = escapeHtmlFn || ((s) => String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;'));

  // Deduplica chapas repetidas (ex: lote 2x/3x imprime 1 mapa com badge da quantidade)
  const seen = new Set();
  const uniqueSheets = [];
  for (const item of items) {
    const key = `${String(item.jobName || '').toLowerCase()}___${String(item.subfolder || '').toLowerCase()}___${String(item.baseName || item.name || '').toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const previewSvg = item.previewSvg || item.fullFile?.previewSvg || null;
    const folderDocs = item.folderDocs || item.fullFile?.folderDocs || [];
    const attached = matchAttachmentsForTask(manualAttachments, item);
    if (previewSvg || attached.length > 0 || folderDocs.length > 0) {
      uniqueSheets.push({ item, previewSvg, folderDocs, attached });
    }
  }

  if (uniqueSheets.length === 0) return '';

  const cardsHtml = uniqueSheets.map(({ item, previewSvg, folderDocs, attached }, idx) => {
    const imgAttachments = attached.filter(a => (a.mime_type || '').startsWith('image/'));
    const pdfAttachments = attached.filter(a => (a.mime_type || '') === 'application/pdf');
    const autoPdfs = folderDocs.filter(d => d.ext === '.pdf');
    const autoImgs = folderDocs.filter(d => d.ext !== '.pdf' && d._dataUrl);

    const qtyBadge = (item.targetQuantity || 1) > 1
      ? `<span class="map-qty">Lote ${item.targetQuantity}x</span>`
      : '';

    const pathStr = item._displayPath || item.fullPath || item.fullFile?.fullPath || '';

    const svgBlock = previewSvg
      ? `<div class="map-svg-wrap">${previewSvg}</div>`
      : '';

    const imgsBlock = [...imgAttachments.map(a => ({ name: a.attachment_name, url: a.data_url, notes: a.notes })), ...autoImgs.map(d => ({ name: d.name, url: d._dataUrl, notes: 'Imagem da pasta do material' }))]
      .map(img => `
        <div class="map-photo-box">
          <div class="map-photo-caption">📎 ${esc(img.name)}${img.notes ? ` — ${esc(img.notes)}` : ''}</div>
          <img src="${img.url}" alt="${esc(img.name)}" class="map-photo-img" />
        </div>
      `).join('');

    const pdfNotesList = [
      ...autoPdfs.map(d => `📄 PDF automático na pasta: <strong>${esc(d.name)}</strong>`),
      ...pdfAttachments.map(a => `📄 PDF anexado: <strong>${esc(a.attachment_name)}</strong>${a.notes ? ` (${esc(a.notes)})` : ''}`)
    ];
    const pdfBlock = pdfNotesList.length > 0
      ? `<div class="map-pdf-note">${pdfNotesList.join(' &nbsp;|&nbsp; ')}</div>`
      : '';

    return `
      <div class="map-card">
        <div class="map-card-header">
          <div>
            <span class="map-num">#${idx + 1}</span>
            <strong>${esc(item.baseName || item.name)}</strong>
            ${qtyBadge}
          </div>
          <div class="map-meta">${esc(item.material || '')}${item.dimensions ? ` · ${esc(item.dimensions)}` : ''}</div>
        </div>
        ${pathStr ? `<div class="map-path">📂 ${esc(pathStr)}</div>` : ''}
        ${svgBlock}
        ${imgsBlock}
        ${pdfBlock}
        <div class="map-notes-area">
          <div class="map-notes-lbl">✏️ Anotações do Operador / Numeração das Peças:</div>
          <div class="map-notes-lines"></div>
          <div class="map-notes-lines"></div>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="maps-section">
      <div class="maps-section-header">
        <span>📐 MAPAS DE PEÇAS & ANEXOS PARA ANOTAÇÃO DO OPERADOR</span>
        <span>${uniqueSheets.length} chapa(s) com desenho / anexo</span>
      </div>
      ${cardsHtml}
    </div>
  `;
}

export const PIECE_MAPS_PRINT_CSS = `
  .maps-section { page-break-before: always; }
  .maps-section-header { display: flex; justify-content: space-between; align-items: center; background: #0f172a; color: #fff; padding: 6px 10px; border-radius: 5px; font-weight: 900; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 8px; }
  .map-card { border: 1.4px solid #334155; border-radius: 6px; padding: 7px 9px; margin-bottom: 10px; page-break-inside: avoid; background: #fff; }
  .map-card-header { display: flex; justify-content: space-between; align-items: center; gap: 8px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin-bottom: 4px; font-size: 9.2px; }
  .map-num { display: inline-block; background: #ea580c; color: #fff; font-weight: 900; font-size: 8px; padding: 1px 5px; border-radius: 3px; margin-right: 5px; }
  .map-qty { display: inline-block; background: #fef3c7; color: #92400e; border: 1px solid #f59e0b; font-weight: 800; font-size: 7.5px; padding: 0.5px 5px; border-radius: 99px; margin-left: 5px; }
  .map-meta { font-size: 8px; font-weight: 700; color: #475569; }
  .map-path { font-size: 7.2px; font-family: Consolas, monospace; color: #334155; background: #f8fafc; padding: 2px 5px; border-left: 2px solid #ea580c; margin-bottom: 5px; word-break: break-all; }
  .map-svg-wrap { border: 1px solid #cbd5e1; border-radius: 4px; padding: 4px; background: #fff; max-height: 290px; overflow: hidden; display: flex; align-items: center; justify-content: center; }
  .map-svg-wrap svg { max-height: 280px; width: 100%; height: auto; }
  .map-photo-box { margin-top: 6px; border: 1px solid #cbd5e1; border-radius: 4px; padding: 4px; background: #fff; text-align: center; }
  .map-photo-caption { font-size: 7.5px; font-weight: 700; color: #334155; text-align: left; margin-bottom: 3px; }
  .map-photo-img { max-width: 100%; max-height: 360px; object-fit: contain; display: block; margin: 0 auto; }
  .map-pdf-note { margin-top: 5px; font-size: 7.8px; color: #1e40af; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 4px; padding: 3px 6px; }
  .map-notes-area { margin-top: 6px; padding-top: 4px; border-top: 1px dashed #94a3b8; }
  .map-notes-lbl { font-size: 7.5px; font-weight: 800; color: #475569; text-transform: uppercase; margin-bottom: 3px; }
  .map-notes-lines { border-bottom: 1px dotted #94a3b8; height: 15px; }
`;
