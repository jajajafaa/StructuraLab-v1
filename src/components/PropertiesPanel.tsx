import React from 'react';
import { Support, StructuralLoad } from '../types/structural';
import { Sliders, X, CheckCircle, Trash2 } from 'lucide-react';

interface PropertiesPanelProps {
  selectedType: 'support' | 'load' | 'beam' | null;
  selectedId: string | null;
  supports: Support[];
  onUpdateSupport: (support: Support) => void;
  onDeleteSupport: (id: string) => void;
  loads: StructuralLoad[];
  onUpdateLoad: (load: StructuralLoad) => void;
  onDeleteLoad: (id: string) => void;
  beamLength: number;
  onClose: () => void;
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  selectedType,
  selectedId,
  supports,
  onUpdateSupport,
  onDeleteSupport,
  loads,
  onUpdateLoad,
  onDeleteLoad,
  beamLength,
  onClose
}) => {
  if (!selectedType || !selectedId) return null;

  const currentSupport = selectedType === 'support' ? supports.find(s => s.id === selectedId) : null;
  const currentLoad = selectedType === 'load' ? loads.find(l => l.id === selectedId) : null;

  return (
    <div className="bg-[#0f172a] border border-slate-700/80 rounded-xl p-4 shadow-2xl text-xs space-y-3 animate-in fade-in zoom-in-95 duration-150">
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <span className="font-mono uppercase font-bold text-cyan-400 flex items-center gap-1.5">
          <Sliders className="w-3.5 h-3.5" />
          Properti Elemen Terpilih
        </span>
        <button onClick={onClose} className="text-slate-400 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* SUPPORT PROPERTIES */}
      {selectedType === 'support' && currentSupport && (
        <div className="space-y-3">
          <div className="font-semibold text-white">
            Tumpuan ID: <span className="font-mono text-cyan-300">{currentSupport.id}</span>
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Tipe Tumpuan (Restraint Type)</label>
            <select
              value={currentSupport.type}
              onChange={e => onUpdateSupport({ ...currentSupport, type: e.target.value as any })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
            >
              <option value="pin">Sendi (Pin) - Menahan Ux, Uy</option>
              <option value="roller">Rol (Roller) - Menahan Uy</option>
              <option value="fixed">Jepit (Fixed) - Menahan Ux, Uy, Rz</option>
            </select>
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Posisi Tumpuan x (m)</label>
            <input
              type="number"
              step="any"
              value={currentSupport.position}
              onChange={e => onUpdateSupport({ ...currentSupport, position: Math.min(beamLength, Math.max(0, parseFloat(e.target.value.replace(',', '.')) || 0)) })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
              placeholder="misal: 16.9"
            />
          </div>

          <div className="pt-2 flex justify-end">
            <button
              onClick={() => onDeleteSupport(currentSupport.id)}
              className="px-3 py-1.5 rounded-lg bg-rose-600/20 text-rose-300 border border-rose-500/30 hover:bg-rose-600/40 text-xs flex items-center gap-1.5 transition"
            >
              <Trash2 className="w-3.5 h-3.5" /> Hapus Tumpuan
            </button>
          </div>
        </div>
      )}

      {/* LOAD PROPERTIES */}
      {selectedType === 'load' && currentLoad && (
        <div className="space-y-3">
          <div className="font-semibold text-white">
            Beban ID: <span className="font-mono text-rose-300">{currentLoad.id}</span>
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Tipe Beban (Load Pattern)</label>
            <select
              value={currentLoad.type}
              onChange={e => onUpdateLoad({ ...currentLoad, type: e.target.value as any })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
            >
              <option value="point">Beban Terpusat (Point Load P, kN)</option>
              <option value="distributed">Beban Merata (Uniform Distributed q, kN/m)</option>
              <option value="triangular">Beban Segitiga (Triangular)</option>
              <option value="trapezoidal">Beban Trapesium (Trapezoidal)</option>
              <option value="moment">Momen Terpusat (Applied Moment M, kN.m)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-slate-400 block mb-1">
                {currentLoad.type === 'moment' ? 'Momen (kN.m)' : currentLoad.type === 'point' ? 'Besar P (kN)' : 'Besar q1 (kN/m)'}
              </label>
              <input
                type="number"
                step="any"
                value={currentLoad.magnitude}
                onChange={e => onUpdateLoad({ ...currentLoad, magnitude: parseFloat(e.target.value.replace(',', '.')) || 0 })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
                placeholder="misal: 16.9"
              />
            </div>

            {currentLoad.type !== 'point' && currentLoad.type !== 'moment' && (
              <div>
                <label className="text-slate-400 block mb-1">Besar q2 (kN/m)</label>
                <input
                  type="number"
                  step="any"
                  value={currentLoad.magnitudeEnd ?? currentLoad.magnitude}
                  onChange={e => onUpdateLoad({ ...currentLoad, magnitudeEnd: parseFloat(e.target.value.replace(',', '.')) || 0 })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
                  placeholder="misal: 16.9"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-slate-400 block mb-1">Posisi Awal x1 (m)</label>
              <input
                type="number"
                step="any"
                value={currentLoad.startPos}
                onChange={e => onUpdateLoad({ ...currentLoad, startPos: Math.min(beamLength, Math.max(0, parseFloat(e.target.value.replace(',', '.')) || 0)) })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
                placeholder="misal: 16.9"
              />
            </div>

            {currentLoad.type !== 'point' && currentLoad.type !== 'moment' && (
              <div>
                <label className="text-slate-400 block mb-1">Posisi Akhir x2 (m)</label>
                <input
                  type="number"
                  step="any"
                  value={currentLoad.endPos ?? beamLength}
                  onChange={e => onUpdateLoad({ ...currentLoad, endPos: Math.min(beamLength, Math.max(currentLoad.startPos, parseFloat(e.target.value.replace(',', '.')) || 0)) })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
                  placeholder="misal: 16.9"
                />
              </div>
            )}
          </div>

          <div className="pt-2 flex justify-end">
            <button
              onClick={() => onDeleteLoad(currentLoad.id)}
              className="px-3 py-1.5 rounded-lg bg-rose-600/20 text-rose-300 border border-rose-500/30 hover:bg-rose-600/40 text-xs flex items-center gap-1.5 transition"
            >
              <Trash2 className="w-3.5 h-3.5" /> Hapus Beban
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
