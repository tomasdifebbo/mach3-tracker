import React, { useState, useEffect, useMemo } from 'react';
import {
  X, Printer, Upload, Trash2, FileText, Image as ImageIcon,
  Layers, Sparkles, ExternalLink, Loader2, Paperclip
} from 'lucide-react';
import { api } from '../services/api';
import {
  buildFileAttachmentKey,
  buildGroupAttachmentKey,
  fileToOptimizedAttachment,
  dataUrlToBlobUrl,
  matchAttachmentsForTask,
  PIECE_MAPS_PRINT_CSS
} from '../utils/attachmentUtils';

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function AnexoDesenhoModal({
  isOpen,
  onClose,
  task,
  attachments = [],
  onAttachmentsChanged,
  operatorName = 'Operador',
  defaultScope = 'file' // 'file' | 'group'
}) {
  const folderDocs = useMemo(
    () => task?.folderDocs || task?.fullFile?.folderDocs || [],
    [task]
  );

  const matchedManual = useMemo(
    () => matchAttachmentsForTask(attachments, task),
    [attachments, task]
  );

  const [activeTab, setActiveTab] = useState('auto'); // 'auto' | 'manual'

  const [selectedFolderDocIdx, setSelectedFolderDocIdx] = useState(0);
  const [folderDocBlob, setFolderDocBlob] = useState(null); // { blobUrl, mimeType, path }
  const [loadingFolderDoc, setLoadingFolderDoc] = useState(false);
  const [folderDocError, setFolderDocError] = useState('');

  const [uploadScope, setUploadScope] = useState(defaultScope);
  const [uploadNotes, setUploadNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  const manualPdfBlobUrls = useMemo(() => {
    const map = {};
    matchedManual.forEach(att => {
      if (att.mime_type === 'application/pdf' && att.data_url) {
        const url = dataUrlToBlobUrl(att.data_url);
        if (url) map[att.id] = url;
      }
    });
    return map;
  }, [matchedManual]);

  useEffect(() => {
    return () => {
      Object.values(manualPdfBlobUrls).forEach(url => {
        try { URL.revokeObjectURL(url); } catch { /* ignore */ }
      });
    };
  }, [manualPdfBlobUrls]);

  // Define aba inicial inteligente ao abrir o modal
  useEffect(() => {
    if (!isOpen || !task) return;
    setUploadScope(defaultScope);
    setUploadNotes('');
    setUploadError('');
    setSelectedFolderDocIdx(0);

    if (defaultScope === 'group') {
      setActiveTab('manual');
    } else if (folderDocs.length > 0) {
      setActiveTab('auto');
    } else {
      setActiveTab('manual');
    }
  }, [isOpen, task, defaultScope, folderDocs.length]);

  // Carrega automaticamente o PDF / imagem encontrado na pasta do material
  const currentFolderDoc = folderDocs[selectedFolderDocIdx] || null;
  useEffect(() => {
    if (!isOpen || !currentFolderDoc?.fullPath) {
      setFolderDocBlob(null);
      setFolderDocError('');
      return;
    }

    let cancelled = false;
    let createdUrl = null;
    setLoadingFolderDoc(true);
    setFolderDocError('');

    api.fetchLocalDocBlob(currentFolderDoc.fullPath)
      .then((res) => {
        if (cancelled) {
          if (res?.blobUrl) URL.revokeObjectURL(res.blobUrl);
          return;
        }
        createdUrl = res.blobUrl;
        setFolderDocBlob({
          blobUrl: res.blobUrl,
          mimeType: res.mimeType || currentFolderDoc.mimeType,
          path: currentFolderDoc.fullPath
        });
      })
      .catch((err) => {
        if (!cancelled) {
          setFolderDocBlob(null);
          setFolderDocError(err?.message || 'Não foi possível carregar o PDF da pasta.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingFolderDoc(false);
      });

    return () => {
      cancelled = true;
      if (createdUrl) {
        try { URL.revokeObjectURL(createdUrl); } catch { /* ignore */ }
      }
    };
  }, [isOpen, currentFolderDoc]);

  if (!isOpen || !task) return null;

  const displayPath = (task.fullPath || task.fullFile?.fullPath || '').replace(/\//g, '\\');

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setUploading(true);
    setUploadError('');
    try {
      const optimized = await fileToOptimizedAttachment(file);
      const isGroup = uploadScope === 'group';
      const fileKey = isGroup
        ? buildGroupAttachmentKey(task.jobName, task.subfolder || task.subfolderName)
        : buildFileAttachmentKey(task);

      const res = await api.savePipelineAttachment({
        file_key: fileKey,
        file_name: isGroup ? null : (task.baseName || task.name || null),
        subfolder: task.subfolder || task.subfolderName || null,
        job_name: task.jobName || null,
        attachment_name: optimized.attachment_name,
        mime_type: optimized.mime_type,
        data_url: optimized.data_url,
        notes: uploadNotes.trim() || null,
        uploaded_by: operatorName || 'Operador'
      });

      if (res?.error) {
        throw new Error(res.error);
      }
      setUploadNotes('');
      setActiveTab('manual');
      if (onAttachmentsChanged) await onAttachmentsChanged();
    } catch (err) {
      setUploadError(err?.message || 'Erro ao anexar arquivo.');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAttachment = async (attId) => {
    if (!window.confirm('Remover este anexo da Ficha Técnica?')) return;
    setDeletingId(attId);
    try {
      await api.deletePipelineAttachment(attId);
      if (onAttachmentsChanged) await onAttachmentsChanged();
    } catch (err) {
      alert('Erro ao remover anexo: ' + (err?.message || ''));
    } finally {
      setDeletingId(null);
    }
  };

  // Imprime uma folha A4 dedicada desta chapa (desenho do G-Code + fotos anexadas + espaço para anotações à caneta)
  const handlePrintSingleMap = () => {
    const imgAttachments = matchedManual.filter(a => (a.mime_type || '').startsWith('image/'));
    const pdfAttachments = matchedManual.filter(a => (a.mime_type || '') === 'application/pdf');

    const imgsHtml = imgAttachments.map(a => `
      <div class="map-photo-box">
        <div class="map-photo-caption">📎 ${escapeHtml(a.attachment_name)}${a.notes ? ` — ${escapeHtml(a.notes)}` : ''}</div>
        <img src="${a.data_url}" alt="${escapeHtml(a.attachment_name)}" class="map-photo-img" style="max-height:520px;" />
      </div>
    `).join('');

    const pdfsList = [
      ...folderDocs.filter(d => d.ext === '.pdf').map(d => `📄 PDF na pasta: <strong>${escapeHtml(d.name)}</strong>`),
      ...pdfAttachments.map(a => `📄 PDF anexado: <strong>${escapeHtml(a.attachment_name)}</strong>`)
    ];

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Mapa de Corte - ${escapeHtml(task.baseName || task.name)}</title>
<style>
  @page { size: A4 portrait; margin: 10mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  body { font-family: 'Segoe UI', Roboto, Arial, sans-serif; color: #0f172a; background: #fff; font-size: 10px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2.5px solid #ea580c; padding-bottom: 7px; margin-bottom: 10px; }
  .badge { display: inline-block; background: #ea580c; color: #fff; font-size: 8px; font-weight: 800; text-transform: uppercase; padding: 2px 7px; border-radius: 4px; margin-bottom: 3px; }
  .title { font-size: 15px; font-weight: 900; }
  .sub { font-size: 9.5px; color: #475569; margin-top: 2px; }
  .meta { text-align: right; font-size: 8.8px; color: #334155; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 5px 9px; }
  ${PIECE_MAPS_PRINT_CSS}
  .maps-section { page-break-before: auto; }
  .map-svg-wrap { max-height: 460px; }
  .map-svg-wrap svg { max-height: 450px; }
  .map-notes-lines { height: 22px; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="badge">Mapa de Peças para Anotação do Operador</div>
      <div class="title">${escapeHtml(task.baseName || task.name)}</div>
      <div class="sub">${escapeHtml(task.jobName || '')}${task.subfolder ? ` ➔ ${escapeHtml(task.subfolder)}` : ''}</div>
    </div>
    <div class="meta">
      <div><strong>Material:</strong> ${escapeHtml(task.material || '-')}</div>
      ${task.dimensions ? `<div><strong>Medidas:</strong> ${escapeHtml(task.dimensions)}</div>` : ''}
      <div><strong>Operador:</strong> ${escapeHtml(operatorName)} · ${new Date().toLocaleDateString('pt-BR')}</div>
    </div>
  </div>
  ${displayPath ? `<div class="map-path">📂 ${escapeHtml(displayPath)}</div>` : ''}
  ${imgsHtml}
  ${pdfsList.length > 0 ? `<div class="map-pdf-note">${pdfsList.join(' &nbsp;|&nbsp; ')}</div>` : ''}
  <div class="map-notes-area" style="margin-top:14px;">
    <div class="map-notes-lbl">✏️ Anotações do Operador / Numeração das Peças:</div>
    <div class="map-notes-lines"></div>
    <div class="map-notes-lines"></div>
    <div class="map-notes-lines"></div>
    <div class="map-notes-lines"></div>
  </div>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=960,height=840');
    if (!win) {
      alert('Permita pop-ups para imprimir o mapa da chapa.');
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 350);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#12151d] text-slate-900 dark:text-slate-100 w-full max-w-4xl max-h-[92vh] rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3.5 border-b border-slate-200 dark:border-white/10 bg-slate-900 text-white flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded bg-orange-500 text-black text-[10px] font-black uppercase tracking-wider">
                Mapa de Peças & Anexos
              </span>
              {folderDocs.length > 0 && (
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold flex items-center gap-1">
                  <Sparkles size={10} /> {folderDocs.length} PDF/Foto da pasta carregado(s)
                </span>
              )}
            </div>
            <h3 className="text-sm sm:text-base font-black truncate mt-1">
              {task.baseName || task.name}
            </h3>
            {displayPath && (
              <p className="text-[10px] font-mono text-slate-400 truncate mt-0.5">
                📂 {displayPath}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 flex items-center justify-center shrink-0 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-4 py-2.5 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            {folderDocs.length > 0 && (
              <button
                type="button"
                onClick={() => setActiveTab('auto')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'auto'
                    ? 'bg-emerald-500 text-black shadow-sm'
                    : 'bg-white dark:bg-white/5 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10 hover:border-emerald-500/50'
                }`}
              >
                <Sparkles size={13} />
                <span>PDF da Pasta ({folderDocs.length})</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setActiveTab('manual')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'manual'
                  ? 'bg-cyan-500 text-black shadow-sm'
                  : 'bg-white dark:bg-white/5 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10 hover:border-cyan-500/50'
              }`}
            >
              <Paperclip size={13} />
              <span>Anexar Foto / PDF ({matchedManual.length})</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handlePrintSingleMap}
            className="px-3 py-1.5 rounded-lg text-xs font-black bg-slate-900 dark:bg-orange-500 hover:bg-orange-600 text-white flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            title="Imprimir folha A4 com as fotos anexadas e linhas para anotação à caneta"
          >
            <Printer size={13} />
            <span>Imprimir Folha A4</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* TAB 1: PDF / IMAGEM AUTOMÁTICO DA PASTA DO MATERIAL */}
          {activeTab === 'auto' && folderDocs.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-3.5 py-2.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <Sparkles size={14} /> Carregado automaticamente da pasta do material:
                  </span>
                  {folderDocs.length > 1 ? (
                    <select
                      value={selectedFolderDocIdx}
                      onChange={(e) => setSelectedFolderDocIdx(Number(e.target.value))}
                      className="text-xs font-bold px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-emerald-500/40 text-slate-900 dark:text-white outline-none cursor-pointer"
                    >
                      {folderDocs.map((d, i) => (
                        <option key={d.fullPath || i} value={i}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-xs font-black text-slate-900 dark:text-white">
                      {currentFolderDoc?.name}
                    </span>
                  )}
                </div>

                {folderDocBlob?.blobUrl && (
                  <a
                    href={folderDocBlob.blobUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-black text-xs font-black flex items-center gap-1.5 transition-all"
                  >
                    <ExternalLink size={12} />
                    <span>Abrir / Imprimir PDF</span>
                  </a>
                )}
              </div>

              {loadingFolderDoc ? (
                <div className="h-[440px] rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] flex flex-col items-center justify-center gap-2 text-slate-400">
                  <Loader2 size={28} className="animate-spin text-emerald-500" />
                  <span className="text-xs font-bold">Carregando {currentFolderDoc?.name}...</span>
                </div>
              ) : folderDocError ? (
                <div className="p-6 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400 text-xs font-bold text-center">
                  {folderDocError}
                </div>
              ) : folderDocBlob?.blobUrl ? (
                (folderDocBlob.mimeType || '').startsWith('image/') ? (
                  <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white p-3 flex items-center justify-center">
                    <img
                      src={folderDocBlob.blobUrl}
                      alt={currentFolderDoc?.name}
                      className="max-h-[520px] max-w-full object-contain rounded"
                    />
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden bg-white h-[520px]">
                    <iframe
                      src={folderDocBlob.blobUrl}
                      title={currentFolderDoc?.name}
                      className="w-full h-full border-0"
                    />
                  </div>
                )
              ) : null}
            </div>
          )}

          {/* TAB 2: ANEXAR FOTO / PDF PRÓPRIO (SALVO NO BANCO) */}
          {activeTab === 'manual' && (
            <div className="space-y-4">
              {/* Formulário de Upload */}
              <div className="p-4 rounded-xl border border-cyan-500/30 bg-cyan-500/[0.06] space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h4 className="text-xs font-black uppercase tracking-wider text-cyan-600 dark:text-cyan-400 flex items-center gap-1.5">
                    <Upload size={14} /> Anexar Foto ou PDF para o Operador
                  </h4>
                  <div className="flex items-center gap-2 text-[11px] font-bold">
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name="attScope"
                        checked={uploadScope === 'file'}
                        onChange={() => setUploadScope('file')}
                      />
                      <span>Apenas esta chapa</span>
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name="attScope"
                        checked={uploadScope === 'group'}
                        onChange={() => setUploadScope('group')}
                      />
                      <span>Subpasta inteira ({task.subfolder || 'Geral'})</span>
                    </label>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={uploadNotes}
                    onChange={(e) => setUploadNotes(e.target.value)}
                    placeholder="Observação opcional (ex.: Numerar peças A1 a A8 na saída da router)"
                    className="flex-1 text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-black/30 text-slate-900 dark:text-white outline-none focus:border-cyan-500"
                  />
                  <label className={`px-4 py-2 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer transition-all shrink-0 ${
                    uploading
                      ? 'bg-slate-400 text-white pointer-events-none'
                      : 'bg-cyan-500 hover:bg-cyan-400 text-black shadow-sm'
                  }`}>
                    {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                    <span>{uploading ? 'Enviando...' : 'Escolher Foto ou PDF'}</span>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={handleFileChange}
                      className="hidden"
                      disabled={uploading}
                    />
                  </label>
                </div>

                {uploadError && (
                  <p className="text-xs font-bold text-red-400">{uploadError}</p>
                )}
              </div>

              {/* Lista de Anexos Salvos */}
              {matchedManual.length === 0 ? (
                <div className="p-8 rounded-xl border border-dashed border-slate-300 dark:border-white/15 text-center space-y-1.5">
                  <Paperclip size={28} className="mx-auto text-slate-400 opacity-40" />
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    Nenhuma foto ou PDF anexado manualmente a esta chapa/subpasta ainda.
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Fotos anexadas saem impressas automaticamente na Ficha Técnica A4 e aparecem no Terminal do Operador.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {matchedManual.map(att => {
                    const isPdf = att.mime_type === 'application/pdf';
                    const pdfUrl = manualPdfBlobUrls[att.id];
                    const isGroupAtt = String(att.file_key || '').startsWith('group::');

                    return (
                      <div
                        key={att.id}
                        className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.03] overflow-hidden"
                      >
                        <div className="px-3.5 py-2.5 border-b border-slate-200 dark:border-white/10 flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2 min-w-0">
                            {isPdf ? (
                              <FileText size={15} className="text-red-400 shrink-0" />
                            ) : (
                              <ImageIcon size={15} className="text-cyan-400 shrink-0" />
                            )}
                            <span className="text-xs font-black truncate">{att.attachment_name}</span>
                            {isGroupAtt && (
                              <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30 text-[9px] font-black uppercase">
                                <Layers size={9} className="inline mr-0.5" /> Conjunto
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            {isPdf && pdfUrl && (
                              <a
                                href={pdfUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 border border-cyan-500/30 text-[11px] font-bold flex items-center gap-1"
                              >
                                <ExternalLink size={11} /> Abrir PDF
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeleteAttachment(att.id)}
                              disabled={deletingId === att.id}
                              className="p-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-400 transition-colors cursor-pointer"
                              title="Remover anexo"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>

                        {att.notes && (
                          <div className="px-3.5 py-1.5 text-[11px] text-amber-500 dark:text-amber-300 bg-amber-500/10 border-b border-amber-500/20 font-semibold">
                            📝 {att.notes}
                          </div>
                        )}

                        <div className="p-3 bg-white flex items-center justify-center">
                          {isPdf ? (
                            pdfUrl ? (
                              <iframe
                                src={pdfUrl}
                                title={att.attachment_name}
                                className="w-full h-[460px] border-0 rounded"
                              />
                            ) : (
                              <p className="text-xs text-slate-500 py-6">PDF anexado ({att.attachment_name})</p>
                            )
                          ) : (
                            <img
                              src={att.data_url}
                              alt={att.attachment_name}
                              className="max-h-[460px] max-w-full object-contain rounded"
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
