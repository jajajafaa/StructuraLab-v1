import React, { useState } from 'react';
import { UserProfile } from './types/auth';
import { AuthService } from './services/db';
import { AuthModal } from './components/AuthModal';
import { AdminDashboard } from './components/AdminDashboard';
import { ConcreteDesignModule } from './components/ConcreteDesignModule';
import { StructuralAnalysisModule } from './components/StructuralAnalysisModule';
import { HistoryView } from './components/HistoryView';
import { DocumentationView } from './components/DocumentationView';
import { GlobalSearchBar } from './components/GlobalSearchBar';
import { UnitToggle } from './components/UnitToggle';
import { ConcreteSectionType } from './types/concrete';
import {
  Layers,
  Compass,
  History,
  BookOpen,
  LogOut,
  ShieldCheck,
  User,
  ArrowRight,
  Calculator,
  ChevronRight,
  Building2,
  Workflow,
  Sparkles,
  Activity,
  Key,
  Lock,
  Unlock,
  X
} from 'lucide-react';

const STORAGE_OWNER_AUTH_KEY = 'structuralab_owner_unlocked';
const OWNER_SECRET_PIN = 'admin2026';

export function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile>(AuthService.getCurrentUser());
  const [activeView, setActiveView] = useState<'dashboard' | 'structural' | 'concrete' | 'history' | 'docs' | 'admin'>('dashboard');

  // Global search navigation target states
  const [structuralInitialType, setStructuralInitialType] = useState<'beam' | 'truss' | undefined>(undefined);
  const [beamInitialPreset, setBeamInitialPreset] = useState<string | undefined>(undefined);
  const [concreteInitialSubModule, setConcreteInitialSubModule] = useState<'analysis' | 'design' | 'shear' | undefined>(undefined);
  const [concreteInitialSectionType, setConcreteInitialSectionType] = useState<ConcreteSectionType | undefined>(undefined);

  const handleGlobalSearchNavigate = (view: 'dashboard' | 'structural' | 'concrete' | 'history' | 'docs' | 'admin', params?: any) => {
    if (params?.structuralType) setStructuralInitialType(params.structuralType);
    if (params?.beamPreset) setBeamInitialPreset(params.beamPreset);
    if (params?.concreteSubModule) setConcreteInitialSubModule(params.concreteSubModule);
    if (params?.concreteSectionType) setConcreteInitialSectionType(params.concreteSectionType);
    setActiveView(view);
  };

  // Owner Mode Authentication State (Hidden from general visitors)
  const [isOwnerUnlocked, setIsOwnerUnlocked] = useState<boolean>(() => {
    return localStorage.getItem(STORAGE_OWNER_AUTH_KEY) === 'true';
  });
  const [showOwnerModal, setShowOwnerModal] = useState<boolean>(false);
  const [ownerPinInput, setOwnerPinInput] = useState<string>('');
  const [ownerPinError, setOwnerPinError] = useState<string | null>(null);

  // Logo secret 3-click tracker
  const logoClickCountRef = React.useRef<number>(0);
  const logoClickTimerRef = React.useRef<any>(null);

  // Check URL parameter (?owner=admin2026 or ?admin=true) on initial mount
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const ownerParam = urlParams.get('owner') || urlParams.get('admin');
      if (ownerParam && (ownerParam.toLowerCase() === OWNER_SECRET_PIN.toLowerCase() || ownerParam === 'true')) {
        localStorage.setItem(STORAGE_OWNER_AUTH_KEY, 'true');
        setIsOwnerUnlocked(true);
        const adm = AuthService.switchToAdmin();
        setCurrentUser(adm);
        setActiveView('admin');
        // Clean URL cleanly without reload
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
      }
    }
  }, []);

  // Keyboard shortcut listener (Ctrl + Shift + A) to toggle secret owner access
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey && e.shiftKey && (e.key === 'A' || e.key === 'a')) || (e.altKey && (e.key === 'a' || e.key === 'A'))) {
        e.preventDefault();
        setShowOwnerModal(prev => !prev);
        setOwnerPinError(null);
        setOwnerPinInput('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleLogoClick = () => {
    setActiveView('dashboard');
    logoClickCountRef.current += 1;
    if (logoClickTimerRef.current) clearTimeout(logoClickTimerRef.current);

    if (logoClickCountRef.current >= 3) {
      logoClickCountRef.current = 0;
      setShowOwnerModal(true);
      setOwnerPinError(null);
      setOwnerPinInput('');
    } else {
      logoClickTimerRef.current = setTimeout(() => {
        logoClickCountRef.current = 0;
      }, 1500);
    }
  };

  const handleVerifyOwnerPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (ownerPinInput.trim() === OWNER_SECRET_PIN || ownerPinInput.trim() === 'admin123') {
      localStorage.setItem(STORAGE_OWNER_AUTH_KEY, 'true');
      setIsOwnerUnlocked(true);
      setShowOwnerModal(false);
      setOwnerPinError(null);
      const adm = AuthService.switchToAdmin();
      setCurrentUser(adm);
      setActiveView('admin');
    } else {
      setOwnerPinError('PIN salah! Akses khusus pemilik ditolak.');
    }
  };

  const handleLockOwnerMode = () => {
    localStorage.removeItem(STORAGE_OWNER_AUTH_KEY);
    setIsOwnerUnlocked(false);
    const guest = AuthService.switchToUser();
    setCurrentUser(guest);
    setActiveView('dashboard');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Top Navbar - 100% Solid */}
      <header className="sticky top-0 z-40 bg-[#090d16] border-b border-slate-800 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
          {/* Logo & Brand (Secret 3-Click Trigger for Owner) */}
          <div
            onClick={handleLogoClick}
            className="flex items-center gap-3 cursor-pointer group shrink-0"
            title="StructuraLab — Analyze. Design. Understand."
          >
            <div className="w-10 h-10 rounded-2xl bg-[#131d2e] border border-slate-700 p-0.5 shadow-lg group-hover:border-slate-500 transition-all flex items-center justify-center">
              <Layers className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <div className="font-extrabold text-lg tracking-tight text-white flex items-center gap-1">
                Structura<span className="text-cyan-400">Lab</span>
              </div>
              <div className="text-[10px] font-mono text-slate-400 hidden xl:block">
                Analyze · Design · Understand
              </div>
            </div>
          </div>

          {/* GLOBAL SEARCH BAR */}
          <div className="flex-1 max-w-xs sm:max-w-sm md:max-w-md lg:max-w-xs xl:max-w-sm">
            <GlobalSearchBar onNavigate={handleGlobalSearchNavigate} />
          </div>

          {/* Nav links - Solid Dock */}
          <nav className="hidden lg:inline-flex items-center p-1 rounded-2xl bg-[#0f172a] border border-slate-800 text-xs font-medium shrink-0">
            <button
              onClick={() => setActiveView('dashboard')}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                activeView === 'dashboard'
                  ? 'bg-white text-slate-950 font-bold shadow-md shadow-white/10'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setActiveView('structural')}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                activeView === 'structural'
                  ? 'bg-white text-slate-950 font-bold shadow-md shadow-white/10'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Structural Analysis
            </button>
            <button
              onClick={() => setActiveView('concrete')}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                activeView === 'concrete'
                  ? 'bg-white text-slate-950 font-bold shadow-md shadow-white/10'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Reinforced Concrete
            </button>
            <button
              onClick={() => setActiveView('history')}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                activeView === 'history'
                  ? 'bg-white text-slate-950 font-bold shadow-md shadow-white/10'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              History
            </button>
            <button
              onClick={() => setActiveView('docs')}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                activeView === 'docs'
                  ? 'bg-white text-slate-950 font-bold shadow-md shadow-white/10'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Documentation
            </button>

            {/* ONLY VISIBLE TO THE OWNER (HIDDEN FROM GENERAL VISITORS) */}
            {isOwnerUnlocked && (
              <button
                onClick={() => {
                  const adm = AuthService.switchToAdmin();
                  setCurrentUser(adm);
                  setActiveView('admin');
                }}
                className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
                  activeView === 'admin'
                    ? 'bg-cyan-400 text-slate-950 font-bold shadow-md'
                    : 'text-cyan-400 hover:bg-cyan-950/40'
                }`}
                title="Panel Khusus Pemilik: Memantau siapa saja yang mengunjungi dan menggunakan website"
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Monitoring Pengunjung</span>
              </button>
            )}
          </nav>

          {/* Global Unit System Switcher */}
          <div className="hidden sm:flex items-center">
            <UnitToggle />
          </div>

          {/* User Session Area */}
          {isOwnerUnlocked && (
            <div className="flex items-center gap-2.5">
              <button
                onClick={handleLockOwnerMode}
                className="px-2.5 py-1.5 rounded-xl text-xs font-medium border bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border-rose-800/80 transition flex items-center gap-1.5 shadow-sm"
                title="Kunci kembali agar tampilan kembali seperti pengunjung umum"
              >
                <Lock className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Kunci Pemilik</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content View Switcher */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {activeView === 'dashboard' && (
          <div className="space-y-8 animate-in fade-in duration-200">
            {/* Hero Welcome - Spatial Glass Slab */}
            <div className="relative overflow-hidden rounded-3xl glass-slab p-8 sm:p-10 shadow-2xl border border-white/[0.08]">
              <div className="relative z-10 max-w-3xl space-y-3">
                <div className="text-[11px] font-mono tracking-wider text-cyan-400 uppercase font-semibold">
                  Civil Engineering Workspace · SNI 2847:2013 & Classical Mechanics
                </div>
                <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
                  Welcome to <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-300 to-indigo-200">StructuraLab</span>
                </h1>
                <p className="text-base text-slate-300 leading-relaxed font-normal">
                  "Your Engineering Calculation Workspace" — Platform terintegrasi perhitungan mekanika teknik, analisis struktur statis tertentu & tak tentu, serta perancangan elemen beton bertulang SNI 2847:2013 dengan penjabaran matematis transparan.
                </p>
              </div>

              {/* Background architectural grid illustration */}
              <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10 pointer-events-none hidden lg:block">
                <svg className="w-full h-full" viewBox="0 0 100 100" fill="none" stroke="currentColor">
                  <path d="M0,0 L100,100 M20,0 L100,80 M40,0 L100,60 M60,0 L100,40 M80,0 L100,20" strokeWidth="0.5" />
                  <path d="M0,20 L80,100 M0,40 L60,100 M0,60 L40,100 M0,80 L20,100" strokeWidth="0.5" />
                </svg>
              </div>
            </div>

            {/* TWO PRIMARY MODULE CARDS - Spatial Glass Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* CARD 1: STRUCTURAL ANALYSIS */}
              <div
                onClick={() => setActiveView('structural')}
                className="group relative glass-card hover:bg-slate-900/70 border border-white/[0.08] hover:border-cyan-500/40 rounded-3xl p-8 shadow-xl transition-all duration-300 hover:shadow-2xl hover:shadow-cyan-950/30 cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-white/[0.06] border border-white/10 flex items-center justify-center text-cyan-400 mb-6 group-hover:border-cyan-400/40 transition-colors shadow-md">
                    <Compass className="w-6 h-6" />
                  </div>
                  <div className="text-[11px] font-mono font-semibold text-cyan-400 uppercase tracking-wider mb-1">
                    Modul 01
                  </div>
                  <h3 className="text-2xl font-bold text-white group-hover:text-cyan-300 transition-colors">
                    Structural Analysis
                  </h3>
                  <p className="text-sm text-slate-300 mt-2.5 leading-relaxed font-normal">
                    Analisis sistem balok kontinu, portal 2D, rangka batang (*truss*), beban merata dan segitiga, metode Cross otomatis untuk struktur statis tak tentu, serta diagram SFD dan BMD interaktif.
                  </p>
                </div>

                <div className="mt-8 pt-6 border-t border-white/[0.06] flex items-center justify-between">
                  <span className="text-xs font-bold text-cyan-400 tracking-wide group-hover:underline">
                    Buka Structural Analysis
                  </span>
                  <div className="w-8 h-8 rounded-full bg-white/10 group-hover:bg-cyan-500 text-white group-hover:text-slate-950 flex items-center justify-center transition-colors">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {/* CARD 2: REINFORCED CONCRETE DESIGN */}
              <div
                onClick={() => setActiveView('concrete')}
                className="group relative glass-card hover:bg-slate-900/70 border border-white/[0.08] hover:border-indigo-500/40 rounded-3xl p-8 shadow-xl transition-all duration-300 hover:shadow-2xl hover:shadow-indigo-950/30 cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-white/[0.06] border border-white/10 flex items-center justify-center text-indigo-400 mb-6 group-hover:border-indigo-400/40 transition-colors shadow-md">
                    <Layers className="w-6 h-6" />
                  </div>
                  <div className="text-[11px] font-mono font-semibold text-indigo-400 uppercase tracking-wider mb-1">
                    Modul 02
                  </div>
                  <h3 className="text-2xl font-bold text-white group-hover:text-indigo-300 transition-colors">
                    Reinforced Concrete Design
                  </h3>
                  <p className="text-sm text-slate-300 mt-2.5 leading-relaxed font-normal">
                    Perancangan elemen beton bertulang SNI 2847:2013 & referensi Agus Setiawan. Analisis & desain lentur balok persegi tunggal, rangkap, balok T & L, serta sengkang geser.
                  </p>
                </div>

                <div className="mt-8 pt-6 border-t border-white/[0.06] flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-400 tracking-wide group-hover:underline">
                    Buka Concrete Calculator
                  </span>
                  <div className="w-8 h-8 rounded-full bg-white/10 group-hover:bg-indigo-500 text-white group-hover:text-slate-950 flex items-center justify-center transition-colors">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Feature Highlights */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="glass-card p-5 rounded-2xl border border-white/[0.06] flex items-start gap-3">
                <Workflow className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-white text-sm">Langkah Perhitungan Transparan</h4>
                  <p className="text-slate-400 mt-1 leading-relaxed">Rumus, substitusi angka, dan logika mekanika dijabarkan langkah demi langkah tanpa kotak misteri.</p>
                </div>
              </div>

              <div className="glass-card p-5 rounded-2xl border border-white/[0.06] flex items-start gap-3">
                <Building2 className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-white text-sm">Visualisasi CAD Interaktif</h4>
                  <p className="text-slate-400 mt-1 leading-relaxed">Penampang melintang balok, diagram SFD & BMD, serta elevasi sengkang otomatis dengan zoom dan pan.</p>
                </div>
              </div>

              <div className="glass-card p-5 rounded-2xl border border-white/[0.06] flex items-start gap-3">
                <History className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-white text-sm">Riwayat & Ekspor Laporan</h4>
                  <p className="text-slate-400 mt-1 leading-relaxed">Simpan sesi kalkulasi dan cetak laporan resmi format teknik sipil profesional.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* View: Structural Analysis */}
        {activeView === 'structural' && (
          <StructuralAnalysisModule
            currentUser={currentUser}
            onBackToDashboard={() => setActiveView('dashboard')}
            initialType={structuralInitialType}
            initialPreset={beamInitialPreset}
          />
        )}

        {/* View: Concrete Design */}
        {activeView === 'concrete' && (
          <ConcreteDesignModule
            currentUser={currentUser}
            onBackToDashboard={() => setActiveView('dashboard')}
            initialSubModule={concreteInitialSubModule}
            initialSectionType={concreteInitialSectionType}
          />
        )}

        {/* View: History */}
        {activeView === 'history' && (
          <HistoryView
            currentUser={currentUser}
            onOpenRecord={(rec) => {
              if (rec.category === 'structural_analysis') setActiveView('structural');
              else setActiveView('concrete');
            }}
          />
        )}

        {/* View: Documentation */}
        {activeView === 'docs' && <DocumentationView />}

        {/* View: Admin */}
        {activeView === 'admin' && (
          <AdminDashboard
            currentUser={currentUser}
            onClose={() => setActiveView('dashboard')}
          />
        )}
      </main>

      {/* Secret Owner Authentication Modal */}
      {showOwnerModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-cyan-500/50 rounded-2xl p-6 max-w-md w-full shadow-2xl relative text-white space-y-4">
            <button
              onClick={() => setShowOwnerModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Verifikasi Pemilik Web</h3>
                <p className="text-xs text-slate-400">Akses khusus pemilik untuk memantau pengunjung & analitik</p>
              </div>
            </div>

            {ownerPinError && (
              <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                {ownerPinError}
              </div>
            )}

            <form onSubmit={handleVerifyOwnerPin} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1">
                  Masukkan PIN / Sandi Pemilik:
                </label>
                <input
                  type="password"
                  autoFocus
                  value={ownerPinInput}
                  onChange={e => {
                    setOwnerPinInput(e.target.value);
                    setOwnerPinError(null);
                  }}
                  placeholder="PIN Default: admin2026"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800 text-[11px] text-slate-400 space-y-1">
                <p className="font-semibold text-cyan-300">💡 Akses Rahasia Pemilik:</p>
                <p>• PIN Default: <code className="text-white font-mono font-bold bg-slate-800 px-1 py-0.5 rounded">admin2026</code></p>
                <p>• Setelah diverifikasi, perangkat Anda otomatis mengingat status Pemilik.</p>
                <p>• Pengunjung umum yang membuka web tidak akan melihat tombol monitoring.</p>
              </div>

              <div className="flex gap-2 justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setShowOwnerModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-lg shadow-cyan-600/30 transition flex items-center gap-1.5"
                >
                  <Unlock className="w-4 h-4" /> Buka Akses Pemilik
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Subtle Footer with Discreet Owner Access Trigger */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-4 px-6 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
        <span>StructuraLab &copy; 2026 — Workspace Perhitungan & Rekayasa Struktur</span>
        <button
          onClick={() => {
            setShowOwnerModal(true);
            setOwnerPinError(null);
            setOwnerPinInput('');
          }}
          className="text-slate-600 hover:text-cyan-400 transition flex items-center gap-1 text-[11px]"
          title="Akses Pemilik (Owner Login)"
        >
          <Lock className="w-3 h-3" />
          <span>Akses Pemilik</span>
        </button>
      </footer>
    </div>
  );
}

export default App;
