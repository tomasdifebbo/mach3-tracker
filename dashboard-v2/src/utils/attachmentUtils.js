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

export function isImageDoc(doc) {
  if (!doc) return false;
  const ext = String(doc.ext || '').toLowerCase();
  const mime = String(doc.mimeType || doc.mime_type || '').toLowerCase();
  return mime.startsWith('image/') || ['.png', '.jpg', '.jpeg', '.webp'].includes(ext);
}

export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Erro ao converter imagem para impressão.'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Baixa e embute em base64 (data URL) todas as imagens da pasta (ex.: "mdf 6mm chapa 1.png")
 * E desmembra/renderiza cada página correspondente dos PDFs do Aspire (ex.: "mdf 6mm.pdf" pág. 1..5)
 * para impressão direta na Ficha Técnica A4.
 */
export async function hydrateFolderDocImagesForPrint(items = [], fetchLocalDocBlobFn) {
  if (!Array.isArray(items) || items.length === 0 || typeof fetchLocalDocBlobFn !== 'function') {
    return items;
  }

  const jobsMap = new Map(); // cacheKey -> { fullPath, page, isPdf }
  for (const item of items) {
    const docs = item?.folderDocs || item?.fullFile?.folderDocs || [];
    for (const d of docs) {
      if (!d?.fullPath || d._dataUrl) continue;
      if (isImageDoc(d)) {
        const key = `${d.fullPath}::img`;
        if (!jobsMap.has(key)) jobsMap.set(key, { fullPath: d.fullPath, page: null, isPdf: false });
      } else if (String(d.ext || '').toLowerCase() === '.pdf') {
        const page = d.targetPage && Number(d.targetPage) > 0 ? Number(d.targetPage) : 1;
        const key = `${d.fullPath}::p${page}`;
        if (!jobsMap.has(key)) jobsMap.set(key, { fullPath: d.fullPath, page, isPdf: true });
      }
    }
  }

  if (jobsMap.size === 0) return items;

  const hasPdfJob = Array.from(jobsMap.values()).some(j => j.isPdf);
  let renderPdfBlobToImageDataUrl = null;
  if (hasPdfJob) {
    try {
      const mod = await import('./pdfRenderUtils');
      renderPdfBlobToImageDataUrl = mod.renderPdfBlobToImageDataUrl;
    } catch {
      renderPdfBlobToImageDataUrl = null;
    }
  }

  const resolvedMap = new Map(); // cacheKey -> { dataUrl, page, totalPages }
  await Promise.all(
    Array.from(jobsMap.entries()).map(async ([key, job]) => {
      try {
        const res = await fetchLocalDocBlobFn(job.fullPath, job.isPdf ? job.page : null);
        if (res?.blob) {
          if (job.isPdf) {
            // Só embute automaticamente se o PDF foi desmembrado para a página desta chapa OU tem apenas 1 página
            if (renderPdfBlobToImageDataUrl && (res.page >= 1 || res.totalPages === 1)) {
              const dataUrl = await renderPdfBlobToImageDataUrl(res.blob, { maxWidth: 1400, pageNumber: 1 });
              if (dataUrl) {
                resolvedMap.set(key, {
                  dataUrl,
                  page: res.page || job.page || 1,
                  totalPages: res.totalPages || 1
                });
              }
            }
          } else {
            const dataUrl = await blobToDataUrl(res.blob);
            if (dataUrl) resolvedMap.set(key, { dataUrl, page: 0, totalPages: 0 });
          }
        }
        if (res?.blobUrl) {
          try { URL.revokeObjectURL(res.blobUrl); } catch { /* ignore */ }
        }
      } catch {
        // Ignora documento indisponível sem travar a impressão
      }
    })
  );

  if (resolvedMap.size === 0) return items;

  return items.map((item) => {
    const docs = item?.folderDocs || item?.fullFile?.folderDocs || [];
    if (!docs.length) return item;
    const hydratedDocs = docs.map((d) => {
      if (!d?.fullPath) return d;
      const isPdf = String(d.ext || '').toLowerCase() === '.pdf';
      const page = d.targetPage && Number(d.targetPage) > 0 ? Number(d.targetPage) : 1;
      const key = isPdf ? `${d.fullPath}::p${page}` : `${d.fullPath}::img`;
      const hit = resolvedMap.get(key);
      if (!hit) return d;
      return {
        ...d,
        _dataUrl: hit.dataUrl,
        _pdfPage: hit.page,
        _pdfTotalPages: hit.totalPages
      };
    });
    return { ...item, folderDocs: hydratedDocs };
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

  // Deduplica chapas repetidas (lote 2x/3x OU múltiplos percursos da mesma chapa como e6mm + vbit que dividem a mesma página do PDF)
  const seenFile = new Set();
  const sheetBuckets = new Map();
  const uniqueSheets = [];
  for (const item of items) {
    const baseName = String(item.baseName || item.name || '').trim();
    const fileKey = `${String(item.jobName || '').toLowerCase()}___${String(item.subfolder || '').toLowerCase()}___${baseName.toLowerCase()}`;
    if (seenFile.has(fileKey)) continue;
    seenFile.add(fileKey);

    const folderDocs = item.folderDocs || item.fullFile?.folderDocs || [];
    const attached = matchAttachmentsForTask(manualAttachments, item);
    if (attached.length === 0 && folderDocs.length === 0) continue;

    // Se há um PDF desmembrado por página (ex: mdf 6mm.pdf pág. 1 para e6mm + vbit), agrupa ambos percursos no mesmo card da Chapa 1!
    const primarySplitPdf = folderDocs.find(d => d.ext === '.pdf' && d._dataUrl && d._pdfPage >= 1);
    const primaryExactImg = folderDocs.find(d => d.ext !== '.pdf' && d._dataUrl && d.exactSheetMatch);
    const bucketKey = primarySplitPdf
      ? `pdf::${String(primarySplitPdf.fullPath || primarySplitPdf.name).toLowerCase()}::p${primarySplitPdf._pdfPage}`
      : primaryExactImg
        ? `img::${String(primaryExactImg.fullPath || primaryExactImg.name).toLowerCase()}`
        : fileKey;

    if (sheetBuckets.has(bucketKey) && attached.length === 0) {
      const existing = sheetBuckets.get(bucketKey);
      if (!existing.extraNames.includes(baseName)) {
        existing.extraNames.push(baseName);
      }
      continue;
    }

    const entry = { item, folderDocs, attached, extraNames: [baseName] };
    sheetBuckets.set(bucketKey, entry);
    uniqueSheets.push(entry);
  }

  if (uniqueSheets.length === 0) return '';

  const cardsHtml = uniqueSheets.map(({ item, folderDocs, attached, extraNames }, idx) => {
    const imgAttachments = attached.filter(a => (a.mime_type || '').startsWith('image/'));
    const pdfAttachments = attached.filter(a => (a.mime_type || '') === 'application/pdf');
    const renderedAutoDocs = folderDocs.filter(d => Boolean(d._dataUrl));
    const unrenderedAutoPdfs = folderDocs.filter(d => d.ext === '.pdf' && !d._dataUrl);

    const qtyBadge = (item.targetQuantity || 1) > 1
      ? `<span class="map-qty">Lote ${item.targetQuantity}x</span>`
      : '';

    const pathStr = item._displayPath || item.fullPath || item.fullFile?.fullPath || '';
    const titleStr = extraNames.length > 1 ? extraNames.join(' + ') : (item.baseName || item.name);

    const imgsBlock = [
      ...renderedAutoDocs.map(d => ({
        name: d.name,
        url: d._dataUrl,
        isPdfPage: d.ext === '.pdf',
        notes: d.ext === '.pdf'
          ? (d._pdfTotalPages > 1
            ? `Chapa ${d._pdfPage} (Página ${d._pdfPage} de ${d._pdfTotalPages} do PDF Aspire)`
            : 'Folha do PDF Aspire')
          : (d.exactSheetMatch ? 'Imagem da pasta (chapa correspondente)' : 'Imagem da pasta do material')
      })),
      ...imgAttachments.map(a => ({ name: a.attachment_name, url: a.data_url, isPdfPage: false, notes: a.notes }))
    ]
      .map(img => `
        <div class="map-photo-box">
          <div class="map-photo-caption">${img.isPdfPage ? '📄' : '🖼️'} ${esc(img.name)}${img.notes ? ` — ${esc(img.notes)}` : ''}</div>
          <img src="${img.url}" alt="${esc(img.name)}" class="map-photo-img" />
        </div>
      `).join('');

    const pdfNotesList = [
      ...unrenderedAutoPdfs.map(d => `📄 PDF automático na pasta: <strong>${esc(d.name)}</strong>${d.targetPage ? ` (Chapa ${d.targetPage})` : ''}`),
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
            <strong>${esc(titleStr)}</strong>
            ${qtyBadge}
          </div>
          <div class="map-meta">${esc(item.material || '')}${item.dimensions ? ` · ${esc(item.dimensions)}` : ''}</div>
        </div>
        ${pathStr ? `<div class="map-path">📂 ${esc(pathStr)}</div>` : ''}
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
        <span>📎 ANEXOS & PDFS DAS PEÇAS PARA ANOTAÇÃO DO OPERADOR</span>
        <span>${uniqueSheets.length} chapa(s) com foto / PDF</span>
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
  .map-photo-img { max-width: 100%; max-height: 460px; object-fit: contain; display: block; margin: 0 auto; }
  .map-pdf-note { margin-top: 5px; font-size: 7.8px; color: #1e40af; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 4px; padding: 3px 6px; }
  .map-notes-area { margin-top: 6px; padding-top: 4px; border-top: 1px dashed #94a3b8; }
  .map-notes-lbl { font-size: 7.5px; font-weight: 800; color: #475569; text-transform: uppercase; margin-bottom: 3px; }
  .map-notes-lines { border-bottom: 1px dotted #94a3b8; height: 15px; }
`;
