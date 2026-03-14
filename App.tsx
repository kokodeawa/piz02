import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Stroke, ToolType, CanvasTransform, BackgroundType, PatternType, CanvasDocument } from './types';
import { getStroke } from 'perfect-freehand';
import { GoogleGenAI } from "@google/genai";
import { CanvasBoard } from './components/CanvasBoard';
import { Toolbar } from './components/Toolbar';
import { ZoomWindow } from './components/ZoomWindow';
import { Dashboard } from './components/Dashboard';
import { v4 as uuidv4 } from 'uuid';
import { jsPDF } from 'jspdf';
import { drawStroke, drawBackground } from './utils/canvas';
import { renderLatexToDataUrl } from './utils/math';
import { Sparkles, X, Loader2, Send } from 'lucide-react';

export default function App() {
  const [view, setView] = useState<'dashboard' | 'editor'>('dashboard');
  const [documents, setDocuments] = useState<CanvasDocument[]>([]);
  const [currentDocId, setCurrentDocId] = useState<string | null>(null);

  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [laserStrokes, setLaserStrokes] = useState<Stroke[]>([]);
  const currentStrokeRef = useRef<Stroke | null>(null);
  const [undoStack, setUndoStack] = useState<Stroke[][]>([]);
  const [redoStack, setRedoStack] = useState<Stroke[][]>([]);
  const getInitialBoardSize = () => {
    const isLandscape = window.innerWidth > window.innerHeight;
    if (isLandscape) {
      return { width: window.innerWidth * 0.65, height: window.innerHeight };
    } else {
      return { width: window.innerWidth, height: window.innerHeight * 0.65 };
    }
  };

  const [boardSize, setBoardSize] = useState(getInitialBoardSize());
  const prevBoardSizeRef = useRef(boardSize);

  useEffect(() => {
    const handleResize = () => {
      setBoardSize(getInitialBoardSize());
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  const [tool, setTool] = useState<ToolType>('pen');
  const [color, setColor] = useState('#000000');
  const [size, setSize] = useState(4);
  const [laserColor, setLaserColor] = useState('#ef4444');
  const [laserSize, setLaserSize] = useState(8);
  const [eraserSize, setEraserSize] = useState(24);
  const [background, setBackground] = useState<BackgroundType>('blank');
  const [pattern, setPattern] = useState<PatternType>('grid');
  const [lupaVisible, setLupaVisible] = useState(true);
  
  const [transform, setTransform] = useState<CanvasTransform>({ x: 0, y: 0, scale: 1 });
  
  const [lupaPos, setLupaPos] = useState({ x: 0, y: 0, width: 400, height: 200, zoom: 2 });
  const [isToolbarVisible, setIsToolbarVisible] = useState(true);

  // AI Assistant State
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [aiPrompt, setAIPrompt] = useState('');
  const [isAILoading, setIsAILoading] = useState(false);
  const [aiError, setAIError] = useState<string | null>(null);

  const handleAIGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setIsAILoading(true);
    setAIError(null);
    console.log('Starting AI generation with prompt:', aiPrompt);
    
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('La clave de API de Gemini no está configurada en el entorno.');
      }

      const ai = new GoogleGenAI({ apiKey });
      
      // Add a manual timeout to the AI request
      const generatePromise = ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Eres un profesor experto. Genera ejercicios educativos basados en este pedido: "${aiPrompt}". 
        
        REGLAS CRÍTICAS DE FORMATO:
        1. Usa LaTeX para TODAS las expresiones matemáticas.
        2. Para fracciones, usa SIEMPRE \\frac{numerador}{denominador}.
        3. Para multiplicaciones usa \\times y para divisiones usa \\div o \\frac.
        4. Si hay varios ejercicios, úsalos dentro de un entorno aligned para que queden uno debajo de otro.
        5. Ejemplo de salida multilínea: "\\begin{aligned} 1) & \\frac{1}{2} + \\frac{3}{4} = \\\\ 2) & 5 \\times 4 = \\end{aligned}"
        6. NO incluyas texto explicativo, SOLO el bloque de LaTeX.`,
      });

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('La solicitud tardó demasiado tiempo (30s). Por favor, intenta de nuevo.')), 30000)
      );

      const response = await Promise.race([generatePromise, timeoutPromise]) as any;
      
      console.log('AI Response received:', response);
      
      let latex = response.text;
      if (latex) {
        // Clean up markdown code blocks if present
        latex = latex.replace(/```latex/g, '').replace(/```/g, '').trim();
        console.log('Cleaned LaTeX:', latex);
        
        const textColor = (background === 'dark' || background === 'navy' || background === 'black' || background === 'gray' || background === 'universe' || background === 'mosaic') ? '#ffffff' : '#000000';
        
        const { dataUrl, width, height } = await renderLatexToDataUrl(latex, textColor);
        console.log('Rendered LaTeX to DataURL');
        
        // Add text to the board at the center of the current view
        const centerX = (boardSize.width / 2 - transform.x) / transform.scale;
        const centerY = (boardSize.height / 2 - transform.y) / transform.scale;
        
        const newStroke: Stroke = {
          id: uuidv4(),
          points: [[centerX, centerY, 1]],
          color: textColor,
          size: size,
          tool: 'pen',
          text: latex,
          imageData: dataUrl,
          imageWidth: width,
          imageHeight: height,
          createdAt: Date.now()
        };
        
        setStrokes(prev => [...prev, newStroke]);
        setUndoStack(prev => [...prev, strokes]);
        setRedoStack([]);
        setIsAIModalOpen(false);
        setAIPrompt('');
      } else {
        throw new Error('La IA no devolvió ningún contenido. Intenta con un pedido diferente.');
      }
    } catch (error) {
      console.error('AI generation failed:', error);
      setAIError(error instanceof Error ? error.message : 'Error desconocido al generar ejercicios.');
    } finally {
      setIsAILoading(false);
    }
  };

  const viewRef = useRef(view);
  useEffect(() => { viewRef.current = view; }, [view]);

  // Save documents to localStorage
  useEffect(() => {
    localStorage.setItem('pizarra-documents', JSON.stringify(documents));
  }, [documents]);

  // Update current document when strokes or other properties change
  useEffect(() => {
    if (view === 'editor' && currentDocId) {
      const timer = setTimeout(() => {
        setDocuments(prev => prev.map(doc => {
          if (doc.id === currentDocId) {
            return {
              ...doc,
              strokes,
              background,
              pattern,
              transform,
              lupaPos,
              lastModified: Date.now()
            };
          }
          return doc;
        }));
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [strokes, background, pattern, transform, lupaPos, view, currentDocId]);

  const handleSelectDocument = useCallback((doc: CanvasDocument) => {
    setCurrentDocId(doc.id);
    setStrokes(doc.strokes);
    setBackground(doc.background);
    setPattern(doc.pattern);
    setTransform(doc.transform);
    setLupaPos(doc.lupaPos);
    setUndoStack([]);
    setRedoStack([]);
    setView('editor');
  }, []);

  const handleCreateDocument = useCallback(() => {
    // Calculate center of the visible canvas area
    // In landscape: ZoomWindow takes 35vw on the right, so canvas is 65vw on the left
    // In portrait: ZoomWindow takes 35vh on the bottom, so canvas is 65vh on the top
    const isLandscape = window.innerWidth > window.innerHeight;
    let centerX, centerY;

    if (isLandscape) {
      centerX = (window.innerWidth * 0.65) / 2;
      centerY = window.innerHeight / 2;
    } else {
      centerX = window.innerWidth / 2;
      centerY = (window.innerHeight * 0.65) / 2;
    }

    // Assuming default lupa size is 400x200
    const lupaWidth = 400;
    const lupaHeight = 200;

    const newDoc: CanvasDocument = {
      id: uuidv4(),
      name: `Lienzo ${documents.length + 1}`,
      lastModified: Date.now(),
      strokes: [],
      background: 'blank',
      pattern: 'grid',
      transform: { x: 0, y: 0, scale: 1 },
      lupaPos: { 
        x: centerX, 
        y: centerY, 
        width: lupaWidth, 
        height: lupaHeight, 
        zoom: 2 
      }
    };
    setDocuments(prev => [...prev, newDoc]);
    handleSelectDocument(newDoc);
  }, [documents.length, handleSelectDocument]);

  const handleDeleteDocument = useCallback((id: string) => {
    setDocuments(prev => prev.filter(doc => doc.id !== id));
  }, []);

  const handleRenameDocument = useCallback((id: string, newName: string) => {
    setDocuments(prev => prev.map(doc => doc.id === id ? { ...doc, name: newName } : doc));
  }, []);

  const handleExit = useCallback(() => {
    setView('dashboard');
    setCurrentDocId(null);
  }, []);

  // Load documents from localStorage and History trap
  useEffect(() => {
    // History trap to prevent back gesture from exiting
    window.history.pushState(null, '', window.location.href);
    const handlePopState = () => {
      if (viewRef.current === 'editor') {
        handleExit();
        window.history.pushState(null, '', window.location.href);
      } else {
        window.history.pushState(null, '', window.location.href);
      }
    };
    window.addEventListener('popstate', handlePopState);

    // Prevent edge swipes (back/forward) in some browsers
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        const x = e.touches[0].clientX;
        const edgeThreshold = 30; // 30px from edge
        if (x < edgeThreshold || x > window.innerWidth - edgeThreshold) {
          // This is an edge touch, prevent default to avoid back/forward navigation
          // Note: This might be ignored by some browsers for system gestures
          // but helps with browser-level navigation.
          // e.preventDefault(); // This can be risky, let's just be aware
        }
      }
    };
    window.addEventListener('touchstart', handleTouchStart, { passive: false });

    const saved = localStorage.getItem('pizarra-documents');
    if (saved) {
      try {
        setDocuments(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load documents', e);
      }
    } else {
      // Initialize with a default document if no saved documents
      const isLandscape = window.innerWidth > window.innerHeight;
      let centerX, centerY;

      if (isLandscape) {
        centerX = (window.innerWidth * 0.65) / 2;
        centerY = window.innerHeight / 2;
      } else {
        centerX = window.innerWidth / 2;
        centerY = (window.innerHeight * 0.65) / 2;
      }

      const initialDoc: CanvasDocument = {
        id: uuidv4(),
        name: 'Lienzo 1',
        lastModified: Date.now(),
        strokes: [],
        background: 'blank',
        pattern: 'grid',
        transform: { x: 0, y: 0, scale: 1 },
        lupaPos: { 
          x: centerX, 
          y: centerY, 
          width: 400, 
          height: 200, 
          zoom: 2 
        }
      };
      setDocuments([initialDoc]);
      setCurrentDocId(initialDoc.id);
      setStrokes([]);
    }

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('touchstart', handleTouchStart);
    };
  }, [handleExit]);

  // Save state before stroke
  const handleStrokeStart = useCallback(() => {
    if (tool === 'laser') return;
    // History is now saved in handleStrokeEnd and onHistorySave to prevent cancelled strokes from adding to history
  }, [tool]);

  const handleHistorySave = useCallback((oldStrokes: Stroke[]) => {
    setUndoStack(prev => [...prev, oldStrokes]);
    setRedoStack([]);
  }, []);

  const handleStrokeEnd = useCallback((stroke: Stroke) => {
    if (stroke) {
      if (stroke.tool === 'laser') {
        setLaserStrokes(prev => [...prev, { ...stroke, opacity: 1 }]);
      } else {
        // Pre-calculate outline for performance
        const options = {
          size: stroke.size,
          thinning: 0.5,
          smoothing: 0.5,
          streamline: 0.5,
        };
        const outline = getStroke(stroke.points, options);
        const strokeWithOutline = { ...stroke, outline };
        
        setStrokes(prev => [...prev, strokeWithOutline]);
        setUndoStack(prev => [...prev, strokes]);
        setRedoStack([]);
      }
      currentStrokeRef.current = null;
    }
  }, [strokes]);

  const handleFindLupa = useCallback(() => {
    setTransform(prev => ({
      ...prev,
      x: boardSize.width / 2 - lupaPos.x * prev.scale,
      y: boardSize.height / 2 - lupaPos.y * prev.scale
    }));
  }, [lupaPos.x, lupaPos.y, boardSize]);

  const handleToggleLupaVisibility = useCallback(() => {
    setLupaVisible(prev => !prev);
  }, []);

  const handleZoomWindowResize = useCallback((width: number, height: number) => {
    const roundedWidth = Math.round(width);
    const roundedHeight = Math.round(height);
    setLupaPos(prev => {
      if (prev.width === roundedWidth && prev.height === roundedHeight) return prev;
      return {
        ...prev,
        width: roundedWidth,
        height: roundedHeight
      };
    });
  }, []);

  // Laser pointer fade effect using requestAnimationFrame for better performance
  useEffect(() => {
    let lastTime = performance.now();
    let animationFrameId: number;

    const updateLaser = (time: number) => {
      const deltaTime = time - lastTime;
      
      // Update roughly every 24ms
      if (deltaTime >= 24) {
        lastTime = time;
        setLaserStrokes(prev => {
          if (prev.length === 0) return prev;
          let changed = false;
          const next = prev.map(s => {
            const currentOpacity = s.opacity ?? 1;
            if (currentOpacity > 0) {
              changed = true;
              // Faster contraction: remove points proportional to length
              const sliceCount = Math.max(1, Math.floor(s.points.length / 8));
              const newPoints = s.points.length > sliceCount ? s.points.slice(sliceCount) : s.points;
              const options = {
                size: s.size,
                thinning: 0.5,
                smoothing: 0.5,
                streamline: 0.5,
              };
              const outline = getStroke(newPoints, options);
              // Slower fade: decrease opacity decay so it stays visible while contracting
              return { ...s, opacity: currentOpacity - 0.01, points: newPoints, outline };
            }
            return s;
          }).filter(s => (s.opacity ?? 0) > 0 && s.points.length > 1);
          return changed ? next : prev;
        });
      }
      animationFrameId = requestAnimationFrame(updateLaser);
    };

    animationFrameId = requestAnimationFrame(updateLaser);
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const prevStrokes = undoStack[undoStack.length - 1];
    setUndoStack(prev => prev.slice(0, -1));
    setRedoStack(prev => [...prev, strokes]);
    setStrokes(prevStrokes);
  }, [undoStack, strokes]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const nextStrokes = redoStack[redoStack.length - 1];
    setRedoStack(prev => prev.slice(0, -1));
    setUndoStack(prev => [...prev, strokes]);
    setStrokes(nextStrokes);
  }, [redoStack, strokes]);

  const handleClear = useCallback(() => {
    setUndoStack(prev => [...prev, strokes]);
    setRedoStack([]);
    setStrokes([]);
  }, [strokes]);

  const handleZoomIn = useCallback(() => {
    setTransform(prev => {
      const newScale = Math.min(prev.scale * 1.2, 10);
      const scaleRatio = newScale / prev.scale;
      
      // Center of the screen
      const cx = boardSize.width / 2;
      const cy = boardSize.height / 2;
      
      return {
        scale: newScale,
        x: cx - (cx - prev.x) * scaleRatio,
        y: cy - (cy - prev.y) * scaleRatio
      };
    });
  }, [boardSize]);

  const handleZoomOut = useCallback(() => {
    setTransform(prev => {
      const newScale = Math.max(prev.scale / 1.2, 0.1);
      const scaleRatio = newScale / prev.scale;
      
      // Center of the screen
      const cx = boardSize.width / 2;
      const cy = boardSize.height / 2;
      
      return {
        scale: newScale,
        x: cx - (cx - prev.x) * scaleRatio,
        y: cy - (cy - prev.y) * scaleRatio
      };
    });
  }, [boardSize]);

  const handleResetOrigin = useCallback(() => {
    setTransform({ x: 0, y: 0, scale: 1 });
  }, []);

  const handleCenterLupa = useCallback(() => {
    // Center of the visible area in canvas coordinates
    const centerX = (boardSize.width / 2 - transform.x) / transform.scale;
    const centerY = (boardSize.height / 2 - transform.y) / transform.scale;
    
    setLupaPos(prev => ({
      ...prev,
      x: centerX,
      y: centerY
    }));
  }, [transform, boardSize]);

  const handleBoardResize = useCallback((width: number, height: number) => {
    const roundedWidth = Math.round(width);
    const roundedHeight = Math.round(height);
    
    setBoardSize(prev => {
      if (prev.width === roundedWidth && prev.height === roundedHeight) return prev;
      return { width: roundedWidth, height: roundedHeight };
    });

    // Adjust transform to keep center aligned
    if (prevBoardSizeRef.current.width !== 0 && prevBoardSizeRef.current.height !== 0) {
      const deltaX = (roundedWidth - prevBoardSizeRef.current.width) / 2;
      const deltaY = (roundedHeight - prevBoardSizeRef.current.height) / 2;
      
      if (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1) {
        setTransform(prev => ({
          ...prev,
          x: prev.x + deltaX,
          y: prev.y + deltaY
        }));
      }
    }
    
    prevBoardSizeRef.current = { width: roundedWidth, height: roundedHeight };
  }, []);

  if (view === 'dashboard') {
    return (
      <Dashboard 
        documents={documents}
        onSelect={handleSelectDocument}
        onCreate={handleCreateDocument}
        onDelete={handleDeleteDocument}
        onRename={handleRenameDocument}
      />
    );
  }

  return (
    <div className="w-full h-[100dvh] overflow-hidden bg-slate-50 relative font-sans flex flex-col landscape:flex-row overscroll-none touch-none">
      <div className="flex-1 relative">
        <CanvasBoard
          strokes={strokes}
          setStrokes={setStrokes}
          laserStrokes={laserStrokes}
          setLaserStrokes={setLaserStrokes}
          currentStrokeRef={currentStrokeRef}
          tool={tool}
          color={color}
          size={size}
          laserColor={laserColor}
          laserSize={laserSize}
          eraserSize={eraserSize}
          background={background}
          pattern={pattern}
          lupaVisible={lupaVisible}
          transform={transform}
          setTransform={setTransform}
          onStrokeStart={handleStrokeStart}
          onStrokeEnd={handleStrokeEnd}
          onHistorySave={handleHistorySave}
          lupaActive={true}
          lupaPos={lupaPos}
          setLupaPos={setLupaPos}
          onResize={handleBoardResize}
        />
      </div>

      <div className="fixed bottom-[40dvh] landscape:bottom-4 landscape:left-4 landscape:right-auto landscape:w-auto landscape:max-w-[60vw] left-0 right-0 z-50">
        <Toolbar
          tool={tool}
          setTool={setTool}
          color={color}
          setColor={setColor}
          size={size}
          setSize={setSize}
          laserColor={laserColor}
          setLaserColor={setLaserColor}
          laserSize={laserSize}
          setLaserSize={setLaserSize}
          eraserSize={eraserSize}
          setEraserSize={setEraserSize}
          background={background}
          setBackground={setBackground}
          pattern={pattern}
          setPattern={setPattern}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onClear={handleClear}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onResetOrigin={handleResetOrigin}
          onCenterLupa={handleCenterLupa}
          onExit={handleExit}
          onAIPrompt={() => setIsAIModalOpen(true)}
          canUndo={undoStack.length > 0}
          canRedo={redoStack.length > 0}
          isToolbarVisible={isToolbarVisible}
          setIsToolbarVisible={setIsToolbarVisible}
        />
      </div>

      <div className="z-40 flex flex-col h-[40dvh] landscape:h-full landscape:w-[35vw] border-t border-slate-200 landscape:border-t-0 landscape:border-l border-slate-200 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] landscape:shadow-[-10px_0_40px_rgba(0,0,0,0.05)]">
        <ZoomWindow
          strokes={strokes}
          setStrokes={setStrokes}
          laserStrokes={laserStrokes}
          setLaserStrokes={setLaserStrokes}
          currentStrokeRef={currentStrokeRef}
          tool={tool}
          setTool={setTool}
          color={color}
          setColor={setColor}
          size={size}
          setSize={setSize}
          laserColor={laserColor}
          setLaserColor={setLaserColor}
          laserSize={laserSize}
          setLaserSize={setLaserSize}
          eraserSize={eraserSize}
          setEraserSize={setEraserSize}
          background={background}
          setBackground={setBackground}
          pattern={pattern}
          setPattern={setPattern}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onClear={handleClear}
          canUndo={undoStack.length > 0}
          canRedo={redoStack.length > 0}
          isToolbarVisible={isToolbarVisible}
          setIsToolbarVisible={setIsToolbarVisible}
          lupaPos={lupaPos}
          setLupaPos={setLupaPos}
          lupaVisible={lupaVisible}
          onFindLupa={handleFindLupa}
          onToggleLupaVisibility={handleToggleLupaVisibility}
          onStrokeStart={handleStrokeStart}
          onStrokeEnd={handleStrokeEnd}
          onHistorySave={handleHistorySave}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onResetOrigin={handleResetOrigin}
          onCenterLupa={handleCenterLupa}
          onExit={handleExit}
          onAIPrompt={() => setIsAIModalOpen(true)}
          onResize={handleZoomWindowResize}
        />
      </div>

      {/* AI Assistant Modal */}
      {isAIModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 border border-white/20">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-violet-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-200">
                  <Sparkles size={20} className="animate-pulse" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 leading-tight">IA Asistente</h3>
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-indigo-500/70">Generador de Contenido</p>
                </div>
              </div>
              <button 
                onClick={() => setIsAIModalOpen(false)}
                className="p-2 rounded-xl hover:bg-white/80 text-slate-400 hover:text-slate-600 transition-all active:scale-95"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-8 flex flex-col gap-6">
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-700">¿Qué ejercicios necesitas?</p>
                <p className="text-xs text-slate-400">
                  Describe los temas o problemas que quieres que aparezcan en la pizarra.
                </p>
              </div>
              
              {aiError && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-xs flex gap-3 animate-in slide-in-from-top-2">
                  <div className="shrink-0 w-1.5 h-1.5 rounded-full bg-red-400 mt-1" />
                  <p><strong>Error:</strong> {aiError}</p>
                </div>
              )}
              
              <div className="relative group">
                <textarea
                  value={aiPrompt}
                  onChange={(e) => setAIPrompt(e.target.value)}
                  placeholder="Ej: 5 sumas de fracciones heterogéneas..."
                  className="w-full h-36 p-5 rounded-2xl border-2 border-slate-100 focus:border-indigo-500 focus:ring-8 focus:ring-indigo-500/5 outline-none transition-all resize-none text-slate-700 text-sm leading-relaxed placeholder:text-slate-300"
                  disabled={isAILoading}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                      handleAIGenerate();
                    }
                  }}
                />
                <div className="absolute bottom-3 right-3 text-[10px] font-medium text-slate-300 group-focus-within:text-indigo-300 transition-colors">
                  Ctrl + Enter para generar
                </div>
              </div>
              
              <button
                onClick={handleAIGenerate}
                disabled={isAILoading || !aiPrompt.trim()}
                className={`
                  w-full py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-3 transition-all active:scale-[0.98]
                  ${isAILoading || !aiPrompt.trim() 
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                    : 'bg-indigo-600 text-white shadow-xl shadow-indigo-200 hover:bg-indigo-700 hover:shadow-indigo-300 hover:-translate-y-0.5'}
                `}
              >
                {isAILoading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>Generando ejercicios...</span>
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    <span>Generar Ejercicios</span>
                  </>
                )}
              </button>
            </div>
            
            <div className="px-8 py-4 bg-slate-50 border-t border-slate-100 flex justify-center">
              <p className="text-[10px] text-slate-400 text-center">
                La IA puede cometer errores. Revisa los resultados antes de usarlos.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
