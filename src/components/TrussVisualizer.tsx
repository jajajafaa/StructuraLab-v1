import React from 'react';
import { TrussNode, TrussMember, TrussAnalysisResult, TrussNodeLoad } from '../types/structural';

interface TrussVisualizerProps {
  nodes: TrussNode[];
  members: TrussMember[];
  loads: TrussNodeLoad[];
  result?: TrussAnalysisResult;
}

export const TrussVisualizer: React.FC<TrussVisualizerProps> = ({
  nodes,
  members,
  loads,
  result
}) => {
  const width = 760;
  const height = 300;
  const padX = 60;
  const padY = 50;

  // Find min/max coordinates
  let minX = 0;
  let maxX = 1;
  let minY = 0;
  let maxY = 1;

  if (nodes.length > 0) {
    minX = Math.min(...nodes.map(n => n.x));
    maxX = Math.max(...nodes.map(n => n.x));
    minY = Math.min(...nodes.map(n => n.y));
    maxY = Math.max(...nodes.map(n => n.y));
  }

  const rangeX = Math.max(1, maxX - minX);
  const rangeY = Math.max(1, maxY - minY);

  const usableW = width - 2 * padX;
  const usableH = height - 2 * padY;

  const toCanvasX = (x: number) => padX + ((x - minX) / rangeX) * usableW;
  const toCanvasY = (y: number) => height - padY - ((y - minY) / rangeY) * usableH;

  return (
    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 shadow-xl overflow-x-auto">
      <div className="flex items-center justify-between text-xs text-slate-400 mb-2 font-mono">
        <span className="text-cyan-400 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
          2D Truss System Visualizer ({nodes.length} Buhul, {members.length} Batang)
        </span>
        <div className="flex gap-4">
          <span className="text-emerald-400 flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Tarik (Tension)
          </span>
          <span className="text-rose-400 flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Tekan (Compression)
          </span>
        </div>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto min-w-[650px] select-none font-sans">
        <defs>
          <marker id="trussLoadArrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#f59e0b" />
          </marker>
        </defs>

        {/* 1. Members */}
        {members.map(mem => {
          const n1 = nodes.find(n => n.id === mem.nodeStartId);
          const n2 = nodes.find(n => n.id === mem.nodeEndId);
          if (!n1 || !n2) return null;

          const x1 = toCanvasX(n1.x);
          const y1 = toCanvasY(n1.y);
          const x2 = toCanvasX(n2.x);
          const y2 = toCanvasY(n2.y);

          // Find force from result
          const forceObj = result?.memberForces.find(mf => mf.memberId === mem.id);
          const isTension = forceObj?.type === 'Tension';
          const isCompression = forceObj?.type === 'Compression';

          const strokeColor = isTension ? '#10b981' : isCompression ? '#ef4444' : '#64748b';
          const strokeW = isTension || isCompression ? '2.5' : '1.5';

          const midX = (x1 + x2) / 2;
          const midY = (y1 + y2) / 2;

          return (
            <g key={mem.id}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={strokeColor} strokeWidth={strokeW} />
              {forceObj && (
                <text x={midX} y={midY - 4} fill={strokeColor} fontSize="9" fontWeight="bold" textAnchor="middle">
                  {Math.abs(forceObj.force).toFixed(1)} kN ({isTension ? 'T' : isCompression ? 'C' : '0'})
                </text>
              )}
            </g>
          );
        })}

        {/* 2. Loads */}
        {loads.map(load => {
          const targetNode = nodes.find(n => n.id === load.nodeId);
          if (!targetNode) return null;
          const nx = toCanvasX(targetNode.x);
          const ny = toCanvasY(targetNode.y);

          return (
            <g key={load.id}>
              {load.Fy !== 0 && (
                <g>
                  <line
                    x1={nx}
                    y1={ny - (load.Fy < 0 ? 35 : -35)}
                    x2={nx}
                    y2={ny}
                    stroke="#f59e0b"
                    strokeWidth="2"
                    markerEnd="url(#trussLoadArrow)"
                  />
                  <text x={nx + 8} y={ny - 20} fill="#f59e0b" fontSize="10" fontWeight="bold">
                    {Math.abs(load.Fy)} kN
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* 3. Nodes */}
        {nodes.map(n => {
          const cx = toCanvasX(n.x);
          const cy = toCanvasY(n.y);

          return (
            <g key={n.id}>
              {/* Supports representation */}
              {n.support === 'pin' && (
                <polygon points={`${cx},${cy} ${cx - 10},${cy + 16} ${cx + 10},${cy + 16}`} fill="#0284c7" />
              )}
              {n.support === 'roller' && (
                <g>
                  <polygon points={`${cx},${cy} ${cx - 8},${cy + 12} ${cx + 8},${cy + 12}`} fill="#0284c7" />
                  <circle cx={cx - 4} cy={cy + 16} r="2.5" fill="#94a3b8" />
                  <circle cx={cx + 4} cy={cy + 16} r="2.5" fill="#94a3b8" />
                </g>
              )}

              <circle cx={cx} cy={cy} r="4.5" fill="#38bdf8" stroke="#0f172a" strokeWidth="1.5" />
              <text x={cx} y={cy - 8} fill="#f8fafc" fontSize="10" fontWeight="bold" textAnchor="middle">
                {n.id}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};
