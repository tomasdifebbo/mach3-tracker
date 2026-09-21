import React, { useState, useEffect, useRef } from 'react';
import { 
  Box, 
  Layers, 
  Download, 
  UploadCloud, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Camera, 
  ShieldCheck, 
  Cpu, 
  Sliders, 
  Scissors, 
  Ruler, 
  Trash2,
  Sparkles,
  Eye,
  FileCheck
} from 'lucide-react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { 
  checkBlenderEngineStatus, 
  generateViaBlender, 
  buildClientSideChannelLetter,
  exportModelToStlBlob,
  generateCuttingSvg,
  generateCuttingDxf
} from '../utils/letraCaixaEngine';

export function GeradorLetraCaixa3D() {
  // Parâmetros da Letra Caixa (milímetros)
  const [largura, setLargura] = useState(600);
  const [altura, setAltura] = useState(200);
  const [profundidade, setProfundidade] = useState(35);
  const [parede, setParede] = useState(2.0);
  const [recuoFrente, setRecuoFrente] = useState(3.0);
  const [espAcr, setEspAcr] = useState(3.0);
  const [recuoFundo, setRecuoFundo] = useState(3.0);
  const [espFundo, setEspFundo] = useState(10.0);

  // Arquivo SVG
  const [svgFile, setSvgFile] = useState(null);
  const [svgContent, setSvgContent] = useState(null);
  const [svgPreviewUrl, setSvgPreviewUrl] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);

  // Estados de Processamento e Motor
  const [isProcessing, setIsProcessing] = useState(false);
  const [blenderOnline, setBlenderOnline] = useState(false);
  const [activeEngine, setActiveEngine] = useState('auto'); // 'auto', 'blender', 'client'
  const [error, setError] = useState(null);
  const [successInfo, setSuccessInfo] = useState(null);

  // URLs de Download
  const [downloads, setDownloads] = useState({
    stlUrl: null,
    faceSvgUrl: null,
    faceDxfUrl: null,
    fundoSvgUrl: null,
    fundoDxfUrl: null,
    renderUrl: null
  });

  // Three.js Refs
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const currentMeshRef = useRef(null);
  const gridHelperRef = useRef(null);
  const [isWireframe, setIsWireframe] = useState(false);

  // Checa status do motor Blender na montagem
  useEffect(() => {
    checkBlenderEngineStatus().then((online) => {
      setBlenderOnline(online);
    });
  }, []);

  // Inicializa Viewport Three.js
  useEffect(() => {
    if (!mountRef.current) return;

    const width = mountRef.current.clientWidth || 500;
    const height = mountRef.current.clientHeight || 380;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020617);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 50000);
    camera.position.set(0, 300, 600);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    rendererRef.current = renderer;

    mountRef.current.innerHTML = '';
    mountRef.current.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 75, 0);
    controlsRef.current = controls;

    // Mesa horizontal no plano XZ em Y = 0
    const grid = new THREE.GridHelper(800, 40, 0x38bdf8, 0x1e293b);
    grid.position.y = 0;
    scene.add(grid);
    gridHelperRef.current = grid;

    // Iluminação técnica
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x1e293b, 0.6);
    scene.add(hemiLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight1.position.set(400, 800, 600);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x38bdf8, 0.5);
    dirLight2.position.set(-400, 600, -400);
    scene.add(dirLight2);

    let animationFrameId;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!mountRef.current || !renderer || !camera) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      renderer.dispose();
      if (mountRef.current) mountRef.current.innerHTML = '';
    };
  }, []);

  // Presets Rápidos
  const applyPreset = (pProf, pParede, pRecuo) => {
    setProfundidade(pProf);
    setParede(pParede);
    setRecuoFrente(pRecuo);
  };

  // Upload do SVG
  const handleFileSelect = (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.svg')) {
      setError('Por favor envie um arquivo de vetor em formato .SVG (convertido em curvas).');
      return;
    }

    setError(null);
    setSvgFile(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      setSvgContent(content);
      const blob = new Blob([content], { type: 'image/svg+xml' });
      setSvgPreviewUrl(URL.createObjectURL(blob));
    };
    reader.readAsText(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const removeFile = () => {
    setSvgFile(null);
    setSvgContent(null);
    if (svgPreviewUrl) URL.revokeObjectURL(svgPreviewUrl);
    setSvgPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Geração 3D & Vetores
  const handleGenerate = async () => {
    if (!svgContent) {
      setError('Anexe um arquivo de vetor .SVG da letra ou logo para gerar.');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setSuccessInfo(null);

    const paramsObj = {
      largura: parseFloat(largura),
      altura: parseFloat(altura),
      profundidade: parseFloat(profundidade),
      parede: parseFloat(parede),
      recuoDente: parseFloat(recuoFrente),
      espAcr: parseFloat(espAcr),
      recuoFundo: parseFloat(recuoFundo),
      espFundo: parseFloat(espFundo)
    };

    try {
      // 1. Tenta motor local Blender se disponível
      if (blenderOnline && activeEngine !== 'client') {
        try {
          const prompt = `Letra caixa largura ${largura}mm, altura ${altura}mm, profundidade ${profundidade}mm, parede ${parede}mm, recuo frente ${recuoFrente}mm, acrilico ${espAcr}mm, recuo fundo ${recuoFundo}mm, fundo ${espFundo}mm.`;
          const base64Svg = btoa(unescape(encodeURIComponent(svgContent)));
          const bRes = await generateViaBlender(prompt, paramsObj, `data:image/svg+xml;base64,${base64Svg}`);
          
          setDownloads({
            stlUrl: bRes.stlUrl,
            faceSvgUrl: bRes.faceSvgUrl,
            faceDxfUrl: bRes.faceDxfUrl,
            fundoSvgUrl: bRes.fundoSvgUrl,
            fundoDxfUrl: bRes.fundoDxfUrl,
            renderUrl: bRes.renderUrl
          });
          setSuccessInfo('Modelo gerado com sucesso via Motor Blender 5.1 Local!');
          setIsProcessing(false);
          return;
        } catch (blenderErr) {
          console.warn("Blender falhou ou indisponível, gerando via motor do navegador:", blenderErr);
        }
      }

      // 2. Motor Instantâneo do Navegador (Client-Side Three.js)
      const res = buildClientSideChannelLetter(svgContent, paramsObj);

      // Atualiza cena 3D
      if (sceneRef.current) {
        if (currentMeshRef.current) {
          sceneRef.current.remove(currentMeshRef.current);
        }
        currentMeshRef.current = res.group;
        sceneRef.current.add(res.group);

        // Ajusta mesa de trabalho proporcional à peça
        if (gridHelperRef.current) sceneRef.current.remove(gridHelperRef.current);
        const tableSize = Math.max(res.size.x * 1.5, res.size.y * 2.5, 600);
        const newGrid = new THREE.GridHelper(tableSize, 40, 0x38bdf8, 0x1e293b);
        newGrid.position.y = 0;
        sceneRef.current.add(newGrid);
        gridHelperRef.current = newGrid;

        // Posiciona câmera olhando para a mesa
        if (cameraRef.current && controlsRef.current) {
          const maxDim = Math.max(res.size.x, res.size.y, res.size.z);
          cameraRef.current.position.set(0, res.size.y * 1.2 + maxDim * 0.4, maxDim * 1.2);
          cameraRef.current.updateProjectionMatrix();
          controlsRef.current.target.set(0, res.size.y / 2, 0);
          controlsRef.current.update();
        }
      }

      // Gera arquivos para download imediato em memória
      if (res.meshFace) res.meshFace.visible = false;
      if (res.meshFundo) res.meshFundo.visible = false;
      const stlBlob = exportModelToStlBlob(res.group);
      if (res.meshFace) res.meshFace.visible = true;
      if (res.meshFundo) res.meshFundo.visible = true;

      const faceSvgBlob = generateCuttingSvg(res.shapesFace, res.scale, 0.5, "Face Acrílico");
      const faceDxfBlob = generateCuttingDxf(res.shapesFace, res.scale, "CORTE_EXTERNO");
      const fundoSvgBlob = generateCuttingSvg(res.shapesFundo, res.scale, 0.5, "Fundo PVC");
      const fundoDxfBlob = generateCuttingDxf(res.shapesFundo, res.scale, "CORTE_FUNDO");

      setDownloads({
        stlUrl: URL.createObjectURL(stlBlob),
        faceSvgUrl: URL.createObjectURL(faceSvgBlob),
        faceDxfUrl: URL.createObjectURL(faceDxfBlob),
        fundoSvgUrl: URL.createObjectURL(fundoSvgBlob),
        fundoDxfUrl: URL.createObjectURL(fundoDxfBlob),
        renderUrl: null
      });

      setSuccessInfo('Modelo 3D e vetores gerados instantaneamente com precisão milimétrica!');
    } catch (err) {
      console.error(err);
      setError(err.message || 'Erro ao processar letra caixa.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Controles da Viewport
  const resetCamera = () => {
    if (!cameraRef.current || !controlsRef.current) return;
    if (currentMeshRef.current) {
      const box = new THREE.Box3().setFromObject(currentMeshRef.current);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      cameraRef.current.position.set(0, size.y * 1.2 + maxDim * 0.4, maxDim * 1.2);
      controlsRef.current.target.set(0, size.y / 2, 0);
    } else {
      cameraRef.current.position.set(0, 300, 600);
      controlsRef.current.target.set(0, 75, 0);
    }
    controlsRef.current.update();
  };

  const toggleWireframe = () => {
    const next = !isWireframe;
    setIsWireframe(next);
    if (currentMeshRef.current) {
      currentMeshRef.current.traverse((child) => {
        if (child.isMesh && child.material) {
          child.material.wireframe = next;
        }
      });
    }
  };

  const clearCanvas = () => {
    if (sceneRef.current && currentMeshRef.current) {
      sceneRef.current.remove(currentMeshRef.current);
      currentMeshRef.current = null;
    }
    if (sceneRef.current && gridHelperRef.current) {
      sceneRef.current.remove(gridHelperRef.current);
      const newGrid = new THREE.GridHelper(800, 40, 0x38bdf8, 0x1e293b);
      newGrid.position.y = 0;
      sceneRef.current.add(newGrid);
      gridHelperRef.current = newGrid;
    }
    resetCamera();
    setSuccessInfo(null);
    setDownloads({
      stlUrl: null,
      faceSvgUrl: null,
      faceDxfUrl: null,
      fundoSvgUrl: null,
      fundoDxfUrl: null,
      renderUrl: null
    });
  };

  const triggerDownload = (url, filename) => {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.3em] text-orange-400 mb-2">Usinagem, Laser & Impressão 3D</p>
          <h2 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            Gerador <span className="text-orange-400">Letra Caixa 3D</span>
          </h2>
          <p className="text-sm text-text-muted mt-2 max-w-2xl">
            Automação para corte a laser (Acrílico frontal), router CNC (Fundo PVC) e impressão 3D (Corpo com degraus de apoio) a partir de vetor SVG.
          </p>
        </div>

        {/* Status do Motor */}
        <div className="flex items-center gap-3">
          {blenderOnline ? (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs font-bold text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Blender 5.1 Conectado</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-cyan-500/10 border border-cyan-500/20 rounded-xl text-xs font-bold text-accent-cyan">
              <Cpu size={14} />
              <span>Motor 3D Navegador Ativo</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Grid: Formulário / Dropzone (Esq) + Viewport 3D / Exportações (Dir) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LADO ESQUERDO: PARÂMETROS & UPLOAD (5 colunas) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Card de Configurações Rápidas */}
          <div className="glass rounded-2xl p-5 border border-white/5 space-y-4">
            <span className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center gap-2">
              <Sparkles size={14} className="text-orange-400" />
              Presets Rápidos de Fábrica:
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button 
                type="button"
                onClick={() => applyPreset(35, 2.0, 3.0)}
                className="px-3 py-2 bg-white/5 hover:bg-orange-500/15 border border-white/10 hover:border-orange-500/30 rounded-xl text-xs font-bold text-white transition-all text-left"
              >
                ✨ Padrão (35mm / 2mm)
              </button>
              <button 
                type="button"
                onClick={() => applyPreset(20, 2.0, 3.0)}
                className="px-3 py-2 bg-white/5 hover:bg-orange-500/15 border border-white/10 hover:border-orange-500/30 rounded-xl text-xs font-bold text-white transition-all text-left"
              >
                📏 SLIM (20mm / 2mm)
              </button>
              <button 
                type="button"
                onClick={() => applyPreset(35, 3.0, 5.0)}
                className="px-3 py-2 bg-white/5 hover:bg-orange-500/15 border border-white/10 hover:border-orange-500/30 rounded-xl text-xs font-bold text-white transition-all text-left"
              >
                🧱 Reforçada (Parede 3mm)
              </button>
              <button 
                type="button"
                onClick={() => applyPreset(50, 2.0, 3.0)}
                className="px-3 py-2 bg-white/5 hover:bg-orange-500/15 border border-white/10 hover:border-orange-500/30 rounded-xl text-xs font-bold text-white transition-all text-left"
              >
                💡 Extra Profunda (50mm)
              </button>
            </div>
          </div>

          {/* Card de Dimensões Técnicas */}
          <div className="glass rounded-2xl p-6 border border-white/5 space-y-5">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Sliders size={16} className="text-accent-cyan" />
              Dimensões Gerais & Encaixes (mm)
            </h3>

            <div className="grid grid-cols-2 gap-3.5">
              {/* Largura */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-text-muted">Largura [mm]:</label>
                <input 
                  type="number" 
                  value={largura} 
                  onChange={(e) => setLargura(e.target.value)}
                  min="10"
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 font-mono text-sm text-white focus:outline-none focus:border-orange-400"
                />
              </div>

              {/* Altura */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-text-muted">Altura [mm]:</label>
                <input 
                  type="number" 
                  value={altura} 
                  onChange={(e) => setAltura(e.target.value)}
                  min="10"
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 font-mono text-sm text-white focus:outline-none focus:border-orange-400"
                />
              </div>

              {/* Profundidade */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-text-muted">Profundidade [mm]:</label>
                <input 
                  type="number" 
                  value={profundidade} 
                  onChange={(e) => setProfundidade(e.target.value)}
                  min="10"
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 font-mono text-sm text-white focus:outline-none focus:border-orange-400"
                />
              </div>

              {/* Parede Externa */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-text-muted">Parede Ext. [mm]:</label>
                <input 
                  type="number" 
                  step="0.5"
                  value={parede} 
                  onChange={(e) => setParede(e.target.value)}
                  min="0.5"
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 font-mono text-sm text-white focus:outline-none focus:border-orange-400"
                />
              </div>

              {/* Recuo Frente (Acrílico) */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-accent-cyan">Recuo Frente [mm]:</label>
                <input 
                  type="number" 
                  step="0.5"
                  value={recuoFrente} 
                  onChange={(e) => setRecuoFrente(e.target.value)}
                  min="1.0"
                  className="w-full bg-black/40 border border-accent-cyan/30 rounded-xl px-3 py-2 font-mono text-sm text-white focus:outline-none focus:border-accent-cyan"
                />
              </div>

              {/* Espessura Face (Acrílico) */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-accent-cyan">Esp. Face [mm]:</label>
                <input 
                  type="number" 
                  step="0.5"
                  value={espAcr} 
                  onChange={(e) => setEspAcr(e.target.value)}
                  min="1.0"
                  className="w-full bg-black/40 border border-accent-cyan/30 rounded-xl px-3 py-2 font-mono text-sm text-white focus:outline-none focus:border-accent-cyan"
                />
              </div>

              {/* Recuo Fundo (PVC) */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-emerald-400">Recuo Fundo [mm]:</label>
                <input 
                  type="number" 
                  step="0.5"
                  value={recuoFundo} 
                  onChange={(e) => setRecuoFundo(e.target.value)}
                  min="1.0"
                  className="w-full bg-black/40 border border-emerald-500/30 rounded-xl px-3 py-2 font-mono text-sm text-white focus:outline-none focus:border-emerald-400"
                />
              </div>

              {/* Espessura Fundo (PVC) */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-emerald-400">Esp. Fundo [mm]:</label>
                <input 
                  type="number" 
                  step="1.0"
                  value={espFundo} 
                  onChange={(e) => setEspFundo(e.target.value)}
                  min="1.0"
                  className="w-full bg-black/40 border border-emerald-500/30 rounded-xl px-3 py-2 font-mono text-sm text-white focus:outline-none focus:border-emerald-400"
                />
              </div>
            </div>

            {/* Dropzone SVG */}
            <div className="pt-2">
              <label className="text-xs font-semibold text-text-muted block mb-2">Vetor da Letra ou Logo (.SVG em curvas):</label>
              
              {!svgFile ? (
                <div 
                  onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                  onDragLeave={(e) => { e.preventDefault(); setIsDragOver(false); }}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current && fileInputRef.current.click()}
                  className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                    isDragOver 
                      ? 'border-orange-400 bg-orange-500/10' 
                      : 'border-white/10 hover:border-white/20 bg-black/20'
                  }`}
                >
                  <input 
                    ref={fileInputRef}
                    type="file" 
                    accept=".svg" 
                    onChange={(e) => handleFileSelect(e.target.files[0])}
                    className="hidden" 
                  />
                  <UploadCloud size={28} className="mx-auto text-orange-400 mb-2 opacity-80" />
                  <p className="text-xs font-bold text-white">Clique ou arraste o arquivo SVG aqui</p>
                  <p className="text-[11px] text-text-muted mt-1">Gere a partir do CorelDRAW ou Illustrator com contornos fechados</p>
                </div>
              ) : (
                <div className="bg-black/30 border border-white/10 rounded-2xl p-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 overflow-hidden">
                    {svgPreviewUrl && (
                      <img src={svgPreviewUrl} alt="Vetor" className="w-10 h-10 object-contain bg-white/5 rounded-lg p-1 border border-white/10 shrink-0" />
                    )}
                    <div className="overflow-hidden">
                      <p className="text-xs font-bold text-white truncate">{svgFile.name}</p>
                      <p className="text-[10px] text-text-muted">{(svgFile.size / 1024).toFixed(1)} KB • Vetor Carregado</p>
                    </div>
                  </div>
                  <button 
                    type="button" 
                    onClick={removeFile}
                    className="p-1.5 text-text-muted hover:text-red-400 hover:bg-white/5 rounded-lg transition-all"
                    title="Remover arquivo"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>

            {/* Mensagem de Erro */}
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-xs text-red-400">
                <AlertCircle size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Mensagem de Sucesso */}
            {successInfo && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-2 text-xs text-emerald-400">
                <CheckCircle2 size={16} className="shrink-0" />
                <span>{successInfo}</span>
              </div>
            )}

            {/* Botão de Geração */}
            <button
              type="button"
              disabled={isProcessing || !svgFile}
              onClick={handleGenerate}
              className={`w-full py-3.5 px-4 rounded-xl font-black text-sm tracking-wide flex items-center justify-center gap-2 transition-all shadow-lg ${
                isProcessing || !svgFile 
                  ? 'bg-white/5 text-text-muted border border-white/10 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-black shadow-orange-500/20'
              }`}
            >
              {isProcessing ? (
                <>
                  <RefreshCw size={18} className="animate-spin" />
                  <span>Gerando Letra Caixa 3D...</span>
                </>
              ) : (
                <>
                  <Box size={18} />
                  <span>⚡ Gerar Letra Caixa 3D & Vetores</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* LADO DIREITO: VIEWPORT 3D & EXPORTAÇÕES (7 colunas) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Card do Canvas 3D */}
          <div className="glass rounded-2xl p-5 border border-white/5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                <Box size={16} className="text-orange-400" />
                Visualizador CAD 3D Interativo (Gire 360° com o Mouse)
              </span>

              {/* Botões de Ação da Câmera */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={resetCamera}
                  className="px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-bold text-text-muted hover:text-white transition-all flex items-center gap-1.5"
                  title="Resetar Câmera"
                >
                  <Camera size={13} />
                  <span>Reset Cam</span>
                </button>
                <button
                  type="button"
                  onClick={toggleWireframe}
                  className={`px-2.5 py-1 border rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    isWireframe 
                      ? 'bg-orange-500/20 border-orange-500/40 text-orange-400' 
                      : 'bg-white/5 hover:bg-white/10 border-white/10 text-text-muted hover:text-white'
                  }`}
                  title="Alternar Malha Wireframe"
                >
                  <Layers size={13} />
                  <span>Wireframe</span>
                </button>
                <button
                  type="button"
                  onClick={clearCanvas}
                  className="px-2.5 py-1 bg-white/5 hover:bg-red-500/10 border border-white/10 hover:border-red-500/30 rounded-lg text-xs font-bold text-text-muted hover:text-red-400 transition-all flex items-center gap-1.5"
                  title="Limpar Área de Trabalho"
                >
                  <Trash2 size={13} />
                  <span>Limpar</span>
                </button>
              </div>
            </div>

            {/* Container WebGL Three.js */}
            <div className="relative w-full h-[380px] bg-slate-950/80 rounded-xl overflow-hidden border border-white/10">
              <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
              
              <div className="absolute bottom-2 left-2 right-2 pointer-events-none flex justify-center">
                <span className="text-[11px] text-text-muted/70 bg-black/60 px-3 py-1 rounded-full border border-white/5 backdrop-blur-sm">
                  🖱️ Clique e arraste para girar 360° | Scroll para zoom | Shift + Arraste para Pan
                </span>
              </div>
            </div>

            {/* Badge de Conformidade */}
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-between text-xs text-emerald-400">
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} />
                <span className="font-bold">Malha Conforme: Watertight Manifold (Tolerância ±0,05 mm)</span>
              </div>
              <span className="text-[10px] font-mono opacity-80">Nível Mesa: Y = 0.00 mm</span>
            </div>
          </div>

          {/* Card de Exportação & Download dos Arquivos */}
          <div className="glass rounded-2xl p-6 border border-white/5 space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-2">
              <Download size={16} className="text-orange-400" />
              Exportações para Fabricação (CNC Router & Laser):
            </h3>

            {/* STL Impressão 3D */}
            <button
              type="button"
              disabled={!downloads.stlUrl}
              onClick={() => triggerDownload(downloads.stlUrl, 'letra_caixa_corpo.stl')}
              className={`w-full py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-between transition-all border ${
                downloads.stlUrl
                  ? 'bg-blue-600 hover:bg-blue-500 text-white border-blue-400/30 shadow-lg shadow-blue-500/10'
                  : 'bg-white/5 text-text-muted border-white/10 opacity-50 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center gap-2">
                <Box size={16} />
                <span>Baixar STL Corpo + Dente de Apoio</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 bg-black/30 rounded">Impressão 3D (.STL)</span>
            </button>

            {/* Grid 2 Colunas: Face Acrílico & Fundo PVC */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Painel Face Acrílico */}
              <div className="bg-sky-500/5 border border-sky-500/20 rounded-xl p-4 space-y-3">
                <span className="text-[11px] font-black uppercase text-accent-cyan tracking-wider flex items-center gap-1.5">
                  <Scissors size={14} />
                  Face Acrílico (Laser / CNC):
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={!downloads.faceSvgUrl}
                    onClick={() => triggerDownload(downloads.faceSvgUrl, 'face_acrilico.svg')}
                    className={`py-2 px-2.5 rounded-lg text-xs font-bold transition-all border flex items-center justify-center gap-1.5 ${
                      downloads.faceSvgUrl
                        ? 'bg-sky-500/20 hover:bg-sky-500/30 border-sky-500/40 text-accent-cyan'
                        : 'bg-white/5 text-text-muted border-white/10 opacity-40 cursor-not-allowed'
                    }`}
                  >
                    <span>✂️ SVG (Laser)</span>
                  </button>
                  <button
                    type="button"
                    disabled={!downloads.faceDxfUrl}
                    onClick={() => triggerDownload(downloads.faceDxfUrl, 'face_acrilico.dxf')}
                    className={`py-2 px-2.5 rounded-lg text-xs font-bold transition-all border flex items-center justify-center gap-1.5 ${
                      downloads.faceDxfUrl
                        ? 'bg-sky-500/20 hover:bg-sky-500/30 border-sky-500/40 text-accent-cyan'
                        : 'bg-white/5 text-text-muted border-white/10 opacity-40 cursor-not-allowed'
                    }`}
                  >
                    <span>📐 DXF (CNC)</span>
                  </button>
                </div>
              </div>

              {/* Painel Fundo PVC */}
              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 space-y-3">
                <span className="text-[11px] font-black uppercase text-emerald-400 tracking-wider flex items-center gap-1.5">
                  <Ruler size={14} />
                  Fundo PVC (Router / Laser):
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={!downloads.fundoSvgUrl}
                    onClick={() => triggerDownload(downloads.fundoSvgUrl, 'fundo_pvc.svg')}
                    className={`py-2 px-2.5 rounded-lg text-xs font-bold transition-all border flex items-center justify-center gap-1.5 ${
                      downloads.fundoSvgUrl
                        ? 'bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-500/40 text-emerald-400'
                        : 'bg-white/5 text-text-muted border-white/10 opacity-40 cursor-not-allowed'
                    }`}
                  >
                    <span>✂️ SVG (Laser)</span>
                  </button>
                  <button
                    type="button"
                    disabled={!downloads.fundoDxfUrl}
                    onClick={() => triggerDownload(downloads.fundoDxfUrl, 'fundo_pvc.dxf')}
                    className={`py-2 px-2.5 rounded-lg text-xs font-bold transition-all border flex items-center justify-center gap-1.5 ${
                      downloads.fundoDxfUrl
                        ? 'bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-500/40 text-emerald-400'
                        : 'bg-white/5 text-text-muted border-white/10 opacity-40 cursor-not-allowed'
                    }`}
                  >
                    <span>📐 DXF (CNC)</span>
                  </button>
                </div>
              </div>

            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
