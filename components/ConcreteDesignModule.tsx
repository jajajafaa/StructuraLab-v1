import React, { useState } from 'react';
import {
  ConcreteSectionType,
  FlexureAnalysisInput,
  FlexureAnalysisOutput,
  FlexureDesignInput,
  FlexureDesignOutput,
  ShearDesignInput,
  ShearDesignOutput,
  STANDARD_REBARS
} from '../types/concrete';
import {
  analyzeConcreteFlexure,
  designConcreteFlexure,
  designConcreteShear
} from '../services/concreteEngine';
import { ConcreteSectionVisualizer } from './ConcreteSectionVisualizer';
import { StirrupElevationVisualizer } from './StirrupElevationVisualizer';
import { DatabaseService } from '../services/db';
import { UserProfile } from '../types/auth';
import { useUnits } from '../context/UnitContext';
import {
  Layers,
  Wrench,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  FileText,
  BookmarkCheck,
  RotateCcw,
  Sparkles,
  HelpCircle,
  BookOpen
} from 'lucide-react';

interface ConcreteDesignModuleProps {
  currentUser: UserProfile | null;
  onBackToDashboard: () => void;
  initialSubModule?: 'analysis' | 'design' | 'shear';
  initialSectionType?: ConcreteSectionType;
}

export const ConcreteDesignModule: React.FC<ConcreteDesignModuleProps> = ({
  currentUser,
  onBackToDashboard,
  initialSubModule,
  initialSectionType
}) => {
  const { symbols, unitSystem } = useUnits();
  // Mode selection: 'analysis' | 'design' | 'shear'
  const [subModule, setSubModule] = useState<'analysis' | 'design' | 'shear'>(initialSubModule || 'analysis');
  const [sectionType, setSectionType] = useState<ConcreteSectionType>(initialSectionType || 'rectangular_single');

  React.useEffect(() => {
    if (initialSubModule) setSubModule(initialSubModule);
    if (initialSectionType) setSectionType(initialSectionType);
  }, [initialSubModule, initialSectionType]);

  // Input states for analysis
  const [b, setB] = useState<number>(300);
  const [h, setH] = useState<number>(550);
  const [bw, setBw] = useState<number>(300);
  const [hf, setHf] = useState<number>(120);
  const [spanL, setSpanL] = useState<number>(6.0);
  const [clearWebDist, setClearWebDist] = useState<number>(2.7);
  const [cover, setCover] = useState<number>(40);
  const [fc, setFc] = useState<number>(25);
  const [fy, setFy] = useState<number>(400);
  const [fyt, setFyt] = useState<number>(400);
  const [tensionCount, setTensionCount] = useState<number>(4);
  const [tensionDia, setTensionDia] = useState<number>(25);
  const [layers, setLayers] = useState<number>(1);
  const [compCount, setCompCount] = useState<number>(2);
  const [compDia, setCompDia] = useState<number>(19);
  const [dPrime, setDPrime] = useState<number>(65);
  const [MuApplied, setMuApplied] = useState<number>(250); // kN.m

  // Input states for shear design
  const [VuApplied, setVuApplied] = useState<number>(215); // kN
  const [stirrupDia, setStirrupDia] = useState<number>(10);
  const [legsCount, setLegsCount] = useState<number>(2);

  // Results state
  const [analysisResult, setAnalysisResult] = useState<FlexureAnalysisOutput | null>(null);
  const [designResult, setDesignResult] = useState<FlexureDesignOutput | null>(null);
  const [shearResult, setShearResult] = useState<ShearDesignOutput | null>(null);
  const [savedNotification, setSavedNotification] = useState(false);

  // Run Analysis Handler
  const handleRunAnalysis = () => {
    const input: FlexureAnalysisInput = {
      geometry: {
        sectionType,
        b,
        h,
        cover,
        bw: sectionType === 't_beam' || sectionType === 'l_beam' ? bw : b,
        hf: sectionType === 't_beam' || sectionType === 'l_beam' ? hf : 0,
        spanLength: spanL,
        clearWebDistance: clearWebDist,
        isInteriorBeam: sectionType === 't_beam'
      },
      material: {
        fc,
        fy,
        fyt,
        lambda: 1.0,
        Es: 200000
      },
      tensionBars: {
        count: tensionCount,
        diameter: tensionDia,
        layers
      },
      compressionBars:
        sectionType === 'rectangular_double'
          ? {
              count: compCount,
              diameter: compDia,
              dPrime
            }
          : undefined,
      Mu_applied: MuApplied
    };

    const res = analyzeConcreteFlexure(input);
    setAnalysisResult(res);
  };

  // Run Design Handler
  const handleRunDesign = () => {
    const input: FlexureDesignInput = {
      sectionType,
      Mu: MuApplied,
      material: {
        fc,
        fy,
        fyt,
        lambda: 1.0,
        Es: 200000
      },
      cover,
      stirrupDiameter: stirrupDia,
      preferredBarDiameter: tensionDia,
      b: sectionType === 'rectangular_single' || sectionType === 'rectangular_double' ? b : undefined,
      h: h > 0 ? h : undefined,
      bw,
      hf,
      spanLength: spanL,
      clearWebDistance: clearWebDist,
      isInteriorBeam: sectionType === 't_beam'
    };

    const res = designConcreteFlexure(input);
    setDesignResult(res);
  };

  // Run Shear Design Handler
  const handleRunShear = () => {
    const dVal = h - cover - stirrupDia - tensionDia / 2.0;
    const input: ShearDesignInput = {
      Vu: VuApplied,
      bw: sectionType === 't_beam' || sectionType === 'l_beam' ? bw : b,
      d: dVal,
      h,
      material: {
        fc,
        fy,
        fyt,
        lambda: 1.0,
        Es: 200000
      },
      stirrupDiameter: stirrupDia,
      legsCount,
      beamSpanL: spanL,
      supportWidth: 400
    };

    const res = designConcreteShear(input);
    setShearResult(res);
  };

  // Auto run initial calculation on mount
  React.useEffect(() => {
    handleRunAnalysis();
  }, [sectionType]);

  // Save calculation to History
  const handleSaveCalculation = () => {
    if (!currentUser) return;
    if (subModule === 'analysis' && analysisResult) {
      DatabaseService.saveCalculationRecord({
        userId: currentUser.uid,
        userEmail: currentUser.email,
        title: `Analisis Lentur Balok ${sectionType} (${b}×${h} mm)`,
        category: 'concrete_design',
        subType: sectionType,
        standard: 'SNI 2847:2013 / Agus Setiawan',
        summary: `Mu = ${MuApplied} kN.m, φMn = ${analysisResult.phiMn.toFixed(2)} kN.m, As = ${analysisResult.As.toFixed(1)} mm² (${analysisResult.isAdequate ? 'Aman' : 'Tidak Memenuhi'})`,
        status: analysisResult.isAdequate ? 'safe' : 'unsafe',
        inputData: { b, h, fc, fy, tensionCount, tensionDia, sectionType },
        resultData: analysisResult
      });
    } else if (subModule === 'design' && designResult) {
      DatabaseService.saveCalculationRecord({
        userId: currentUser.uid,
        userEmail: currentUser.email,
        title: `Desain Balok Beton Bertulang (Mu = ${MuApplied} kN.m)`,
        category: 'concrete_design',
        subType: 'design_optimum',
        standard: 'SNI 2847:2013 / Agus Setiawan',
        summary: `Rekomendasi: ${designResult.chosenDesign.name}, φMn = ${designResult.chosenDesign.phiMn} kN.m`,
        status: 'optimized',
        inputData: { MuApplied, fc, fy },
        resultData: designResult
      });
    } else if (subModule === 'shear' && shearResult) {
      DatabaseService.saveCalculationRecord({
        userId: currentUser.uid,
        userEmail: currentUser.email,
        title: `Desain Tulangan Sengkang Geser (Vu = ${VuApplied} kN)`,
        category: 'shear_design',
        subType: 'stirrup_design',
        standard: 'SNI 2847:2013 / Agus Setiawan',
        summary: `Tumpuan: D${stirrupDia}-${shearResult.s_selected_support} mm | Lapangan: D${stirrupDia}-${shearResult.s_selected_field} mm`,
        status: shearResult.isSectionAdequate ? 'safe' : 'unsafe',
        inputData: { VuApplied, fc, fyt, bw, h },
        resultData: shearResult
      });
    }

    setSavedNotification(true);
    setTimeout(() => setSavedNotification(false), 2500);
  };

  // Textbook Example Preset Loader
  const loadExamplePreset = (exName: string) => {
    if (exName === 'contoh_3_2') {
      // Contoh 3.2: b=300, d=550, 3D29, fc=20, fy=400
      setB(300);
      setH(600);
      setFc(20);
      setFy(400);
      setSectionType('rectangular_single');
      setTensionCount(3);
      setTensionDia(29);
      setLayers(1);
      setMuApplied(300);
    } else if (exName === 'contoh_3_7') {
      // Contoh 3.7: b=300, d=600, 6D29 (tarik), 3D22 (tekan), fc=25, fy=400, d'=50
      setB(300);
      setH(700);
      setFc(25);
      setFy(400);
      setSectionType('rectangular_double');
      setTensionCount(6);
      setTensionDia(29);
      setLayers(2);
      setCompCount(3);
      setCompDia(22);
      setDPrime(50);
      setMuApplied(700);
    } else if (exName === 'contoh_3_9') {
      // Contoh 3.9: Balok T, be=1750, bw=300, hf=120, d=510, h=600, 6D22, fc=25, fy=400
      setSectionType('t_beam');
      setB(1750);
      setBw(300);
      setHf(120);
      setH(600);
      setSpanL(7.0);
      setClearWebDist(2.7);
      setFc(25);
      setFy(400);
      setTensionCount(6);
      setTensionDia(22);
      setLayers(2);
      setMuApplied(380);
    } else if (exName === 'contoh_5_1') {
      // Contoh 5.1 & 5.2 Shear: bw=350, d=585, h=650, fc=20, fyt=400, Vu=317.89 kN
      setSubModule('shear');
      setB(350);
      setBw(350);
      setH(650);
      setFc(20);
      setFyt(400);
      setVuApplied(317.9);
      setStirrupDia(10);
      setLegsCount(2);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between glass-slab border border-white/[0.08] rounded-3xl p-5 gap-4 shadow-2xl">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToDashboard}
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs text-slate-200 hover:text-white font-mono transition border border-white/10"
          >
            ← Dashboard
          </button>
          <div>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-cyan-400" /> Modul Beton Bertulang (Reinforced Concrete)
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Perancangan Balok & Sengkang Geser Berdasarkan SNI 2847:2013 & Buku Agus Setiawan
            </p>
          </div>
        </div>

        {/* Sub-module VisionOS Segmented Dock */}
        <div className="flex bg-black/40 backdrop-blur-xl p-1 rounded-2xl border border-white/10 self-start md:self-auto shadow-inner">
          <button
            onClick={() => { setSubModule('analysis'); handleRunAnalysis(); }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
              subModule === 'analysis' ? 'bg-white text-slate-950 font-bold shadow-md' : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            1. Analisis Lentur
          </button>
          <button
            onClick={() => { setSubModule('design'); handleRunDesign(); }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
              subModule === 'design' ? 'bg-white text-slate-950 font-bold shadow-md' : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            2. Desain Penampang
          </button>
          <button
            onClick={() => { setSubModule('shear'); handleRunShear(); }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
              subModule === 'shear' ? 'bg-white text-slate-950 font-bold shadow-md' : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            3. Desain Geser / Sengkang
          </button>
        </div>
      </div>

      {/* Preset Examples Helper */}
      <div className="flex flex-wrap items-center justify-between glass-card border border-white/[0.08] p-3.5 rounded-2xl gap-2 text-xs">
        <span className="text-slate-300 font-medium flex items-center gap-1.5">
          <BookOpen className="w-4 h-4 text-cyan-400" />
          Muat Contoh Soal Buku Agus Setiawan:
        </span>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => { setSubModule('analysis'); loadExamplePreset('contoh_3_2'); setTimeout(handleRunAnalysis, 50); }}
            className="px-3 py-1 bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white rounded-xl border border-white/10 text-[11px] font-medium transition"
          >
            Contoh 3.2 (Tulangan Tunggal 3D29)
          </button>
          <button
            onClick={() => { setSubModule('analysis'); loadExamplePreset('contoh_3_7'); setTimeout(handleRunAnalysis, 50); }}
            className="px-3 py-1 bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white rounded-xl border border-white/10 text-[11px] font-medium transition"
          >
            Contoh 3.7 (Tulangan Rangkap 6D29 + 3D22)
          </button>
          <button
            onClick={() => { setSubModule('analysis'); loadExamplePreset('contoh_3_9'); setTimeout(handleRunAnalysis, 50); }}
            className="px-3 py-1 bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white rounded-xl border border-white/10 text-[11px] font-medium transition"
          >
            Contoh 3.9 (Balok T Monolit Pelat)
          </button>
          <button
            onClick={() => { loadExamplePreset('contoh_5_1'); setTimeout(handleRunShear, 50); }}
            className="px-3 py-1 bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white rounded-xl border border-white/10 text-[11px] font-medium transition"
          >
            Contoh 5.2 (Desain Sengkang Balok)
          </button>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: Input Parameters Form */}
        <div className="lg:col-span-5 glass-slab border border-white/[0.08] rounded-3xl p-5 shadow-2xl space-y-4 text-xs">
          <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
            <h2 className="font-bold text-white text-sm flex items-center gap-2">
              <Wrench className="w-4 h-4 text-cyan-400" /> Parameter Input & Geometri
            </h2>
            <span className="font-mono text-[11px] text-slate-400 tabular-nums">
              {unitSystem === 'si' ? 'SI Metrik (mm, MPa, kN·m)' : 'Imperial (in, ksi, kip·ft)'}
            </span>
          </div>

          {/* Section Type Selector */}
          <div>
            <label className="block text-slate-300 font-semibold mb-2">Bentuk & Konfigurasi Penampang</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSectionType('rectangular_single')}
                className={`py-2 px-3 rounded-xl border text-left transition ${
                  sectionType === 'rectangular_single'
                    ? 'bg-white/[0.12] border-white/40 text-white font-bold shadow'
                    : 'glass-card border-white/[0.08] text-slate-400 hover:text-white hover:border-white/20'
                }`}
              >
                1. Persegi Tunggal
              </button>
              <button
                type="button"
                onClick={() => setSectionType('rectangular_double')}
                className={`py-2 px-3 rounded-xl border text-left transition ${
                  sectionType === 'rectangular_double'
                    ? 'bg-white/[0.12] border-white/40 text-white font-bold shadow'
                    : 'glass-card border-white/[0.08] text-slate-400 hover:text-white hover:border-white/20'
                }`}
              >
                2. Persegi Rangkap
              </button>
              <button
                type="button"
                onClick={() => setSectionType('t_beam')}
                className={`py-2 px-3 rounded-xl border text-left transition ${
                  sectionType === 't_beam'
                    ? 'bg-white/[0.12] border-white/40 text-white font-bold shadow'
                    : 'glass-card border-white/[0.08] text-slate-400 hover:text-white hover:border-white/20'
                }`}
              >
                3. Balok Penampang T
              </button>
              <button
                type="button"
                onClick={() => setSectionType('l_beam')}
                className={`py-2 px-3 rounded-xl border text-left transition ${
                  sectionType === 'l_beam'
                    ? 'bg-white/[0.12] border-white/40 text-white font-bold shadow'
                    : 'glass-card border-white/[0.08] text-slate-400 hover:text-white hover:border-white/20'
                }`}
              >
                4. Balok Penampang L
              </button>
            </div>
          </div>

          {/* Material Properties */}
          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80 space-y-3">
            <span className="font-semibold text-slate-300 block">Karakteristik Material Beton & Baja</span>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 block mb-1">Kuat Tekan Beton f'c ({symbols.stress})</label>
                <input
                  type="number"
                  value={fc}
                  onChange={e => setFc(parseFloat(e.target.value.replace(',', '.')) || 0)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                  min="1"
                  step="any"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Kuat Leleh Lentur fy ({symbols.stress})</label>
                <input
                  type="number"
                  value={fy}
                  onChange={e => setFy(parseFloat(e.target.value.replace(',', '.')) || 0)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                  min="1"
                  step="any"
                />
              </div>
            </div>
          </div>

          {/* Section Geometry */}
          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80 space-y-3">
            <span className="font-semibold text-slate-300 block">Dimensi Geometri Penampang</span>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 block mb-1">
                  {sectionType === 't_beam' || sectionType === 'l_beam' ? `Lebar Sayap be (${symbols.dim})` : `Lebar Balok b (${symbols.dim})`}
                </label>
                <input
                  type="number"
                  value={b}
                  onChange={e => setB(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Tinggi Total Balok h ({symbols.dim})</label>
                <input
                  type="number"
                  value={h}
                  onChange={e => setH(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                />
              </div>
            </div>

            {/* If T or L Beam */}
            {(sectionType === 't_beam' || sectionType === 'l_beam') && (
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800">
                <div>
                  <label className="text-slate-400 block mb-1">Lebar Badan bw ({symbols.dim})</label>
                  <input
                    type="number"
                    value={bw}
                    onChange={e => setBw(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Tebal Sayap hf ({symbols.dim})</label>
                  <input
                    type="number"
                    value={hf}
                    onChange={e => setHf(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Reinforcement Input (for Analysis) or Action Loading */}
          {subModule === 'analysis' && (
            <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80 space-y-3">
              <span className="font-semibold text-slate-300 block">Tulangan Terpasang & Beban Momen</span>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Jumlah Tulangan Tarik (n)</label>
                  <input
                    type="number"
                    value={tensionCount}
                    onChange={e => setTensionCount(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                    min="2"
                    max="16"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Diameter Tulangan Tarik</label>
                  <select
                    value={tensionDia}
                    onChange={e => setTensionDia(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                  >
                    {STANDARD_REBARS.filter(r => r.diameter >= 12).map(r => (
                      <option key={r.diameter} value={r.diameter}>
                        {r.label} (A={r.area} mm²)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Compression rebar if doubly reinforced */}
              {sectionType === 'rectangular_double' && (
                <div className="pt-2 border-t border-slate-800 grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-400 block mb-1">Tulangan Tekan (n')</label>
                    <input
                      type="number"
                      value={compCount}
                      onChange={e => setCompCount(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                      min="2"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Diameter Tulangan Tekan</label>
                    <select
                      value={compDia}
                      onChange={e => setCompDia(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                    >
                      {STANDARD_REBARS.filter(r => r.diameter >= 12).map(r => (
                        <option key={r.diameter} value={r.diameter}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div>
                <label className="text-slate-400 block mb-1">Momen Terfaktor Mu ({symbols.moment})</label>
                <input
                  type="number"
                  value={MuApplied}
                  onChange={e => setMuApplied(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-bold"
                />
              </div>
            </div>
          )}

          {/* Loading Input for Design Module */}
          {subModule === 'design' && (
            <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80 space-y-3">
              <span className="font-semibold text-slate-300 block">Kebutuhan Momen Rencana Desain</span>
              <div>
                <label className="text-slate-400 block mb-1">Momen Terfaktor Mu yang Harus Dipikul ({symbols.moment})</label>
                <input
                  type="number"
                  value={MuApplied}
                  onChange={e => setMuApplied(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-bold text-sm"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Diameter Tulangan Tarik yang Diutamakan</label>
                <select
                  value={tensionDia}
                  onChange={e => setTensionDia(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                >
                  {STANDARD_REBARS.filter(r => r.diameter >= 16).map(r => (
                    <option key={r.diameter} value={r.diameter}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Loading Input for Shear Module */}
          {subModule === 'shear' && (
            <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80 space-y-3">
              <span className="font-semibold text-slate-300 block">Parameter Gaya Geser & Sengkang</span>
              <div>
                <label className="text-slate-400 block mb-1">Gaya Geser Terfaktor Vu pada Penampang Kritis ({symbols.force})</label>
                <input
                  type="number"
                  value={VuApplied}
                  onChange={e => setVuApplied(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-bold text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Diameter Sengkang</label>
                  <select
                    value={stirrupDia}
                    onChange={e => setStirrupDia(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                  >
                    <option value={10}>D10 (Standar)</option>
                    <option value={12}>D12</option>
                    <option value={13}>D13 (Heavy)</option>
                    <option value={16}>D16</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Jumlah Kaki Sengkang</label>
                  <select
                    value={legsCount}
                    onChange={e => setLegsCount(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                  >
                    <option value={2}>2 Kaki (Standar U)</option>
                    <option value={3}>3 Kaki</option>
                    <option value={4}>4 Kaki (Balok Lebar)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Action Button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                if (subModule === 'analysis') handleRunAnalysis();
                else if (subModule === 'design') handleRunDesign();
                else handleRunShear();
              }}
              className="w-full py-3 rounded-2xl bg-white hover:bg-slate-100 text-slate-950 font-bold text-xs shadow-xl active:scale-[0.99] transition flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4 text-slate-900" />
              {subModule === 'analysis' ? 'Jalankan Analisis Kapasitas Lentur' : subModule === 'design' ? 'Jalankan Desain & Optimasi Dimensi' : 'Hitung Kebutuhan Tulangan Geser'}
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: Visualizer & Transparent Engineering Results */}
        <div className="lg:col-span-7 space-y-6">
          {/* Visualizer Display */}
          {subModule !== 'shear' ? (
            <ConcreteSectionVisualizer
              sectionType={sectionType}
              b={sectionType === 't_beam' || sectionType === 'l_beam' ? b : b}
              h={h}
              d={analysisResult?.d || (h - cover - 10 - tensionDia / 2.0)}
              bw={bw}
              hf={hf}
              tensionCount={subModule === 'design' && designResult ? designResult.chosenDesign.tensionBarsCount : tensionCount}
              tensionDia={subModule === 'design' && designResult ? designResult.chosenDesign.tensionBarDiameter : tensionDia}
              layers={layers}
              compressionCount={sectionType === 'rectangular_double' ? compCount : (subModule === 'design' && designResult?.chosenDesign.compressionBarsCount ? designResult.chosenDesign.compressionBarsCount : 0)}
              compressionDia={compDia}
              dPrime={dPrime}
              a={analysisResult?.a}
              c={analysisResult?.c}
            />
          ) : (
            shearResult && (
              <StirrupElevationVisualizer
                spanL={spanL}
                h={h}
                bw={bw}
                zones={shearResult.zones}
              />
            )
          )}

          {/* Results Summary Card */}
          <div className="glass-slab border border-white/[0.08] rounded-3xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                  Hasil Perhitungan Teknik
                </span>
                <span className="text-[11px] font-mono text-slate-400">SNI 2847:2013</span>
              </div>

              {currentUser && (
                <button
                  onClick={handleSaveCalculation}
                  className="flex items-center gap-1.5 px-3 py-1 bg-white/10 hover:bg-white/20 text-white border border-white/10 rounded-xl text-xs transition"
                >
                  <BookmarkCheck className="w-3.5 h-3.5" />
                  {savedNotification ? 'Tersimpan!' : 'Simpan Riwayat'}
                </button>
              )}
            </div>

            {/* Analysis Output View */}
            {subModule === 'analysis' && analysisResult && (
              <div className="space-y-4">
                {/* Main status indicator */}
                <div
                  className={`p-4 rounded-xl border flex items-center justify-between ${
                    analysisResult.isAdequate
                      ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                      : 'bg-rose-950/30 border-rose-500/40 text-rose-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {analysisResult.isAdequate ? (
                      <CheckCircle2 className="w-7 h-7 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="w-7 h-7 text-rose-400 shrink-0" />
                    )}
                    <div>
                      <h3 className="font-bold text-sm">
                        {analysisResult.isAdequate ? 'PENAMPANG MEMENUHI SYARAT (AMAN)' : 'PENAMPANG TIDAK MEMENUHI SYARAT'}
                      </h3>
                      <p className="text-xs opacity-90">
                        Kuat Momen Rencana φMn = {analysisResult.phiMn.toFixed(2)} kN.m {analysisResult.isAdequate ? '≥' : '<'} Mu = {MuApplied} kN.m (Rasio Kapasitas = {((MuApplied / (analysisResult.phiMn || 1)) * 100).toFixed(1)}%)
                      </p>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full text-[11px] font-mono font-bold bg-slate-900 border border-slate-700">
                    φ = {analysisResult.phi.toFixed(3)}
                  </span>
                </div>

                {/* Key Engineering Numbers Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <span className="text-slate-400 block text-[11px]">Luas Tulangan As</span>
                    <span className="text-lg font-bold text-white">{analysisResult.As.toFixed(1)}</span>
                    <span className="text-[10px] text-slate-500 block">mm² ({tensionCount}D{tensionDia})</span>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <span className="text-slate-400 block text-[11px]">Rasio Tulangan ρ</span>
                    <span className="text-lg font-bold text-cyan-400">{analysisResult.rho.toFixed(5)}</span>
                    <span className="text-[10px] text-slate-500 block">ρ_min = {analysisResult.rhoMin.toFixed(5)}</span>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <span className="text-slate-400 block text-[11px]">Tinggi Blok Tekan a</span>
                    <span className="text-lg font-bold text-amber-400">{analysisResult.a.toFixed(2)}</span>
                    <span className="text-[10px] text-slate-500 block">Garis Netral c = {analysisResult.c.toFixed(2)} mm</span>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <span className="text-slate-400 block text-[11px]">Regangan Baja ε_t</span>
                    <span className="text-lg font-bold text-emerald-400">{analysisResult.eps_t.toFixed(5)}</span>
                    <span className="text-[10px] text-slate-500 block">{analysisResult.failureType.split(' ')[0]}</span>
                  </div>
                </div>

                {/* Step-by-Step Transparent Formulas */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                  <h4 className="font-bold text-slate-200 text-xs flex items-center gap-2">
                    <FileText className="w-4 h-4 text-cyan-400" /> Tahapan & Substitusi Perhitungan Matematis
                  </h4>
                  <div className="space-y-2 text-xs divide-y divide-slate-800">
                    {analysisResult.steps.map((st, sIdx) => (
                      <div key={sIdx} className="pt-2 first:pt-0">
                        <div className="font-semibold text-indigo-300">{st.title}</div>
                        <div className="font-mono text-[11px] text-slate-300 bg-slate-900/80 p-2 rounded my-1">
                          <div>Rumus: {st.formula}</div>
                          <div className="text-cyan-400">Substitusi: {st.substitution}</div>
                          <div className="text-emerald-400 font-bold">Hasil: {st.result}</div>
                        </div>
                        <p className="text-[11px] text-slate-400">{st.explanation}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Design Output View */}
            {subModule === 'design' && designResult && (
              <div className="space-y-4">
                <div className="p-3 bg-blue-950/30 border border-blue-500/30 rounded-xl text-xs text-blue-200">
                  Sistem mengevaluasi batasan daktilitas lentur (ρ ≤ ρ_maks, ε_t ≥ 0.005) dan menghasilkan kombinasi dimensi serta penulangan yang paling efisien.
                </div>

                {/* Alternatives List */}
                <div className="space-y-2.5">
                  <span className="font-semibold text-slate-300 text-xs block">
                    Alternatif Desain Terverifikasi ({designResult.alternatives.length} Opsi):
                  </span>
                  {designResult.alternatives.map((alt, idx) => (
                    <div
                      key={alt.id}
                      className={`p-3.5 rounded-xl border transition ${
                        idx === 0
                          ? 'bg-slate-950 border-cyan-500/50 shadow-md ring-1 ring-cyan-500/20'
                          : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-sm">{alt.name}</span>
                            {idx === 0 && (
                              <span className="px-2 py-0.5 rounded text-[10px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold">
                                REKOMENDASI UTAMA
                              </span>
                            )}
                            <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300">
                              {alt.reinforcementType}
                            </span>
                          </div>
                          <p className="text-slate-400 text-xs mt-1">
                            Tulangan Tarik: <strong className="text-cyan-300">{alt.tensionBarSummary}</strong>
                            {alt.compressionBarSummary && (
                              <> | Tulangan Tekan: <strong className="text-indigo-300">{alt.compressionBarSummary}</strong></>
                            )}
                          </p>
                        </div>

                        <div className="text-right sm:self-center">
                          <span className="text-emerald-400 font-bold text-sm block">
                            φMn = {alt.phiMn} kN.m
                          </span>
                          <span className="text-[11px] text-slate-400">
                            Efisiensi: {(alt.efficiencyRatio * 100).toFixed(1)}%
                          </span>
                        </div>
                      </div>

                      <div className="mt-2.5 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 flex flex-wrap gap-x-4 gap-y-1">
                        {alt.reasons.map((r, rIdx) => (
                          <span key={rIdx} className="flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" /> {r}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Shear Output View */}
            {subModule === 'shear' && shearResult && (
              <div className="space-y-4">
                <div
                  className={`p-4 rounded-xl border flex items-center justify-between ${
                    shearResult.isSectionAdequate
                      ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                      : 'bg-rose-950/30 border-rose-500/40 text-rose-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {shearResult.isSectionAdequate ? (
                      <CheckCircle2 className="w-7 h-7 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="w-7 h-7 text-rose-400 shrink-0" />
                    )}
                    <div>
                      <h3 className="font-bold text-sm">
                        {shearResult.isSectionAdequate
                          ? 'PENAMPANG MEMADAI UNTUK BEBAN GESER'
                          : 'DIMENSI BALOK HARUS DIPERBESAR (Vs > Vs_maks)'}
                      </h3>
                      <p className="text-xs opacity-90">
                        {shearResult.shearRequirementType} (Vu = {VuApplied} kN)
                      </p>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full text-[11px] font-mono font-bold bg-slate-900 border border-slate-700">
                    φ = 0.75
                  </span>
                </div>

                {/* Shear parameters */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <span className="text-slate-400 block text-[11px]">Kuat Geser Beton Vc</span>
                    <span className="text-lg font-bold text-white">{shearResult.Vc.toFixed(1)} kN</span>
                    <span className="text-[10px] text-slate-500 block">φVc = {shearResult.phiVc.toFixed(1)} kN</span>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <span className="text-slate-400 block text-[11px]">Kuat Geser Sengkang Vs</span>
                    <span className="text-lg font-bold text-cyan-400">{shearResult.Vs_required.toFixed(1)} kN</span>
                    <span className="text-[10px] text-slate-500 block">Vs_maks = {shearResult.Vs_max_limit.toFixed(1)} kN</span>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <span className="text-slate-400 block text-[11px]">Sengkang Tumpuan</span>
                    <span className="text-lg font-bold text-amber-400">D{stirrupDia} - {shearResult.s_selected_support}</span>
                    <span className="text-[10px] text-slate-500 block">{legsCount} kaki (s_maks = {shearResult.s_max_code} mm)</span>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <span className="text-slate-400 block text-[11px]">Sengkang Lapangan</span>
                    <span className="text-lg font-bold text-emerald-400">D{stirrupDia} - {shearResult.s_selected_field}</span>
                    <span className="text-[10px] text-slate-500 block">Total = {shearResult.totalStirrupCount} buah</span>
                  </div>
                </div>

                {/* Detailed steps */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                  <h4 className="font-bold text-slate-200 text-xs flex items-center gap-2">
                    <FileText className="w-4 h-4 text-cyan-400" /> Langkah Penyelesaian Desain Sengkang
                  </h4>
                  <div className="space-y-2 text-xs divide-y divide-slate-800">
                    {shearResult.steps.map((st, sIdx) => (
                      <div key={sIdx} className="pt-2 first:pt-0">
                        <div className="font-semibold text-indigo-300">{st.title}</div>
                        <div className="font-mono text-[11px] text-slate-300 bg-slate-900/80 p-2 rounded my-1">
                          <div>Rumus: {st.formula}</div>
                          <div className="text-cyan-400">Substitusi: {st.substitution}</div>
                          <div className="text-emerald-400 font-bold">Hasil: {st.result}</div>
                        </div>
                        <p className="text-[11px] text-slate-400">{st.explanation}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
