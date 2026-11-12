import React from 'react';
import {
  FilePlus2,
  FolderOpen,
  Save,
  RotateCcw,
  RotateCw,
  MousePointer,
  Move,
  PlusCircle,
  Network,
  Anchor,
  Layers,
  Play,
  Maximize2,
  Eye,
  Sliders,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';

interface AnalysisToolbarProps {
  activeTool: 'select' | 'move' | 'add_node' | 'add_member' | 'add_support' | 'add_load';
  onSelectTool: (tool: 'select' | 'move' | 'add_node' | 'add_member' | 'add_support' | 'add_load') => void;
  onNewModel: () => void;
  onSaveModel: () => void;
  onRunAnalysis: () => void;
  onResetView?: () => void;
  isAnalyzing?: boolean;
  modelSummaryText?: string;
}

export const AnalysisToolbar: React.FC<AnalysisToolbarProps> = ({
  activeTool,
  onSelectTool,
  onNewModel,
  onSaveModel,
  onRunAnalysis,
  onResetView,
  isAnalyzing = false,
  modelSummaryText = ''
}) => {
  return (
    <div className="glass-slab border border-white/[0.08] px-4 py-2.5 rounded-2xl flex flex-wrap items-center justify-between gap-2 select-none shadow-xl mb-3">
      {/* File & Edit Action Group */}
      <div className="flex items-center gap-1 bg-black/40 backdrop-blur-xl p-1 rounded-2xl border border-white/10">
        <button
          onClick={onNewModel}
          className="px-2.5 py-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition flex items-center gap-1.5 text-xs font-medium"
          title="Model Baru (New Model)"
        >
          <FilePlus2 className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden sm:inline">Baru</span>
        </button>

        <button
          onClick={onSaveModel}
          className="px-2.5 py-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition flex items-center gap-1.5 text-xs font-medium"
          title="Simpan Model (Save Model)"
        >
          <Save className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden sm:inline">Simpan</span>
        </button>

        <div className="h-4 w-px bg-white/10 mx-1"></div>

        {/* CAD Interaction Tools */}
        <button
          onClick={() => onSelectTool('select')}
          className={`px-2.5 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition ${
            activeTool === 'select'
              ? 'bg-white text-slate-950 font-bold shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
          }`}
          title="Pilih Objek (Select)"
        >
          <MousePointer className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Pilih</span>
        </button>

        <button
          onClick={() => onSelectTool('move')}
          className={`px-2.5 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition ${
            activeTool === 'move'
              ? 'bg-white text-slate-950 font-bold shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
          }`}
          title="Geser / Pan Kanvas"
        >
          <Move className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Pan</span>
        </button>

        <button
          onClick={() => onSelectTool('add_node')}
          className={`px-2.5 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition ${
            activeTool === 'add_node'
              ? 'bg-white text-slate-950 font-bold shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
          }`}
          title="Tambah Titik Buhul (Add Node)"
        >
          <PlusCircle className="w-3.5 h-3.5 text-blue-400" />
          <span className="hidden lg:inline">+ Node</span>
        </button>

        <button
          onClick={() => onSelectTool('add_member')}
          className={`px-2.5 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition ${
            activeTool === 'add_member'
              ? 'bg-white text-slate-950 font-bold shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
          }`}
          title="Tambah Elemen Batang (Add Member)"
        >
          <Network className="w-3.5 h-3.5 text-indigo-400" />
          <span className="hidden lg:inline">+ Batang</span>
        </button>

        <button
          onClick={() => onSelectTool('add_support')}
          className={`px-2.5 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition ${
            activeTool === 'add_support'
              ? 'bg-white text-slate-950 font-bold shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
          }`}
          title="Tambah Tumpuan (Add Support)"
        >
          <Anchor className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden lg:inline">+ Tumpuan</span>
        </button>

        <button
          onClick={() => onSelectTool('add_load')}
          className={`px-2.5 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition ${
            activeTool === 'add_load'
              ? 'bg-white text-slate-950 font-bold shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
          }`}
          title="Tambah Beban Struktural (Add Load)"
        >
          <Layers className="w-3.5 h-3.5 text-rose-400" />
          <span className="hidden lg:inline">+ Beban</span>
        </button>
      </div>

      {/* Model status & Run Button */}
      <div className="flex items-center gap-3">
        {modelSummaryText && (
          <span className="text-[11px] font-mono text-slate-400 tabular-nums hidden xl:inline">
            {modelSummaryText}
          </span>
        )}

        {onResetView && (
          <button
            onClick={onResetView}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition border border-white/5"
            title="Reset Tampilan Kanvas (Fit to Screen)"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        )}

        <button
          onClick={onRunAnalysis}
          disabled={isAnalyzing}
          className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-950 font-bold text-xs rounded-xl shadow-lg flex items-center gap-2 active:scale-95 transition"
        >
          {isAnalyzing ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-900" /> Menghitung...
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current text-slate-950" /> Run Analysis
            </>
          )}
        </button>
      </div>
    </div>
  );
};
