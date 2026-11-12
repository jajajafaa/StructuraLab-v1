import React, { useState } from 'react';
import {
  TrussNode,
  TrussMember,
  TrussNodeLoad,
  SupportType
} from '../types/structural';
import {
  Layers,
  Plus,
  Trash2,
  Anchor,
  GitCommit,
  ArrowDown,
  Sparkles,
  ChevronRight,
  ChevronDown,
  Cpu
} from 'lucide-react';

interface TrussModelExplorerProps {
  nodes: TrussNode[];
  onUpdateNodes: (nodes: TrussNode[]) => void;
  members: TrussMember[];
  onUpdateMembers: (members: TrussMember[]) => void;
  loads: TrussNodeLoad[];
  onUpdateLoads: (loads: TrussNodeLoad[]) => void;
  onRunAnalysis: () => void;
  onLoadPreset: (preset: 'warren' | 'pratt' | 'howe' | 'roof' | 'cantilever') => void;
}

const parseNum = (val: string | number, fallback = 0): number => {
  if (typeof val === 'number') return isNaN(val) ? fallback : val;
  const cleaned = String(val).replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? fallback : num;
};

export const TrussModelExplorer: React.FC<TrussModelExplorerProps> = ({
  nodes,
  onUpdateNodes,
  members,
  onUpdateMembers,
  loads,
  onUpdateLoads,
  onRunAnalysis,
  onLoadPreset
}) => {
  const [activeTab, setActiveTab] = useState<'nodes' | 'members' | 'loads' | 'presets'>('nodes');

  // Add node form state
  const [newX, setNewX] = useState<string>('0');
  const [newY, setNewY] = useState<string>('0');
  const [newSupport, setNewSupport] = useState<SupportType | 'none'>('none');

  // Add member form state
  const [memberStart, setMemberStart] = useState<string>('');
  const [memberEnd, setMemberEnd] = useState<string>('');
  const [memberArea, setMemberArea] = useState<string>('1500');

  // Add load form state
  const [loadNodeId, setLoadNodeId] = useState<string>('');
  const [loadFy, setLoadFy] = useState<string>('-20');
  const [loadFx, setLoadFx] = useState<string>('0');

  const handleAddNode = (e: React.FormEvent) => {
    e.preventDefault();
    const nextId = `node-${Date.now().toString(36)}`;
    const xNum = parseNum(newX, 0);
    const yNum = parseNum(newY, 0);
    const newNode: TrussNode = {
      id: nextId,
      x: xNum,
      y: yNum,
      support: newSupport === 'none' ? undefined : newSupport
    };
    onUpdateNodes([...nodes, newNode]);
    // increment x suggestion
    setNewX(String(Number((xNum + 2).toFixed(2))));
  };

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberStart || !memberEnd || memberStart === memberEnd) return;
    const exists = members.some(
      m =>
        (m.nodeStartId === memberStart && m.nodeEndId === memberEnd) ||
        (m.nodeStartId === memberEnd && m.nodeEndId === memberStart)
    );
    if (exists) return;

    const newMem: TrussMember = {
      id: `m-${Date.now().toString(36)}`,
      nodeStartId: memberStart,
      nodeEndId: memberEnd,
      E: 200000,
      A: parseNum(memberArea, 1500)
    };
    onUpdateMembers([...members, newMem]);
  };

  const handleAddLoad = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loadNodeId) return;
    const newLd: TrussNodeLoad = {
      id: `load-${Date.now().toString(36)}`,
      nodeId: loadNodeId,
      Fx: parseNum(loadFx, 0),
      Fy: parseNum(loadFy, 0)
    };
    onUpdateLoads([...loads, newLd]);
  };

  return (
    <div className="w-full h-full bg-[#0d1527] rounded-xl border border-slate-800 shadow-xl flex flex-col overflow-hidden text-xs text-slate-300">
      {/* Explorer Header */}
      <div className="bg-[#080d1a] border-b border-slate-800 p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          <h2 className="font-bold text-white uppercase tracking-wider text-[11px] font-mono">
            Model Explorer (2D Truss)
          </h2>
        </div>
        <span className="text-[10px] font-mono bg-cyan-950 text-cyan-400 px-1.5 py-0.5 rounded border border-cyan-800">
          2D TRUSS CAD
        </span>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-4 bg-[#0a0f1d] border-b border-slate-800 p-1 gap-1 text-[11px] font-medium">
        <button
          onClick={() => setActiveTab('nodes')}
          className={`py-1 rounded text-center transition ${
            activeTab === 'nodes' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:text-white'
          }`}
        >
          Buhul ({nodes.length})
        </button>
        <button
          onClick={() => setActiveTab('members')}
          className={`py-1 rounded text-center transition ${
            activeTab === 'members' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400 hover:text-white'
          }`}
        >
          Batang ({members.length})
        </button>
        <button
          onClick={() => setActiveTab('loads')}
          className={`py-1 rounded text-center transition ${
            activeTab === 'loads' ? 'bg-amber-600 text-white font-bold' : 'text-slate-400 hover:text-white'
          }`}
        >
          Beban ({loads.length})
        </button>
        <button
          onClick={() => setActiveTab('presets')}
          className={`py-1 rounded text-center transition ${
            activeTab === 'presets' ? 'bg-purple-600 text-white font-bold' : 'text-slate-400 hover:text-white'
          }`}
        >
          Preset
        </button>
      </div>

      {/* Tab Contents */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* TAB 1: NODES */}
        {activeTab === 'nodes' && (
          <div className="space-y-3">
            {/* Add Node Form */}
            <form onSubmit={handleAddNode} className="bg-slate-900/90 border border-slate-800 p-2.5 rounded-lg space-y-2">
              <span className="text-[11px] font-bold text-cyan-400 flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> Tambah Titik Buhul (Node)
              </span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 block">X (meter)</label>
                  <input
                    type="number"
                    step="any"
                    value={newX}
                    onChange={e => setNewX(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block">Y (meter)</label>
                  <input
                    type="number"
                    step="any"
                    value={newY}
                    onChange={e => setNewY(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white font-mono text-xs"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block">Tumpuan</label>
                <select
                  value={newSupport}
                  onChange={e => setNewSupport(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white font-mono text-xs"
                >
                  <option value="none">Bebas (Tidak ada tumpuan)</option>
                  <option value="pin">Sendi (Pin Support - 2 Reaksi)</option>
                  <option value="roller">Rol (Roller Support - 1 Reaksi)</option>
                </select>
              </div>
              <button
                type="submit"
                className="w-full py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition"
              >
                + Tambah Buhul
              </button>
            </form>

            {/* Nodes List */}
            <div className="space-y-1">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
                Daftar Titik Buhul ({nodes.length}):
              </span>
              {nodes.length === 0 ? (
                <p className="text-[11px] text-slate-500 italic p-2 text-center">Belum ada titik buhul.</p>
              ) : (
                nodes.map((n, idx) => (
                  <div
                    key={n.id}
                    className="flex items-center justify-between p-2 rounded bg-slate-900/60 border border-slate-800 hover:border-slate-700"
                  >
                    <div>
                      <span className="font-bold text-white font-mono">N{idx + 1}</span>
                      <span className="text-slate-400 font-mono text-[11px] ml-2">
                        ({n.x}m, {n.y}m)
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <select
                        value={n.support || 'none'}
                        onChange={e => {
                          const val = e.target.value;
                          const supp = val === 'none' ? undefined : (val as SupportType);
                          onUpdateNodes(nodes.map(item => item.id === n.id ? { ...item, support: supp } : item));
                        }}
                        className="bg-slate-950 text-cyan-300 border border-slate-700 rounded px-1.5 py-0.5 text-[10px] font-mono focus:border-cyan-400"
                        title="Ubah jenis tumpuan buhul"
                      >
                        <option value="none">Bebas</option>
                        <option value="pin">Sendi (Pin)</option>
                        <option value="roller">Rol (Roller)</option>
                      </select>
                      <button
                        onClick={() => onUpdateNodes(nodes.filter(item => item.id !== n.id))}
                        className="text-slate-500 hover:text-rose-400 p-0.5"
                        title="Hapus buhul"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 2: MEMBERS */}
        {activeTab === 'members' && (
          <div className="space-y-3">
            {/* Add Member Form */}
            <form onSubmit={handleAddMember} className="bg-slate-900/90 border border-slate-800 p-2.5 rounded-lg space-y-2">
              <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                <GitCommit className="w-3.5 h-3.5" /> Hubungkan Batang (Member)
              </span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 block">Buhul Awal</label>
                  <select
                    value={memberStart}
                    onChange={e => setMemberStart(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white font-mono text-xs"
                  >
                    <option value="">Pilih...</option>
                    {nodes.map((n, idx) => (
                      <option key={n.id} value={n.id}>
                        N{idx + 1} ({n.x}, {n.y})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block">Buhul Akhir</label>
                  <select
                    value={memberEnd}
                    onChange={e => setMemberEnd(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white font-mono text-xs"
                  >
                    <option value="">Pilih...</option>
                    {nodes.map((n, idx) => (
                      <option key={n.id} value={n.id}>
                        N{idx + 1} ({n.x}, {n.y})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block">Luas Penampang A (mm²)</label>
                <input
                  type="number"
                  step="any"
                  value={memberArea}
                  onChange={e => setMemberArea(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white font-mono text-xs"
                />
              </div>
              <button
                type="submit"
                disabled={!memberStart || !memberEnd}
                className="w-full py-1 rounded bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold text-xs transition"
              >
                + Hubungkan Batang
              </button>
            </form>

            {/* Members List */}
            <div className="space-y-1">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
                Daftar Batang ({members.length}):
              </span>
              {members.length === 0 ? (
                <p className="text-[11px] text-slate-500 italic p-2 text-center">Belum ada batang.</p>
              ) : (
                members.map((mem, idx) => {
                  const n1 = nodes.find(n => n.id === mem.nodeStartId);
                  const n2 = nodes.find(n => n.id === mem.nodeEndId);
                  const idx1 = nodes.findIndex(n => n.id === mem.nodeStartId) + 1;
                  const idx2 = nodes.findIndex(n => n.id === mem.nodeEndId) + 1;
                  const len = n1 && n2 ? Math.sqrt(Math.pow(n2.x - n1.x, 2) + Math.pow(n2.y - n1.y, 2)) : 0;

                  return (
                    <div
                      key={mem.id}
                      className="flex items-center justify-between p-2 rounded bg-slate-900/60 border border-slate-800 hover:border-slate-700 text-xs"
                    >
                      <div>
                        <span className="font-bold text-emerald-400 font-mono">M{idx + 1}</span>
                        <span className="text-slate-300 font-mono text-[11px] ml-2">
                          N{idx1} → N{idx2}
                        </span>
                        <span className="text-slate-500 font-mono text-[10px] ml-2">({len.toFixed(2)}m)</span>
                      </div>
                      <button
                        onClick={() => onUpdateMembers(members.filter(item => item.id !== mem.id))}
                        className="text-slate-500 hover:text-rose-400"
                        title="Hapus batang"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* TAB 3: LOADS */}
        {activeTab === 'loads' && (
          <div className="space-y-3">
            {/* Add Load Form */}
            <form onSubmit={handleAddLoad} className="bg-slate-900/90 border border-slate-800 p-2.5 rounded-lg space-y-2">
              <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1">
                <ArrowDown className="w-3.5 h-3.5" /> Beri Beban Titik Buhul
              </span>
              <div>
                <label className="text-[10px] text-slate-400 block">Titik Buhul Target</label>
                <select
                  value={loadNodeId}
                  onChange={e => setLoadNodeId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white font-mono text-xs"
                >
                  <option value="">Pilih buhul...</option>
                  {nodes.map((n, idx) => (
                    <option key={n.id} value={n.id}>
                      N{idx + 1} ({n.x}m, {n.y}m)
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 block">Fy (kN, negatif = bawah)</label>
                  <input
                    type="number"
                    step="any"
                    value={loadFy}
                    onChange={e => setLoadFy(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block">Fx (kN, positif = kanan)</label>
                  <input
                    type="number"
                    step="any"
                    value={loadFx}
                    onChange={e => setLoadFx(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white font-mono text-xs"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={!loadNodeId}
                className="w-full py-1 rounded bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold text-xs transition"
              >
                + Tambah Beban Buhul
              </button>
            </form>

            {/* Loads List */}
            <div className="space-y-1">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
                Daftar Beban Buhul ({loads.length}):
              </span>
              {loads.length === 0 ? (
                <p className="text-[11px] text-slate-500 italic p-2 text-center">Belum ada beban.</p>
              ) : (
                loads.map((ld, idx) => {
                  const nodeIndex = nodes.findIndex(n => n.id === ld.nodeId) + 1;
                  return (
                    <div
                      key={ld.id}
                      className="flex items-center justify-between p-2 rounded bg-slate-900/60 border border-slate-800 hover:border-slate-700 text-xs"
                    >
                      <div>
                        <span className="font-bold text-amber-400 font-mono">P{idx + 1}</span>
                        <span className="text-white font-mono text-[11px] ml-2">di N{nodeIndex}</span>
                        <span className="text-slate-400 font-mono text-[10px] ml-2">
                          Fy={ld.Fy}kN {ld.Fx ? `Fx=${ld.Fx}kN` : ''}
                        </span>
                      </div>
                      <button
                        onClick={() => onUpdateLoads(loads.filter(item => item.id !== ld.id))}
                        className="text-slate-500 hover:text-rose-400"
                        title="Hapus beban"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* TAB 4: PRESETS */}
        {activeTab === 'presets' && (
          <div className="space-y-2">
            <span className="text-[11px] font-mono text-purple-400 uppercase tracking-wider block font-bold">
              Koleksi Model Benchmark Rangka Batang:
            </span>
            <button
              onClick={() => onLoadPreset('warren')}
              className="w-full text-left p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500 transition"
            >
              <div className="font-bold text-white text-xs">Warren Truss (8m)</div>
              <div className="text-[10px] text-slate-400">4 panel bentang 8m, beban 20kN di buhul bawah</div>
            </button>
            <button
              onClick={() => onLoadPreset('pratt')}
              className="w-full text-left p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500 transition"
            >
              <div className="font-bold text-white text-xs">Pratt Truss (12m)</div>
              <div className="text-[10px] text-slate-400">6 panel bentang 12m, beban 30kN di titik buhul</div>
            </button>
            <button
              onClick={() => onLoadPreset('howe')}
              className="w-full text-left p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500 transition"
            >
              <div className="font-bold text-white text-xs">Howe Truss (12m)</div>
              <div className="text-[10px] text-slate-400">Diagonal miring ke tengah menahan gaya tekan</div>
            </button>
            <button
              onClick={() => onLoadPreset('roof')}
              className="w-full text-left p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500 transition"
            >
              <div className="font-bold text-white text-xs">Kuda-Kuda Atap Simetris</div>
              <div className="text-[10px] text-slate-400">Bentang 8m x tinggi 2m, beban gording 15kN</div>
            </button>
            <button
              onClick={() => onLoadPreset('cantilever')}
              className="w-full text-left p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500 transition"
            >
              <div className="font-bold text-white text-xs">Truss Kantilever (6m)</div>
              <div className="text-[10px] text-slate-400">Terjepit di sisi kiri, beban ujung 25kN</div>
            </button>
          </div>
        )}
      </div>

      {/* Bottom Run Action */}
      <div className="bg-[#080d1a] border-t border-slate-800 p-2.5">
        <button
          onClick={onRunAnalysis}
          className="w-full py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition"
        >
          <Cpu className="w-4 h-4 text-cyan-200" /> Run Truss Analysis (Titik Buhul)
        </button>
      </div>
    </div>
  );
};
