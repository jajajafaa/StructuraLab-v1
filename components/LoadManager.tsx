import React, { useState } from 'react';
import { StructuralLoad, LoadType } from '../types/structural';
import { Plus, Trash2, Edit2, Layers, ArrowDown, ArrowUp, RotateCw, RotateCcw } from 'lucide-react';

interface LoadManagerProps {
  loads: StructuralLoad[];
  onUpdateLoads: (loads: StructuralLoad[]) => void;
  beamLength: number;
  onSelectLoad?: (id: string) => void;
}

export const LoadManager: React.FC<LoadManagerProps> = ({
  loads,
  onUpdateLoads,
  beamLength,
  onSelectLoad
}) => {
  const [loadType, setLoadType] = useState<LoadType>('point');
  const [magnitude, setMagnitude] = useState<string>('25');
  const [magnitudeEnd, setMagnitudeEnd] = useState<string>('10');
  const [startPos, setStartPos] = useState<string>('3.0');
  const [endPos, setEndPos] = useState<string>('6.0');
  const [direction, setDirection] = useState<'down' | 'up' | 'cw' | 'ccw'>('down');
  const [label, setLabel] = useState<string>('P1');

  const parseNum = (val: string, fallback = 0): number => {
    const clean = val.replace(',', '.').trim();
    if (clean === '') return fallback;
    const n = parseFloat(clean);
    return isNaN(n) ? fallback : n;
  };

  const handleAddLoad = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedStart = parseNum(startPos, 0);
    const parsedEnd = parseNum(endPos, beamLength || 6);
    const parsedMag = parseNum(magnitude, 20);
    const parsedMagEnd = parseNum(magnitudeEnd, 0);

    const newLoad: StructuralLoad = {
      id: 'load-' + Date.now().toString(36),
      type: loadType,
      startPos: Math.max(0, parsedStart),
      endPos: loadType !== 'point' && loadType !== 'moment' ? Math.max(parsedStart, parsedEnd) : undefined,
      magnitude: parsedMag,
      magnitudeEnd: loadType === 'triangular' || loadType === 'trapezoidal' ? parsedMagEnd : undefined,
      direction,
      label: label || `Beban ${loads.length + 1}`
    };

    onUpdateLoads([...loads, newLoad]);
    // Prepare next label
    setLabel(`L${loads.length + 2}`);
  };

  const handleDelete = (id: string) => {
    onUpdateLoads(loads.filter(l => l.id !== id));
  };

  return (
    <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-4 shadow-xl text-xs space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <h3 className="font-bold text-slate-200 text-sm flex items-center gap-1.5">
          <Layers className="w-4 h-4 text-rose-400" />
          Load Manager (Manajemen Pembebanan)
        </h3>
        <span className="font-mono text-cyan-400 text-[11px]">{loads.length} Beban Aktif</span>
      </div>

      {/* Add New Load Form */}
      <form onSubmit={handleAddLoad} className="bg-[#070b12] p-3 rounded-lg border border-slate-800/80 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-slate-400 block mb-1">Tipe Beban</label>
            <select
              value={loadType}
              onChange={e => {
                const t = e.target.value as LoadType;
                setLoadType(t);
                if (t === 'moment') setDirection('cw');
                else setDirection('down');
              }}
              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white text-xs"
            >
              <option value="point">Point Load (P, kN)</option>
              <option value="distributed">Uniform Distributed (q, kN/m)</option>
              <option value="triangular">Triangular Distributed (q1→q2)</option>
              <option value="trapezoidal">Trapezoidal Distributed</option>
              <option value="moment">Applied Moment (M, kN.m)</option>
            </select>
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Label Beban</label>
            <input
              type="text"
              value={label}
              onChange={e => setLabel(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white text-xs font-mono"
              placeholder="Contoh: P1, q1, Beban Mati"
            />
          </div>
        </div>

        {/* Magnitude inputs */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-slate-400 block mb-1">
              {loadType === 'moment' ? 'Besar Momen (kN.m)' : loadType === 'point' ? 'Besar Gaya P (kN)' : 'Besar q1 (kN/m)'}
            </label>
            <input
              type="number"
              step="any"
              value={magnitude}
              onChange={e => setMagnitude(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono"
              placeholder="misal: 16.9"
              required
            />
          </div>

          {loadType !== 'point' && loadType !== 'moment' ? (
            <div>
              <label className="text-slate-400 block mb-1">Besar q2 (kN/m)</label>
              <input
                type="number"
                step="any"
                value={magnitudeEnd}
                onChange={e => setMagnitudeEnd(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono"
                placeholder="misal: 16.9"
              />
            </div>
          ) : (
            <div>
              <label className="text-slate-400 block mb-1">Arah Beban</label>
              <select
                value={direction}
                onChange={e => setDirection(e.target.value as any)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white text-xs"
              >
                {loadType === 'moment' ? (
                  <>
                    <option value="cw">Searah Jarum Jam (CW)</option>
                    <option value="ccw">Berlawanan Arah (CCW)</option>
                  </>
                ) : (
                  <>
                    <option value="down">Ke Bawah (Gravitasi ↓)</option>
                    <option value="up">Ke Atas (Uplift ↑)</option>
                  </>
                )}
              </select>
            </div>
          )}
        </div>

        {/* Positions */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-slate-400 block mb-1">Posisi Mulai x1 (m)</label>
            <input
              type="number"
              step="any"
              value={startPos}
              onChange={e => setStartPos(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono"
              min="0"
              placeholder="misal: 16.9"
              required
            />
          </div>

          {loadType !== 'point' && loadType !== 'moment' && (
            <div>
              <label className="text-slate-400 block mb-1">Posisi Akhir x2 (m)</label>
              <input
                type="number"
                step="any"
                value={endPos}
                onChange={e => setEndPos(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono"
                min="0"
                placeholder="misal: 16.9"
                required
              />
            </div>
          )}
        </div>

        <button
          type="submit"
          className="w-full py-1.5 bg-rose-600/30 hover:bg-rose-600/50 text-rose-300 border border-rose-500/40 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" /> Tambahkan Beban ke Model
        </button>
      </form>

      {/* Active Loads List */}
      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
        {loads.map(l => (
          <div
            key={l.id}
            onClick={() => onSelectLoad && onSelectLoad(l.id)}
            className="p-2 bg-[#070b12] hover:bg-slate-800/40 rounded-lg border border-slate-800 flex items-center justify-between cursor-pointer transition text-[11px]"
          >
            <div>
              <span className="font-bold text-white mr-1.5">{l.label}</span>
              <span className="text-rose-400 font-mono">
                {l.magnitude} {l.type === 'distributed' ? 'kN/m' : 'kN'}
              </span>
              <span className="text-slate-500 ml-2 font-mono">
                [x = {l.startPos}m {l.endPos ? `→ ${l.endPos}m` : ''}]
              </span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(l.id);
              }}
              className="text-rose-400 hover:text-rose-300 p-1"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
