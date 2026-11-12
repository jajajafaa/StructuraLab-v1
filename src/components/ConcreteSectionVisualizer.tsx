import React from 'react';
import { ConcreteSectionType } from '../types/concrete';

interface CrossSectionVisualizerProps {
  sectionType: ConcreteSectionType;
  b: number;      // mm
  h: number;      // mm
  d: number;      // mm
  bw?: number;    // mm (for T/L)
  hf?: number;    // mm (for T/L)
  tensionCount: number;
  tensionDia: number;
  layers?: number;
  compressionCount?: number;
  compressionDia?: number;
  dPrime?: number;
  stirrupDia?: number;
  a?: number;     // Whitney stress block depth
  c?: number;     // Neutral axis depth
}

export const ConcreteSectionVisualizer: React.FC<CrossSectionVisualizerProps> = ({
  sectionType,
  b,
  h,
  d,
  bw = 300,
  hf = 120,
  tensionCount,
  tensionDia,
  layers = 1,
  compressionCount = 0,
  compressionDia = 16,
  dPrime = 65,
  a = 0,
  c = 0
}) => {
  const canvasWidth = 420;
  const canvasHeight = 360;

  // Compute bounding box scale
  const effectiveB = sectionType === 't_beam' || sectionType === 'l_beam' ? b : b;
  const maxDim = Math.max(effectiveB, h, 600);
  const scale = 240.0 / maxDim;

  const originX = canvasWidth / 2;
  const originY = 50;

  const drawH = h * scale;
  const drawB = b * scale;
  const drawBw = bw * scale;
  const drawHf = hf * scale;

  return (
    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 shadow-xl flex flex-col items-center">
      <div className="w-full flex items-center justify-between text-xs text-slate-400 mb-2 font-mono">
        <span className="text-cyan-400 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
          Penampang Melintang (b={b || 0}mm × h={h || 0}mm)
        </span>
        <span className="text-amber-400">
          d = {isNaN(d) ? '0.0' : d.toFixed(1)} mm | d' = {isNaN(dPrime) ? '0.0' : dPrime.toFixed(1)} mm
        </span>
      </div>

      <svg viewBox={`0 0 ${canvasWidth} ${canvasHeight}`} className="w-full h-auto max-w-[380px] select-none font-sans">
        <defs>
          <pattern id="concreteHatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="8" stroke="#334155" strokeWidth="1" />
          </pattern>
        </defs>

        {/* 1. Concrete Outline */}
        {sectionType === 'rectangular_single' || sectionType === 'rectangular_double' ? (
          <g>
            <rect
              x={originX - drawB / 2}
              y={originY}
              width={drawB}
              height={drawH}
              fill="#1e293b"
              stroke="#64748b"
              strokeWidth="2.5"
              rx="4"
            />
            {/* Dimension Lines */}
            <line x1={originX - drawB / 2} y1={originY + drawH + 20} x2={originX + drawB / 2} y2={originY + drawH + 20} stroke="#94a3b8" strokeWidth="1.5" />
            <text x={originX} y={originY + drawH + 34} fill="#cbd5e1" fontSize="11" textAnchor="middle" fontWeight="bold">
              b = {b} mm
            </text>
          </g>
        ) : sectionType === 't_beam' ? (
          <g>
            {/* T-Shape polygon */}
            <polygon
              points={`
                ${originX - drawB / 2},${originY}
                ${originX + drawB / 2},${originY}
                ${originX + drawB / 2},${originY + drawHf}
                ${originX + drawBw / 2},${originY + drawHf}
                ${originX + drawBw / 2},${originY + drawH}
                ${originX - drawBw / 2},${originY + drawH}
                ${originX - drawBw / 2},${originY + drawHf}
                ${originX - drawB / 2},${originY + drawHf}
              `}
              fill="#1e293b"
              stroke="#64748b"
              strokeWidth="2.5"
            />
            {/* Top flange dimension */}
            <text x={originX} y={originY - 8} fill="#38bdf8" fontSize="11" textAnchor="middle" fontWeight="bold">
              be = {b} mm
            </text>
            <text x={originX} y={originY + drawH + 24} fill="#cbd5e1" fontSize="10" textAnchor="middle">
              bw = {bw} mm
            </text>
          </g>
        ) : (
          <g>
            {/* L-Shape polygon */}
            <polygon
              points={`
                ${originX - drawB / 2},${originY}
                ${originX + drawB / 2},${originY}
                ${originX + drawB / 2},${originY + drawHf}
                ${originX - drawB / 2 + drawBw},${originY + drawHf}
                ${originX - drawB / 2 + drawBw},${originY + drawH}
                ${originX - drawB / 2},${originY + drawH}
              `}
              fill="#1e293b"
              stroke="#64748b"
              strokeWidth="2.5"
            />
            <text x={originX} y={originY - 8} fill="#38bdf8" fontSize="11" textAnchor="middle" fontWeight="bold">
              be = {b} mm (Balok L)
            </text>
          </g>
        )}

        {/* 2. Whitney Stress Block & Neutral Axis Indicator */}
        {a > 0 && (
          <g>
            {/* Compression block filled with subtle red/orange */}
            <rect
              x={originX - (sectionType === 't_beam' ? drawBw / 2 : drawB / 2)}
              y={originY}
              width={sectionType === 't_beam' ? drawBw : drawB}
              height={Math.min(drawH, a * scale)}
              fill="#ef4444"
              fillOpacity="0.25"
              stroke="#ef4444"
              strokeWidth="1.5"
              strokeDasharray="4 2"
            />
            {/* Neutral Axis */}
            {c > 0 && (
              <g>
                <line
                  x1={originX - drawB / 2 - 15}
                  y1={originY + c * scale}
                  x2={originX + drawB / 2 + 15}
                  y2={originY + c * scale}
                  stroke="#f59e0b"
                  strokeWidth="1.5"
                  strokeDasharray="6 3"
                />
                <text x={originX + drawB / 2 + 20} y={originY + c * scale + 3} fill="#fbbf24" fontSize="9" fontWeight="bold">
                  Garis Netral (c={c.toFixed(1)}mm)
                </text>
              </g>
            )}
          </g>
        )}

        {/* 3. Height Dimension Line */}
        <line x1={originX - drawB / 2 - 25} y1={originY} x2={originX - drawB / 2 - 25} y2={originY + drawH} stroke="#94a3b8" strokeWidth="1.5" />
        <text
          x={originX - drawB / 2 - 32}
          y={originY + drawH / 2}
          fill="#cbd5e1"
          fontSize="11"
          fontWeight="bold"
          textAnchor="middle"
          transform={`rotate(-90 ${originX - drawB / 2 - 32} ${originY + drawH / 2})`}
        >
          h = {h} mm
        </text>

        {/* 4. Compression Rebars (Top) */}
        {compressionCount > 0 && (
          <g>
            {Array.from({ length: compressionCount }).map((_, idx) => {
              const activeWidth = (sectionType === 't_beam' ? drawBw : drawB) - 40;
              const barX = originX - activeWidth / 2 + (idx / Math.max(1, compressionCount - 1)) * activeWidth;
              const barY = originY + dPrime * scale;
              return (
                <circle
                  key={`comp-${idx}`}
                  cx={barX}
                  cy={barY}
                  r={Math.max(4, (compressionDia / 2.0) * scale)}
                  fill="#38bdf8"
                  stroke="#0284c7"
                  strokeWidth="1.5"
                />
              );
            })}
          </g>
        )}

        {/* 5. Tension Rebars (Bottom) */}
        {tensionCount > 0 && (
          <g>
            {/* If 1 layer */}
            {layers === 1 ? (
              Array.from({ length: tensionCount }).map((_, idx) => {
                const activeWidth = (sectionType === 't_beam' ? drawBw : drawB) - 40;
                const barX = originX - activeWidth / 2 + (idx / Math.max(1, tensionCount - 1)) * activeWidth;
                const barY = originY + d * scale;
                return (
                  <circle
                    key={`tens-${idx}`}
                    cx={barX}
                    cy={barY}
                    r={Math.max(4.5, (tensionDia / 2.0) * scale)}
                    fill="#ec4899"
                    stroke="#be185d"
                    strokeWidth="1.5"
                  />
                );
              })
            ) : (
              // 2 layers
              <>
                {Array.from({ length: Math.ceil(tensionCount / 2) }).map((_, idx) => {
                  const activeWidth = (sectionType === 't_beam' ? drawBw : drawB) - 40;
                  const countL1 = Math.ceil(tensionCount / 2);
                  const barX = originX - activeWidth / 2 + (idx / Math.max(1, countL1 - 1)) * activeWidth;
                  const barY = originY + drawH - 30;
                  return (
                    <circle
                      key={`tens-l1-${idx}`}
                      cx={barX}
                      cy={barY}
                      r={Math.max(4.5, (tensionDia / 2.0) * scale)}
                      fill="#ec4899"
                      stroke="#be185d"
                      strokeWidth="1.5"
                    />
                  );
                })}
                {Array.from({ length: Math.floor(tensionCount / 2) }).map((_, idx) => {
                  const activeWidth = (sectionType === 't_beam' ? drawBw : drawB) - 40;
                  const countL2 = Math.floor(tensionCount / 2);
                  const barX = originX - activeWidth / 2 + (idx / Math.max(1, countL2 - 1)) * activeWidth;
                  const barY = originY + drawH - 55;
                  return (
                    <circle
                      key={`tens-l2-${idx}`}
                      cx={barX}
                      cy={barY}
                      r={Math.max(4.5, (tensionDia / 2.0) * scale)}
                      fill="#ec4899"
                      stroke="#be185d"
                      strokeWidth="1.5"
                    />
                  );
                })}
              </>
            )}
          </g>
        )}

        {/* Legend */}
        <g transform={`translate(${originX - 140}, ${canvasHeight - 25})`}>
          <circle cx="0" cy="0" r="5" fill="#ec4899" />
          <text x="10" y="3" fill="#cbd5e1" fontSize="10">
            Tarik ({tensionCount}D{tensionDia})
          </text>

          {compressionCount > 0 && (
            <>
              <circle cx="120" cy="0" r="5" fill="#38bdf8" />
              <text x="130" y="3" fill="#cbd5e1" fontSize="10">
                Tekan ({compressionCount}D{compressionDia})
              </text>
            </>
          )}

          {a > 0 && (
            <>
              <rect x="220" y="-4" width="8" height="8" fill="#ef4444" fillOpacity="0.5" stroke="#ef4444" />
              <text x="234" y="3" fill="#cbd5e1" fontSize="10">
                Blok Tekan (a={a.toFixed(1)}mm)
              </text>
            </>
          )}
        </g>
      </svg>
    </div>
  );
};
