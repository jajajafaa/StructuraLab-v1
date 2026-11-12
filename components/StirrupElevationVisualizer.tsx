import React from 'react';
import { StirrupArrangement } from '../types/concrete';

interface StirrupElevationVisualizerProps {
  spanL: number; // m
  h: number;     // mm
  bw: number;    // mm
  zones: StirrupArrangement[];
  supportWidth?: number; // mm
}

export const StirrupElevationVisualizer: React.FC<StirrupElevationVisualizerProps> = ({
  spanL,
  h,
  bw,
  zones,
  supportWidth = 400
}) => {
  const width = 800;
  const height = 240;
  const padX = 60;
  const beamTop = 60;
  const beamDrawH = 80;
  const usableWidth = width - 2 * padX;

  const toX = (m: number) => padX + (m / spanL) * usableWidth;

  return (
    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 shadow-xl overflow-x-auto">
      <div className="flex items-center justify-between text-xs text-slate-400 mb-2 font-mono">
        <span className="text-cyan-400 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
          Elevasi Penulangan Sengkang Balok (L = {spanL} m | {bw}×{h} mm)
        </span>
        <span className="text-slate-300">
          SNI 2847:2013 Pasal 11.4 & Bab 5
        </span>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto min-w-[700px] select-none font-sans">
        {/* Columns / Supports */}
        <rect x={padX - 25} y={beamTop + beamDrawH} width="35" height="70" fill="#334155" stroke="#475569" />
        <rect x={width - padX - 10} y={beamTop + beamDrawH} width="35" height="70" fill="#334155" stroke="#475569" />

        {/* Beam Outline */}
        <rect
          x={padX}
          y={beamTop}
          width={usableWidth}
          height={beamDrawH}
          fill="#1e293b"
          stroke="#64748b"
          strokeWidth="2"
        />

        {/* Longitudinal rebar lines */}
        {/* Top rebar */}
        <line x1={padX + 5} y1={beamTop + 14} x2={padX + usableWidth - 5} y2={beamTop + 14} stroke="#38bdf8" strokeWidth="2.5" />
        {/* Bottom rebar */}
        <line x1={padX + 5} y1={beamTop + beamDrawH - 14} x2={padX + usableWidth - 5} y2={beamTop + beamDrawH - 14} stroke="#ec4899" strokeWidth="2.5" />

        {/* Stirrups across beam */}
        {zones.map((zone, zIdx) => {
          const startM = zone.rangeFrom;
          const endM = zone.rangeTo;
          const s_mm = zone.spacing;
          const numStirrups = Math.max(2, Math.round(((endM - startM) * 1000) / s_mm));

          // Draw for left half and mirror to right half
          return (
            <g key={zIdx}>
              {/* Left half */}
              {Array.from({ length: numStirrups }).map((_, sIdx) => {
                const currentM = startM + (sIdx / numStirrups) * (endM - startM);
                const sx = toX(currentM);
                return (
                  <line
                    key={`s-l-${sIdx}`}
                    x1={sx}
                    y1={beamTop + 6}
                    x2={sx}
                    y2={beamTop + beamDrawH - 6}
                    stroke={zIdx === 0 ? '#38bdf8' : '#94a3b8'}
                    strokeWidth={zIdx === 0 ? '2' : '1.5'}
                  />
                );
              })}

              {/* Right half (symmetric) */}
              {Array.from({ length: numStirrups }).map((_, sIdx) => {
                const currentM = spanL - (startM + (sIdx / numStirrups) * (endM - startM));
                const sx = toX(currentM);
                return (
                  <line
                    key={`s-r-${sIdx}`}
                    x1={sx}
                    y1={beamTop + 6}
                    x2={sx}
                    y2={beamTop + beamDrawH - 6}
                    stroke={zIdx === 0 ? '#38bdf8' : '#94a3b8'}
                    strokeWidth={zIdx === 0 ? '2' : '1.5'}
                  />
                );
              })}
            </g>
          );
        })}

        {/* Zone Dimension Labels */}
        {zones.map((z, idx) => {
          const x1 = toX(z.rangeFrom);
          const x2 = toX(z.rangeTo);
          const midX = (x1 + x2) / 2;
          return (
            <g key={`lbl-${idx}`}>
              <line x1={x1} y1={beamTop - 12} x2={x2} y2={beamTop - 12} stroke="#38bdf8" strokeWidth="1" />
              <circle cx={x1} cy={beamTop - 12} r="2" fill="#38bdf8" />
              <circle cx={x2} cy={beamTop - 12} r="2" fill="#38bdf8" />
              <text x={midX} y={beamTop - 18} fill="#38bdf8" fontSize="10" fontWeight="bold" textAnchor="middle">
                D{z.diameter} - {z.spacing} mm ({z.zone})
              </text>
            </g>
          );
        })}

        {/* Centerline */}
        <line
          x1={toX(spanL / 2)}
          y1={beamTop - 25}
          x2={toX(spanL / 2)}
          y2={beamTop + beamDrawH + 25}
          stroke="#f59e0b"
          strokeWidth="1"
          strokeDasharray="4 3"
        />
        <text x={toX(spanL / 2)} y={beamTop + beamDrawH + 36} fill="#fbbf24" fontSize="10" textAnchor="middle">
          As Balok (L/2 = {(spanL / 2).toFixed(2)} m)
        </text>
      </svg>
    </div>
  );
};
