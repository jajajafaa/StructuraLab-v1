import React from 'react';
import { useUnits, UnitSystem } from '../context/UnitContext';
import { Gauge, ArrowLeftRight } from 'lucide-react';

interface UnitToggleProps {
  compact?: boolean;
}

export const UnitToggle: React.FC<UnitToggleProps> = ({ compact = false }) => {
  const { unitSystem, setUnitSystem } = useUnits();

  return (
    <div className="flex items-center gap-1.5" title="Beralih Satuan: SI (Metrik: m, kN, MPa) vs Imperial (US: ft, kip, ksi)">
      <div className="inline-flex p-0.5 rounded-xl bg-slate-900/90 backdrop-blur-md border border-white/10 shadow-lg">
        <button
          type="button"
          onClick={() => setUnitSystem('si')}
          className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all flex items-center gap-1 ${
            unitSystem === 'si'
              ? 'bg-white text-slate-950 font-bold shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Satuan SI Metrik: meter (m), milimeter (mm), kilonewton (kN), megapascal (MPa)"
        >
          <span>SI Metrik</span>
          {!compact && <span className="text-[10px] opacity-60 font-mono font-normal">m, kN</span>}
        </button>

        <button
          type="button"
          onClick={() => setUnitSystem('imperial')}
          className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all flex items-center gap-1 ${
            unitSystem === 'imperial'
              ? 'bg-white text-slate-950 font-bold shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Satuan Imperial US: feet (ft), inch (in), kips (kip), ksi"
        >
          <span>Imperial</span>
          {!compact && <span className="text-[10px] opacity-60 font-mono font-normal">ft, kip</span>}
        </button>
      </div>
    </div>
  );
};
