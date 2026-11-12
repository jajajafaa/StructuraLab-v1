import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { DiagramPoint, SupportReaction, StructuralLoad, Support, SupportType, LoadType } from '../types/structural';
import { useUnits } from '../context/UnitContext';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  ArrowDown,
  Anchor,
  CircleDot,
  X,
  Tag,
  Move,
  Activity,
  RotateCcw,
  MousePointer2,
  Hand,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown
} from 'lucide-react';

interface StructuralViewportProps {
  length: number;
  supports: Support[];
  loads: StructuralLoad[];
  reactions?: SupportReaction[];
  diagramPoints?: DiagramPoint[];
  selectedId: string | null;
  onSelectObject: (type: 'support' | 'load' | 'beam' | null, id: string | null) => void;
  activeViewMode: 'model' | 'loads' | 'sfd' | 'bmd' | 'all';
  onChangeViewMode: (mode: 'model' | 'loads' | 'sfd' | 'bmd' | 'all') => void;
  onAddSupportAt?: (pos: number, type: SupportType) => void;
  onAddLoadAt?: (pos: number, type: LoadType, mag: number) => void;
}

export const StructuralViewport: React.FC<StructuralViewportProps> = ({
  length,
  supports,
  loads,
  reactions = [],
  diagramPoints = [],
  selectedId,
  onSelectObject,
  activeViewMode,
  onChangeViewMode,
  onAddSupportAt,
  onAddLoadAt
}) => {
  const { symbols } = useUnits();

  const baseWidth = 880;
  const baseHeight = 490;
  const paddingX = 80;
  const beamY = 110;
  const usableWidth = baseWidth - 2 * paddingX;

  // Interaction Mode: 'inspect' (default, safe hover/click without accidental pan) vs 'pan' (drag to move)
  const [controlMode, setControlMode] = useState<'inspect' | 'pan'>('inspect');

  // Zoom & Pan State
  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Touch pinch zoom tracking
  const touchStartDistRef = useRef<number | null>(null);
  const touchStartZoomRef = useRef<number>(1.0);

  // Display toggles
  const [showValues, setShowValues] = useState<boolean>(true);
  const [showInspectionHud, setShowInspectionHud] = useState<boolean>(true);
  const [hoverMeterX, setHoverMeterX] = useState<number | null>(null);
  const [quickActionPos, setQuickActionPos] = useState<{ xMeter: number; screenX: number; screenY: number } | null>(null);

  const safeLength = length > 0 ? length : 6;
  const toCanvasX = (x: number) => paddingX + (x / safeLength) * usableWidth;

  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // ViewBox calculation based on zoom and pan
  const viewWidth = baseWidth / Math.max(0.2, zoom);
  const viewHeight = baseHeight / Math.max(0.2, zoom);
  const viewBoxX = (baseWidth - viewWidth) / 2 - pan.x;
  const viewBoxY = (baseHeight - viewHeight) / 2 - pan.y;

  // Global mouseup and blur listener to prevent dragging getting stuck
  useEffect(() => {
    const handleGlobalRelease = () => {
      setIsDragging(false);
      touchStartDistRef.current = null;
    };

    window.addEventListener('mouseup', handleGlobalRelease);
    window.addEventListener('pointerup', handleGlobalRelease);
    window.addEventListener('blur', handleGlobalRelease);

    return () => {
      window.removeEventListener('mouseup', handleGlobalRelease);
      window.removeEventListener('pointerup', handleGlobalRelease);
      window.removeEventListener('blur', handleGlobalRelease);
    };
  }, []);

  // Convert mouse or touch coordinates into SVG viewBox space
  const getCoordsFromClient = useCallback((clientX: number, clientY: number) => {
    if (!svgRef.current) return { svgX: 0, svgY: 0, screenRelX: 0, screenRelY: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    const screenRelX = clientX - rect.left;
    const screenRelY = clientY - rect.top;
    const svgX = viewBoxX + (screenRelX / width) * viewWidth;
    const svgY = viewBoxY + (screenRelY / height) * viewHeight;
    return { svgX, svgY, screenRelX, screenRelY };
  }, [viewBoxX, viewBoxY, viewWidth, viewHeight]);

  // Wheel Zoom (centered zoom with safety bounds)
  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 0.87;
    setZoom(prev => {
      const next = Math.min(3.5, Math.max(0.4, Number((prev * factor).toFixed(2))));
      return next;
    });
  };

  // Mouse drag pan handlers
  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    // Left-click pan ONLY if in 'pan' mode, or middle mouse button (button === 1), or Space held
    const isPanMode = controlMode === 'pan' || e.button === 1 || e.altKey;
    if (isPanMode && e.button !== 2) {
      e.preventDefault();
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      setPanStart({ x: pan.x, y: pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isDragging) {
      if (!svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const factorX = viewWidth / Math.max(1, rect.width);
      const factorY = viewHeight / Math.max(1, rect.height);
      const dx = (e.clientX - dragStart.x) * factorX;
      const dy = (e.clientY - dragStart.y) * factorY;
      
      // Pan limits to prevent beam from being lost
      const maxPanX = baseWidth * 1.8;
      const maxPanY = baseHeight * 1.8;
      setPan({
        x: Math.max(-maxPanX, Math.min(maxPanX, panStart.x + dx)),
        y: Math.max(-maxPanY, Math.min(maxPanY, panStart.y + dy))
      });
      return;
    }

    // Inspect mode tracking: only track position without moving canvas
    if (length <= 0) return;
    const { svgX } = getCoordsFromClient(e.clientX, e.clientY);
    if (svgX >= paddingX - 15 && svgX <= baseWidth - paddingX + 15) {
      const rawMeter = ((svgX - paddingX) / usableWidth) * safeLength;
      const clamped = Math.max(0, Math.min(safeLength, Number(rawMeter.toFixed(2))));
      setHoverMeterX(clamped);
    } else {
      setHoverMeterX(null);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Mobile Touch Event Handling
  const handleTouchStart = (e: React.TouchEvent<SVGSVGElement>) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      if (controlMode === 'pan') {
        setIsDragging(true);
        setDragStart({ x: touch.clientX, y: touch.clientY });
        setPanStart({ x: pan.x, y: pan.y });
      } else {
        // Inspect touched position on beam
        const { svgX } = getCoordsFromClient(touch.clientX, touch.clientY);
        if (svgX >= paddingX - 15 && svgX <= baseWidth - paddingX + 15) {
          const rawMeter = ((svgX - paddingX) / usableWidth) * safeLength;
          setHoverMeterX(Math.max(0, Math.min(safeLength, Number(rawMeter.toFixed(2)))));
        }
      }
    } else if (e.touches.length === 2) {
      // Pinch-to-zoom init
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchStartDistRef.current = Math.hypot(dx, dy);
      touchStartZoomRef.current = zoom;
    }
  };

  const handleTouchMove = (e: React.TouchEvent<SVGSVGElement>) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      if (controlMode === 'pan' && isDragging) {
        if (!svgRef.current) return;
        const rect = svgRef.current.getBoundingClientRect();
        const factorX = viewWidth / Math.max(1, rect.width);
        const factorY = viewHeight / Math.max(1, rect.height);
        const dx = (touch.clientX - dragStart.x) * factorX;
        const dy = (touch.clientY - dragStart.y) * factorY;
        setPan({
          x: panStart.x + dx,
          y: panStart.y + dy
        });
      } else if (controlMode === 'inspect') {
        const { svgX } = getCoordsFromClient(touch.clientX, touch.clientY);
        if (svgX >= paddingX - 15 && svgX <= baseWidth - paddingX + 15) {
          const rawMeter = ((svgX - paddingX) / usableWidth) * safeLength;
          setHoverMeterX(Math.max(0, Math.min(safeLength, Number(rawMeter.toFixed(2)))));
        }
      }
    } else if (e.touches.length === 2 && touchStartDistRef.current) {
      // Pinch to zoom active
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const ratio = dist / touchStartDistRef.current;
      const newZoom = Math.min(3.5, Math.max(0.4, Number((touchStartZoomRef.current * ratio).toFixed(2))));
      setZoom(newZoom);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    touchStartDistRef.current = null;
  };

  const handleResetView = () => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
    setHoverMeterX(null);
  };

  // Directional Pan Nudge buttons for touch and keyboard users
  const handleNudgePan = (dirX: number, dirY: number) => {
    const step = 60 / zoom;
    setPan(prev => ({
      x: prev.x + dirX * step,
      y: prev.y + dirY * step
    }));
  };

  // Handle click on beam
  const handleBeamClick = (e: React.MouseEvent<SVGElement>) => {
    e.stopPropagation();
    if (length <= 0 || !svgRef.current) return;
    const { svgX, screenRelX, screenRelY } = getCoordsFromClient(e.clientX, e.clientY);
    const rawMeter = ((svgX - paddingX) / usableWidth) * safeLength;
    const meterX = Number(Math.max(0, Math.min(safeLength, rawMeter)).toFixed(1));

    setQuickActionPos({
      xMeter: meterX,
      screenX: screenRelX,
      screenY: Math.min(220, screenRelY)
    });
    onSelectObject('beam', 'main-beam');
  };

  // Critical values and points in SFD & BMD
  const { maxV, minV, maxM, minM, zeroVPoints, absMaxV, absMaxM } = useMemo(() => {
    if (!diagramPoints || diagramPoints.length === 0) {
      return {
        maxV: null,
        minV: null,
        maxM: null,
        minM: null,
        zeroVPoints: [],
        absMaxV: 1,
        absMaxM: 1
      };
    }

    let pMaxV = diagramPoints[0];
    let pMinV = diagramPoints[0];
    let pMaxM = diagramPoints[0];
    let pMinM = diagramPoints[0];
    const zeros: DiagramPoint[] = [];

    for (let i = 0; i < diagramPoints.length; i++) {
      const pt = diagramPoints[i];
      if (pt.V > pMaxV.V) pMaxV = pt;
      if (pt.V < pMinV.V) pMinV = pt;
      if (pt.M > pMaxM.M) pMaxM = pt;
      if (pt.M < pMinM.M) pMinM = pt;

      if (i > 0) {
        const prev = diagramPoints[i - 1];
        if ((prev.V >= 0 && pt.V < 0) || (prev.V <= 0 && pt.V > 0)) {
          zeros.push(Math.abs(prev.V) < Math.abs(pt.V) ? prev : pt);
        }
      }
    }

    const absV = Math.max(1, Math.abs(pMaxV.V), Math.abs(pMinV.V));
    const absM = Math.max(1, Math.abs(pMaxM.M), Math.abs(pMinM.M));

    return {
      maxV: pMaxV,
      minV: pMinV,
      maxM: pMaxM,
      minM: pMinM,
      zeroVPoints: zeros,
      absMaxV: absV,
      absMaxM: absM
    };
  }, [diagramPoints]);

  // Interpolate / find closest diagram point for current hovered meter
  const hoveredPoint = useMemo(() => {
    if (hoverMeterX === null || !diagramPoints || diagramPoints.length === 0) return null;
    let closest = diagramPoints[0];
    let minDist = Math.abs(diagramPoints[0].x - hoverMeterX);
    for (let i = 1; i < diagramPoints.length; i++) {
      const dist = Math.abs(diagramPoints[i].x - hoverMeterX);
      if (dist < minDist) {
        minDist = dist;
        closest = diagramPoints[i];
      }
    }
    return closest;
  }, [hoverMeterX, diagramPoints]);

  // Dynamic layout bases
  const sfdBaseY = activeViewMode === 'sfd' ? 260 : 245;
  const sfdHeight = activeViewMode === 'sfd' ? 95 : 46;
  const sfdScale = sfdHeight / absMaxV;

  const bmdBaseY = activeViewMode === 'bmd' ? 260 : 385;
  const bmdHeight = activeViewMode === 'bmd' ? 100 : 52;
  const bmdScale = bmdHeight / absMaxM;

  // Paths for SFD (Sky Blue theme)
  let sfdPath = `M ${toCanvasX(0)} ${sfdBaseY}`;
  diagramPoints.forEach(pt => {
    const cx = toCanvasX(pt.x);
    const cy = sfdBaseY - pt.V * sfdScale;
    sfdPath += ` L ${cx} ${cy}`;
  });
  sfdPath += ` L ${toCanvasX(safeLength)} ${sfdBaseY} Z`;

  // Paths for BMD (Warm Amber theme, positive tension plotted downward)
  let bmdPath = `M ${toCanvasX(0)} ${bmdBaseY}`;
  diagramPoints.forEach(pt => {
    const cx = toCanvasX(pt.x);
    const cy = bmdBaseY + pt.M * bmdScale;
    bmdPath += ` L ${cx} ${cy}`;
  });
  bmdPath += ` L ${toCanvasX(safeLength)} ${bmdBaseY} Z`;

  // Step frequency for intermediate value tags based on zoom
  const sampleStep = zoom >= 1.7 ? 10 : zoom >= 1.2 ? 18 : 30;

  return (
    <div
      ref={containerRef}
      className="w-full bg-[#0b0f19] rounded-3xl glass-slab border border-white/[0.08] shadow-2xl overflow-hidden font-sans select-none flex flex-col relative"
    >
      {/* Viewport Top Header & CAD Toolbars */}
      <div className="bg-[#0f1422]/90 backdrop-blur-xl border-b border-white/[0.08] px-3 sm:px-4 py-3 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
        {/* Left Info: System status and hover indicator */}
        <div className="flex items-center justify-between sm:justify-start gap-2.5">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white tracking-wide flex items-center gap-1.5 text-xs sm:text-sm">
              <span>Balok Kontinu</span>
              <span className="text-slate-500">·</span>
              <span className="font-mono text-sky-400">L = {length} {symbols.length}</span>
            </span>
          </div>

          {hoverMeterX !== null ? (
            <span className="bg-sky-500/10 text-sky-300 font-mono text-[11px] px-2.5 py-0.5 rounded-lg border border-sky-500/20 shadow-sm animate-in fade-in duration-100">
              x = {hoverMeterX} {symbols.length}
            </span>
          ) : (
            <span className="text-[11px] font-mono text-slate-500 hidden sm:inline">
              {controlMode === 'inspect' ? 'Arahkan kursor untuk inspeksi V & M' : 'Tahan & geser untuk pan kanvas'}
            </span>
          )}
        </div>

        {/* View Mode Tabs - Spatial Pill Dock (Scrollable on small mobile screens) */}
        <div className="overflow-x-auto no-scrollbar py-0.5">
          <div className="inline-flex p-1 rounded-2xl bg-black/50 border border-white/10 backdrop-blur-xl text-xs font-medium shrink-0">
            <button
              onClick={() => onChangeViewMode('all')}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                activeViewMode === 'all'
                  ? 'bg-slate-100 text-slate-950 font-bold shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Semua Tampilan
            </button>
            <button
              onClick={() => onChangeViewMode('loads')}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                activeViewMode === 'loads'
                  ? 'bg-slate-100 text-slate-950 font-bold shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Model & Beban
            </button>
            <button
              onClick={() => onChangeViewMode('sfd')}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                activeViewMode === 'sfd'
                  ? 'bg-slate-100 text-slate-950 font-bold shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Gaya Geser (SFD)
            </button>
            <button
              onClick={() => onChangeViewMode('bmd')}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                activeViewMode === 'bmd'
                  ? 'bg-slate-100 text-slate-950 font-bold shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Momen Lentur (BMD)
            </button>
          </div>
        </div>

        {/* CAD Controls: Inspect vs Pan, Zoom & Viewport Tools */}
        <div className="flex flex-wrap items-center justify-between sm:justify-end gap-1.5">
          {/* Interaction Mode Toggle: ↖ Inspeksi vs ✋ Geser */}
          <div className="inline-flex p-0.5 rounded-xl bg-black/50 border border-white/10">
            <button
              onClick={() => setControlMode('inspect')}
              className={`px-2.5 py-1 rounded-lg flex items-center gap-1.5 text-[11px] font-medium transition ${
                controlMode === 'inspect'
                  ? 'bg-sky-500 text-white font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Mode Inspeksi: Kursor mengarahkan pembacaan gaya tanpa menggeser kanvas secara tidak sengaja"
            >
              <MousePointer2 className="w-3.5 h-3.5" />
              <span>Inspeksi</span>
            </button>
            <button
              onClick={() => setControlMode('pan')}
              className={`px-2.5 py-1 rounded-lg flex items-center gap-1.5 text-[11px] font-medium transition ${
                controlMode === 'pan'
                  ? 'bg-sky-500 text-white font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Mode Geser (Pan): Klik & geser kanvas secara bebas"
            >
              <Hand className="w-3.5 h-3.5" />
              <span>Geser</span>
            </button>
          </div>

          {/* Toggle HUD Card Visibility */}
          <button
            onClick={() => setShowInspectionHud(!showInspectionHud)}
            className={`px-2.5 py-1 rounded-xl flex items-center gap-1.5 text-[11px] font-medium transition border ${
              showInspectionHud
                ? 'bg-sky-500/15 text-sky-300 border-sky-500/30 font-bold'
                : 'bg-white/[0.04] text-slate-400 border-white/10 hover:bg-white/[0.08]'
            }`}
            title={showInspectionHud ? "Sembunyikan Panel Inspeksi Gaya Real-time" : "Tampilkan Panel Inspeksi Gaya Real-time"}
          >
            <Activity className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{showInspectionHud ? 'Sembunyikan HUD' : 'Tampilkan HUD'}</span>
          </button>

          {/* Toggle Values on Diagram */}
          <button
            onClick={() => setShowValues(!showValues)}
            className={`px-2.5 py-1 rounded-xl flex items-center gap-1 text-[11px] font-medium transition border ${
              showValues
                ? 'bg-white/15 text-white border-white/20 font-bold'
                : 'bg-white/[0.04] text-slate-400 border-white/10 hover:bg-white/[0.08]'
            }`}
            title="Tampilkan Nilai Gaya Geser dan Momen langsung pada diagram"
          >
            <Tag className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Nilai</span>
          </button>

          {/* Zoom Controls */}
          <div className="flex items-center gap-1 bg-black/40 p-0.5 rounded-xl border border-white/10">
            <button
              onClick={() => setZoom(prev => Math.max(0.4, Number((prev - 0.2).toFixed(2))))}
              className="p-1 rounded-lg hover:bg-white/10 text-slate-300 transition"
              title="Zoom Out (-)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] font-mono text-white font-bold px-1.5 text-center min-w-[38px] tabular-nums">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom(prev => Math.min(3.5, Number((prev + 0.2).toFixed(2))))}
              className="p-1 rounded-lg hover:bg-white/10 text-slate-300 transition"
              title="Zoom In (+)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Reset View Button */}
          <button
            onClick={handleResetView}
            className="p-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-slate-300 border border-white/10 transition"
            title="Reset Zoom & Pan (Fit to View)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* SVG Canvas Area with Safe Pan & Zoom */}
      <div
        className="relative overflow-hidden flex-1 select-none touch-none"
        style={{
          cursor: controlMode === 'pan' ? (isDragging ? 'grabbing' : 'grab') : 'crosshair'
        }}
      >
        {/* Floating Spatial CAD HUD Overlay Card */}
        {showInspectionHud && diagramPoints.length > 0 && (
          <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20 glass-dock rounded-2xl p-3 sm:p-4 text-xs font-mono shadow-2xl space-y-2 max-w-[92vw] sm:min-w-[230px] border border-white/15 bg-[#0f1422]/95 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-1.5 border-b border-white/[0.08] text-[10px]">
              <span className="text-white font-semibold flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-sky-400" /> Inspeksi Gaya Real-time
              </span>
              <div className="flex items-center gap-2">
                <span className="text-slate-400 tabular-nums">{Math.round(zoom * 100)}%</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowInspectionHud(false);
                  }}
                  className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition"
                  title="Sembunyikan panel inspeksi gaya real-time"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-1 gap-2 sm:gap-1 text-[11px]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between">
                <span className="text-slate-400 text-[10px] sm:text-xs">Posisi x:</span>
                <span className="text-sky-400 font-bold tabular-nums">
                  {hoverMeterX !== null ? `${hoverMeterX.toFixed(2)} ${symbols.length}` : `-- ${symbols.length}`}
                </span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between">
                <span className="text-slate-400 text-[10px] sm:text-xs">Gaya Geser V:</span>
                <span className="font-bold text-white tabular-nums">
                  {hoveredPoint ? `${hoveredPoint.V > 0 ? '+' : ''}${hoveredPoint.V.toFixed(2)} ${symbols.force}` : '--'}
                </span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between">
                <span className="text-slate-400 text-[10px] sm:text-xs">Momen M:</span>
                <span className="font-bold text-amber-400 tabular-nums">
                  {hoveredPoint ? `${hoveredPoint.M > 0 ? '+' : ''}${hoveredPoint.M.toFixed(2)} ${symbols.moment}` : '--'}
                </span>
              </div>
            </div>

            <div className="pt-1.5 border-t border-white/[0.08] hidden sm:flex items-center justify-between text-[10px] text-slate-400">
              <span>V maks: <b className="text-white">{absMaxV.toFixed(1)} {symbols.force}</b></span>
              <span>M maks: <b className="text-amber-400">{absMaxM.toFixed(1)} {symbols.moment}</b></span>
            </div>
          </div>
        )}

        {/* Discreet Restore Button when HUD is Hidden */}
        {!showInspectionHud && diagramPoints.length > 0 && (
          <button
            type="button"
            onClick={() => setShowInspectionHud(true)}
            className="absolute top-3 right-3 z-20 px-2.5 py-1 rounded-xl bg-black/60 hover:bg-black/80 text-slate-300 hover:text-white text-[11px] font-mono border border-white/10 shadow-lg flex items-center gap-1.5 backdrop-blur-md transition animate-in fade-in duration-150"
            title="Tampilkan kembali panel inspeksi gaya real-time"
          >
            <Activity className="w-3.5 h-3.5 text-sky-400" />
            <span>+ Inspeksi Gaya</span>
          </button>
        )}

        {/* On-Screen Directional Pan Nudge Controls (Bottom Left for Mobile & Desktop) */}
        <div className="absolute bottom-3 left-3 z-20 flex flex-col items-center gap-1 bg-black/60 backdrop-blur-md p-1 rounded-2xl border border-white/10 shadow-lg opacity-80 hover:opacity-100 transition-opacity">
          <button
            onClick={() => handleNudgePan(0, 1)}
            className="p-1 hover:bg-white/10 text-slate-300 rounded-lg transition"
            title="Geser ke Atas"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleNudgePan(1, 0)}
              className="p-1 hover:bg-white/10 text-slate-300 rounded-lg transition"
              title="Geser ke Kiri"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleResetView}
              className="px-1.5 py-0.5 text-[10px] font-mono text-slate-400 hover:text-white rounded transition"
              title="Pusatkan Kanvas"
            >
              FIT
            </button>
            <button
              onClick={() => handleNudgePan(-1, 0)}
              className="p-1 hover:bg-white/10 text-slate-300 rounded-lg transition"
              title="Geser ke Kanan"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <button
            onClick={() => handleNudgePan(0, -1)}
            className="p-1 hover:bg-white/10 text-slate-300 rounded-lg transition"
            title="Geser ke Bawah"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* The SVG Canvas Element */}
        <svg
          ref={svgRef}
          viewBox={`${viewBoxX} ${viewBoxY} ${viewWidth} ${viewHeight}`}
          preserveAspectRatio="xMidYMid meet"
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseLeave={() => {
            setIsDragging(false);
            setHoverMeterX(null);
          }}
          onClick={() => setQuickActionPos(null)}
          style={{
            backgroundColor: '#0b0f19',
            backgroundImage: `
              radial-gradient(circle, #1e2536 1.2px, transparent 1.2px),
              linear-gradient(to right, rgba(30, 41, 59, 0.18) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(30, 41, 59, 0.18) 1px, transparent 1px)
            `,
            backgroundSize: `${22 * zoom}px ${22 * zoom}px, ${44 * zoom}px ${44 * zoom}px, ${44 * zoom}px ${44 * zoom}px`
          }}
          className="w-full h-auto block select-none"
        >
          <defs>
            {/* SFD Soft Gradient - Sky Blue */}
            <linearGradient id="vpSfdGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="0.03" />
            </linearGradient>

            {/* BMD Soft Gradient - Warm Amber */}
            <linearGradient id="vpBmdGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#d97706" stopOpacity="0.03" />
            </linearGradient>

            <marker id="vpArrowDown" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#f43f5e" />
            </marker>
            <marker id="vpArrowUp" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#38bdf8" />
            </marker>
          </defs>

          {/* Background catch-all for mouse interaction */}
          <rect
            data-bg="true"
            x={viewBoxX}
            y={viewBoxY}
            width={viewWidth}
            height={viewHeight}
            fill="transparent"
          />

          {/* Grid Metric Rulers across full height */}
          <g opacity="0.3" pointerEvents="none">
            {Array.from({ length: Math.floor(safeLength) + 1 }).map((_, mIdx) => {
              const mx = toCanvasX(mIdx);
              return (
                <g key={`grid-m-${mIdx}`}>
                  <line x1={mx} y1={beamY - 60} x2={mx} y2={baseHeight - 20} stroke="#334155" strokeWidth="0.5" strokeDasharray="3 3" />
                  <text x={mx} y={beamY + 75} fill="#64748b" fontSize="9" fontFamily="monospace" textAnchor="middle">
                    {mIdx}m
                  </text>
                </g>
              );
            })}
          </g>

          {/* ================= 1. PHYSICAL BEAM MEMBER ================= */}
          {length > 0 ? (
            <g className="cursor-pointer" onClick={handleBeamClick}>
              {/* Invisible wide hit area for easy tapping on mobile and clicking */}
              <line
                x1={toCanvasX(0)}
                y1={beamY}
                x2={toCanvasX(length)}
                y2={beamY}
                stroke="transparent"
                strokeWidth="36"
              />
              {/* Visible Beam Line - Titanium Silver */}
              <line
                x1={toCanvasX(0)}
                y1={beamY}
                x2={toCanvasX(length)}
                y2={beamY}
                stroke={selectedId === 'main-beam' ? '#38bdf8' : '#cbd5e1'}
                strokeWidth={selectedId === 'main-beam' ? '12' : '10'}
                strokeLinecap="round"
              />
              {/* Dimension Line under beam */}
              <line x1={toCanvasX(0)} y1={beamY + 28} x2={toCanvasX(length)} y2={beamY + 28} stroke="#475569" strokeWidth="1" />
              <text x={toCanvasX(length / 2)} y={beamY + 24} fill="#cbd5e1" fontSize="10" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
                L = {length} m {controlMode === 'inspect' ? '(Klik batang untuk menu opsi)' : ''}
              </text>
            </g>
          ) : (
            <g transform={`translate(${baseWidth / 2}, ${baseHeight / 2 - 30})`} pointerEvents="none">
              <rect x="-240" y="-45" width="480" height="90" rx="14" fill="#0f172a" fillOpacity="0.9" stroke="#334155" strokeWidth="1.2" />
              <text x="0" y="-12" fill="#38bdf8" fontSize="13" fontWeight="bold" textAnchor="middle">
                Ruang Kerja Analisis Struktur Siap Digunakan
              </text>
              <text x="0" y="10" fill="#94a3b8" fontSize="11" textAnchor="middle">
                Silakan masukkan panjang bentang L (meter) pada menu samping,
              </text>
              <text x="0" y="28" fill="#64748b" fontSize="10" textAnchor="middle">
                lalu tentukan tumpuan dan beban untuk memulai kalkulasi rekayasa.
              </text>
            </g>
          )}

          {/* ================= 2. SUPPORTS ================= */}
          {supports.map((s, idx) => {
            const sx = toCanvasX(s.position);
            const sy = beamY + 5;
            const isSelected = selectedId === s.id;

            return (
              <g
                key={s.id || idx}
                className="cursor-pointer group"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectObject('support', s.id);
                  setQuickActionPos(null);
                }}
              >
                {s.type === 'pin' && (
                  <g transform={`translate(${sx}, ${sy})`}>
                    <polygon
                      points="0,0 -12,18 12,18"
                      fill={isSelected ? '#38bdf8' : '#2563eb'}
                      stroke={isSelected ? '#ffffff' : '#60a5fa'}
                      strokeWidth="1.5"
                    />
                    <line x1="-15" y1="18" x2="15" y2="18" stroke="#475569" strokeWidth="2" />
                    <line x1="-12" y1="22" x2="-8" y2="18" stroke="#475569" strokeWidth="1" />
                    <line x1="-4" y1="22" x2="0" y2="18" stroke="#475569" strokeWidth="1" />
                    <line x1="4" y1="22" x2="8" y2="18" stroke="#475569" strokeWidth="1" />
                  </g>
                )}
                {s.type === 'roller' && (
                  <g transform={`translate(${sx}, ${sy})`}>
                    <polygon
                      points="0,0 -12,14 12,14"
                      fill={isSelected ? '#38bdf8' : '#2563eb'}
                      stroke={isSelected ? '#ffffff' : '#60a5fa'}
                      strokeWidth="1.5"
                    />
                    <circle cx="-6" cy="18" r="3" fill="#94a3b8" />
                    <circle cx="6" cy="18" r="3" fill="#94a3b8" />
                    <line x1="-15" y1="22" x2="15" y2="22" stroke="#475569" strokeWidth="2" />
                  </g>
                )}
                {s.type === 'fixed' && (
                  <g transform={`translate(${sx}, ${beamY})`}>
                    <rect
                      x="-8"
                      y="-20"
                      width="8"
                      height="40"
                      fill={isSelected ? '#38bdf8' : '#334155'}
                      stroke={isSelected ? '#ffffff' : '#475569'}
                    />
                    <line x1="-14" y1="-15" x2="-8" y2="-20" stroke="#64748b" strokeWidth="1" />
                    <line x1="-14" y1="-5" x2="-8" y2="-10" stroke="#64748b" strokeWidth="1" />
                    <line x1="-14" y1="5" x2="-8" y2="0" stroke="#64748b" strokeWidth="1" />
                    <line x1="-14" y1="15" x2="-8" y2="10" stroke="#64748b" strokeWidth="1" />
                  </g>
                )}
                <text x={sx} y={sy + 36} fill={isSelected ? '#38bdf8' : '#cbd5e1'} fontSize="11" fontWeight="bold" textAnchor="middle">
                  {s.label || String.fromCharCode(65 + idx)} ({s.position}m)
                </text>
              </g>
            );
          })}

          {/* ================= 3. REACTIONS ================= */}
          {reactions.map((r, idx) => {
            const rx = toCanvasX(r.position);
            return (
              <g key={`reac-${idx}`} pointerEvents="none">
                <line
                  x1={rx}
                  y1={beamY + 58}
                  x2={rx}
                  y2={beamY + 12}
                  stroke="#38bdf8"
                  strokeWidth="2.5"
                  markerEnd="url(#vpArrowUp)"
                />
                <rect x={rx - 32} y={beamY + 54} width="64" height="15" rx="3" fill="#0f172a" stroke="#38bdf8" strokeWidth="0.8" />
                <text x={rx} y={beamY + 65} fill="#38bdf8" fontSize="10" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
                  R={r.Ry.toFixed(1)}{symbols.force}
                </text>
              </g>
            );
          })}

          {/* ================= 4. STRUCTURAL LOADS ================= */}
          {(activeViewMode === 'all' || activeViewMode === 'loads') && loads.map((load, idx) => {
            const lx = toCanvasX(load.startPos);
            const isSelected = selectedId === load.id;

            if (load.type === 'point') {
              return (
                <g
                  key={load.id || idx}
                  className="cursor-pointer group"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectObject('load', load.id);
                    setQuickActionPos(null);
                  }}
                >
                  <line
                    x1={lx}
                    y1={beamY - 45}
                    x2={lx}
                    y2={beamY - 6}
                    stroke={isSelected ? '#ffffff' : '#f43f5e'}
                    strokeWidth={isSelected ? '3.5' : '2.5'}
                    markerEnd="url(#vpArrowDown)"
                  />
                  <circle cx={lx} cy={beamY - 45} r="5" fill={isSelected ? '#ffffff' : '#f43f5e'} />
                  <text x={lx} y={beamY - 50} fill="#f43f5e" fontSize="11" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
                    P = {load.magnitude} {symbols.force}
                  </text>
                </g>
              );
            } else if (load.type === 'distributed') {
              const endX = toCanvasX(load.endPos ?? safeLength);
              const arrows = Math.max(3, Math.round((endX - lx) / 25));
              return (
                <g
                  key={load.id || idx}
                  className="cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectObject('load', load.id);
                    setQuickActionPos(null);
                  }}
                >
                  <line x1={lx} y1={beamY - 32} x2={endX} y2={beamY - 32} stroke="#f43f5e" strokeWidth={isSelected ? '2.5' : '1.5'} />
                  {Array.from({ length: arrows }).map((_, aIdx) => {
                    const ax = lx + (aIdx / (arrows - 1 || 1)) * (endX - lx);
                    return (
                      <line
                        key={aIdx}
                        x1={ax}
                        y1={beamY - 32}
                        x2={ax}
                        y2={beamY - 6}
                        stroke="#f43f5e"
                        strokeWidth="1.5"
                        markerEnd="url(#vpArrowDown)"
                      />
                    );
                  })}
                  <text x={(lx + endX) / 2} y={beamY - 38} fill="#f43f5e" fontSize="11" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
                    q = {load.magnitude} {symbols.distLoad} [{load.startPos}{symbols.length} - {load.endPos}{symbols.length}]
                  </text>
                </g>
              );
            } else if (load.type === 'triangular' || load.type === 'trapezoidal') {
              const endX = toCanvasX(load.endPos ?? safeLength);
              const q1 = load.magnitude;
              const q2 = load.magnitudeEnd ?? 0;
              const h1 = (q1 / Math.max(q1, q2, 1)) * 36;
              const h2 = (q2 / Math.max(q1, q2, 1)) * 36;

              const polyPoints = `${lx},${beamY - 6} ${lx},${beamY - 6 - h1} ${endX},${beamY - 6 - h2} ${endX},${beamY - 6}`;

              return (
                <g
                  key={load.id || idx}
                  className="cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectObject('load', load.id);
                    setQuickActionPos(null);
                  }}
                >
                  <polygon points={polyPoints} fill="#f43f5e" fillOpacity="0.25" stroke="#f43f5e" strokeWidth="1.5" />
                  {h1 > 0 && <line x1={lx} y1={beamY - 6 - h1} x2={lx} y2={beamY - 6} stroke="#f43f5e" strokeWidth="1.5" markerEnd="url(#vpArrowDown)" />}
                  {h2 > 0 && <line x1={endX} y1={beamY - 6 - h2} x2={endX} y2={beamY - 6} stroke="#f43f5e" strokeWidth="1.5" markerEnd="url(#vpArrowDown)" />}
                  <text x={(lx + endX) / 2} y={beamY - 42} fill="#f43f5e" fontSize="10" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
                    {load.type === 'triangular' ? `Segitiga (${q1} → ${q2} kN/m)` : `Trapesium (${q1} → ${q2} kN/m)`}
                  </text>
                </g>
              );
            }
            return null;
          })}

          {/* ================= 5. SFD (GAYA GESER) - SKY BLUE THEME ================= */}
          {(activeViewMode === 'all' || activeViewMode === 'sfd') && diagramPoints.length > 0 && (
            <g className="transition-opacity duration-200">
              {/* Baseline */}
              <line x1={toCanvasX(0)} y1={sfdBaseY} x2={toCanvasX(safeLength)} y2={sfdBaseY} stroke="#334155" strokeWidth="1.5" strokeDasharray="3 3" />
              <text x={paddingX - 10} y={sfdBaseY + 4} fill="#38bdf8" fontSize="11" fontFamily="monospace" fontWeight="bold" textAnchor="end">
                SFD (V)
              </text>

              {/* Shaded Area and Stroke Curve */}
              <path d={sfdPath} fill="url(#vpSfdGrad)" stroke="#38bdf8" strokeWidth="2.2" />

              {/* Zero Shear Indicator Line (leads to maximum moment) */}
              {zeroVPoints.map((zp, i) => {
                const zx = toCanvasX(zp.x);
                return (
                  <g key={`zero-v-${i}`}>
                    <circle cx={zx} cy={sfdBaseY} r="3.5" fill="#fbbf24" stroke="#ffffff" strokeWidth="1" />
                    <line x1={zx} y1={sfdBaseY} x2={zx} y2={bmdBaseY} stroke="#fbbf24" strokeWidth="1" strokeDasharray="2 2" opacity="0.6" />
                    <text x={zx} y={sfdBaseY - 8} fill="#fcd34d" fontSize="9" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
                      V=0 (M maks)
                    </text>
                  </g>
                );
              })}

              {/* Peak Values Badges */}
              {showValues && maxV && Math.abs(maxV.V) > 0.05 && (
                <g transform={`translate(${toCanvasX(maxV.x)}, ${sfdBaseY - maxV.V * sfdScale})`}>
                  <line x1="0" y1="0" x2="0" y2={maxV.V * sfdScale} stroke="#38bdf8" strokeWidth="1" strokeDasharray="2 2" opacity="0.5" />
                  <rect x="-42" y="-19" width="84" height="15" rx="4" fill="#0c1829" stroke="#38bdf8" strokeWidth="1" />
                  <text x="0" y="-8" fill="#ffffff" fontSize="9.5" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
                    V={maxV.V > 0 ? '+' : ''}{maxV.V.toFixed(2)}{symbols.force}
                  </text>
                  <circle cx="0" cy="0" r="3.5" fill="#38bdf8" stroke="#ffffff" strokeWidth="1" />
                </g>
              )}

              {showValues && minV && Math.abs(minV.V) > 0.05 && minV.x !== maxV?.x && (
                <g transform={`translate(${toCanvasX(minV.x)}, ${sfdBaseY - minV.V * sfdScale})`}>
                  <line x1="0" y1="0" x2="0" y2={minV.V * sfdScale} stroke="#38bdf8" strokeWidth="1" strokeDasharray="2 2" opacity="0.5" />
                  <rect x="-42" y="4" width="84" height="15" rx="4" fill="#0c1829" stroke="#38bdf8" strokeWidth="1" />
                  <text x="0" y="15" fill="#ffffff" fontSize="9.5" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
                    V={minV.V.toFixed(2)}{symbols.force}
                  </text>
                  <circle cx="0" cy="0" r="3.5" fill="#38bdf8" stroke="#ffffff" strokeWidth="1" />
                </g>
              )}

              {/* Intermediate Value Labels along the SFD curve when zoomed in */}
              {showValues && diagramPoints.filter((_, i) => i % sampleStep === 0).map((pt, i) => {
                const cx = toCanvasX(pt.x);
                const cy = sfdBaseY - pt.V * sfdScale;
                const isNearMax = maxV && Math.abs(pt.x - maxV.x) < 0.2;
                const isNearMin = minV && Math.abs(pt.x - minV.x) < 0.2;
                if (isNearMax || isNearMin) return null;

                return (
                  <g key={`sfd-sample-${i}`} className="opacity-90">
                    <circle cx={cx} cy={cy} r="2" fill="#38bdf8" />
                    {zoom >= 1.0 && (
                      <text
                        x={cx}
                        y={cy + (pt.V >= 0 ? -6 : 12)}
                        fill="#bae6fd"
                        fontSize="8.5"
                        fontFamily="monospace"
                        fontWeight="semibold"
                        textAnchor="middle"
                      >
                        {pt.V > 0 ? '+' : ''}{pt.V.toFixed(1)}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          )}

          {/* ================= 6. BMD (MOMEN LENTUR) - WARM AMBER THEME ================= */}
          {(activeViewMode === 'all' || activeViewMode === 'bmd') && diagramPoints.length > 0 && (
            <g className="transition-opacity duration-200">
              {/* Baseline */}
              <line x1={toCanvasX(0)} y1={bmdBaseY} x2={toCanvasX(safeLength)} y2={bmdBaseY} stroke="#334155" strokeWidth="1.5" strokeDasharray="3 3" />
              <text x={paddingX - 10} y={bmdBaseY + 4} fill="#fbbf24" fontSize="11" fontFamily="monospace" fontWeight="bold" textAnchor="end">
                BMD (M)
              </text>

              {/* Shaded Area and Stroke Curve */}
              <path d={bmdPath} fill="url(#vpBmdGrad)" stroke="#f59e0b" strokeWidth="2.2" />

              {/* Peak Maximum Moment Badge */}
              {showValues && maxM && Math.abs(maxM.M) > 0.05 && (
                <g transform={`translate(${toCanvasX(maxM.x)}, ${bmdBaseY + maxM.M * bmdScale})`}>
                  <line x1="0" y1="0" x2="0" y2={-maxM.M * bmdScale} stroke="#f59e0b" strokeWidth="1" strokeDasharray="2 2" opacity="0.5" />
                  <rect x="-48" y="4" width="96" height="16" rx="4" fill="#1c1917" stroke="#fbbf24" strokeWidth="1" />
                  <text x="0" y="16" fill="#fef3c7" fontSize="9.5" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
                    M maks = {maxM.M > 0 ? '+' : ''}{maxM.M.toFixed(2)} {symbols.moment}
                  </text>
                  <circle cx="0" cy="0" r="3.5" fill="#fbbf24" stroke="#ffffff" strokeWidth="1" />
                </g>
              )}

              {/* Negative Moment Badge (e.g. at supports in continuous beams) */}
              {showValues && minM && minM.M < -0.05 && (
                <g transform={`translate(${toCanvasX(minM.x)}, ${bmdBaseY + minM.M * bmdScale})`}>
                  <line x1="0" y1="0" x2="0" y2={-minM.M * bmdScale} stroke="#f59e0b" strokeWidth="1" strokeDasharray="2 2" opacity="0.5" />
                  <rect x="-52" y="-19" width="104" height="16" rx="4" fill="#1c1917" stroke="#fbbf24" strokeWidth="1" />
                  <text x="0" y="-7" fill="#fef3c7" fontSize="9.5" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
                    M tumpuan = {minM.M.toFixed(2)} {symbols.moment}
                  </text>
                  <circle cx="0" cy="0" r="3.5" fill="#fbbf24" stroke="#ffffff" strokeWidth="1" />
                </g>
              )}

              {/* Intermediate Value Labels along the BMD curve when zoomed in */}
              {showValues && diagramPoints.filter((_, i) => i % sampleStep === 0).map((pt, i) => {
                const cx = toCanvasX(pt.x);
                const cy = bmdBaseY + pt.M * bmdScale;
                const isNearMax = maxM && Math.abs(pt.x - maxM.x) < 0.2;
                const isNearMin = minM && Math.abs(pt.x - minM.x) < 0.2;
                if (isNearMax || isNearMin) return null;

                return (
                  <g key={`bmd-sample-${i}`} className="opacity-90">
                    <circle cx={cx} cy={cy} r="2" fill="#fbbf24" />
                    {zoom >= 1.0 && (
                      <text
                        x={cx}
                        y={cy + (pt.M >= 0 ? 12 : -6)}
                        fill="#fde68a"
                        fontSize="8.5"
                        fontFamily="monospace"
                        fontWeight="semibold"
                        textAnchor="middle"
                      >
                        {pt.M > 0 ? '+' : ''}{pt.M.toFixed(1)}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          )}

          {/* ================= 7. INTERACTIVE TRACKING CROSSHAIR ================= */}
          {hoverMeterX !== null && (
            <g pointerEvents="none">
              {/* Full height vertical guide line */}
              <line
                x1={toCanvasX(hoverMeterX)}
                y1={beamY - 45}
                x2={toCanvasX(hoverMeterX)}
                y2={baseHeight - 20}
                stroke="#38bdf8"
                strokeWidth="1.2"
                strokeDasharray="3 3"
              />

              {/* Dot on physical beam */}
              <circle cx={toCanvasX(hoverMeterX)} cy={beamY} r="4.5" fill="#38bdf8" stroke="#ffffff" strokeWidth="1" />

              {/* Interactive Tooltips on Diagrams */}
              {hoveredPoint && (activeViewMode === 'all' || activeViewMode === 'sfd') && (
                <g transform={`translate(${toCanvasX(hoverMeterX)}, ${sfdBaseY - hoveredPoint.V * sfdScale})`}>
                  <circle cx="0" cy="0" r="4" fill="#38bdf8" stroke="#ffffff" strokeWidth="1.5" />
                  <rect x="7" y="-12" width="76" height="18" rx="4" fill="#0f172a" stroke="#38bdf8" strokeWidth="1" />
                  <text x="12" y="1" fill="#38bdf8" fontSize="9.5" fontFamily="monospace" fontWeight="bold">
                    V: {hoveredPoint.V > 0 ? '+' : ''}{hoveredPoint.V.toFixed(2)}k
                  </text>
                </g>
              )}

              {hoveredPoint && (activeViewMode === 'all' || activeViewMode === 'bmd') && (
                <g transform={`translate(${toCanvasX(hoverMeterX)}, ${bmdBaseY + hoveredPoint.M * bmdScale})`}>
                  <circle cx="0" cy="0" r="4" fill="#fbbf24" stroke="#ffffff" strokeWidth="1.5" />
                  <rect x="7" y="-12" width="76" height="18" rx="4" fill="#1c1917" stroke="#fbbf24" strokeWidth="1" />
                  <text x="12" y="1" fill="#fbbf24" fontSize="9.5" fontFamily="monospace" fontWeight="bold">
                    M: {hoveredPoint.M > 0 ? '+' : ''}{hoveredPoint.M.toFixed(2)}m
                  </text>
                </g>
              )}
            </g>
          )}
        </svg>

        {/* Quick Action Floating Menu on Beam Click */}
        {quickActionPos && (
          <div
            className="absolute z-30 bg-[#0f172a] border border-sky-500/60 rounded-2xl shadow-2xl p-3 text-xs text-white space-y-2 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-xl"
            style={{
              left: Math.max(16, Math.min(baseWidth - 240, quickActionPos.screenX - 80)),
              top: Math.max(40, quickActionPos.screenY + 10)
            }}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-1.5 font-bold text-sky-400">
              <span>Posisi Terpilih: x = {quickActionPos.xMeter} m</span>
              <button
                onClick={() => setQuickActionPos(null)}
                className="text-slate-400 hover:text-white p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex flex-col gap-1.5 min-w-[210px]">
              {onAddLoadAt && (
                <>
                  <button
                    onClick={() => {
                      onAddLoadAt(quickActionPos.xMeter, 'point', 20);
                      setQuickActionPos(null);
                    }}
                    className="px-2.5 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-xl text-left text-[11px] font-medium flex items-center gap-1.5 transition"
                  >
                    <ArrowDown className="w-3.5 h-3.5" /> + Beban Terpusat P (20 kN)
                  </button>
                  <button
                    onClick={() => {
                      onAddLoadAt(quickActionPos.xMeter, 'distributed', 10);
                      setQuickActionPos(null);
                    }}
                    className="px-2.5 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-xl text-left text-[11px] font-medium flex items-center gap-1.5 transition"
                  >
                    <ArrowDown className="w-3.5 h-3.5" /> + Beban Merata q (10 kN/m)
                  </button>
                </>
              )}
              {onAddSupportAt && (
                <>
                  <button
                    onClick={() => {
                      onAddSupportAt(quickActionPos.xMeter, 'pin');
                      setQuickActionPos(null);
                    }}
                    className="px-2.5 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/40 rounded-xl text-left text-[11px] font-medium flex items-center gap-1.5 transition"
                  >
                    <Anchor className="w-3.5 h-3.5" /> + Tumpuan Sendi (Pin)
                  </button>
                  <button
                    onClick={() => {
                      onAddSupportAt(quickActionPos.xMeter, 'roller');
                      setQuickActionPos(null);
                    }}
                    className="px-2.5 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/40 rounded-xl text-left text-[11px] font-medium flex items-center gap-1.5 transition"
                  >
                    <CircleDot className="w-3.5 h-3.5" /> + Tumpuan Rol (Roller)
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Viewport Footer Console Info */}
      <div className="bg-[#0f1422] border-t border-white/[0.08] px-4 py-2 flex flex-wrap items-center justify-between text-[11px] text-slate-400 font-mono gap-2">
        <div className="flex items-center gap-3">
          <span className="text-sky-400 font-semibold">MODE: {activeViewMode.toUpperCase()}</span>
          <span>|</span>
          <span className="flex items-center gap-1">
            <Move className="w-3 h-3 text-sky-400" />
            <span>{controlMode === 'inspect' ? 'Mode Inspeksi aktif: Geser kursor/sentuh untuk membaca gaya.' : 'Mode Pan aktif: Tarik kanvas untuk menggeser view.'}</span>
          </span>
        </div>
        <div className="text-slate-500 text-[10px] hidden sm:block">
          Konvensi: Momen positif diplot di serat tarik (bawah). SFD (Biru Langit) · BMD (Kuning Amber).
        </div>
      </div>
    </div>
  );
};
