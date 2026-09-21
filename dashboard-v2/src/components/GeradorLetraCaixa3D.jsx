import React, { useState, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { 
  Box, 
  Layers, 
  Download, 
  UploadCloud, 
  RefreshCw, 
  Camera, 
  Eye, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  FileCode, 
  Scissors, 
  Sparkles,
  Maximize2
} from 'lucide-react';
import { buildChannelLetterMesh, checkBlenderServer } from '../utils/letraCaixaEngine';

export function GeradorLetraCaixa3D() {
  // Parâmetros Técnicos
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
  const [svgText, setSvgText] = useState(null);
  const [svgPreview, setSvgPreview] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);

  // Estado da Geração
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationResult, setGenerationResult] = useState(null);
  const [error, setError] = useState(null);
  const [isWireframe, setIsWireframe] = useState(false);
  const [blenderOnline, setBlenderOnline] = useState(false);

  // Three.js Refs
  const canvasContainerRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const gridHelperRef = useRef(null);
  const currentMeshRef = useRef(null);

  // Verificar status do Blender local
  useEffect(() => {
    checkBlenderServer().then(online => setBlenderOnline(online));
  }, []);

  // ─── INICIALIZAÇÃO DA CENA THREE.JS ──────────────────────────────────────────
  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;

    const width = container.clientWidth || 600;
    const height = container.clientHeight || 380;

    // Cena
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0f1d);
    sceneRef.current = scene;

    // Câmera (Elevada, olhando de cima para a mesa)
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 50000);
    camera.position.set(0, 320, 650);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 75, 0);
    controlsRef.current = controls;

    // Mesa de Trabalho (Grid Horizontal no plano XZ em Y=0)
    const grid = new THREE.GridHelper(800, 40, 0x38bdf8, 0x1e293b);
    grid.position.y = 0;
    scene.add(grid);
    gridHelperRef.current = grid;

    // Iluminação
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

    // Loop de Animação
    let animId;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Redimensionamento
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // ─── PRESETS RÁPIDOS ─────────────────────────────────────────────────────────
  const applyPreset = (preset) => {
    switch (preset) {
      case 'padrao':
        setProfundidade(35); setParede(2.0); setRecuoFrente(3.0); setEspAcr(3.0); setRecuoFundo(3.0); setEspFundo(10.0);
        break;
      case 'slim':
        setProfundidade(20); setParede(2.0); setRecuoFrente(3.0); setEspAcr(2.0); setRecuoFundo(2.5); setEspFundo(5.0);
        break;
      case 'reforcada':
        setProfundidade(35); setParede(3.0); setRecuoFrente(5.0); setEspAcr(3.0); setRecuoFundo(4.0); setEspFundo(10.0);
        break;
      case 'profunda':
        setProfundidade(50); setParede(2.5); setRecuoFrente(3.0); setEspAcr(3.0); setRecuoFundo(3.5); setEspFundo(10.0);
        break;
      default: break;
    }
  };

  // ─── UPLOAD & LEITURA DO SVG ─────────────────────────────────────────────────
  const handleFileSelect = (file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext !== 'svg') {
      setError('Formato não suportado. Por favor, envie um arquivo vetorial .SVG.');
      return;
    }

    setError(null);
    setSvgFile(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      setSvgText(text);
      setSvgPreview(text);
    };
    reader.readAsText(file);
  };

  // ─── GERAR MODELO 3D & VETORES ───────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!svgText) {
      setError('Por favor, anexe um arquivo vetor SVG em curvas antes de gerar.');
      return;
    }

    setError(null);
    setIsGenerating(true);

    try {
      const params = {
        largura: parseFloat(largura),
        altura: parseFloat(altura),
        profundidade: parseFloat(profundidade),
        parede: parseFloat(parede),
        recuoFrente: parseFloat(recuoFrente),
        espAcr: parseFloat(espAcr),
        recuoFundo: parseFloat(recuoFundo),
        espFundo: parseFloat(espFundo)
      };

      const result = buildChannelLetterMesh(svgText, params);
      setGenerationResult(result);

      // Atualizar Three.js Viewport
      if (sceneRef.current) {
        if (currentMeshRef.current) {
          sceneRef.current.remove(currentMeshRef.current);
        }

        const meshGroup = result.meshGroup;
        currentMeshRef.current = meshGroup;

        // Medir Bounding Box e nivelar sobre a mesa (Y = 0)
        const box = new THREE.Box3().setFromObject(meshGroup);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        // Centralizar em X e Z, assentar base diretamente sobre a mesa (Y = 0)
        meshGroup.position.x = -center.x;
        meshGroup.position.z = -center.z;
        meshGroup.position.y = -box.min.y;

        sceneRef.current.add(meshGroup);

        // Ajustar grade para o tamanho da peça
        if (gridHelperRef.current) {
          sceneRef.current.remove(gridHelperRef.current);
        }
        const tableSize = Math.max(size.x * 1.5, size.y * 2.5, 600);
        const newGrid = new THREE.GridHelper(tableSize, 40, 0x38bdf8, 0x1e293b);
        newGrid.position.y = 0;
        sceneRef.current.add(newGrid);
        gridHelperRef.current = newGrid;

        // Câmera enquadrando a peça em cima da mesa
        const maxDim = Math.max(size.x, size.y, size.z);
        if (cameraRef.current && controlsRef.current) {
          cameraRef.current.position.set(0, size.y * 1.2 + maxDim * 0.4, maxDim * 1.2);
          cameraRef.current.updateProjectionMatrix();
          controlsRef.current.target.set(0, size.y / 2, 0);
          controlsRef.current.update();
        }
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Erro ao gerar modelo 3D da letra caixa.');
    } finally {
      setIsGenerating(false);
    }
  };

  // ─── DOWNLOAD DE ARQUIVOS ────────────────────────────────────────────────────
  const downloadBlob = (content, filename, type) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ─── CONTROLES DA CÂMERA ─────────────────────────────────────────────────────
  const resetCamera = () => {
    if (cameraRef.current && controlsRef.current) {
      if (currentMeshRef.current) {
        const box = new THREE.Box3().setFromObject(currentMeshRef.current);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        cameraRef.current.position.set(0, size.y * 1.2 + maxDim * 0.4, maxDim * 1.2);
        controlsRef.current.target.set(0, size.y / 2, 0);
      } else {
        cameraRef.current.position.set(0, 320, 650);
        controlsRef.current.target.set(0, 75, 0);
      }
      controlsRef.current.update();
    }
  };

  const toggleWireframe = () => {
    const nextState = !isWireframe;
    setIsWireframe(nextState);
    if (currentMeshRef.current) {
      currentMeshRef.current.traverse((child) => {
        if (child.isMesh && child.material) {
          child.material.wireframe = nextState;
        }
      });
    }
  };

  const handleClear = () => {
    if (currentMeshRef.current && sceneRef.current) {
      sceneRef.current.remove(currentMeshRef.current);
      currentMeshRef.current = null;
    }
    if (gridHelperRef.current && sceneRef.current) {
      sceneRef.current.remove(gridHelperRef.current);
      const grid = new THREE.GridHelper(800, 40, 0x38bdf8, 0x1e293b);
      grid.position.y = 0;
      sceneRef.current.add(grid);
      gridHelperRef.current = grid;
    }
    resetCamera();
    setSvgFile(null);
    setSvgText(null);
    setSvgPreview(null);
    setGenerationResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Cabeçalho */}
      <div>
        <p className="text-xs font-black uppercase tracking-[0.3em] text-orange-400 mb-2">Usinagem & Vetorização 3D</p>
        <h2 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
          Gerador Letra Caixa 3D <span className="text-orange-400">➔ CAD & Vetores</span>
        </h2>
        <p className="text-sm text-text-muted mt-2 max-w-3xl">
          Modelagem paramétrica de letras caixa com rebaixo para encaixe frontal do acrílico e fundo para chapa de PVC.
          Gera malha 3D STL para impressão e vetores 1:1 (SVG/DXF) para corte a laser e router CNC.
        </p>
      </div>

      {/* Badges de Status */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-xs font-medium text-accent-cyan bg-accent-cyan/10 border border-accent-cyan/20 px-3.5 py-2 rounded-xl">
          <CheckCircle2 size={15} />
          <span>Tolerância ±0,05 mm | Encaixes Frente e Fundo Precisos</span>
        </div>
        {blenderOnline && (
          <div className="flex items-center gap-2 text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-2 rounded-xl">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Motor Blender 5.1 Local Conectado (:8080)</span>
          </div>
        )}
      </div>

      {/* Layout Principal em 2 Colunas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* COLUNA ESQUERDA: PARÂMETROS & ENTRADAS (5 Colunas) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Card de Configurações */}
          <div className="glass rounded-2xl p-6 border border-white/5 space-y-5">
            
            {/* Presets Rápidos */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-text-muted mb-2 block">
                ⚡ Configurações Rápidas
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => applyPreset('padrao')}
                  className="px-3 py-2 bg-white/5 hover:bg-orange-500/15 border border-white/10 hover:border-orange-500/30 rounded-xl text-xs font-semibold text-slate-200 hover:text-orange-400 transition-all text-left"
                >
                  ✨ Padrão (35mm)
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('slim')}
                  className="px-3 py-2 bg-white/5 hover:bg-orange-500/15 border border-white/10 hover:border-orange-500/30 rounded-xl text-xs font-semibold text-slate-200 hover:text-orange-400 transition-all text-left"
                >
                  📏 SLIM (20mm)
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('reforcada')}
                  className="px-3 py-2 bg-white/5 hover:bg-orange-500/15 border border-white/10 hover:border-orange-500/30 rounded-xl text-xs font-semibold text-slate-200 hover:text-orange-400 transition-all text-left"
                >
                  🧱 Parede 3mm
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('profunda')}
                  className="px-3 py-2 bg-white/5 hover:bg-orange-500/15 border border-white/10 hover:border-orange-500/30 rounded-xl text-xs font-semibold text-slate-200 hover:text-orange-400 transition-all text-left"
                >
                  💡 Profunda (50mm)
                </button>
              </div>
            </div>

            {/* Grid de Inputs Paramétricos */}
            <div className="space-y-4">
              <label className="text-xs font-bold uppercase tracking-wider text-text-muted block">
                📐 Dimensões Gerais & Paredes
              </label>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-black/30 p-3 rounded-xl border border-white/5">
                  <label className="text-[11px] text-text-muted font-medium block mb-1">Largura [mm]</label>
                  <input
                    type="number"
                    value={largura}
                    onChange={(e) => setLargura(e.target.value)}
                    className="w-full bg-transparent text-white font-mono font-bold text-sm focus:outline-none"
                    min="10"
                    step="10"
                  />
                </div>
                <div className="bg-black/30 p-3 rounded-xl border border-white/5">
                  <label className="text-[11px] text-text-muted font-medium block mb-1">Altura [mm]</label>
                  <input
                    type="number"
                    value={altura}
                    onChange={(e) => setAltura(e.target.value)}
                    className="w-full bg-transparent text-white font-mono font-bold text-sm focus:outline-none"
                    min="10"
                    step="10"
                  />
                </div>
                <div className="bg-black/30 p-3 rounded-xl border border-white/5">
                  <label className="text-[11px] text-text-muted font-medium block mb-1">Profundidade [mm]</label>
                  <input
                    type="number"
                    value={profundidade}
                    onChange={(e) => setProfundidade(e.target.value)}
                    className="w-full bg-transparent text-white font-mono font-bold text-sm focus:outline-none"
                    min="10"
                    step="1"
                  />
                </div>
                <div className="bg-black/30 p-3 rounded-xl border border-white/5">
                  <label className="text-[11px] text-text-muted font-medium block mb-1">Parede Ext [mm]</label>
                  <input
                    type="number"
                    value={parede}
                    onChange={(e) => setParede(e.target.value)}
                    className="w-full bg-transparent text-white font-mono font-bold text-sm focus:outline-none"
                    min="0.5"
                    step="0.5"
                  />
                </div>
              </div>

              {/* Encaixes Acrílico & PVC */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                {/* Face Acrílico */}
                <div className="bg-sky-500/5 p-3 rounded-xl border border-sky-500/20">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400 block mb-2">🔹 Face Acrílico</span>
                  <div className="space-y-2">
                    <div>
                      <span className="text-[10px] text-text-muted">Recuo Dente [mm]</span>
                      <input
                        type="number"
                        value={recuoFrente}
                        onChange={(e) => setRecuoFrente(e.target.value)}
                        className="w-full bg-transparent text-sky-300 font-mono font-bold text-xs focus:outline-none"
                        step="0.5"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-text-muted">Espessura Face [mm]</span>
                      <input
                        type="number"
                        value={espAcr}
                        onChange={(e) => setEspAcr(e.target.value)}
                        className="w-full bg-transparent text-sky-300 font-mono font-bold text-xs focus:outline-none"
                        step="0.5"
                      />
                    </div>
                  </div>
                </div>

                {/* Fundo PVC */}
                <div className="bg-lime-500/5 p-3 rounded-xl border border-lime-500/20">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-lime-400 block mb-2">🔸 Fundo PVC</span>
                  <div className="space-y-2">
                    <div>
                      <span className="text-[10px] text-text-muted">Recuo Fundo [mm]</span>
                      <input
                        type="number"
                        value={recuoFundo}
                        onChange={(e) => setRecuoFundo(e.target.value)}
                        className="w-full bg-transparent text-lime-300 font-mono font-bold text-xs focus:outline-none"
                        step="0.5"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-text-muted">Espessura Fundo [mm]</span>
                      <input
                        type="number"
                        value={espFundo}
                        onChange={(e) => setEspFundo(e.target.value)}
                        className="w-full bg-transparent text-lime-300 font-mono font-bold text-xs focus:outline-none"
                        step="1.0"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Dropzone de Vetor SVG */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-text-muted mb-2 block">
                📁 Vetor da Letra / Logo (.SVG em curvas)
              </label>

              {!svgFile ? (
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragOver(false);
                    if (e.dataTransfer.files?.[0]) handleFileSelect(e.dataTransfer.files[0]);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                    isDragOver
                      ? 'border-orange-500 bg-orange-500/10'
                      : 'border-white/10 hover:border-white/20 bg-black/20 hover:bg-black/30'
                  }`}
                >
                  <UploadCloud className="mx-auto text-orange-400 mb-2" size={32} />
                  <p className="text-sm font-bold text-white mb-1">Arraste o arquivo SVG aqui</p>
                  <p className="text-xs text-text-muted">ou clique para selecionar do computador</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".svg"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                  />
                </div>
              ) : (
                <div className="p-3 bg-white/5 border border-white/10 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-10 h-10 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
                      <FileCode className="text-orange-400" size={20} />
                    </div>
                    <div className="truncate">
                      <p className="text-xs font-bold text-white truncate">{svgFile.name}</p>
                      <p className="text-[10px] text-text-muted">{(svgFile.size / 1024).toFixed(1)} KB • Vetor Pronto</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSvgFile(null);
                      setSvgText(null);
                      setSvgPreview(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="p-1.5 hover:bg-white/10 text-slate-400 hover:text-red-400 rounded-lg transition-colors"
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

            {/* Botão Gerar */}
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-black font-black text-sm uppercase tracking-wider rounded-xl shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="animate-spin" size={18} />
                  <span>Calculando Geometria...</span>
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  <span>Gerar Letra Caixa 3D</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* COLUNA DIREITA: VISUALIZADOR 3D INTERATIVO & EXPORTAÇÕES (7 Colunas) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Card da Viewport 3D */}
          <div className="glass rounded-2xl p-6 border border-white/5 space-y-4">
            
            {/* Header da Viewport com Botões de Ação */}
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <span className="text-xs font-bold text-white flex items-center gap-2">
                <Box size={16} className="text-orange-400" />
                Visualizador CAD 3D Interativo (Gire 360° com o Mouse)
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={resetCamera}
                  title="Resetar Câmera"
                  className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-semibold text-slate-300 hover:text-white transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Camera size={13} />
                  <span className="hidden sm:inline">Reset</span>
                </button>
                <button
                  type="button"
                  onClick={toggleWireframe}
                  title="Alternar Malha Wireframe"
                  className={`px-2.5 py-1.5 border rounded-lg text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                    isWireframe
                      ? 'bg-orange-500/20 border-orange-500 text-orange-400'
                      : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300 hover:text-white'
                  }`}
                >
                  <Eye size={13} />
                  <span className="hidden sm:inline">Wireframe</span>
                </button>
                <button
                  type="button"
                  onClick={handleClear}
                  title="Limpar Área de Trabalho"
                  className="px-2.5 py-1.5 bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-500/30 rounded-lg text-xs font-semibold text-slate-300 hover:text-red-400 transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 size={13} />
                  <span className="hidden sm:inline">Limpar</span>
                </button>
              </div>
            </div>

            {/* Container do Canvas Three.js */}
            <div className="relative w-full h-[380px] bg-slate-950/80 rounded-xl overflow-hidden border border-white/5">
              <div ref={canvasContainerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
              
              {/* Dica de Interação */}
              <div className="absolute bottom-2.5 left-2.5 right-2.5 pointer-events-none flex justify-center">
                <span className="bg-black/60 backdrop-blur-md border border-white/10 text-[10px] text-text-muted px-3 py-1 rounded-full">
                  🖱️ Arraste para girar 360° | Scroll para zoom | Shift + Arraste para mover
                </span>
              </div>
            </div>
          </div>

          {/* Card de Exportações Técnicas (STL, SVG, DXF) */}
          <div className="glass rounded-2xl p-6 border border-white/5 space-y-4">
            <span className="text-xs font-bold uppercase tracking-wider text-text-muted block">
              💾 Exportações para Fabricação (1:1 mm)
            </span>

            {/* Botão Primário: STL para Impressão 3D */}
            <button
              type="button"
              disabled={!generationResult}
              onClick={() => {
                if (generationResult?.stlOutput) {
                  downloadBlob(generationResult.stlOutput, 'letra_caixa_corpo_dente.stl', 'application/octet-stream');
                }
              }}
              className="w-full py-3 bg-white/10 hover:bg-white/15 disabled:opacity-30 disabled:hover:bg-white/10 border border-white/10 hover:border-orange-500/40 rounded-xl text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Download size={16} className="text-orange-400" />
              <span>Baixar STL Corpo + Dentes de Apoio (Impressão 3D)</span>
            </button>

            {/* Grid dos Vetores de Corte 2D */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Face Acrílico */}
              <div className="p-3.5 bg-sky-500/5 border border-sky-500/20 rounded-xl space-y-2.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-sky-400 block">
                  🔹 Face Acrílico (Laser / Router)
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={!generationResult}
                    onClick={() => {
                      if (generationResult?.faceSvg) {
                        downloadBlob(generationResult.faceSvg, 'face_acrilico.svg', 'image/svg+xml');
                      }
                    }}
                    className="flex-1 py-2 bg-sky-500/10 hover:bg-sky-500/20 disabled:opacity-30 border border-sky-500/30 rounded-lg text-sky-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Scissors size={14} />
                    <span>SVG Laser</span>
                  </button>
                  <button
                    type="button"
                    disabled={!generationResult}
                    onClick={() => {
                      if (generationResult?.faceDxf) {
                        downloadBlob(generationResult.faceDxf, 'face_acrilico.dxf', 'application/dxf');
                      }
                    }}
                    className="flex-1 py-2 bg-sky-500/10 hover:bg-sky-500/20 disabled:opacity-30 border border-sky-500/30 rounded-lg text-sky-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <FileCode size={14} />
                    <span>DXF CNC</span>
                  </button>
                </div>
              </div>

              {/* Fundo PVC */}
              <div className="p-3.5 bg-lime-500/5 border border-lime-500/20 rounded-xl space-y-2.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-lime-400 block">
                  🔸 Fundo PVC (Router / Laser)
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={!generationResult}
                    onClick={() => {
                      if (generationResult?.fundoSvg) {
                        downloadBlob(generationResult.fundoSvg, 'fundo_pvc.svg', 'image/svg+xml');
                      }
                    }}
                    className="flex-1 py-2 bg-lime-500/10 hover:bg-lime-500/20 disabled:opacity-30 border border-lime-500/30 rounded-lg text-lime-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Scissors size={14} />
                    <span>SVG Laser</span>
                  </button>
                  <button
                    type="button"
                    disabled={!generationResult}
                    onClick={() => {
                      if (generationResult?.fundoDxf) {
                        downloadBlob(generationResult.fundoDxf, 'fundo_pvc.dxf', 'application/dxf');
                      }
                    }}
                    className="flex-1 py-2 bg-lime-500/10 hover:bg-lime-500/20 disabled:opacity-30 border border-lime-500/30 rounded-lg text-lime-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <FileCode size={14} />
                    <span>DXF CNC</span>
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
