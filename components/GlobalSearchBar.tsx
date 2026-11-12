import React, { useState, useEffect, useRef, useMemo } from 'react';
import { DatabaseService } from '../services/db';
import { CalculationRecord } from '../types/auth';
import {
  Search,
  Compass,
  Layers,
  BookOpen,
  History,
  ArrowRight,
  X,
  Sliders,
  Wrench,
  CheckCircle2,
  FileText,
  CornerDownLeft,
  Command
} from 'lucide-react';

export type SearchCategory = 'all' | 'module' | 'doc' | 'record';

export interface SearchResultItem {
  id: string;
  category: 'module' | 'doc' | 'record';
  title: string;
  subtitle: string;
  badge: string;
  badgeColor: string;
  icon: React.ReactNode;
  keywords: string[];
  action: () => void;
}

interface GlobalSearchBarProps {
  onNavigate: (view: 'dashboard' | 'structural' | 'concrete' | 'history' | 'docs' | 'admin', params?: {
    structuralType?: 'beam' | 'truss';
    beamPreset?: string;
    concreteSubModule?: 'analysis' | 'design' | 'shear';
    concreteSectionType?: 'rectangular' | 't_beam' | 'l_beam';
    openRecord?: CalculationRecord;
  }) => void;
}

export const GlobalSearchBar: React.FC<GlobalSearchBarProps> = ({ onNavigate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<SearchCategory>('all');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Global Keyboard Shortcut: Ctrl + K or Cmd + K or "/"
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in another input/textarea
      const target = e.target as HTMLElement;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setIsOpen(prev => !prev);
      } else if (e.key === '/' && !isInput) {
        e.preventDefault();
        setIsOpen(true);
      } else if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    } else {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Read calculation records from DatabaseService dynamically
  const records = useMemo(() => {
    try {
      return DatabaseService.getCalculationRecords();
    } catch {
      return [];
    }
  }, [isOpen]);

  // Index of static engineering modules and documentation topics
  const searchableCatalog: SearchResultItem[] = useMemo(() => {
    const items: SearchResultItem[] = [
      // ================= MODULES =================
      {
        id: 'mod-beam-det',
        category: 'module',
        title: 'Analisis Balok Statis Tertentu (Determinate Beam)',
        subtitle: 'Perhitungan reaksi tumpuan sendi-rol, kantilever, overhang, beban titik, merata (UDL), dan segitiga.',
        badge: 'Modul Struktur',
        badgeColor: 'bg-cyan-950 text-cyan-300 border-cyan-700',
        icon: <Compass className="w-4 h-4 text-cyan-400" />,
        keywords: ['balok', 'beam', 'statis tertentu', 'sendi rol', 'kantilever', 'overhang', 'reaksi tumpuan', 'simple beam'],
        action: () => {
          onNavigate('structural', { structuralType: 'beam' });
          setIsOpen(false);
        }
      },
      {
        id: 'mod-cross-indet',
        category: 'module',
        title: 'Balok Statis Tak Tentu — Metode Cross (Moment Distribution)',
        subtitle: 'Analisis balok jepit-jepit, jepit-rol, dan balok menerus multi-bentang dengan rotasi dan distribusi momen.',
        badge: 'Metode Cross',
        badgeColor: 'bg-indigo-950 text-indigo-300 border-indigo-700',
        icon: <Sliders className="w-4 h-4 text-indigo-400" />,
        keywords: ['metode cross', 'cross', 'statis tak tentu', 'balok menerus', 'continuous beam', 'jepit jepit', 'jepit rol', 'indeterminate'],
        action: () => {
          onNavigate('structural', { structuralType: 'beam', beamPreset: 'continuous_2span' });
          setIsOpen(false);
        }
      },
      {
        id: 'mod-truss-2d',
        category: 'module',
        title: 'Analisis Rangka Batang 2D (2D Truss CAD)',
        subtitle: 'Pemodelan interaktif rangka batang, titik buhul (joints), tumpuan, beban titik, dan metode keseimbangan titik buhul.',
        badge: 'Truss CAD',
        badgeColor: 'bg-blue-950 text-blue-300 border-blue-700',
        icon: <Layers className="w-4 h-4 text-blue-400" />,
        keywords: ['rangka batang', 'truss', '2d truss', 'titik buhul', 'method of joints', 'gaya batang', 'warren', 'pratt', 'howe'],
        action: () => {
          onNavigate('structural', { structuralType: 'truss' });
          setIsOpen(false);
        }
      },
      {
        id: 'mod-sfd-bmd',
        category: 'module',
        title: 'Diagram Gaya Geser (SFD) & Momen Lentur (BMD)',
        subtitle: 'Visualisasi kurva gaya lintang V(x) dan momen lentur M(x), titik V=0, serta nilai ekstrim V maks dan M maks.',
        badge: 'Diagram V & M',
        badgeColor: 'bg-emerald-950 text-emerald-300 border-emerald-700',
        icon: <Compass className="w-4 h-4 text-emerald-400" />,
        keywords: ['sfd', 'bmd', 'gaya geser', 'momen lentur', 'diagram', 'shear force', 'bending moment', 'v maks', 'm maks'],
        action: () => {
          onNavigate('structural', { structuralType: 'beam' });
          setIsOpen(false);
        }
      },
      {
        id: 'mod-concrete-analysis',
        category: 'module',
        title: 'Analisis Kapasitas Lentur Balok Beton Bertulang (SNI 2847)',
        subtitle: 'Hitung kuat momen nominal Mn, momen rencana phiMn, regangan baja tarik epsilon_t, dan rasio tulangan rho.',
        badge: 'Analisis Beton',
        badgeColor: 'bg-indigo-950 text-indigo-300 border-indigo-700',
        icon: <Layers className="w-4 h-4 text-indigo-400" />,
        keywords: ['analisis lentur', 'kapasitas lentur', 'beton bertulang', 'phiMn', 'Mn', 'whitney', 'regangan baja', 'sni 2847'],
        action: () => {
          onNavigate('concrete', { concreteSubModule: 'analysis' });
          setIsOpen(false);
        }
      },
      {
        id: 'mod-concrete-design',
        category: 'module',
        title: 'Desain Kebutuhan Tulangan Lentur Balok (Singular & Doubly)',
        subtitle: 'Perhitungan kebutuhan luas tulangan baja As, rekomendasi jumlah batang D10–D36, dan cek tulangan rangkap.',
        badge: 'Desain Lentur',
        badgeColor: 'bg-cyan-950 text-cyan-300 border-cyan-700',
        icon: <Wrench className="w-4 h-4 text-cyan-400" />,
        keywords: ['desain lentur', 'tulangan tarik', 'tulangan rangkap', 'luas tulangan', 'as perlu', 'rebar', 'jumlah tulangan'],
        action: () => {
          onNavigate('concrete', { concreteSubModule: 'design' });
          setIsOpen(false);
        }
      },
      {
        id: 'mod-concrete-tbeam',
        category: 'module',
        title: 'Desain Balok Penampang Sayap T & L (Flanged Beam)',
        subtitle: 'Analisis balok T dan balok L dengan lebar sayap efektif be, tebal pelat hf, dan kasus a <= hf atau a > hf.',
        badge: 'Balok T & L',
        badgeColor: 'bg-indigo-950 text-indigo-300 border-indigo-700',
        icon: <Layers className="w-4 h-4 text-indigo-400" />,
        keywords: ['balok t', 'balok l', 'flanged beam', 't beam', 'l beam', 'lebar sayap', 'tebal slab'],
        action: () => {
          onNavigate('concrete', { concreteSubModule: 'design', concreteSectionType: 't_beam' });
          setIsOpen(false);
        }
      },
      {
        id: 'mod-concrete-shear',
        category: 'module',
        title: 'Desain Tulangan Geser & Sengkang (Stirrup Design)',
        subtitle: 'Kuat geser beton nominal Vc, tahanan geser sengkang Vs, spasi sengkang daerah kritis tumpuan dan lapangan.',
        badge: 'Desain Geser',
        badgeColor: 'bg-rose-950 text-rose-300 border-rose-700',
        icon: <Wrench className="w-4 h-4 text-rose-400" />,
        keywords: ['sengkang', 'stirrup', 'tulangan geser', 'shear design', 'vc', 'vs', 'spasi sengkang', 'geser balok'],
        action: () => {
          onNavigate('concrete', { concreteSubModule: 'shear' });
          setIsOpen(false);
        }
      },

      // ================= DOCUMENTATION & SNI FORMULAS =================
      {
        id: 'doc-bab3',
        category: 'doc',
        title: 'Bab 3: Teori Analisis Lentur Balok Beton (Agus Setiawan)',
        subtitle: 'Asumsi blok tegangan ekuivalen Whitney, rasio tulangan seimbang rho_b, batas daktilitas tarik, dan faktor reduksi phi.',
        badge: 'Dokumentasi SNI',
        badgeColor: 'bg-purple-950 text-purple-300 border-purple-700',
        icon: <BookOpen className="w-4 h-4 text-purple-400" />,
        keywords: ['bab 3', 'whitney', 'analisis lentur', 'buku agus setiawan', 'rho balance', 'daktilitas', 'regangan'],
        action: () => {
          onNavigate('docs');
          setIsOpen(false);
        }
      },
      {
        id: 'doc-bab4',
        category: 'doc',
        title: 'Bab 4: Prosedur Desain Tulangan Lentur (Agus Setiawan)',
        subtitle: 'Indeks ketahanan momen Ru, perhitungan luas tulangan As = rho*b*d, spasi bersih min 25 mm, dan tebal selimut 40 mm.',
        badge: 'Dokumentasi SNI',
        badgeColor: 'bg-purple-950 text-purple-300 border-purple-700',
        icon: <BookOpen className="w-4 h-4 text-purple-400" />,
        keywords: ['bab 4', 'desain lentur', 'indeks tahanan', 'ru', 'selimut beton', 'spasi tulangan'],
        action: () => {
          onNavigate('docs');
          setIsOpen(false);
        }
      },
      {
        id: 'doc-bab5',
        category: 'doc',
        title: 'Bab 5: Landasan Desain Tulangan Geser (SNI 2847:2013)',
        subtitle: 'Formula kuat geser beton Vc = 0.17*lambda*sqrt(fc)*bw*d, tahanan sengkang Vs, batas spasi s_maks = min(d/2, 600mm).',
        badge: 'Dokumentasi SNI',
        badgeColor: 'bg-purple-950 text-purple-300 border-purple-700',
        icon: <BookOpen className="w-4 h-4 text-purple-400" />,
        keywords: ['bab 5', 'rumus geser', 'vc', 'vs', 'spasi sengkang', 'sni 2847 2013'],
        action: () => {
          onNavigate('docs');
          setIsOpen(false);
        }
      },
      {
        id: 'doc-sni-2847',
        category: 'doc',
        title: 'Standar Acuan Resmi: SNI 2847:2013 & Erlangga 2016',
        subtitle: 'Persyaratan beton struktural untuk bangunan gedung Indonesia dan implementasi komputasi numerik deterministik.',
        badge: 'Standar Nasional',
        badgeColor: 'bg-amber-950 text-amber-300 border-amber-700',
        icon: <BookOpen className="w-4 h-4 text-amber-400" />,
        keywords: ['sni', 'sni 2847:2013', 'erlangga', 'agus setiawan', 'standar nasional', 'spesifikasi'],
        action: () => {
          onNavigate('docs');
          setIsOpen(false);
        }
      }
    ];

    // ================= DYNAMIC CALCULATION RECORDS =================
    records.forEach(rec => {
      const isConcrete = rec.category === 'concrete_design' || rec.category === 'shear_design';
      items.push({
        id: `rec-${rec.id}`,
        category: 'record',
        title: rec.title,
        subtitle: `${rec.summary} (${new Date(rec.timestamp).toLocaleDateString('id-ID')})`,
        badge: rec.status === 'safe' ? 'Aman / Safe' : rec.status === 'analyzed' ? 'Dianalisis' : 'Perlu Evaluasi',
        badgeColor: rec.status === 'safe'
          ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
          : rec.status === 'analyzed'
          ? 'bg-cyan-950 text-cyan-300 border-cyan-700'
          : 'bg-amber-950 text-amber-300 border-amber-700',
        icon: <History className="w-4 h-4 text-emerald-400" />,
        keywords: [
          rec.title,
          rec.summary,
          rec.standard,
          rec.subType,
          rec.category,
          'riwayat',
          'history',
          'perhitungan',
          'kalkulasi'
        ],
        action: () => {
          if (isConcrete) {
            onNavigate('concrete', { openRecord: rec });
          } else {
            onNavigate('structural', { openRecord: rec });
          }
          setIsOpen(false);
        }
      });
    });

    return items;
  }, [records, onNavigate]);

  // Filtered results based on query & active tab
  const filteredResults = useMemo(() => {
    let list = searchableCatalog;

    if (activeCategory !== 'all') {
      list = list.filter(item => item.category === activeCategory);
    }

    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery) {
      // If query is empty, show all items (prioritizing modules, then docs, then recent records)
      return list.slice(0, 10);
    }

    const queryWords = cleanQuery.split(/\s+/).filter(Boolean);

    return list
      .filter(item => {
        const textToSearch = `${item.title} ${item.subtitle} ${item.keywords.join(' ')}`.toLowerCase();
        return queryWords.every(word => textToSearch.includes(word));
      })
      .slice(0, 15);
  }, [searchableCatalog, query, activeCategory]);

  // Adjust selected index on query/filter changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query, activeCategory]);

  // Handle keyboard navigation inside the list
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % (filteredResults.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + (filteredResults.length || 1)) % (filteredResults.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredResults[selectedIndex]) {
        filteredResults[selectedIndex].action();
      }
    }
  };

  const getCategoryLabel = (cat: 'module' | 'doc' | 'record') => {
    if (cat === 'module') return 'MODUL';
    if (cat === 'doc') return 'DOKUMEN';
    return 'RIWAYAT';
  };

  return (
    <div className="relative" ref={containerRef}>
      {/* Search Input Trigger in Navbar - 100% Solid background */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-2xl bg-[#131b2a] hover:bg-[#1a2538] border border-slate-700 hover:border-slate-500 text-xs text-slate-200 hover:text-white transition-all group w-44 sm:w-60 md:w-68 lg:w-76 shadow-md"
        title="Cari modul rekayasa, rumus SNI, atau riwayat perhitungan (Ctrl+K)"
      >
        <Search className="w-3.5 h-3.5 text-slate-400 group-hover:text-sky-400 transition-colors" />
        <span className="truncate flex-1 text-left text-slate-300 group-hover:text-white">
          Cari modul, rumus, riwayat...
        </span>
        <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono bg-[#1c2638] text-slate-300 rounded-md border border-slate-600 group-hover:border-slate-400">
          <span className="text-[10px]">⌘</span>K
        </kbd>
      </button>

      {/* Global Search Command-Palette Modal / Dropdown */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-[#060a12]/90 backdrop-blur-sm flex items-start justify-center p-3 sm:p-6 md:p-12 animate-in fade-in duration-150">
          <div
            className="border-2 border-slate-700 rounded-3xl max-w-2xl w-full shadow-[0_25px_60px_-15px_rgba(0,0,0,0.95)] overflow-hidden flex flex-col max-h-[85vh] text-white animate-in zoom-in-95 duration-150 bg-[#0f172a]"
            onClick={e => e.stopPropagation()}
          >
            {/* Top Search Input Row - 100% Solid */}
            <div className="p-4 border-b border-slate-700 flex items-center gap-3 bg-[#162032]">
              <Search className="w-5 h-5 text-sky-400 shrink-0 ml-1" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Cari modul (balok, truss, beton), bab SNI, atau riwayat kalkulasi..."
                className="w-full bg-transparent text-sm sm:text-base text-white placeholder-slate-400 focus:outline-none font-sans"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition"
                  title="Hapus pencarian"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="px-2.5 py-1 rounded-xl bg-[#222e44] hover:bg-[#2c3b57] text-slate-200 hover:text-white text-xs font-mono transition border border-slate-600"
              >
                ESC
              </button>
            </div>

            {/* Category Filter Segmented Dock - 100% Solid */}
            <div className="px-4 py-2.5 border-b border-slate-700 bg-[#0b101b] flex items-center gap-2 overflow-x-auto text-xs">
              <button
                onClick={() => setActiveCategory('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition border ${
                  activeCategory === 'all'
                    ? 'bg-white text-slate-950 font-bold border-white shadow-md'
                    : 'bg-[#151e2e] text-slate-300 border-slate-700 hover:bg-[#1e2a40] hover:text-white'
                }`}
              >
                Semua ({searchableCatalog.length})
              </button>
              <button
                onClick={() => setActiveCategory('module')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition border flex items-center gap-1.5 ${
                  activeCategory === 'module'
                    ? 'bg-white text-slate-950 font-bold border-white shadow-md'
                    : 'bg-[#151e2e] text-slate-300 border-slate-700 hover:bg-[#1e2a40] hover:text-white'
                }`}
              >
                <Compass className="w-3.5 h-3.5" />
                <span>Modul ({searchableCatalog.filter(i => i.category === 'module').length})</span>
              </button>
              <button
                onClick={() => setActiveCategory('doc')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition border flex items-center gap-1.5 ${
                  activeCategory === 'doc'
                    ? 'bg-white text-slate-950 font-bold border-white shadow-md'
                    : 'bg-[#151e2e] text-slate-300 border-slate-700 hover:bg-[#1e2a40] hover:text-white'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Dokumentasi ({searchableCatalog.filter(i => i.category === 'doc').length})</span>
              </button>
              <button
                onClick={() => setActiveCategory('record')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition border flex items-center gap-1.5 ${
                  activeCategory === 'record'
                    ? 'bg-white text-slate-950 font-bold border-white shadow-md'
                    : 'bg-[#151e2e] text-slate-300 border-slate-700 hover:bg-[#1e2a40] hover:text-white'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>Riwayat ({records.length})</span>
              </button>
            </div>

            {/* Results List - 100% Solid */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5 divide-y divide-slate-800 bg-[#0f172a]">
              {filteredResults.length === 0 ? (
                <div className="py-12 px-4 text-center space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-[#162032] border border-slate-700 flex items-center justify-center mx-auto text-slate-400">
                    <Search className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-white text-sm">Tidak ada hasil yang cocok</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Coba gunakan kata kunci umum seperti: <code className="text-sky-400">balok</code>, <code className="text-sky-400">truss</code>, <code className="text-sky-400">sengkang</code>, <code className="text-sky-400">cross</code>, atau <code className="text-sky-400">bab 3</code>.
                  </p>
                </div>
              ) : (
                filteredResults.map((item, index) => {
                  const isSelected = index === selectedIndex;
                  return (
                    <div
                      key={item.id}
                      onClick={item.action}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={`p-3 rounded-2xl cursor-pointer transition-all flex items-start justify-between gap-3 ${
                        isSelected
                          ? 'bg-[#1e2d46] border-2 border-sky-400 text-white shadow-xl'
                          : 'bg-[#141c2b] border border-slate-800 hover:bg-[#192437] hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div
                          className={`p-2 rounded-xl mt-0.5 shrink-0 border transition ${
                            isSelected ? 'bg-white text-slate-950 border-white' : 'bg-[#1d273a] text-slate-200 border-slate-700'
                          }`}
                        >
                          {item.icon}
                        </div>

                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[9px] font-mono font-bold tracking-wider uppercase px-1.5 py-0.5 rounded-md bg-[#222e44] text-slate-200 border border-slate-700">
                              {getCategoryLabel(item.category)}
                            </span>
                            <span className="font-semibold text-sm text-white">
                              {item.title}
                            </span>
                          </div>

                          <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                            {item.subtitle}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-lg border ${item.badgeColor}`}>
                          {item.badge}
                        </span>
                        {isSelected && (
                          <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono text-sky-300">
                            Buka <CornerDownLeft className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer Shortcut Hints - 100% Solid */}
            <div className="p-3 px-5 bg-[#0b101b] border-t border-slate-700 flex flex-wrap items-center justify-between text-[11px] text-slate-400 font-mono gap-2">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-[#1e2a3e] rounded-md border border-slate-600 text-slate-200">↑</kbd>
                  <kbd className="px-1.5 py-0.5 bg-[#1e2a3e] rounded-md border border-slate-600 text-slate-200">↓</kbd>
                  <span>Pilih</span>
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-[#1e2a3e] rounded-md border border-slate-600 text-slate-200">↵</kbd>
                  <span>Buka Modul</span>
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-[#1e2a3e] rounded-md border border-slate-600 text-slate-200">ESC</kbd>
                  <span>Tutup</span>
                </span>
              </div>
              <span className="text-slate-400 tabular-nums">
                {filteredResults.length} hasil ditemukan
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
