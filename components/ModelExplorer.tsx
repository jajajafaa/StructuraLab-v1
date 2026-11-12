import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  CircleDot,
  Network,
  Anchor,
  Layers,
  Component,
  Boxes,
  Sliders,
  Trash2,
  Plus,
  ArrowDown,
  ArrowUp,
  RotateCw
} from 'lucide-react';
import { Support, StructuralLoad, SupportType, LoadType } from '../types/structural';
import { useUnits } from '../context/UnitContext';

interface ModelExplorerProps {
  beamLength: number;
  onUpdateBeamLength: (len: number) => void;
  supports: Support[];
  onUpdateSupports: (supports: Support[]) => void;
  loads: StructuralLoad[];
  onUpdateLoads: (loads: StructuralLoad[]) => void;
  selectedId: string | null;
  onSelectObject: (type: 'support' | 'load' | 'beam' | null, id: string | null) => void;
  materialE: number;
  onUpdateMaterialE: (e: number) => void;
  sectionI: number;
  onUpdateSectionI: (i: number) => void;
}

export const ModelExplorer: React.FC<ModelExplorerProps> = ({
  beamLength,
  onUpdateBeamLength,
  supports,
  onUpdateSupports,
  loads,
  onUpdateLoads,
  selectedId,
  onSelectObject,
  materialE,
  onUpdateMaterialE,
  sectionI,
  onUpdateSectionI
}) => {
  const { symbols } = useUnits();

  // Collapsible sections state
  const [openSections, setOpenSections] = useState({
    geometry: true,
    supports: true,
    loads: true,
    materials: false,
    sections: false
  });

  // Helper to parse numbers supporting both comma (,) and dot (.)
  const parseNum = (val: string | number, fallback = 0): number => {
    if (typeof val === 'number') return isNaN(val) ? fallback : val;
    const clean = String(val).replace(',', '.').trim();
    if (clean === '') return fallback;
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? fallback : parsed;
  };

  // Local string state for beamLength to allow typing decimals like 16.9 or 16,9 freely
  const [beamLengthStr, setBeamLengthStr] = useState<string>(beamLength > 0 ? String(beamLength) : '');

  React.useEffect(() => {
    setBeamLengthStr(beamLength > 0 ? String(beamLength) : '');
  }, [beamLength]);

  // Inline Add Support State (string format allows typing arbitrary decimals)
  const [showAddSupport, setShowAddSupport] = useState(false);
  const [newSuppType, setNewSuppType] = useState<SupportType>('roller');
  const [newSuppPos, setNewSuppPos] = useState<string>('0');
  const [newSuppLabel, setNewSuppLabel] = useState<string>('');

  // Inline Add Load State (string format allows typing arbitrary decimals)
  const [showAddLoad, setShowAddLoad] = useState(false);
  const [newLoadType, setNewLoadType] = useState<LoadType>('point');
  const [newLoadMag, setNewLoadMag] = useState<string>('20');
  const [newLoadMagEnd, setNewLoadMagEnd] = useState<string>('0');
  const [newLoadStartPos, setNewLoadStartPos] = useState<string>('0');
  const [newLoadEndPos, setNewLoadEndPos] = useState<string>(beamLength > 0 ? String(beamLength) : '6');
  const [newLoadDir, setNewLoadDir] = useState<'down' | 'up' | 'cw' | 'ccw'>('down');
  const [newLoadLabel, setNewLoadLabel] = useState<string>('');

  const toggleSection = (key: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleAddSupport = (e: React.FormEvent) => {
    e.preventDefault();
    const nextChar = String.fromCharCode(65 + supports.length);
    const label = newSuppLabel.trim() || `Tumpuan ${nextChar}`;
    const newSupport: Support = {
      id: 'supp-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 5),
      nodeId: nextChar,
      type: newSuppType,
      position: parseNum(newSuppPos, 0),
      label
    };
    onUpdateSupports([...supports, newSupport]);
    setNewSuppLabel('');
    setShowAddSupport(false);
  };

  const handleAddLoad = (e: React.FormEvent) => {
    e.preventDefault();
    const label = newLoadLabel.trim() || (newLoadType === 'point' ? `P${loads.length + 1}` : newLoadType === 'distributed' ? `q${loads.length + 1}` : `Beban ${loads.length + 1}`);
    const newLoad: StructuralLoad = {
      id: 'load-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 5),
      type: newLoadType,
      magnitude: parseNum(newLoadMag, 0),
      magnitudeEnd: (newLoadType === 'triangular' || newLoadType === 'trapezoidal') ? parseNum(newLoadMagEnd, 0) : undefined,
      startPos: parseNum(newLoadStartPos, 0),
      endPos: (newLoadType === 'distributed' || newLoadType === 'triangular' || newLoadType === 'trapezoidal') ? parseNum(newLoadEndPos, beamLength || 6) : undefined,
      direction: newLoadDir,
      label
    };
    onUpdateLoads([...loads, newLoad]);
    setNewLoadLabel('');
    setShowAddLoad(false);
  };

  const handleDeleteSupport = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdateSupports(supports.filter(s => s.id !== id));
    if (selectedId === id) onSelectObject(null, null);
  };

  const handleDeleteLoad = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdateLoads(loads.filter(l => l.id !== id));
    if (selectedId === id) onSelectObject(null, null);
  };

  return (
    <div className="w-full bg-[#070b13]/95 backdrop-blur-2xl border-r border-white/[0.08] text-xs text-slate-300 flex flex-col h-full overflow-y-auto divide-y divide-white/[0.06]">
      {/* Explorer Header */}
      <div className="p-3.5 bg-slate-950/70 border-b border-white/[0.06] flex items-center justify-between">
        <span className="font-semibold text-white text-xs tracking-wide">Model Explorer</span>
        <span className="text-[10px] text-slate-400 font-mono">Input Parameter</span>
      </div>

      {/* 1. MODEL GEOMETRY */}
      <div className="p-2.5">
        <button
          onClick={() => toggleSection('geometry')}
          className="w-full flex items-center justify-between py-1.5 px-2 hover:bg-white/[0.04] rounded-xl text-left font-semibold text-white transition"
        >
          <span className="flex items-center gap-2">
            {openSections.geometry ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
            <Network className="w-3.5 h-3.5 text-cyan-400" /> 1. Geometri Balok
          </span>
          <span className="text-[11px] font-mono text-cyan-300 font-bold">{beamLength} {symbols.length}</span>
        </button>

        {openSections.geometry && (
          <div className="pl-4 pr-2 py-2 space-y-2">
            <div>
              <label className="text-[11px] text-slate-400 block mb-1 font-medium">Panjang Bentang Total (L, {symbols.length}):</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="any"
                  value={beamLengthStr}
                  placeholder={`Ketik bentang L (${symbols.length})... (misal: 16.9)`}
                  onChange={e => {
                    const raw = e.target.value;
                    setBeamLengthStr(raw);
                    const parsed = parseFloat(raw.replace(',', '.'));
                    onUpdateBeamLength(isNaN(parsed) || parsed < 0 ? 0 : parsed);
                  }}
                  className="flex-1 bg-black/40 border border-white/10 focus:border-white/30 focus:outline-none rounded-xl px-2.5 py-1.5 text-white font-mono font-bold placeholder:text-slate-600 placeholder:font-normal text-xs"
                  min="0"
                />
                <span className="px-2.5 py-1.5 bg-white/[0.06] border border-white/10 text-slate-300 rounded-xl text-xs flex items-center">{symbols.length}</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Mendukung angka desimal titik maupun koma (misal: 16.9 atau 16,9).
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 2. SUPPORTS */}
      <div className="p-3">
        <div className="flex items-center justify-between py-1 px-1">
          <button
            onClick={() => toggleSection('supports')}
            className="flex-1 flex items-center gap-2 text-left font-semibold text-slate-200 hover:text-white transition group"
          >
            {openSections.supports ? <ChevronDown className="w-3.5 h-3.5 text-cyan-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300" />}
            <span className="flex items-center gap-1.5 text-xs tracking-wide">
              <Anchor className="w-3.5 h-3.5 text-cyan-400" /> 2. Tumpuan (Supports)
            </span>
            <span className="text-[11px] font-mono text-slate-400 tabular-nums ml-1">
              ({supports.length})
            </span>
          </button>
          <button
            onClick={() => setShowAddSupport(!showAddSupport)}
            className="px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[11px] font-medium border border-white/10 transition flex items-center gap-1 shadow-sm active:scale-95"
            title="Tambah Tumpuan Baru"
          >
            <Plus className="w-3 h-3" /> Tambah
          </button>
        </div>

        {openSections.supports && (
          <div className="pt-2 space-y-2">
            {/* Inline Add Support Form */}
            {showAddSupport && (
              <form onSubmit={handleAddSupport} className="glass-card p-3 rounded-2xl border border-white/15 space-y-2.5 text-xs shadow-xl">
                <div className="font-semibold text-white flex items-center justify-between border-b border-white/[0.08] pb-1.5">
                  <span className="text-[11px] tracking-wide text-slate-200">Input Tumpuan Baru</span>
                  <button
                    type="button"
                    onClick={() => setShowAddSupport(false)}
                    className="text-slate-400 hover:text-white text-xs px-1"
                  >
                    ✕
                  </button>
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Tipe Tumpuan:</label>
                  <select
                    value={newSuppType}
                    onChange={e => setNewSuppType(e.target.value as SupportType)}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-2.5 py-1.5 text-white font-medium focus:border-white/30 outline-none text-xs"
                  >
                    <option value="pin" className="bg-slate-900">Sendi (Pin) — Reaksi Vertikal & Horizontal</option>
                    <option value="roller" className="bg-slate-900">Rol (Roller) — Reaksi Vertikal saja</option>
                    <option value="fixed" className="bg-slate-900">Jepit (Fixed) — Reaksi V, H & Momen Jepit</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Posisi x ({symbols.length}):</label>
                    <input
                      type="number"
                      step="any"
                      value={newSuppPos}
                      placeholder="misal: 16.9"
                      onChange={e => setNewSuppPos(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-2.5 py-1.5 text-white font-mono tabular-nums text-xs focus:border-white/30 outline-none placeholder:text-slate-600"
                      min="0"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Label (opsional):</label>
                    <input
                      type="text"
                      placeholder={`Tumpuan ${String.fromCharCode(65 + supports.length)}`}
                      value={newSuppLabel}
                      onChange={e => setNewSuppLabel(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-2.5 py-1.5 text-white text-xs focus:border-white/30 outline-none placeholder:text-slate-600"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-white hover:bg-slate-100 text-slate-950 font-bold rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow-md active:scale-[0.99]"
                >
                  <Plus className="w-3.5 h-3.5" /> Simpan Tumpuan
                </button>
              </form>
            )}

            {/* List of existing supports */}
            {supports.length === 0 ? (
              <div className="text-[11px] text-slate-400 italic p-3 glass-card rounded-xl border border-white/[0.06]">
                Belum ada tumpuan. Klik tombol "+ Tambah" di atas untuk memasukkan tumpuan (misal Sendi di x=0 dan Rol di x=L).
              </div>
            ) : (
              supports.map(supp => (
                <div
                  key={supp.id}
                  onClick={() => onSelectObject('support', supp.id)}
                  className={`p-2.5 rounded-xl border text-left cursor-pointer transition flex items-center justify-between ${
                    selectedId === supp.id
                      ? 'bg-white/[0.12] border-white/40 text-white shadow-lg backdrop-blur-md'
                      : 'glass-card border-white/[0.06] hover:border-white/20 text-slate-300'
                  }`}
                >
                  <div>
                    <div className="font-semibold text-white flex items-center gap-1.5 text-xs">
                      <CircleDot className="w-3.5 h-3.5 text-cyan-400" />
                      {supp.label || `Tumpuan ${supp.nodeId}`} ({supp.type === 'pin' ? 'Sendi' : supp.type === 'roller' ? 'Rol' : 'Jepit'})
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono tabular-nums mt-0.5">
                      x = {supp.position} {symbols.length} {supp.type === 'pin' ? '· Menahan Ux, Uy' : supp.type === 'roller' ? '· Menahan Uy' : '· Menahan Ux, Uy, M'}
                    </div>
                  </div>
                  <button
                    onClick={e => handleDeleteSupport(supp.id, e)}
                    className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                    title="Hapus Tumpuan"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* 3. LOADS */}
      <div className="p-3">
        <div className="flex items-center justify-between py-1 px-1">
          <button
            onClick={() => toggleSection('loads')}
            className="flex-1 flex items-center gap-2 text-left font-semibold text-slate-200 hover:text-white transition group"
          >
            {openSections.loads ? <ChevronDown className="w-3.5 h-3.5 text-rose-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300" />}
            <span className="flex items-center gap-1.5 text-xs tracking-wide">
              <Layers className="w-3.5 h-3.5 text-rose-400" /> 3. Beban Bekerja (Loads)
            </span>
            <span className="text-[11px] font-mono text-slate-400 tabular-nums ml-1">
              ({loads.length})
            </span>
          </button>
          <button
            onClick={() => {
              if (newLoadEndPos === '0' && beamLength > 0) {
                setNewLoadEndPos(String(beamLength));
              }
              setShowAddLoad(!showAddLoad);
            }}
            className="px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[11px] font-medium border border-white/10 transition flex items-center gap-1 shadow-sm active:scale-95"
            title="Tambah Beban Baru"
          >
            <Plus className="w-3 h-3" /> Tambah
          </button>
        </div>

        {openSections.loads && (
          <div className="pt-2 space-y-2">
            {/* Inline Add Load Form */}
            {showAddLoad && (
              <form onSubmit={handleAddLoad} className="glass-card p-3 rounded-2xl border border-white/15 space-y-2.5 text-xs shadow-xl">
                <div className="font-semibold text-white flex items-center justify-between border-b border-white/[0.08] pb-1.5">
                  <span className="text-[11px] tracking-wide text-slate-200">Input Beban Bekerja Baru</span>
                  <button
                    type="button"
                    onClick={() => setShowAddLoad(false)}
                    className="text-slate-400 hover:text-white text-xs px-1"
                  >
                    ✕
                  </button>
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Tipe Beban:</label>
                  <select
                    value={newLoadType}
                    onChange={e => setNewLoadType(e.target.value as LoadType)}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-2.5 py-1.5 text-white font-medium focus:border-white/30 outline-none text-xs"
                  >
                    <option value="point" className="bg-slate-900">Beban Terpusat (P) — Titik</option>
                    <option value="distributed" className="bg-slate-900">Beban Merata (q) — Panjang</option>
                    <option value="triangular" className="bg-slate-900">Beban Segitiga / Trapesium</option>
                    <option value="moment" className="bg-slate-900">Momen Titik Terpusat (M)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">
                      {newLoadType === 'distributed' ? `Besar q (${symbols.distLoad}):` : newLoadType === 'moment' ? `Momen M (${symbols.moment}):` : newLoadType === 'triangular' ? `q Awal (${symbols.distLoad}):` : `Besar P (${symbols.force}):`}
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={newLoadMag}
                      onChange={e => setNewLoadMag(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-2.5 py-1.5 text-white font-mono tabular-nums text-xs focus:border-white/30 outline-none placeholder:text-slate-600"
                      placeholder="misal: 16.9"
                      required
                    />
                  </div>

                  {(newLoadType === 'triangular' || newLoadType === 'trapezoidal') ? (
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">q Akhir ({symbols.distLoad}):</label>
                      <input
                        type="number"
                        step="any"
                        value={newLoadMagEnd}
                        onChange={e => setNewLoadMagEnd(e.target.value)}
                        className="w-full bg-black/50 border border-white/10 rounded-xl px-2.5 py-1.5 text-white font-mono tabular-nums text-xs focus:border-white/30 outline-none placeholder:text-slate-600"
                        placeholder="misal: 25.5"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Arah Kerja:</label>
                      <select
                        value={newLoadDir}
                        onChange={e => setNewLoadDir(e.target.value as any)}
                        className="w-full bg-black/50 border border-white/10 rounded-xl px-2.5 py-1.5 text-white focus:border-white/30 outline-none text-xs"
                      >
                        {newLoadType === 'moment' ? (
                          <>
                            <option value="cw" className="bg-slate-900">Searah Jarum Jam (CW)</option>
                            <option value="ccw" className="bg-slate-900">Berlawanan Arah (CCW)</option>
                          </>
                        ) : (
                          <>
                            <option value="down" className="bg-slate-900">Ke Bawah (Gravitasi ↓)</option>
                            <option value="up" className="bg-slate-900">Ke Atas (Angkat ↑)</option>
                          </>
                        )}
                      </select>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Posisi x1 / Titik ({symbols.length}):</label>
                    <input
                      type="number"
                      step="any"
                      value={newLoadStartPos}
                      onChange={e => setNewLoadStartPos(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-2.5 py-1.5 text-white font-mono tabular-nums text-xs focus:border-white/30 outline-none placeholder:text-slate-600"
                      min="0"
                      placeholder="misal: 16.9"
                      required
                    />
                  </div>

                  {(newLoadType === 'distributed' || newLoadType === 'triangular' || newLoadType === 'trapezoidal') && (
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Posisi x2 / Akhir ({symbols.length}):</label>
                      <input
                        type="number"
                        step="any"
                        value={newLoadEndPos}
                        onChange={e => setNewLoadEndPos(e.target.value)}
                        className="w-full bg-black/50 border border-white/10 rounded-xl px-2.5 py-1.5 text-white font-mono tabular-nums text-xs focus:border-white/30 outline-none placeholder:text-slate-600"
                        min="0"
                        placeholder="misal: 16.9"
                        required
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Label Beban (opsional):</label>
                  <input
                    type="text"
                    placeholder="Contoh: P1, q1, Beban Mati..."
                    value={newLoadLabel}
                    onChange={e => setNewLoadLabel(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-2.5 py-1.5 text-white text-xs focus:border-white/30 outline-none placeholder:text-slate-600"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-white hover:bg-slate-100 text-slate-950 font-bold rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow-md active:scale-[0.99]"
                >
                  <Plus className="w-3.5 h-3.5" /> Simpan Beban
                </button>
              </form>
            )}

            {/* List of existing loads */}
            {loads.length === 0 ? (
              <div className="text-[11px] text-slate-400 italic p-3 glass-card rounded-xl border border-white/[0.06]">
                Belum ada beban. Klik tombol "+ Tambah" di atas untuk memasukkan beban terpusat (P) atau beban merata (q).
              </div>
            ) : (
              loads.map(load => (
                <div
                  key={load.id}
                  onClick={() => onSelectObject('load', load.id)}
                  className={`p-2.5 rounded-xl border text-left cursor-pointer transition flex items-center justify-between ${
                    selectedId === load.id
                      ? 'bg-white/[0.12] border-white/40 text-white shadow-lg backdrop-blur-md'
                      : 'glass-card border-white/[0.06] hover:border-white/20 text-slate-300'
                  }`}
                >
                  <div>
                    <div className="font-semibold text-white flex items-center gap-1.5 text-xs">
                      {load.direction === 'down' ? <ArrowDown className="w-3.5 h-3.5 text-rose-400" /> : load.direction === 'up' ? <ArrowUp className="w-3.5 h-3.5 text-cyan-400" /> : <RotateCw className="w-3.5 h-3.5 text-amber-400" />}
                      {load.label || (load.type === 'point' ? 'Beban Terpusat P' : load.type === 'distributed' ? 'Beban Merata q' : 'Beban Segitiga')}: {load.magnitude} {load.type === 'distributed' ? symbols.distLoad : load.type === 'moment' ? symbols.moment : symbols.force}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono tabular-nums mt-0.5">
                      x = {load.startPos}{symbols.length} {load.endPos ? `→ ${load.endPos}${symbols.length}` : ''} {load.magnitudeEnd !== undefined ? `(q2=${load.magnitudeEnd} ${symbols.distLoad})` : ''}
                    </div>
                  </div>
                  <button
                    onClick={e => handleDeleteLoad(load.id, e)}
                    className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                    title="Hapus Beban"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* 4. MATERIAL PROPERTIES */}
      <div className="p-3">
        <button
          onClick={() => toggleSection('materials')}
          className="w-full flex items-center justify-between py-1 px-1 hover:text-white rounded-lg text-left font-semibold text-slate-200 transition group"
        >
          <span className="flex items-center gap-2 text-xs">
            {openSections.materials ? <ChevronDown className="w-3.5 h-3.5 text-cyan-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300" />}
            <Boxes className="w-3.5 h-3.5 text-amber-400" /> 4. Properti Material
          </span>
          <span className="text-[11px] font-mono text-slate-400 tabular-nums">E={materialE/1000} GPa</span>
        </button>

        {openSections.materials && (
          <div className="pt-2 px-1 space-y-2">
            <div className="glass-card p-3 rounded-2xl border border-white/[0.08]">
              <label className="text-[11px] text-slate-400 block mb-1.5">Modulus Elastisitas E ({symbols.stress})</label>
              <input
                type="number"
                step="any"
                value={materialE}
                onChange={e => onUpdateMaterialE(parseFloat(e.target.value.replace(',', '.')) || 0)}
                className="w-full bg-black/50 border border-white/10 rounded-xl px-2.5 py-1.5 text-white font-mono tabular-nums text-xs focus:border-white/30 outline-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* 5. SECTION PROPERTIES */}
      <div className="p-3">
        <button
          onClick={() => toggleSection('sections')}
          className="w-full flex items-center justify-between py-1 px-1 hover:text-white rounded-lg text-left font-semibold text-slate-200 transition group"
        >
          <span className="flex items-center gap-2 text-xs">
            {openSections.sections ? <ChevronDown className="w-3.5 h-3.5 text-cyan-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300" />}
            <Component className="w-3.5 h-3.5 text-emerald-400" /> 5. Properti Penampang
          </span>
          <span className="text-[11px] font-mono text-slate-400 tabular-nums">Inersia I ({symbols.inertia})</span>
        </button>

        {openSections.sections && (
          <div className="pt-2 px-1 space-y-2">
            <div className="glass-card p-3 rounded-2xl border border-white/[0.08]">
              <label className="text-[11px] text-slate-400 block mb-1.5">Momen Inersia I ({symbols.inertia})</label>
              <input
                type="number"
                step="any"
                value={sectionI}
                onChange={e => onUpdateSectionI(parseFloat(e.target.value.replace(',', '.')) || 0)}
                className="w-full bg-black/50 border border-white/10 rounded-xl px-2.5 py-1.5 text-white font-mono tabular-nums text-xs focus:border-white/30 outline-none"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
