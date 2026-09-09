import React, { useState, useRef } from 'react';
import { FileCode, Download, UploadCloud, RefreshCw, CheckCircle2, Layers, Box, AlertCircle, FileCheck } from 'lucide-react';
import { processGCodeToDxf } from '../utils/gcodeToDxf';

export function ConversorGcodeDxf() {
  const [file, setFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileSelect = (selectedFile) => {
    if (!selectedFile) return;

    const ext = selectedFile.name.split('.').pop().toLowerCase();
    if (!['txt', 'tap', 'nc', 'cnc', 'gcode'].includes(ext)) {
      setError('Formato não suportado. Por favor, envie um arquivo G-code (.txt, .tap, .nc, .cnc, .gcode).');
      return;
    }

    setError(null);
    setFile(selectedFile);
    setIsProcessing(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const res = processGCodeToDxf(text, selectedFile.name);
        setResult(res);
      } catch (err) {
        console.error('Erro ao converter G-code para DXF:', err);
        setError(err.message || 'Erro ao processar arquivo G-code. Verifique o formato do arquivo.');
      } finally {
        setIsProcessing(false);
      }
    };
    reader.onerror = () => {
      setError('Erro ao ler arquivo do disco.');
      setIsProcessing(false);
    };
    reader.readAsText(selectedFile);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleReset = () => {
    if (result && result.downloadUrl) {
      URL.revokeObjectURL(result.downloadUrl);
    }
    setFile(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div>
        <p className="text-xs font-black uppercase tracking-[0.3em] text-orange-400 mb-2">Usinagem & Vetorização</p>
        <h2 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
          Conversor G-Code <span className="text-orange-400">➔ DXF</span>
        </h2>
        <p className="text-sm text-text-muted mt-2 max-w-2xl">
          Converta seus arquivos de código de corte (G-code) diretamente em vetores CAD no formato DXF.
          Ideal para encarregados inspecionarem contornos e liberarem peças para edição no CorelDRAW ou AutoCAD.
        </p>
      </div>

      {/* Main Container */}
      <div className="glass rounded-2xl p-6 md:p-8 border border-white/5 space-y-6">
        
        {/* Memory notice badge */}
        <div className="flex items-center gap-2 text-xs font-medium text-accent-cyan bg-accent-cyan/10 border border-accent-cyan/20 px-4 py-2.5 rounded-xl">
          <FileCheck size={16} className="shrink-0" />
          <span>Processamento 100% local em memória temporária do navegador (Sem impacto no banco de dados).</span>
        </div>

        {/* Upload Zone */}
        {!result && (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 md:p-12 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-4 ${
              isDragOver
                ? 'border-orange-500 bg-orange-500/10 scale-[1.01]'
                : 'border-white/10 hover:border-orange-500/50 hover:bg-white/[0.02]'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.tap,.nc,.cnc,.gcode"
              onChange={(e) => handleFileSelect(e.target.files[0])}
              className="hidden"
            />

            <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
              <UploadCloud size={32} />
            </div>

            <div>
              <p className="text-base font-bold text-white mb-1">
                Arraste seu arquivo G-Code aqui ou <span className="text-orange-400 underline decoration-orange-400/40">clique para selecionar</span>
              </p>
              <p className="text-xs text-text-muted">
                Suporta extensões: <code className="bg-black/30 text-orange-300 px-1.5 py-0.5 rounded">.txt</code>, <code className="bg-black/30 text-orange-300 px-1.5 py-0.5 rounded">.tap</code>, <code className="bg-black/30 text-orange-300 px-1.5 py-0.5 rounded">.nc</code>, <code className="bg-black/30 text-orange-300 px-1.5 py-0.5 rounded">.gcode</code>
              </p>
            </div>

            {isProcessing && (
              <div className="flex items-center gap-2 text-sm font-bold text-orange-400 mt-2">
                <RefreshCw size={18} className="animate-spin" />
                <span>Processando G-Code e extraindo contornos 2D...</span>
              </div>
            )}
          </div>
        )}

        {/* Error alert */}
        {error && (
          <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm font-semibold">
            <AlertCircle size={18} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Results Area */}
        {result && (
          <div className="space-y-6">

            {/* Success Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 bg-orange-500/10 border border-orange-500/20 rounded-2xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center text-orange-400 shrink-0">
                  <CheckCircle2 size={24} />
                </div>
                <div>
                  <h4 className="text-base font-black text-white">{result.outFileName}</h4>
                  <p className="text-xs text-text-muted">Arquivo DXF gerado e pronto para download</p>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <a
                  href={result.downloadUrl}
                  download={result.outFileName}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-black font-black text-sm rounded-xl transition-all shadow-lg shadow-orange-500/20"
                >
                  <Download size={18} />
                  <span>Baixar DXF (.dxf)</span>
                </a>

                <button
                  onClick={handleReset}
                  className="px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-text-muted hover:text-white rounded-xl text-xs font-bold transition-all"
                >
                  Converter Novo
                </button>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="glass rounded-xl p-5 border border-white/5">
                <div className="flex items-center gap-2 text-accent-success mb-1">
                  <Layers size={18} />
                  <span className="text-xs font-bold uppercase tracking-wider">Peças Únicas 2D</span>
                </div>
                <p className="text-3xl font-black text-white">{result.stats.uniquePiecesCount}</p>
                <p className="text-[10px] text-text-muted mt-1">Camada DXF: PECAS_2D (Verde)</p>
              </div>

              <div className="glass rounded-xl p-5 border border-white/5">
                <div className="flex items-center gap-2 text-accent-cyan mb-1">
                  <Box size={18} />
                  <span className="text-xs font-bold uppercase tracking-wider">Dimensão Total</span>
                </div>
                <p className="text-3xl font-black text-white">
                  {result.stats.totalWidth} <span className="text-sm font-bold text-text-muted">×</span> {result.stats.totalHeight} <span className="text-xs text-text-muted">mm</span>
                </p>
                <p className="text-[10px] text-text-muted mt-1">Largura X × Altura Y</p>
              </div>

              <div className="glass rounded-xl p-5 border border-white/5">
                <div className="flex items-center gap-2 text-orange-400 mb-1">
                  <FileCode size={18} />
                  <span className="text-xs font-bold uppercase tracking-wider">Passes de Corte</span>
                </div>
                <p className="text-3xl font-black text-white">{result.stats.rawPassesCount}</p>
                <p className="text-[10px] text-text-muted mt-1">Camada DXF: PASSADAS_COMPLETAS (Vermelho)</p>
              </div>
            </div>

            {/* Extracted Pieces List */}
            {result.pieceDetails && result.pieceDetails.length > 0 && (
              <div className="glass rounded-2xl border border-white/5 overflow-hidden">
                <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-widest text-white">
                    Detalhamento das Peças Extraídas ({result.pieceDetails.length})
                  </h4>
                </div>

                <div className="divide-y divide-white/5 max-h-72 overflow-y-auto custom-scrollbar">
                  {result.pieceDetails.map((piece) => (
                    <div key={piece.index} className="flex items-center justify-between px-6 py-3 text-xs hover:bg-white/[0.02]">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 font-bold text-[10px] flex items-center justify-center">
                          #{piece.index}
                        </span>
                        <span className="font-semibold text-white">
                          Peça {piece.index}: ~{piece.width} × {piece.height} mm
                        </span>
                      </div>

                      <div className="flex items-center gap-4">
                        <span className="text-text-muted font-medium">{piece.points} pontos</span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          piece.isClosed ? 'bg-accent-success/10 text-accent-success border border-accent-success/20' : 'bg-accent-warning/10 text-accent-warning border border-accent-warning/20'
                        }`}>
                          {piece.isClosed ? 'Contorno Fechado' : 'Contorno Aberto'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
}
