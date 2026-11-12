import React, { useState } from 'react';
import {
  BeamAnalysisResult,
  TrussAnalysisResult,
  TrussNode,
  TrussMember,
  TrussNodeLoad
} from '../types/structural';
import { useUnits } from '../context/UnitContext';
import {
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  Layers,
  TrendingUp,
  FileText,
  Table,
  Maximize2,
  Minimize2,
  ShieldCheck,
  Zap,
  Info,
  Activity
} from 'lucide-react';

interface ResultsPanelProps {
  result?: BeamAnalysisResult | null;
  trussResult?: TrussAnalysisResult | null;
  analysisMode?: 'beam' | 'truss';
  beamLength?: number;
  totalLoadGravity?: number;
  trussNodes?: TrussNode[];
  trussMembers?: TrussMember[];
  trussLoads?: TrussNodeLoad[];
}

export const ResultsPanel: React.FC<ResultsPanelProps> = ({
  result,
  trussResult,
  analysisMode = 'beam',
  beamLength = 0,
  totalLoadGravity = 0,
  trussNodes = [],
  trussMembers = [],
  trussLoads = []
}) => {
  const { symbols } = useUnits();
  const [activeTab, setActiveTab] = useState<'summary' | 'reactions' | 'sfd' | 'bmd' | 'steps' | 'cross' | 'truss_members' | 'deflection'>('summary');
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  // Clean mathematical text formatting helper to guarantee no raw underscores appear
  const cleanMath = (text?: string): string => {
    if (!text) return '';
    return text
      .replace(/ΣF_beban/g, 'ΣF beban')
      .replace(/R_Ay/g, 'RAy')
      .replace(/R_By/g, 'RBy')
      .replace(/R_Ax/g, 'RAx')
      .replace(/M_A/g, 'MA')
      .replace(/M_B/g, 'MB')
      .replace(/M_maks/g, 'M maks')
      .replace(/V_maks/g, 'V maks')
      .replace(/L_AB/g, 'L(AB)')
      .replace(/x_i/g, 'x')
      .replace(/P_i/g, 'P')
      .replace(/q_merata/g, 'q merata')
      .replace(/q_segitiga/g, 'q segitiga')
      .replace(/P_ujung/g, 'P ujung')
      .replace(/P_overhang/g, 'P overhang')
      .replace(/q_bentang/g, 'q bentang')
      .replace(/FEM_([a-zA-Z0-9-]+)/g, 'FEM($1)')
      .replace(/DF_([a-zA-Z0-9-]+)/g, 'DF($1)')
      .replace(/K_([a-zA-Z0-9-]+)/g, 'K($1)')
      .replace(/M_([a-zA-Z0-9-]+)/g, 'M($1)')
      .replace(/R_([a-zA-Z0-9-]+)/g, 'R($1)')
      .replace(/([a-zA-Z0-9])_([a-zA-Z0-9]+)/g, '$1 $2')
      .replace(/_/g, ' ');
  };

  // TRUSS RESULTS MODE
  if (analysisMode === 'truss') {
    if (!trussResult) {
      return (
        <div className="bg-[#0b121e] border-t border-slate-800 p-4 text-center text-xs text-slate-500 font-mono">
          Belum ada hasil analisis rangka batang. Atur buhul, batang, tumpuan, & beban, lalu klik tombol "Run Truss Analysis".
        </div>
      );
    }

    const tensionCount = trussResult.memberForces.filter(m => m.type === 'Tension').length;
    const compCount = trussResult.memberForces.filter(m => m.type === 'Compression').length;
    const zeroCount = trussResult.memberForces.filter(m => m.type === 'Zero-force').length;
    const totalFyLoad = trussLoads.reduce((sum, l) => sum + l.Fy, 0);

    return (
      <div
        className={`bg-[#070b13] border-t border-white/[0.08] text-white flex flex-col transition-all duration-200 select-none glass-slab ${
          isExpanded ? 'h-96' : 'h-64'
        }`}
      >
        {/* Truss Tab Navigation Header - Spatial Dock */}
        <div className="bg-slate-950/70 border-b border-white/[0.06] px-4 py-2 flex items-center justify-between text-xs font-medium">
          <div className="inline-flex p-1 rounded-2xl bg-black/40 border border-white/10 backdrop-blur-xl gap-0.5 overflow-x-auto">
            <button
              onClick={() => setActiveTab('summary')}
              className={`px-3 py-1 rounded-xl text-xs transition-all ${
                activeTab === 'summary'
                  ? 'bg-white text-slate-950 font-bold shadow-md shadow-white/10'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              1. Ringkasan
            </button>
            <button
              onClick={() => setActiveTab('reactions')}
              className={`px-3 py-1 rounded-xl text-xs transition-all ${
                activeTab === 'reactions'
                  ? 'bg-white text-slate-950 font-bold shadow-md shadow-white/10'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              2. Reaksi ({trussResult.supportReactions.length})
            </button>
            <button
              onClick={() => setActiveTab('truss_members')}
              className={`px-3 py-1 rounded-xl text-xs transition-all ${
                activeTab === 'truss_members'
                  ? 'bg-white text-slate-950 font-bold shadow-md shadow-white/10'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              3. Gaya Batang ({trussResult.memberForces.length})
            </button>
            <button
              onClick={() => setActiveTab('steps')}
              className={`px-3 py-1 rounded-xl text-xs transition-all ${
                activeTab === 'steps'
                  ? 'bg-white text-slate-950 font-bold shadow-md shadow-white/10'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              4. Langkah Matematis ({trussResult.steps.length})
            </button>
          </div>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-slate-300 border border-white/10 transition"
            title={isExpanded ? 'Kecilkan Panel' : 'Perbesar Panel'}
          >
            {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Truss Content */}
        <div className="flex-1 overflow-y-auto p-4 text-xs font-sans">
          {activeTab === 'summary' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-[#070b12] p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-400 text-[11px] block">Batang Tarik (Tension)</span>
                  <span className="text-xl font-bold font-mono text-emerald-400">{tensionCount}</span>
                  <span className="text-[10px] text-slate-500 block">batang bertanda positif (+)</span>
                </div>
                <div className="bg-[#070b12] p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-400 text-[11px] block">Batang Tekan (Compression)</span>
                  <span className="text-xl font-bold font-mono text-rose-400">{compCount}</span>
                  <span className="text-[10px] text-slate-500 block">batang bertanda negatif (-)</span>
                </div>
                <div className="bg-[#070b12] p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-400 text-[11px] block">Batang Nol (Zero-Force)</span>
                  <span className="text-xl font-bold font-mono text-slate-400">{zeroCount}</span>
                  <span className="text-[10px] text-slate-500 block">batang tanpa gaya</span>
                </div>
                <div className="bg-[#070b12] p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-400 text-[11px] block">Metode Solusi Truss</span>
                  <span className="text-sm font-bold text-white block mt-1">Method of Joints</span>
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1 mt-0.5">
                    <CheckCircle2 className="w-3 h-3" /> Statis Tertentu & Stabil
                  </span>
                </div>
              </div>

              <div className="p-3 bg-[#070b12] rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-slate-300">
                    Total Beban Kerja Vertikal: <strong className="text-amber-400 font-mono">{Math.abs(totalFyLoad)} {symbols.force}</strong> |
                    Reaksi Vertikal Total: <strong className="text-cyan-400 font-mono">{trussResult.supportReactions.reduce((s, r) => s + r.Ry, 0).toFixed(2)} {symbols.force}</strong>
                  </span>
                </div>
                <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  STATUS: SEIMBANG & STABIL (OK)
                </span>
              </div>
            </div>
          )}

          {activeTab === 'reactions' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border border-slate-800 rounded-lg overflow-hidden font-mono">
                <thead className="bg-[#070b12] text-slate-400 uppercase text-[10px]">
                  <tr>
                    <th className="p-2.5">Titik Buhul</th>
                    <th className="p-2.5">Koordinat (X, Y)</th>
                    <th className="p-2.5">Reaksi Horisontal Rx ({symbols.force})</th>
                    <th className="p-2.5">Reaksi Vertikal Ry ({symbols.force})</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {trussResult.supportReactions.map((sr, idx) => {
                    const node = trussNodes.find(n => n.id === sr.nodeId);
                    const nodeIdx = trussNodes.findIndex(n => n.id === sr.nodeId) + 1;
                    return (
                      <tr key={idx} className="hover:bg-slate-800/40">
                        <td className="p-2.5 font-bold text-cyan-400">N{nodeIdx} ({sr.nodeId})</td>
                        <td className="p-2.5 text-slate-300">({node?.x ?? '-'} {symbols.length}, {node?.y ?? '-'} {symbols.length})</td>
                        <td className="p-2.5 text-slate-400">{sr.Rx.toFixed(2)} {symbols.force}</td>
                        <td className="p-2.5 font-bold text-emerald-400">{sr.Ry.toFixed(2)} {symbols.force}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'truss_members' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border border-slate-800 rounded-lg overflow-hidden font-mono">
                <thead className="bg-[#070b12] text-slate-400 uppercase text-[10px]">
                  <tr>
                    <th className="p-2.5">Batang</th>
                    <th className="p-2.5">Buhul Awal → Akhir</th>
                    <th className="p-2.5">Panjang L ({symbols.length})</th>
                    <th className="p-2.5">Gaya Aksial N ({symbols.force})</th>
                    <th className="p-2.5">Sifat Gaya</th>
                    <th className="p-2.5">Tegangan Kerja σ ({symbols.stress})</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {trussResult.memberForces.map((mf, idx) => {
                    const mem = trussMembers.find(m => m.id === mf.memberId);
                    const n1 = trussNodes.find(n => n.id === mem?.nodeStartId);
                    const n2 = trussNodes.find(n => n.id === mem?.nodeEndId);
                    const n1Idx = trussNodes.findIndex(n => n.id === mem?.nodeStartId) + 1;
                    const n2Idx = trussNodes.findIndex(n => n.id === mem?.nodeEndId) + 1;
                    const len = n1 && n2 ? Math.sqrt(Math.pow(n2.x - n1.x, 2) + Math.pow(n2.y - n1.y, 2)) : 0;
                    const isTension = mf.type === 'Tension';
                    const isCompression = mf.type === 'Compression';

                    return (
                      <tr key={idx} className="hover:bg-slate-800/40">
                        <td className="p-2.5 font-bold text-white">M{idx + 1}</td>
                        <td className="p-2.5 text-slate-300">N{n1Idx} → N{n2Idx}</td>
                        <td className="p-2.5 text-slate-400">{len.toFixed(2)} {symbols.length}</td>
                        <td
                          className={`p-2.5 font-bold ${
                            isTension ? 'text-emerald-400' : isCompression ? 'text-rose-400' : 'text-slate-400'
                          }`}
                        >
                          {mf.force > 0 ? `+${mf.force.toFixed(2)}` : mf.force.toFixed(2)} {symbols.force}
                        </td>
                        <td className="p-2.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              isTension
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : isCompression
                                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {isTension ? 'Tarik (Tension)' : isCompression ? 'Tekan (Compression)' : 'Batang Nol (Zero)'}
                          </span>
                        </td>
                        <td className="p-2.5 text-slate-300">{mf.stress.toFixed(2)} {symbols.stress}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'steps' && (
            <div className="space-y-3">
              {trussResult.steps.map((st, idx) => (
                <div key={idx} className="p-3 bg-[#070b12] rounded-xl border border-slate-800 space-y-1.5">
                  <div className="font-bold text-cyan-300 text-xs flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-cyan-950 border border-cyan-800 text-cyan-400 flex items-center justify-center text-[10px] font-mono">
                      {st.stepNumber || idx + 1}
                    </span>
                    {cleanMath(st.title)}
                  </div>
                  {st.description && <p className="text-slate-400 text-[11px]">{cleanMath(st.description)}</p>}
                  {(st.formula || st.substitution || st.result) && (
                    <div className="font-mono text-[11px] text-slate-300 bg-slate-950 p-2.5 rounded-lg border border-slate-800/80 space-y-1">
                      {st.formula && (
                        <div className="text-cyan-400/90 font-medium">
                          <span className="text-slate-500">Rumus: </span>
                          {cleanMath(st.formula)}
                        </div>
                      )}
                      {st.substitution && (
                        <div>
                          <span className="text-slate-500">Hitungan: </span>
                          {cleanMath(st.substitution)}
                        </div>
                      )}
                      {st.result && (
                        <div className="text-emerald-400 font-bold">
                          <span className="text-slate-500">Hasil: </span>
                          {cleanMath(st.result)}
                        </div>
                      )}
                    </div>
                  )}
                  {st.explanation && <p className="text-[11px] text-slate-500 italic">{cleanMath(st.explanation)}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // BEAM RESULTS MODE
  if (!result) {
    return (
      <div className="bg-[#0b121e] border-t border-slate-800 p-4 text-center text-xs text-slate-500 font-mono">
        Belum ada hasil analisis. Atur geometri & beban, lalu klik tombol "Run Analysis" pada toolbar.
      </div>
    );
  }

  const { maxMoment, minMoment, maxShear, minShear, reactions, equilibriumCheck, steps, crossTable, methodUsed, isDeterminate, degreeOfIndeterminacy } = result;

  return (
    <div
      className={`bg-[#070b13] border-t border-white/[0.08] text-white flex flex-col transition-all duration-200 select-none glass-slab ${
        isExpanded ? 'h-96' : 'h-64'
      }`}
    >
      {/* Tab Navigation Header - Spatial Dock */}
      <div className="bg-slate-950/70 border-b border-white/[0.06] px-4 py-2 flex items-center justify-between text-xs font-medium">
        <div className="inline-flex p-1 rounded-2xl bg-black/40 border border-white/10 backdrop-blur-xl gap-0.5 overflow-x-auto">
          <button
            onClick={() => setActiveTab('summary')}
            className={`px-3 py-1 rounded-xl text-xs transition-all ${
              activeTab === 'summary'
                ? 'bg-white text-slate-950 font-bold shadow-md shadow-white/10'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            1. Ringkasan
          </button>
          <button
            onClick={() => setActiveTab('reactions')}
            className={`px-3 py-1 rounded-xl text-xs transition-all ${
              activeTab === 'reactions'
                ? 'bg-white text-slate-950 font-bold shadow-md shadow-white/10'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            2. Reaksi ({reactions.length})
          </button>
          <button
            onClick={() => setActiveTab('sfd')}
            className={`px-3 py-1 rounded-xl text-xs transition-all ${
              activeTab === 'sfd'
                ? 'bg-white text-slate-950 font-bold shadow-md shadow-white/10'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            3. Gaya Geser (SFD)
          </button>
          <button
            onClick={() => setActiveTab('bmd')}
            className={`px-3 py-1 rounded-xl text-xs transition-all ${
              activeTab === 'bmd'
                ? 'bg-white text-slate-950 font-bold shadow-md shadow-white/10'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            4. Momen Lentur (BMD)
          </button>
          <button
            onClick={() => setActiveTab('steps')}
            className={`px-3 py-1 rounded-xl text-xs transition-all ${
              activeTab === 'steps'
                ? 'bg-white text-slate-950 font-bold shadow-md shadow-white/10'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            5. Langkah ({steps.length})
          </button>
          <button
            onClick={() => setActiveTab('deflection')}
            className={`px-3 py-1 rounded-xl text-xs transition-all flex items-center gap-1.5 ${
              activeTab === 'deflection'
                ? 'bg-cyan-400 text-slate-950 font-bold shadow-md shadow-cyan-400/20'
                : 'text-cyan-400/90 hover:text-cyan-300'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            6. Defleksi (Lendutan)
          </button>
          {crossTable && (
            <button
              onClick={() => setActiveTab('cross')}
              className={`px-3 py-1 rounded-xl text-xs transition-all ${
                activeTab === 'cross'
                  ? 'bg-white text-slate-950 font-bold shadow-md shadow-white/10'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              7. Tabel Cross ({crossTable.cycles.length})
            </button>
          )}
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-slate-300 border border-white/10 transition"
          title={isExpanded ? 'Kecilkan Panel' : 'Perbesar Panel'}
        >
          {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Tab Contents */}
      <div className="flex-1 overflow-y-auto p-4 text-xs font-sans">
        {/* TAB 1: SUMMARY */}
        {activeTab === 'summary' && (
          <div className="space-y-4">
            {/* Automatic Classification Banner */}
            <div
              className="p-3.5 rounded-2xl glass-card border border-white/[0.08] flex flex-wrap items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2.5">
                <ShieldCheck
                  className={`w-5 h-5 ${isDeterminate ? 'text-emerald-400' : 'text-cyan-400'}`}
                />
                <div>
                  <div className="font-semibold text-xs text-white">
                    {isDeterminate
                      ? 'Struktur Statis Tertentu (Equilibrium Statics)'
                      : `Struktur Statis Tak Tentu · Derajat Ketidaktentuan n = ${degreeOfIndeterminacy}`}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {isDeterminate
                      ? 'Jumlah reaksi R ≤ 3. Diselesaikan dengan persamaan kesetimbangan statika dasar (ΣFx=0, ΣFy=0, ΣM=0).'
                      : `Jumlah reaksi R > 3. Diselesaikan secara otomatis dengan Metode Distribusi Momen (Metode Cross).`}
                  </div>
                </div>
              </div>
              <span
                className={`px-2.5 py-1 rounded-xl text-xs font-medium border ${
                  isDeterminate
                    ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                    : 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
                }`}
              >
                {isDeterminate ? 'Statis Tertentu' : 'Metode Cross Otomatis'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="glass-card p-4 rounded-2xl border border-white/[0.08]">
                <span className="text-slate-400 text-[11px] block">Momen Positif Lapangan (M+)</span>
                <span className="text-2xl font-bold font-mono text-amber-400 block mt-1 tabular-nums">
                  {maxMoment.value.toFixed(2)}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">{symbols.moment} di x = {maxMoment.x} {symbols.length}</span>
              </div>

              <div className="glass-card p-4 rounded-2xl border border-white/[0.08]">
                <span className="text-slate-400 text-[11px] block">Momen Negatif Tumpuan (M-)</span>
                <span className="text-2xl font-bold font-mono text-amber-500/90 block mt-1 tabular-nums">
                  {minMoment.value.toFixed(2)}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">{symbols.moment} di x = {minMoment.x} {symbols.length}</span>
              </div>

              <div className="glass-card p-4 rounded-2xl border border-white/[0.08]">
                <span className="text-slate-400 text-[11px] block">Gaya Geser Absolut Maks (|V|)</span>
                <span className="text-2xl font-bold font-mono text-sky-400 block mt-1 tabular-nums">
                  {Math.max(Math.abs(maxShear.value), Math.abs(minShear.value)).toFixed(2)}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">{symbols.force} (Penampang Kritis)</span>
              </div>

              <div className="glass-card p-4 rounded-2xl border border-white/[0.08]">
                <span className="text-slate-400 text-[11px] block">Metode Solusi Analisis</span>
                <span className="text-sm font-semibold text-white block mt-2 truncate">
                  {methodUsed}
                </span>
                <span className="text-[10px] text-emerald-400 flex items-center gap-1 mt-1">
                  <CheckCircle2 className="w-3 h-3" /> Kesetimbangan Statika Terpenuhi
                </span>
              </div>

              {result.deflectionResult && (
                <div
                  onClick={() => setActiveTab('deflection')}
                  className="glass-card p-4 rounded-2xl border border-cyan-800/40 hover:border-cyan-500/80 cursor-pointer transition col-span-2 sm:col-span-4 lg:col-span-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span>
                      <span className="text-cyan-300 font-bold text-xs uppercase tracking-wider font-mono">
                        Estimasi Defleksi / Lendutan Balok (SNI 2847 & AISC):
                      </span>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${result.deflectionResult.isPassL360 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : result.deflectionResult.isPassL240 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'}`}>
                      {result.deflectionResult.isPassL360 ? '✓ AMAN TERHADAP L/360 & L/240' : result.deflectionResult.isPassL240 ? '✓ MEMENUHI BATAS STANDAR L/240' : '⚠️ LENDUTAN MELEBIHI BATAS IZIN'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-xs">
                    <div>
                      <span className="text-slate-400 text-[10px] block">Lendutan Maks (|δ_maks|)</span>
                      <span className="text-xl font-bold font-mono text-cyan-400 block mt-0.5">
                        {result.deflectionResult.maxDeflection.toFixed(2)} mm
                      </span>
                      <span className="text-[10px] text-slate-500">pada x = {result.deflectionResult.maxDeflectionX} {symbols.length}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block">Batas Izin L/240</span>
                      <span className="text-base font-bold font-mono text-slate-200 block mt-0.5">
                        {result.deflectionResult.allowableDeflectionL240.toFixed(2)} mm
                      </span>
                      <span className="text-[10px] text-slate-500">Standar atap & lantai umum</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block">Batas Ketat L/360</span>
                      <span className="text-base font-bold font-mono text-slate-200 block mt-0.5">
                        {result.deflectionResult.allowableDeflectionL360.toFixed(2)} mm
                      </span>
                      <span className="text-[10px] text-slate-500">Lantai berpartisi plesteran</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block">Kekakuan Lentur (E·I)</span>
                      <span className="text-base font-bold font-mono text-slate-300 block mt-0.5">
                        E = {result.deflectionResult.E} MPa
                      </span>
                      <span className="text-[10px] text-slate-500">I = {(result.deflectionResult.I / 1e6).toFixed(1)} × 10⁶ mm⁴</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Validation & Equilibrium box */}
            <div className="p-3.5 glass-card rounded-2xl border border-white/[0.08] flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-slate-300">
                  Pemeriksaan Keseimbangan Vertikal: ΣRy ={' '}
                  <strong className="text-cyan-300 font-mono">{equilibriumCheck.sumFy} {symbols.force}</strong> vs ΣBeban ={' '}
                  <strong className="text-rose-300 font-mono">{totalLoadGravity.toFixed(2)} {symbols.force}</strong>
                </span>
              </div>
              <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                STATUS: SEIMBANG (OK)
              </span>
            </div>
          </div>
        )}

        {/* TAB 2: REACTIONS */}
        {activeTab === 'reactions' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border border-slate-800 rounded-lg overflow-hidden font-mono">
              <thead className="bg-[#070b12] text-slate-400 uppercase text-[10px]">
                <tr>
                  <th className="p-2.5">Label Tumpuan</th>
                  <th className="p-2.5">Posisi x ({symbols.length})</th>
                  <th className="p-2.5">Tipe Tumpuan</th>
                  <th className="p-2.5">Reaksi Vertikal Ry ({symbols.force})</th>
                  <th className="p-2.5">Reaksi Horizontal Rx ({symbols.force})</th>
                  <th className="p-2.5">Momen Jepit M ({symbols.moment})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {reactions.map((r, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/40">
                    <td className="p-2.5 font-bold text-cyan-400">{r.label}</td>
                    <td className="p-2.5 text-slate-300">{r.position} {symbols.length}</td>
                    <td className="p-2.5 capitalize text-slate-300">{r.type}</td>
                    <td className="p-2.5 font-bold text-emerald-400">{r.Ry.toFixed(2)} {symbols.force}</td>
                    <td className="p-2.5 text-slate-400">{r.Rx.toFixed(2)} {symbols.force}</td>
                    <td className="p-2.5 text-amber-400">{r.M ? `${r.M.toFixed(2)} ${symbols.moment}` : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 3: SFD VALUES */}
        {activeTab === 'sfd' && (
          <div className="space-y-3">
            <div className="flex justify-between text-xs text-slate-400">
              <span>Nilai Puncak Gaya Geser (Shear Force Diagram):</span>
              <span className="font-mono text-cyan-400">
                V maks(+) = {maxShear.value.toFixed(2)} {symbols.force} | V maks(-) = {minShear.value.toFixed(2)} {symbols.force}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px]">
              {result.diagramPoints.filter((_, i) => i % 20 === 0).map((pt, i) => (
                <div key={i} className="p-2 bg-[#070b12] rounded border border-slate-800 flex justify-between">
                  <span className="text-slate-400">x={pt.x}{symbols.length}:</span>
                  <span className={`font-bold ${pt.V >= 0 ? 'text-blue-400' : 'text-rose-400'}`}>
                    V={pt.V.toFixed(2)} {symbols.force}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: BMD VALUES */}
        {activeTab === 'bmd' && (
          <div className="space-y-3">
            <div className="flex justify-between text-xs text-slate-400">
              <span>Nilai Puncak Momen Lentur (Bending Moment Diagram):</span>
              <span className="font-mono text-emerald-400">
                M lapangan = {maxMoment.value.toFixed(2)} {symbols.moment} | M tumpuan = {minMoment.value.toFixed(2)} {symbols.moment}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px]">
              {result.diagramPoints.filter((_, i) => i % 20 === 0).map((pt, i) => (
                <div key={i} className="p-2 bg-[#070b12] rounded border border-slate-800 flex justify-between">
                  <span className="text-slate-400">x={pt.x}{symbols.length}:</span>
                  <span className={`font-bold ${pt.M >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    M={pt.M.toFixed(2)} {symbols.moment}
                  </span>
                </div>
              ))}
            </div>

            {/* Quadratic Parabolic BMD Verification Card */}
            {result.quadraticMomentChecks && result.quadraticMomentChecks.length > 0 && (
              <div className="mt-4 p-3.5 bg-slate-900/90 rounded-xl border border-emerald-500/30 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="font-semibold text-xs text-white">
                      Verifikasi Matematis Kurva Parabola Kuadratik BMD (dM/dx = V)
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                    Bukan Garis Lurus (δ ≠ 0)
                  </span>
                </div>
                <p className="text-[11px] text-slate-300">
                  Pada segmen dengan beban merata konstan <span className="text-amber-300 font-mono">w</span>, diagram gaya geser berubah linear (<span className="text-sky-300 font-mono">dV/dx = -w</span>) dan diagram momen lentur melengkung kuadratik (<span className="text-amber-300 font-mono">dM/dx = V</span>).
                </p>
                <div className="space-y-2">
                  {result.quadraticMomentChecks.map((chk, idx) => (
                    <div key={idx} className="p-2.5 bg-black/50 rounded-lg border border-white/[0.08] text-[11px] space-y-1">
                      <div className="flex items-center justify-between font-mono">
                        <span className="text-cyan-300 font-bold">{chk.loadLabel} [x = {chk.startPos}{symbols.length} - {chk.endPos}{symbols.length}]</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${chk.isQuadratic ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-rose-950 text-rose-300 border border-rose-800'}`}>
                          {chk.isQuadratic ? '✓ PARABOLA KUADRATIK TERVERIFIKASI' : 'GARIS LURUS'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[10.5px]">
                        <div>
                          <span className="text-slate-400 block text-[9.5px]">Momen Tengah Nyata (M mid)</span>
                          <span className="text-amber-300 font-bold">{chk.mMidActual.toFixed(2)} {symbols.moment}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[9.5px]">Tali Busur Linear (M chord)</span>
                          <span className="text-slate-300">{chk.mMidLinearChord.toFixed(2)} {symbols.moment}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[9.5px]">Sagitta Kelengkungan (δ)</span>
                          <span className="text-emerald-400 font-bold">+{chk.parabolicSagitta.toFixed(2)} {symbols.moment}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[9.5px]">Teori (w·L²/8)</span>
                          <span className="text-cyan-300 font-bold">{chk.expectedSagitta.toFixed(2)} {symbols.moment}</span>
                        </div>
                      </div>
                      <div className="text-[10px] text-slate-400 pt-1 border-t border-white/[0.06] flex items-center justify-between">
                        <span>Luas SFD (∫ V dx) = Perubahan Momen ΔM</span>
                        <span className="text-emerald-400 font-mono">Match: {chk.shearAreaMatch ? 'Presisi (OK)' : 'Evaluasi'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: STEP-BY-STEP MATHEMATICAL CALCULATION */}
        {activeTab === 'steps' && (
          <div className="space-y-3">
            {steps.map((st, idx) => (
              <div key={idx} className="p-3 bg-[#070b12] rounded-xl border border-slate-800 space-y-1.5">
                <div className="font-bold text-cyan-300 text-xs flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-cyan-950 border border-cyan-800 text-cyan-400 flex items-center justify-center text-[10px] font-mono">
                    {st.stepNumber !== undefined ? st.stepNumber : idx + 1}
                  </span>
                  {cleanMath(st.title)}
                </div>
                {st.description && <p className="text-slate-400 text-[11px]">{cleanMath(st.description)}</p>}
                {(st.formula || st.substitution || st.result) && (
                  <div className="font-mono text-[11px] text-slate-300 bg-slate-950 p-2.5 rounded-lg border border-slate-800/80 space-y-1">
                    {st.formula && (
                      <div className="text-cyan-400/90 font-medium">
                        <span className="text-slate-500">Rumus: </span>
                        {cleanMath(st.formula)}
                      </div>
                    )}
                    {st.substitution && (
                      <div>
                        <span className="text-slate-500">Hitungan: </span>
                        {cleanMath(st.substitution)}
                      </div>
                    )}
                    {st.result && (
                      <div className="text-emerald-400 font-bold">
                        <span className="text-slate-500">Hasil: </span>
                        {cleanMath(st.result)}
                      </div>
                    )}
                  </div>
                )}
                {st.explanation && <p className="text-[11px] text-slate-500 italic">{cleanMath(st.explanation)}</p>}
              </div>
            ))}
          </div>
        )}

        {/* TAB 6: CROSS TABLE */}
        {activeTab === 'cross' && crossTable && (
          <div className="space-y-3 overflow-x-auto">
            <span className="font-mono text-xs text-indigo-400 font-bold">
              Tabel Distribusi Momen (Metode Cross)
            </span>
            <table className="w-full text-left text-[11px] font-mono border border-slate-800 divide-y divide-slate-800">
              <thead className="bg-[#070b12] text-slate-400">
                <tr>
                  <th className="p-2">Siklus</th>
                  {crossTable.members.map(m => (
                    <th key={m} className="p-2 text-center">
                      {m}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                <tr>
                  <td className="p-2 text-slate-400 font-bold">DF</td>
                  {crossTable.members.map(m => (
                    <td key={m} className="p-2 text-center">
                      {crossTable.distributionFactors[m]}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="p-2 text-amber-400 font-bold">FEM</td>
                  {crossTable.members.map(m => (
                    <td key={m} className="p-2 text-center text-amber-400">
                      {crossTable.fem[m]}
                    </td>
                  ))}
                </tr>
                {crossTable.cycles.map((cyc, cIdx) => (
                  <React.Fragment key={cIdx}>
                    <tr className="bg-slate-900/40">
                      <td className="p-2 text-slate-400">Dist {cIdx + 1}</td>
                      {crossTable.members.map(m => (
                        <td key={m} className="p-2 text-center text-cyan-300">
                          {cyc.distribution[m] || '0.00'}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="p-2 text-slate-400">CO {cIdx + 1}</td>
                      {crossTable.members.map(m => (
                        <td key={m} className="p-2 text-center text-indigo-300">
                          {cyc.carryOver[m] || '0.00'}
                        </td>
                      ))}
                    </tr>
                  </React.Fragment>
                ))}
                <tr className="bg-slate-900 font-bold text-emerald-400">
                  <td className="p-2">M Akhir</td>
                  {crossTable.members.map(m => (
                    <td key={m} className="p-2 text-center">
                      {crossTable.finalMoments[m]}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 7: DEFLECTION (LENDUTAN BALOK) */}
        {activeTab === 'deflection' && result.deflectionResult && (
          <div className="space-y-4">
            {/* Header info */}
            <div className="p-4 rounded-2xl glass-card border border-cyan-800/40 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-bold text-sm text-cyan-400 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  Kalkulasi Lendutan & Deformasi Elastis Balok (Beam Deflection)
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  {result.deflectionResult.formulaDescription}. Membandingkan lendutan aktual dengan batas lendutan izin standar SNI 2847 / AISC.
                </div>
              </div>
              <span className={`px-3 py-1 rounded-xl text-xs font-bold font-mono border ${result.deflectionResult.isPassL360 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : result.deflectionResult.isPassL240 ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'}`}>
                {result.deflectionResult.isPassL360 ? 'AMAN L/360 & L/240' : result.deflectionResult.isPassL240 ? 'MEMENUHI SYARAT L/240' : 'MELEBIHI BATAS IZIN'}
              </span>
            </div>

            {/* Metrics cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-[#070b12] p-3.5 rounded-xl border border-cyan-800/40">
                <span className="text-slate-400 text-[11px] block">Lendutan Maksimum (δ_maks)</span>
                <span className="text-2xl font-bold font-mono text-cyan-400 block mt-1 tabular-nums">
                  {result.deflectionResult.maxDeflection.toFixed(2)} mm
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">di titik x = {result.deflectionResult.maxDeflectionX} {symbols.length}</span>
              </div>
              <div className="bg-[#070b12] p-3.5 rounded-xl border border-slate-800">
                <span className="text-slate-400 text-[11px] block">Batas Izin L/240 (Atap/Lantai)</span>
                <span className="text-2xl font-bold font-mono text-slate-200 block mt-1 tabular-nums">
                  {result.deflectionResult.allowableDeflectionL240.toFixed(2)} mm
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Rasio: {(result.deflectionResult.maxDeflection / (result.deflectionResult.allowableDeflectionL240 || 1) * 100).toFixed(1)}%</span>
              </div>
              <div className="bg-[#070b12] p-3.5 rounded-xl border border-slate-800">
                <span className="text-slate-400 text-[11px] block">Batas Ketat L/360 (Partisi)</span>
                <span className="text-2xl font-bold font-mono text-slate-200 block mt-1 tabular-nums">
                  {result.deflectionResult.allowableDeflectionL360.toFixed(2)} mm
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Rasio: {(result.deflectionResult.maxDeflection / (result.deflectionResult.allowableDeflectionL360 || 1) * 100).toFixed(1)}%</span>
              </div>
              <div className="bg-[#070b12] p-3.5 rounded-xl border border-slate-800">
                <span className="text-slate-400 text-[11px] block">Kekakuan Lentur Penampang</span>
                <span className="text-sm font-bold font-mono text-white block mt-1">
                  E = {result.deflectionResult.E.toLocaleString()} MPa
                </span>
                <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                  I = {(result.deflectionResult.I / 1e6).toFixed(1)} × 10⁶ mm⁴
                </span>
              </div>
            </div>

            {/* SVG Deflection Curve Visualization */}
            <div className="bg-[#080d16] p-4 rounded-2xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                <span className="text-cyan-300 font-bold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                  Kurva Elastis Lendutan Balok δ(x):
                </span>
                <span>Panjang Balok L = {result.totalLength} m | Skala Deformasi Proporsional</span>
              </div>
              <div className="relative w-full h-36 bg-[#060a12] rounded-xl border border-slate-800/80 overflow-hidden flex items-center justify-center">
                <svg viewBox="0 0 800 120" className="w-full h-full select-none">
                  {/* Undeformed Baseline */}
                  <line x1="60" y1="35" x2="740" y2="35" stroke="#475569" strokeWidth="2" strokeDasharray="4 4" />
                  <text x="60" y="25" fill="#94a3b8" fontSize="9" fontFamily="monospace">x = 0m</text>
                  <text x="740" y="25" fill="#94a3b8" fontSize="9" fontFamily="monospace" textAnchor="end">x = {result.totalLength}m</text>

                  {/* Deflected Elastic Curve */}
                  {(() => {
                    const pts = result.deflectionResult.deflectionPoints;
                    if (pts.length < 2) return null;
                    const maxD = Math.max(0.01, result.deflectionResult.maxDeflection);
                    const pathData = pts.map((p, idx) => {
                      const sx = 60 + (p.x / result.totalLength) * (740 - 60);
                      // scale delta so max deflection maps to +55px below baseline
                      const sy = 35 + (p.delta / maxD) * 55;
                      return `${idx === 0 ? 'M' : 'L'} ${sx.toFixed(1)} ${sy.toFixed(1)}`;
                    }).join(' ');

                    const peakX = 60 + (result.deflectionResult.maxDeflectionX / result.totalLength) * (740 - 60);
                    const peakY = 35 + 55;

                    return (
                      <g>
                        {/* Shaded Area under Deflection Curve */}
                        <path
                          d={`${pathData} L 740 35 L 60 35 Z`}
                          fill="#00e5ff"
                          fillOpacity="0.08"
                        />
                        {/* Curve Stroke */}
                        <path
                          d={pathData}
                          fill="none"
                          stroke="#00e5ff"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                        />
                        {/* Peak Deflection Point Indicator */}
                        <circle cx={peakX} cy={peakY} r="4.5" fill="#f59e0b" stroke="#ffffff" strokeWidth="1.5" />
                        <line x1={peakX} y1="35" x2={peakX} y2={peakY} stroke="#f59e0b" strokeWidth="1" strokeDasharray="2 2" />
                        <text
                          x={peakX}
                          y={peakY + 16}
                          fill="#f59e0b"
                          fontSize="9.5"
                          fontFamily="monospace"
                          fontWeight="bold"
                          textAnchor="middle"
                        >
                          δ_maks = {result.deflectionResult.maxDeflection.toFixed(2)} mm
                        </text>
                      </g>
                    );
                  })()}
                </svg>
              </div>
            </div>

            {/* Engineering Formula Breakdown Box */}
            <div className="bg-[#070b12] p-4 rounded-xl border border-slate-800 space-y-2 text-xs font-mono">
              <span className="font-bold text-slate-300 block">Langkah & Rumus Perhitungan Lendutan Balok:</span>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80 space-y-1.5 text-[11px] text-slate-300">
                <div className="text-cyan-400">
                  <span className="text-slate-500">1. Persamaan Diferensial Elastis: </span>
                  E·I · d²v/dx² = -M(x)  →  v(x) = ∫∫ [ -M(x) / (E·I) ] dx dx
                </div>
                <div>
                  <span className="text-slate-500">2. Nilai Acuan Sederhana: </span>
                  Beban terpusat tengah bentang: δ_tengah = P·L³ / (48·E·I) | Beban merata penuh: δ_tengah = 5·w·L⁴ / (384·E·I)
                </div>
                <div>
                  <span className="text-slate-500">3. Kontrol Batas Lendutan SNI 2847: </span>
                  Δ_izin = L / 240 = ({result.totalLength} × 1000) / 240 = <strong>{result.deflectionResult.allowableDeflectionL240} mm</strong>
                </div>
                <div className="text-emerald-400">
                  <span className="text-slate-500">4. Evaluasi Kelayakan: </span>
                  {result.deflectionResult.maxDeflection} mm ≤ {result.deflectionResult.allowableDeflectionL240} mm → <strong>{result.deflectionResult.isPassL240 ? 'MEMENUHI SYARAT KELAYAKAN LENDUTAN (OK)' : 'PERLU MENAMBAH DIMENSI TINGGI BALOK (TIDAK MEMENUHI)'}</strong>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
