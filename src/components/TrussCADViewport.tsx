import React, { useState, useRef } from 'react';
import {
  TrussNode,
  TrussMember,
  TrussNodeLoad,
  TrussAnalysisResult,
  SupportType
} from '../types/structural';
import {
  MousePointer,
  Plus,
  GitCommit,
  Anchor,
  ArrowDown,
  Trash2,
  Maximize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sparkles,
  Info
} from 'lucide-react';

interface TrussCADViewportProps {
  nodes: TrussNode[];
  members: TrussMember[];
  loads: TrussNodeLoad[];
  result?: TrussAnalysisResult | null;
  onUpdateNodes: (nodes: TrussNode[]) => void;
  onUpdateMembers: (members: TrussMember[]) => void;
  onUpdateLoads: (loads: TrussNodeLoad[]) => void;
  onRunAnalysis: () => void;
  onLoadPreset?: (presetName: 'warren' | 'pratt' | 'howe' | 'roof' | 'cantilever') => void;
}

export const TrussCADViewport: React.FC<TrussCADViewportProps> = ({
  nodes,
  members,
  loads,
  result,
  onUpdateNodes,
  onUpdateMembers,
  onUpdateLoads,
  onRunAnalysis,
  onLoadPreset
}) => {
  // CAD Tools: 'select' | 'add_node' | 'add_member' | 'add_support' | 'add_load'
  const [activeTool, setActiveTool] = useState<'select' | 'add_node' | 'add_member' | 'add_support' | 'add_load'>('select');
  const [displayMode, setDisplayMode] = useState<'model' | 'forces' | 'all'>('all');

  // Selection
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  // Member drawing state (Node A -> Node B)
  const [drawingStartNodeId, setDrawingStartNodeId] = useState<string | null>(null);

  // Mouse hover coordinates (in physical meters)
  const [hoverCoord, setHoverCoord] = useState<{ x: number; y: number } | null>(null);
  const [loadModalNodeId, setLoadModalNodeId] = useState<string | null>(null);
  const [tempFy, setTempFy] = useState<number>(-20);
  const [tempFx, setTempFx] = useState<number>(0);

  // View transform
  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const svgRef = useRef<SVGSVGElement | null>(null);

  // Viewport dimensions
  const width = 880;
  const height = 440;
  const margin = 60;

  // Compute bounding box of current nodes
  const allX = nodes.length > 0 ? nodes.map(n => n.x) : [0, 8];
  const allY = nodes.length > 0 ? nodes.map(n => n.y) : [0, 3];
  const minModelX = Math.min(0, ...allX);
  const maxModelX = Math.max(8, ...allX);
  const minModelY = Math.min(0, ...allY);
  const maxModelY = Math.max(3, ...allY);

  const spanX = Math.max(6, maxModelX - minModelX);
  const spanY = Math.max(3, maxModelY - minModelY);

  const usableW = width - 2 * margin;
  const usableH = height - 2 * margin;

  // Scale: pixels per meter (keep aspect ratio square)
  const scale = Math.min(usableW / (spanX + 1), usableH / (spanY + 1)) * zoom;

  const originCanvasX = margin + 30 + pan.x;
  const originCanvasY = height - margin - 20 + pan.y;

  const toCanvasX = (x: number) => originCanvasX + (x - minModelX) * scale;
  const toCanvasY = (y: number) => originCanvasY - (y - minModelY) * scale;

  const toModelX = (canvasX: number) => minModelX + (canvasX - originCanvasX) / scale;
  const toModelY = (canvasY: number) => minModelY + (originCanvasY - canvasY) / scale;

  // Snap to 0.5m grid
  const snap = (val: number, step = 0.5) => Math.round(val / step) * step;

  // Handle canvas mouse move
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const cX = ((e.clientX - rect.left) / rect.width) * width;
    const cY = ((e.clientY - rect.top) / rect.height) * height;

    const rawX = toModelX(cX);
    const rawY = toModelY(cY);
    setHoverCoord({
      x: snap(rawX, 0.5),
      y: Math.max(0, snap(rawY, 0.5))
    });
  };

  const handleMouseLeave = () => {
    setHoverCoord(null);
  };

  // Canvas Click (Placing nodes, etc.)
  const handleCanvasClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!hoverCoord) return;

    if (activeTool === 'add_node') {
      const nextId = `node-${Date.now().toString(36)}`;
      const newNode: TrussNode = {
        id: nextId,
        x: hoverCoord.x,
        y: hoverCoord.y,
        support: undefined
      };
      const updatedNodes = [...nodes, newNode];
      onUpdateNodes(updatedNodes);
      setSelectedNodeId(nextId);
    } else if (activeTool === 'select') {
      setSelectedNodeId(null);
      setSelectedMemberId(null);
      setDrawingStartNodeId(null);
    }
  };

  // Node Click handler
  const handleNodeClick = (node: TrussNode, e: React.MouseEvent) => {
    e.stopPropagation();

    if (activeTool === 'select') {
      setSelectedNodeId(node.id);
      setSelectedMemberId(null);
    } else if (activeTool === 'add_member') {
      if (!drawingStartNodeId) {
        // Start member from this node
        setDrawingStartNodeId(node.id);
        setSelectedNodeId(node.id);
      } else if (drawingStartNodeId !== node.id) {
        // Finish member
        const exists = members.some(
          m =>
            (m.nodeStartId === drawingStartNodeId && m.nodeEndId === node.id) ||
            (m.nodeStartId === node.id && m.nodeEndId === drawingStartNodeId)
        );
        if (!exists) {
          const newMem: TrussMember = {
            id: `mem-${Date.now().toString(36)}`,
            nodeStartId: drawingStartNodeId,
            nodeEndId: node.id,
            E: 200000,
            A: 1500
          };
          onUpdateMembers([...members, newMem]);
        }
        setDrawingStartNodeId(null);
      }
    } else if (activeTool === 'add_support') {
      // Cycle: undefined -> pin -> roller -> undefined
      const cycleSupport = (curr?: SupportType): SupportType | undefined => {
        if (!curr) return 'pin';
        if (curr === 'pin') return 'roller';
        return undefined;
      };
      const updated = nodes.map(n => (n.id === node.id ? { ...n, support: cycleSupport(n.support) } : n));
      onUpdateNodes(updated);
    } else if (activeTool === 'add_load') {
      setLoadModalNodeId(node.id);
    }
  };

  // Member Click handler
  const handleMemberClick = (mem: TrussMember, e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeTool === 'select') {
      setSelectedMemberId(mem.id);
      setSelectedNodeId(null);
    }
  };

  // Delete selected item
  const handleDeleteSelected = () => {
    if (selectedNodeId) {
      onUpdateNodes(nodes.filter(n => n.id !== selectedNodeId));
      onUpdateMembers(members.filter(m => m.nodeStartId !== selectedNodeId && m.nodeEndId !== selectedNodeId));
      onUpdateLoads(loads.filter(l => l.nodeId !== selectedNodeId));
      setSelectedNodeId(null);
    } else if (selectedMemberId) {
      onUpdateMembers(members.filter(m => m.id !== selectedMemberId));
      setSelectedMemberId(null);
    }
  };

  // Clear all
  const handleClearAll = () => {
    onUpdateNodes([]);
    onUpdateMembers([]);
    onUpdateLoads([]);
    setSelectedNodeId(null);
    setSelectedMemberId(null);
    setDrawingStartNodeId(null);
  };

  // Save joint load
  const handleSaveLoad = () => {
    if (!loadModalNodeId) return;
    const existingIdx = loads.findIndex(l => l.nodeId === loadModalNodeId);
    if (tempFy === 0 && tempFx === 0) {
      if (existingIdx >= 0) onUpdateLoads(loads.filter(l => l.nodeId !== loadModalNodeId));
    } else {
      const newLoad: TrussNodeLoad = {
        id: `load-${Date.now().toString(36)}`,
        nodeId: loadModalNodeId,
        Fx: tempFx,
        Fy: tempFy
      };
      if (existingIdx >= 0) {
        const copy = [...loads];
        copy[existingIdx] = newLoad;
        onUpdateLoads(copy);
      } else {
        onUpdateLoads([...loads, newLoad]);
      }
    }
    setLoadModalNodeId(null);
  };

  // Grid lines generation (0m to maxModelX+2m, 0m to maxModelY+2m)
  const gridLinesX: number[] = [];
  for (let x = Math.floor(minModelX); x <= Math.ceil(maxModelX) + 2; x += 1) {
    gridLinesX.push(x);
  }
  const gridLinesY: number[] = [];
  for (let y = 0; y <= Math.ceil(maxModelY) + 2; y += 1) {
    gridLinesY.push(y);
  }

  const drawingStartNode = nodes.find(n => n.id === drawingStartNodeId);

  return (
    <div className="w-full bg-[#080d16] rounded-2xl border-2 border-slate-700/80 shadow-2xl overflow-hidden font-sans select-none flex flex-col relative">
      {/* Top CAD Header & Tool Bar */}
      <div className="bg-[#0f172a] border-b border-slate-800 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-mono text-cyan-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
            WORKSPACE RANGKA BATANG 2D (2D TRUSS CAD)
          </span>
          <span className="text-slate-500 font-mono text-[11px]">
            ({nodes.length} Buhul, {members.length} Batang, {loads.length} Beban)
          </span>
        </div>

        {/* Display Mode Toggle */}
        <div className="flex bg-[#070b12] p-0.5 rounded-lg border border-slate-800">
          <button
            onClick={() => setDisplayMode('all')}
            className={`px-2.5 py-1 rounded text-xs transition ${
              displayMode === 'all' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Semua (Lengkap)
          </button>
          <button
            onClick={() => setDisplayMode('forces')}
            className={`px-2.5 py-1 rounded text-xs transition ${
              displayMode === 'forces' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Diagram Gaya (T / C)
          </button>
          <button
            onClick={() => setDisplayMode('model')}
            className={`px-2.5 py-1 rounded text-xs transition ${
              displayMode === 'model' ? 'bg-slate-700 text-white font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Geometri Saja
          </button>
        </div>
      </div>

      {/* Preset Benchmarks for Truss */}
      {onLoadPreset && (
        <div className="bg-[#0b121e] border-b border-slate-800/80 px-4 py-1.5 flex flex-wrap items-center justify-between text-xs gap-2">
          <span className="text-cyan-300 font-medium flex items-center gap-1.5 text-[11px]">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            Preset Struktur Rangka Standar:
          </span>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => onLoadPreset('warren')}
              className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 text-[11px] font-mono"
            >
              ★ Warren Truss (8m, 4 Panel)
            </button>
            <button
              onClick={() => onLoadPreset('pratt')}
              className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 text-[11px] font-mono"
            >
              Pratt Truss (12m, 6 Panel)
            </button>
            <button
              onClick={() => onLoadPreset('howe')}
              className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 text-[11px] font-mono"
            >
              Howe Truss (12m, 6 Panel)
            </button>
            <button
              onClick={() => onLoadPreset('roof')}
              className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 text-[11px] font-mono"
            >
              Kuda-Kuda Atap (8m x 2m)
            </button>
            <button
              onClick={() => onLoadPreset('cantilever')}
              className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 text-[11px] font-mono"
            >
              Truss Kantilever (6m)
            </button>
          </div>
        </div>
      )}

      {/* CAD Interactive Toolbar */}
      <div className="bg-[#090e1a] border-b border-slate-800/80 px-4 py-2 flex flex-wrap items-center justify-between text-xs gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => {
              setActiveTool('select');
              setDrawingStartNodeId(null);
            }}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition ${
              activeTool === 'select' ? 'bg-cyan-600 text-white font-bold shadow' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
            title="Pilih & seleksi elemen pada kanvas"
          >
            <MousePointer className="w-3.5 h-3.5" /> Pilih (Select)
          </button>
          <button
            onClick={() => {
              setActiveTool('add_node');
              setDrawingStartNodeId(null);
            }}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition ${
              activeTool === 'add_node' ? 'bg-cyan-600 text-white font-bold shadow' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
            title="Klik pada grid kanvas untuk menambahkan titik buhul baru (snap 0.5m)"
          >
            <Plus className="w-3.5 h-3.5" /> + Buhul (Node)
          </button>
          <button
            onClick={() => {
              setActiveTool('add_member');
              setDrawingStartNodeId(null);
            }}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition ${
              activeTool === 'add_member' ? 'bg-emerald-600 text-white font-bold shadow' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
            title="Klik buhul awal lalu klik buhul akhir untuk menarik batang seperti CAD"
          >
            <GitCommit className="w-3.5 h-3.5" /> + Batang (Draw Member)
          </button>
          <button
            onClick={() => {
              setActiveTool('add_support');
              setDrawingStartNodeId(null);
            }}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition ${
              activeTool === 'add_support' ? 'bg-blue-600 text-white font-bold shadow' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
            title="Klik pada titik buhul untuk mengatur tumpuan: Sendi -> Rol -> Bebas"
          >
            <Anchor className="w-3.5 h-3.5" /> + Tumpuan (Support)
          </button>
          <button
            onClick={() => {
              setActiveTool('add_load');
              setDrawingStartNodeId(null);
            }}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition ${
              activeTool === 'add_load' ? 'bg-amber-600 text-white font-bold shadow' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
            title="Klik pada titik buhul untuk memberi beban titik Fx / Fy"
          >
            <ArrowDown className="w-3.5 h-3.5" /> + Beban (Load)
          </button>

          {(selectedNodeId || selectedMemberId) && (
            <button
              onClick={handleDeleteSelected}
              className="px-2.5 py-1 rounded-lg text-xs font-medium bg-rose-900/80 hover:bg-rose-700 text-rose-200 flex items-center gap-1 border border-rose-700/80 transition"
              title="Hapus elemen yang dipilih"
            >
              <Trash2 className="w-3.5 h-3.5" /> Hapus Terpilih
            </button>
          )}

          <button
            onClick={handleClearAll}
            className="px-2 py-1 rounded-lg text-xs text-slate-400 hover:text-rose-300 hover:bg-slate-800 transition"
            title="Bersihkan model"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>

          <button
            onClick={onRunAnalysis}
            className="px-3 py-1 rounded-lg text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white flex items-center gap-1.5 shadow-md shadow-cyan-950 border border-cyan-400/40 transition active:scale-95 ml-1"
            title="Jalankan perhitungan analitis rangka batang (Method of Joints)"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-200" />
            Hitung Rangka Batang
          </button>
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setZoom(z => Math.max(0.6, z - 0.15))}
            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="font-mono text-[11px] text-slate-400 px-1">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom(z => Math.min(2.0, z + 0.15))}
            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => {
              setZoom(1.0);
              setPan({ x: 0, y: 0 });
            }}
            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
            title="Fit View"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Selected Node Quick Context Bar */}
      {selectedNodeId && (() => {
        const selNode = nodes.find(n => n.id === selectedNodeId);
        const selIdx = nodes.findIndex(n => n.id === selectedNodeId) + 1;
        if (!selNode) return null;
        return (
          <div className="bg-[#0b1424] border-b border-cyan-800/60 px-4 py-1.5 text-xs text-slate-200 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-cyan-400">
                Buhul N{selIdx} ({selNode.x}m, {selNode.y}m)
              </span>
              <span className="text-slate-500">| Tumpuan:</span>
              <div className="inline-flex rounded-lg bg-slate-900 p-0.5 border border-slate-700">
                <button
                  onClick={() => {
                    onUpdateNodes(nodes.map(n => n.id === selNode.id ? { ...n, support: undefined } : n));
                  }}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${!selNode.support ? 'bg-slate-700 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
                >
                  Bebas
                </button>
                <button
                  onClick={() => {
                    onUpdateNodes(nodes.map(n => n.id === selNode.id ? { ...n, support: 'pin' } : n));
                  }}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${selNode.support === 'pin' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
                >
                  Sendi (Pin)
                </button>
                <button
                  onClick={() => {
                    onUpdateNodes(nodes.map(n => n.id === selNode.id ? { ...n, support: 'roller' } : n));
                  }}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${selNode.support === 'roller' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
                >
                  Rol (Roller)
                </button>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setLoadModalNodeId(selNode.id)}
                className="px-2 py-0.5 rounded bg-amber-900/60 hover:bg-amber-800 text-amber-200 border border-amber-700 text-[11px]"
              >
                + Beri Beban
              </button>
              <button
                onClick={handleDeleteSelected}
                className="px-2 py-0.5 rounded bg-rose-900/60 hover:bg-rose-800 text-rose-200 border border-rose-700 text-[11px]"
              >
                Hapus Buhul
              </button>
            </div>
          </div>
        );
      })()}

      {/* Interactive Helper Banner */}
      {activeTool === 'add_member' && (
        <div className="bg-emerald-950/90 border-b border-emerald-600 px-4 py-1.5 text-xs text-emerald-200 flex items-center justify-between font-mono animate-fadeIn">
          <span>
            {drawingStartNodeId
              ? `▶ Titik buhul awal terpilih (${nodes.find(n => n.id === drawingStartNodeId)?.id}). Silakan klik buhul akhir untuk menyelesaikan garis batang.`
              : `▶ Mode Gambar Batang Aktif: Klik pada buhul awal, lalu tarik dan klik buhul tujuan.`}
          </span>
          {drawingStartNodeId && (
            <button
              onClick={() => setDrawingStartNodeId(null)}
              className="text-emerald-400 hover:text-white underline text-[11px]"
            >
              Batal
            </button>
          )}
        </div>
      )}

      {/* SVG CAD Canvas */}
      <div className="relative w-full overflow-hidden bg-[#070d18] cursor-crosshair">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto min-h-[380px] select-none"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onClick={handleCanvasClick}
        >
          <defs>
            {/* Grid Pattern */}
            <pattern id="trussSmallGrid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1e293b" strokeWidth="0.5" strokeOpacity="0.4" />
            </pattern>
            {/* Load Arrow Marker */}
            <marker
              id="trussLoadArrowGold"
              viewBox="0 0 10 10"
              refX="5"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#f59e0b" />
            </marker>
            {/* Reaction Arrow Marker */}
            <marker
              id="trussReactionArrowCyan"
              viewBox="0 0 10 10"
              refX="5"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#00e5ff" />
            </marker>
          </defs>

          {/* Background fine grid */}
          <rect width={width} height={height} fill="#070d18" />
          <rect width={width} height={height} fill="url(#trussSmallGrid)" />

          {/* Major Grid Lines with coordinates */}
          {gridLinesX.map(gx => {
            const cx = toCanvasX(gx);
            if (cx < 0 || cx > width) return null;
            return (
              <g key={`glx-${gx}`}>
                <line x1={cx} y1={0} x2={cx} y2={height} stroke="#334155" strokeWidth="0.7" strokeDasharray="3 3" />
                <text x={cx + 3} y={originCanvasY + 14} fill="#64748b" fontSize="9" fontFamily="monospace">
                  {gx}m
                </text>
              </g>
            );
          })}
          {gridLinesY.map(gy => {
            const cy = toCanvasY(gy);
            if (cy < 0 || cy > height) return null;
            return (
              <g key={`gly-${gy}`}>
                <line x1={0} y1={cy} x2={width} y2={cy} stroke="#334155" strokeWidth="0.7" strokeDasharray="3 3" />
                <text x={originCanvasX - 22} y={cy - 3} fill="#64748b" fontSize="9" fontFamily="monospace">
                  {gy}m
                </text>
              </g>
            );
          })}

          {/* Origin Axes Indicator (X in Red, Y in Green) */}
          <g transform={`translate(${originCanvasX}, ${originCanvasY})`} pointerEvents="none">
            <line x1="0" y1="0" x2="35" y2="0" stroke="#ef4444" strokeWidth="2" markerEnd="url(#trussLoadArrowGold)" />
            <line x1="0" y1="0" x2="0" y2="-35" stroke="#10b981" strokeWidth="2" markerEnd="url(#trussLoadArrowGold)" />
            <text x="38" y="4" fill="#ef4444" fontSize="9" fontFamily="monospace" fontWeight="bold">
              +X
            </text>
            <text x="-4" y="-38" fill="#10b981" fontSize="9" fontFamily="monospace" fontWeight="bold">
              +Y
            </text>
            <circle cx="0" cy="0" r="3" fill="#cbd5e1" />
          </g>

          {/* Rubberband line preview while drawing member */}
          {drawingStartNode && hoverCoord && (
            <g pointerEvents="none">
              <line
                x1={toCanvasX(drawingStartNode.x)}
                y1={toCanvasY(drawingStartNode.y)}
                x2={toCanvasX(hoverCoord.x)}
                y2={toCanvasY(hoverCoord.y)}
                stroke="#00e5ff"
                strokeWidth="2.5"
                strokeDasharray="4 4"
              />
              {/* Length readout */}
              {(() => {
                const dx = hoverCoord.x - drawingStartNode.x;
                const dy = hoverCoord.y - drawingStartNode.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const midX = (toCanvasX(drawingStartNode.x) + toCanvasX(hoverCoord.x)) / 2;
                const midY = (toCanvasY(drawingStartNode.y) + toCanvasY(hoverCoord.y)) / 2;
                return (
                  <rect
                    x={midX - 26}
                    y={midY - 14}
                    width="52"
                    height="16"
                    rx="4"
                    fill="#0f172a"
                    stroke="#00e5ff"
                    strokeWidth="1"
                  />
                );
              })()}
              <text
                x={(toCanvasX(drawingStartNode.x) + toCanvasX(hoverCoord.x)) / 2}
                y={(toCanvasY(drawingStartNode.y) + toCanvasY(hoverCoord.y)) / 2 - 2}
                fill="#00e5ff"
                fontSize="10"
                fontFamily="monospace"
                fontWeight="bold"
                textAnchor="middle"
              >
                {Math.sqrt(
                  Math.pow(hoverCoord.x - drawingStartNode.x, 2) + Math.pow(hoverCoord.y - drawingStartNode.y, 2)
                ).toFixed(2)}m
              </text>
            </g>
          )}

          {/* ================= 1. MEMBERS RENDERING ================= */}
          {members.map((mem, idx) => {
            const n1 = nodes.find(n => n.id === mem.nodeStartId);
            const n2 = nodes.find(n => n.id === mem.nodeEndId);
            if (!n1 || !n2) return null;

            const x1 = toCanvasX(n1.x);
            const y1 = toCanvasY(n1.y);
            const x2 = toCanvasX(n2.x);
            const y2 = toCanvasY(n2.y);
            const isSelected = selectedMemberId === mem.id;

            // Result force
            const forceObj = result?.memberForces.find(mf => mf.memberId === mem.id);
            const isTension = forceObj?.type === 'Tension';
            const isCompression = forceObj?.type === 'Compression';

            let strokeColor = '#64748b'; // default slate
            let strokeW = isSelected ? 4 : 2.5;

            if (displayMode === 'forces' || displayMode === 'all') {
              if (isTension) {
                strokeColor = '#10b981'; // Green for Tension
                strokeW = isSelected ? 5 : 3.5;
              } else if (isCompression) {
                strokeColor = '#ef4444'; // Red for Compression
                strokeW = isSelected ? 5 : 3.5;
              }
            }

            const midX = (x1 + x2) / 2;
            const midY = (y1 + y2) / 2;
            const len = Math.sqrt(Math.pow(n2.x - n1.x, 2) + Math.pow(n2.y - n1.y, 2));

            return (
              <g
                key={mem.id}
                className="cursor-pointer group"
                onClick={e => handleMemberClick(mem, e)}
              >
                {/* Wide invisible hit line */}
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth="20" />
                {/* Visible Member Line */}
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={isSelected ? '#38bdf8' : strokeColor}
                  strokeWidth={strokeW}
                  strokeLinecap="round"
                />

                {/* Force Badge / Member Label */}
                {forceObj && (displayMode === 'forces' || displayMode === 'all') ? (
                  <g pointerEvents="none">
                    <rect
                      x={midX - 32}
                      y={midY - 10}
                      width="64"
                      height="18"
                      rx="4"
                      fill="#0b1016"
                      fillOpacity="0.9"
                      stroke={strokeColor}
                      strokeWidth="1"
                    />
                    <text
                      x={midX}
                      y={midY + 3}
                      fill={strokeColor}
                      fontSize="9.5"
                      fontFamily="monospace"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      {Math.abs(forceObj.force).toFixed(1)} kN {isTension ? '(T)' : isCompression ? '(C)' : '(0)'}
                    </text>
                  </g>
                ) : (
                  <g pointerEvents="none">
                    <text
                      x={midX}
                      y={midY - 6}
                      fill="#94a3b8"
                      fontSize="9"
                      fontFamily="monospace"
                      textAnchor="middle"
                    >
                      M{idx + 1} ({len.toFixed(2)}m)
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* ================= 2. SUPPORT REACTIONS ================= */}
          {(displayMode === 'all' || displayMode === 'forces') &&
            result?.supportReactions.map(sr => {
              const targetNode = nodes.find(n => n.id === sr.nodeId);
              if (!targetNode) return null;
              const nx = toCanvasX(targetNode.x);
              const ny = toCanvasY(targetNode.y);

              return (
                <g key={`truss-reac-${sr.nodeId}`} pointerEvents="none">
                  {/* Vertical Reaction Arrow */}
                  {Math.abs(sr.Ry) > 0.01 && (
                    <g>
                      <line
                        x1={nx}
                        y1={ny + 45}
                        x2={nx}
                        y2={ny + 16}
                        stroke="#00e5ff"
                        strokeWidth="2.5"
                        markerEnd="url(#trussReactionArrowCyan)"
                      />
                      <rect
                        x={nx - 24}
                        y={ny + 48}
                        width="48"
                        height="15"
                        rx="3"
                        fill="#0b1016"
                        fillOpacity="0.9"
                        stroke="#00e5ff"
                        strokeWidth="0.8"
                      />
                      <text
                        x={nx}
                        y={ny + 59}
                        fill="#00e5ff"
                        fontSize="9.5"
                        fontFamily="monospace"
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        Ry={sr.Ry.toFixed(1)}
                      </text>
                    </g>
                  )}
                  {/* Horizontal Reaction Arrow */}
                  {Math.abs(sr.Rx) > 0.01 && (
                    <g>
                      <line
                        x1={nx - 45}
                        y1={ny}
                        x2={nx - 16}
                        y2={ny}
                        stroke="#00e5ff"
                        strokeWidth="2.5"
                        markerEnd="url(#trussReactionArrowCyan)"
                      />
                      <text
                        x={nx - 48}
                        y={ny + 3}
                        fill="#00e5ff"
                        fontSize="9.5"
                        fontFamily="monospace"
                        fontWeight="bold"
                        textAnchor="end"
                      >
                        Rx={sr.Rx.toFixed(1)}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

          {/* ================= 3. JOINT LOADS ================= */}
          {loads.map(load => {
            const targetNode = nodes.find(n => n.id === load.nodeId);
            if (!targetNode) return null;
            const nx = toCanvasX(targetNode.x);
            const ny = toCanvasY(targetNode.y);

            return (
              <g key={load.id} pointerEvents="none">
                {/* Fy load arrow */}
                {load.Fy !== 0 && (
                  <g>
                    <line
                      x1={nx}
                      y1={ny - (load.Fy < 0 ? 45 : -45)}
                      x2={nx}
                      y2={ny - (load.Fy < 0 ? 8 : -8)}
                      stroke="#f59e0b"
                      strokeWidth="2.5"
                      markerEnd="url(#trussLoadArrowGold)"
                    />
                    <rect
                      x={nx - 28}
                      y={ny - (load.Fy < 0 ? 62 : -48)}
                      width="56"
                      height="16"
                      rx="3"
                      fill="#0f172a"
                      stroke="#f59e0b"
                      strokeWidth="1"
                    />
                    <text
                      x={nx}
                      y={ny - (load.Fy < 0 ? 50 : -60)}
                      fill="#fbbf24"
                      fontSize="10"
                      fontFamily="monospace"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      P = {Math.abs(load.Fy)} kN
                    </text>
                  </g>
                )}
                {/* Fx load arrow */}
                {load.Fx !== 0 && (
                  <g>
                    <line
                      x1={nx - (load.Fx > 0 ? 45 : -45)}
                      y1={ny}
                      x2={nx - (load.Fx > 0 ? 8 : -8)}
                      y2={ny}
                      stroke="#f59e0b"
                      strokeWidth="2.5"
                      markerEnd="url(#trussLoadArrowGold)"
                    />
                    <text
                      x={nx - (load.Fx > 0 ? 50 : -50)}
                      y={ny + 4}
                      fill="#fbbf24"
                      fontSize="10"
                      fontFamily="monospace"
                      fontWeight="bold"
                      textAnchor={load.Fx > 0 ? 'end' : 'start'}
                    >
                      Fx={load.Fx}kN
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* ================= 4. NODES & SUPPORTS ================= */}
          {nodes.map((node, idx) => {
            const cx = toCanvasX(node.x);
            const cy = toCanvasY(node.y);
            const isSelected = selectedNodeId === node.id;
            const isStartDrawing = drawingStartNodeId === node.id;

            return (
              <g
                key={node.id}
                className="cursor-pointer group"
                onClick={e => handleNodeClick(node, e)}
              >
                {/* Supports */}
                {node.support === 'pin' && (
                  <g transform={`translate(${cx}, ${cy})`} pointerEvents="none">
                    <polygon
                      points="0,0 -12,18 12,18"
                      fill="#0284c7"
                      stroke="#38bdf8"
                      strokeWidth="1.5"
                    />
                    <line x1="-15" y1="18" x2="15" y2="18" stroke="#64748b" strokeWidth="2" />
                    <line x1="-12" y1="22" x2="-8" y2="18" stroke="#64748b" strokeWidth="1" />
                    <line x1="-4" y1="22" x2="0" y2="18" stroke="#64748b" strokeWidth="1" />
                    <line x1="4" y1="22" x2="8" y2="18" stroke="#64748b" strokeWidth="1" />
                  </g>
                )}
                {node.support === 'roller' && (
                  <g transform={`translate(${cx}, ${cy})`} pointerEvents="none">
                    <polygon
                      points="0,0 -12,14 12,14"
                      fill="#0284c7"
                      stroke="#38bdf8"
                      strokeWidth="1.5"
                    />
                    <circle cx="-5" cy="18" r="3" fill="#94a3b8" />
                    <circle cx="5" cy="18" r="3" fill="#94a3b8" />
                    <line x1="-15" y1="22" x2="15" y2="22" stroke="#64748b" strokeWidth="2" />
                  </g>
                )}

                {/* Node circle */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={isSelected || isStartDrawing ? 7 : 5}
                  fill={isStartDrawing ? '#00e5ff' : isSelected ? '#38bdf8' : '#e2e8f0'}
                  stroke={isSelected || isStartDrawing ? '#ffffff' : '#0f172a'}
                  strokeWidth="2"
                  className="transition-transform hover:scale-125"
                />

                {/* Pulsing ring when drawing starts here */}
                {isStartDrawing && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r="12"
                    fill="none"
                    stroke="#00e5ff"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                    className="animate-spin"
                  />
                )}

                {/* Node ID Label */}
                <text
                  x={cx}
                  y={node.support ? cy - 10 : cy - 8}
                  fill={isSelected ? '#38bdf8' : '#cbd5e1'}
                  fontSize="10"
                  fontFamily="monospace"
                  fontWeight="bold"
                  textAnchor="middle"
                  pointerEvents="none"
                >
                  N{idx + 1} ({node.x}, {node.y})
                </text>
              </g>
            );
          })}

          {/* Mouse coordinate cursor crosshair indicator */}
          {hoverCoord && (
            <g pointerEvents="none">
              <circle
                cx={toCanvasX(hoverCoord.x)}
                cy={toCanvasY(hoverCoord.y)}
                r="4"
                fill="none"
                stroke="#00e5ff"
                strokeWidth="1.5"
              />
            </g>
          )}
        </svg>

        {/* Empty State Banner */}
        {nodes.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <div className="bg-[#0f172a]/90 border border-slate-700 p-6 rounded-2xl shadow-2xl text-center max-w-md pointer-events-auto">
              <Sparkles className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
              <h3 className="text-white font-bold text-sm">Kanvas CAD Rangka Batang (2D Truss) Siap</h3>
              <p className="text-xs text-slate-400 mt-1">
                Pilih tool <span className="text-cyan-300 font-bold">+ Buhul</span> untuk menambah titik dengan klik mouse, atau gunakan preset standar di atas untuk memuat model benchmark instan.
              </p>
              {onLoadPreset && (
                <div className="mt-3 flex gap-2 justify-center">
                  <button
                    onClick={() => onLoadPreset('warren')}
                    className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-bold transition shadow"
                  >
                    Muat Warren Truss (8m)
                  </button>
                  <button
                    onClick={() => onLoadPreset('roof')}
                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-medium border border-slate-700 transition"
                  >
                    Muat Rangka Atap
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom CAD Status Bar */}
      <div className="bg-[#0a0f1d] border-t border-slate-800 px-4 py-2 flex flex-wrap items-center justify-between text-xs font-mono text-slate-400">
        <div className="flex items-center gap-4">
          <span className="text-cyan-300 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
            Kursor: {hoverCoord ? `X = ${hoverCoord.x.toFixed(2)} m, Y = ${hoverCoord.y.toFixed(2)} m` : 'Di luar kanvas'}
          </span>
          <span className="text-slate-500">|</span>
          <span className="text-slate-300">Snap Grid: 0.5 m (Aktif)</span>
          <span className="text-slate-500">|</span>
          <span className="text-slate-300">
            Tool Aktif:{' '}
            <span className="text-cyan-400 font-bold uppercase">{activeTool.replace('_', ' ')}</span>
          </span>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-emerald-400 flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Batang Tarik (Tension, +)
          </span>
          <span className="text-rose-400 flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Batang Tekan (Compression, -)
          </span>
          <span className="text-slate-400 flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-500"></span> Batang Nol (0)
          </span>
        </div>
      </div>

      {/* Modal / Popover for Adding Joint Load */}
      {loadModalNodeId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0d1527] border-2 border-cyan-500/80 rounded-2xl p-5 max-w-sm w-full shadow-2xl">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
              <ArrowDown className="w-4 h-4 text-amber-400" />
              Atur Beban Titik Buhul: {nodes.find(n => n.id === loadModalNodeId)?.id}
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 block mb-1 font-medium">Beban Vertikal Fy (kN):</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    step="any"
                    value={tempFy}
                    onChange={e => setTempFy(parseFloat(e.target.value.replace(',', '.')) || 0)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white font-mono"
                    placeholder="-20 (arah ke bawah)"
                  />
                  <span className="text-slate-400 font-mono text-[11px]">kN</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">Nilai negatif (-) berarti arah ke bawah (gravitasi).</p>
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-medium">Beban Horisontal Fx (kN):</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    step="any"
                    value={tempFx}
                    onChange={e => setTempFx(parseFloat(e.target.value.replace(',', '.')) || 0)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white font-mono"
                    placeholder="0"
                  />
                  <span className="text-slate-400 font-mono text-[11px]">kN</span>
                </div>
              </div>

              {/* Quick Presets for Load */}
              <div className="pt-1">
                <span className="text-[11px] text-slate-400 block mb-1">Preset Cepat:</span>
                <div className="flex gap-1.5 flex-wrap">
                  <button
                    onClick={() => {
                      setTempFy(-10);
                      setTempFx(0);
                    }}
                    className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] border border-slate-700 font-mono"
                  >
                    -10 kN
                  </button>
                  <button
                    onClick={() => {
                      setTempFy(-20);
                      setTempFx(0);
                    }}
                    className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] border border-slate-700 font-mono"
                  >
                    -20 kN
                  </button>
                  <button
                    onClick={() => {
                      setTempFy(-40);
                      setTempFx(0);
                    }}
                    className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] border border-slate-700 font-mono"
                  >
                    -40 kN
                  </button>
                  <button
                    onClick={() => {
                      setTempFy(0);
                      setTempFx(0);
                    }}
                    className="px-2 py-0.5 bg-rose-950/80 hover:bg-rose-900 text-rose-300 rounded text-[11px] border border-rose-800 font-mono"
                  >
                    Hapus Beban (0)
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setLoadModalNodeId(null)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
              >
                Batal
              </button>
              <button
                onClick={handleSaveLoad}
                className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold"
              >
                Simpan Beban
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
