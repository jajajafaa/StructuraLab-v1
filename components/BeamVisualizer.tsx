import React from 'react';
import { DiagramPoint, SupportReaction, StructuralLoad, Support } from '../types/structural';

interface BeamCanvasProps {
  length: number;
  supports: Support[];
  loads: StructuralLoad[];
  reactions?: SupportReaction[];
  diagramPoints?: DiagramPoint[];
  activeDiagram?: 'loads' | 'sfd' | 'bmd' | 'all';
}

export const BeamVisualizer: React.FC<BeamCanvasProps> = ({
  length,
  supports,
  loads,
  reactions = [],
  diagramPoints = [],
  activeDiagram = 'all'
}) => {
  const width = 800;
  const height = 440;
  const paddingX = 70;
  const beamY = 90;
  const usableWidth = width - 2 * paddingX;

  const safeLength = length > 0 ? length : 6;
  const toCanvasX = (x: number) => paddingX + (x / safeLength) * usableWidth;

  // Max values for diagrams
  let maxV = 0;
  let maxM = 0;
  diagramPoints.forEach(p => {
    if (Math.abs(p.V) > maxV) maxV = Math.abs(p.V);
    if (Math.abs(p.M) > maxM) maxM = Math.abs(p.M);
  });
  if (maxV === 0) maxV = 1;
  if (maxM === 0) maxM = 1;

  // Build SVG path for SFD
  const sfdBaseY = 220;
  const sfdScale = 45 / maxV;
  let sfdPath = `M ${toCanvasX(0)} ${sfdBaseY}`;
  diagramPoints.forEach(pt => {
    const cx = toCanvasX(pt.x);
    const cy = sfdBaseY - pt.V * sfdScale;
    sfdPath += ` L ${cx} ${cy}`;
  });
  sfdPath += ` L ${toCanvasX(safeLength)} ${sfdBaseY} Z`;

  // Build SVG path for BMD (Positive moment plotted downward on tension side)
  const bmdBaseY = 350;
  const bmdScale = 50 / maxM;
  let bmdPath = `M ${toCanvasX(0)} ${bmdBaseY}`;
  diagramPoints.forEach(pt => {
    const cx = toCanvasX(pt.x);
    const cy = bmdBaseY + pt.M * bmdScale;
    bmdPath += ` L ${cx} ${cy}`;
  });
  bmdPath += ` L ${toCanvasX(safeLength)} ${bmdBaseY} Z`;

  return (
    <div className="w-full bg-slate-950 rounded-xl p-4 border border-slate-800 shadow-2xl overflow-x-auto">
      <div className="flex items-center justify-between mb-2 px-2 text-xs text-slate-400">
        <span className="font-mono text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
          Structural Visualizer Workspace (L = {length} m)
        </span>
        <div className="flex gap-4">
          <span className="flex items-center gap-1.5 text-blue-400">
            <span className="w-3 h-0.5 bg-blue-500"></span> SFD (Gaya Geser, kN)
          </span>
          <span className="flex items-center gap-1.5 text-emerald-400">
            <span className="w-3 h-0.5 bg-emerald-500"></span> BMD (Momen Lentur, kN.m)
          </span>
        </div>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto min-w-[700px] select-none font-sans">
        <defs>
          {/* Gradients */}
          <linearGradient id="sfdGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0.05" />
          </linearGradient>
          <linearGradient id="bmdGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#047857" stopOpacity="0.05" />
          </linearGradient>
          {/* Arrow markers */}
          <marker id="arrowDown" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#f43f5e" />
          </marker>
          <marker id="arrowUp" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#06b6d4" />
          </marker>
        </defs>

        {/* ================= SECTION 1: PHYSICAL BEAM & LOADS ================= */}
        {/* Beam Element */}
        <line
          x1={toCanvasX(0)}
          y1={beamY}
          x2={toCanvasX(safeLength)}
          y2={beamY}
          stroke="#94a3b8"
          strokeWidth="10"
          strokeLinecap="round"
        />

        {/* Supports */}
        {supports.map((s, idx) => {
          const sx = toCanvasX(s.position);
          const sy = beamY + 5;
          return (
            <g key={s.id || idx}>
              {s.type === 'pin' && (
                <g transform={`translate(${sx}, ${sy})`}>
                  <polygon points="0,0 -12,18 12,18" fill="#38bdf8" stroke="#0284c7" strokeWidth="1.5" />
                  <line x1="-15" y1="18" x2="15" y2="18" stroke="#64748b" strokeWidth="2" />
                  <line x1="-12" y1="22" x2="-8" y2="18" stroke="#64748b" strokeWidth="1" />
                  <line x1="-4" y1="22" x2="0" y2="18" stroke="#64748b" strokeWidth="1" />
                  <line x1="4" y1="22" x2="8" y2="18" stroke="#64748b" strokeWidth="1" />
                </g>
              )}
              {s.type === 'roller' && (
                <g transform={`translate(${sx}, ${sy})`}>
                  <polygon points="0,0 -12,14 12,14" fill="#38bdf8" stroke="#0284c7" strokeWidth="1.5" />
                  <circle cx="-6" cy="18" r="3" fill="#94a3b8" />
                  <circle cx="6" cy="18" r="3" fill="#94a3b8" />
                  <line x1="-15" y1="22" x2="15" y2="22" stroke="#64748b" strokeWidth="2" />
                </g>
              )}
              {s.type === 'fixed' && (
                <g transform={`translate(${sx}, ${beamY})`}>
                  <rect x="-8" y="-20" width="8" height="40" fill="#475569" stroke="#64748b" />
                  <line x1="-14" y1="-15" x2="-8" y2="-20" stroke="#94a3b8" strokeWidth="1" />
                  <line x1="-14" y1="-5" x2="-8" y2="-10" stroke="#94a3b8" strokeWidth="1" />
                  <line x1="-14" y1="5" x2="-8" y2="0" stroke="#94a3b8" strokeWidth="1" />
                  <line x1="-14" y1="15" x2="-8" y2="10" stroke="#94a3b8" strokeWidth="1" />
                </g>
              )}
              <text x={sx} y={sy + 36} fill="#cbd5e1" fontSize="11" fontWeight="bold" textAnchor="middle">
                {s.label || String.fromCharCode(65 + idx)} ({s.position}m)
              </text>
            </g>
          );
        })}

        {/* Reaction Forces */}
        {reactions.map((r, idx) => {
          const rx = toCanvasX(r.position);
          return (
            <g key={idx}>
              <line
                x1={rx}
                y1={beamY + 58}
                x2={rx}
                y2={beamY + 12}
                stroke="#06b6d4"
                strokeWidth="2.5"
                markerEnd="url(#arrowUp)"
              />
              <text x={rx + 8} y={beamY + 52} fill="#38bdf8" fontSize="10" fontWeight="bold">
                R={r.Ry.toFixed(1)}kN
              </text>
            </g>
          );
        })}

        {/* Structural Loads */}
        {loads.map((load, idx) => {
          const lx = toCanvasX(load.startPos);
          if (load.type === 'point') {
            return (
              <g key={load.id || idx}>
                <line
                  x1={lx}
                  y1={beamY - 45}
                  x2={lx}
                  y2={beamY - 6}
                  stroke="#f43f5e"
                  strokeWidth="2.5"
                  markerEnd="url(#arrowDown)"
                />
                <text x={lx} y={beamY - 50} fill="#fb7185" fontSize="11" fontWeight="bold" textAnchor="middle">
                  P = {load.magnitude} kN
                </text>
              </g>
            );
          } else if (load.type === 'distributed') {
            const endX = toCanvasX(load.endPos ?? safeLength);
            const arrows = Math.max(3, Math.round((endX - lx) / 25));
            return (
              <g key={load.id || idx}>
                <line x1={lx} y1={beamY - 32} x2={endX} y2={beamY - 32} stroke="#f43f5e" strokeWidth="1.5" />
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
                      markerEnd="url(#arrowDown)"
                    />
                  );
                })}
                <text x={(lx + endX) / 2} y={beamY - 38} fill="#fb7185" fontSize="11" fontWeight="bold" textAnchor="middle">
                  q = {load.magnitude} kN/m
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
              <g key={load.id || idx}>
                <polygon points={polyPoints} fill="#f43f5e" fillOpacity="0.2" stroke="#f43f5e" strokeWidth="1.5" />
                <line x1={lx} y1={beamY - 6 - h1} x2={lx} y2={beamY - 6} stroke="#f43f5e" strokeWidth="1.5" markerEnd="url(#arrowDown)" />
                <line x1={endX} y1={beamY - 6 - h2} x2={endX} y2={beamY - 6} stroke="#f43f5e" strokeWidth="1.5" markerEnd="url(#arrowDown)" />
                <text x={(lx + endX) / 2} y={beamY - 42} fill="#fb7185" fontSize="10" fontWeight="bold" textAnchor="middle">
                  {load.type === 'triangular' ? `Segitiga (${q1} -> ${q2} kN/m)` : `Trapesium (${q1} -> ${q2} kN/m)`}
                </text>
              </g>
            );
          } else if (load.type === 'moment') {
            return (
              <g key={load.id || idx}>
                <circle cx={lx} cy={beamY} r="18" fill="none" stroke="#eab308" strokeWidth="2" strokeDasharray="6 3" />
                <text x={lx} y={beamY - 24} fill="#facc15" fontSize="10" fontWeight="bold" textAnchor="middle">
                  M = {load.magnitude} kN.m
                </text>
              </g>
            );
          }
          return null;
        })}

        {/* ================= SECTION 2: SHEAR FORCE DIAGRAM (SFD) ================= */}
        {(activeDiagram === 'all' || activeDiagram === 'sfd') && (
          <g>
            {/* Baseline */}
            <line x1={toCanvasX(0)} y1={sfdBaseY} x2={toCanvasX(safeLength)} y2={sfdBaseY} stroke="#475569" strokeWidth="1.5" strokeDasharray="3 3" />
            <text x={paddingX - 10} y={sfdBaseY + 4} fill="#60a5fa" fontSize="11" fontWeight="bold" textAnchor="end">
              SFD (V)
            </text>
            {/* Filled Area */}
            <path d={sfdPath} fill="url(#sfdGrad)" stroke="#3b82f6" strokeWidth="2" />
            {/* Values indicators */}
            {diagramPoints.filter((_, i) => i % 25 === 0 || i === diagramPoints.length - 1).map((pt, i) => (
              <g key={i}>
                <circle cx={toCanvasX(pt.x)} cy={sfdBaseY - pt.V * sfdScale} r="2.5" fill="#60a5fa" />
              </g>
            ))}
          </g>
        )}

        {/* ================= SECTION 3: BENDING MOMENT DIAGRAM (BMD) ================= */}
        {(activeDiagram === 'all' || activeDiagram === 'bmd') && (
          <g>
            {/* Baseline */}
            <line x1={toCanvasX(0)} y1={bmdBaseY} x2={toCanvasX(safeLength)} y2={bmdBaseY} stroke="#475569" strokeWidth="1.5" strokeDasharray="3 3" />
            <text x={paddingX - 10} y={bmdBaseY + 4} fill="#34d399" fontSize="11" fontWeight="bold" textAnchor="end">
              BMD (M)
            </text>
            {/* Filled Area */}
            <path d={bmdPath} fill="url(#bmdGrad)" stroke="#10b981" strokeWidth="2" />
            {/* Values indicators */}
            {diagramPoints.filter((_, i) => i % 25 === 0 || i === diagramPoints.length - 1).map((pt, i) => (
              <g key={i}>
                <circle cx={toCanvasX(pt.x)} cy={bmdBaseY + pt.M * bmdScale} r="2.5" fill="#34d399" />
              </g>
            ))}
          </g>
        )}
      </svg>
    </div>
  );
};
