import React, { useState } from 'react';
import {
  Support,
  StructuralLoad,
  BeamSpan,
  BeamAnalysisResult,
  TrussNode,
  TrussMember,
  TrussNodeLoad,
  TrussAnalysisResult,
  LoadType,
  SupportType
} from '../types/structural';
import {
  solveUnifiedBeam,
  solveTruss2D
} from '../services/structuralEngine';
import { AnalysisToolbar } from './AnalysisToolbar';
import { ModelExplorer } from './ModelExplorer';
import { StructuralViewport } from './StructuralViewport';
import { PropertiesPanel } from './PropertiesPanel';
import { LoadManager } from './LoadManager';
import { ResultsPanel } from './ResultsPanel';
import { TrussCADViewport } from './TrussCADViewport';
import { TrussModelExplorer } from './TrussModelExplorer';
import { DatabaseService } from '../services/db';
import { UserProfile } from '../types/auth';
import {
  Compass,
  BookmarkCheck,
  CheckCircle2,
  Sliders,
  FileSpreadsheet,
  Layers,
  Sparkles,
  BookOpen,
  Cpu,
  GitCommit
} from 'lucide-react';

interface StructuralAnalysisModuleProps {
  currentUser: UserProfile | null;
  onBackToDashboard: () => void;
  initialType?: 'beam' | 'truss';
  initialPreset?: string;
}

export const StructuralAnalysisModule: React.FC<StructuralAnalysisModuleProps> = ({
  currentUser,
  onBackToDashboard,
  initialType,
  initialPreset
}) => {
  // Primary Engineering Modules:
  // 'beam': Unified Statis Tertentu & Tak Tentu (Metode Cross otomatis jika reaksi > 3)
  // 'truss': 2D Truss CAD Workspace
  const [analysisType, setAnalysisType] = useState<'beam' | 'truss'>(initialType || 'beam');
  const [activeToolbarTool, setActiveToolbarTool] = useState<'select' | 'move' | 'add_node' | 'add_member' | 'add_support' | 'add_load'>('select');
  const [activeViewMode, setActiveViewMode] = useState<'model' | 'loads' | 'sfd' | 'bmd' | 'all'>('all');

  // Selection state
  const [selectedType, setSelectedType] = useState<'support' | 'load' | 'beam' | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Material & Section Properties
  const [materialE, setMaterialE] = useState<number>(200000); // MPa
  const [sectionI, setSectionI] = useState<number>(4000); // x10^6 mm^4

  // Unified Beam State (Starts empty, user enters values or clicks Run/Presets)
  const [beamLength, setBeamLength] = useState<number>(0);
  const [supports, setSupports] = useState<Support[]>([]);
  const [loads, setLoads] = useState<StructuralLoad[]>([]);
  const [beamResult, setBeamResult] = useState<BeamAnalysisResult | null>(null);

  // 2D Truss State (CAD Mode)
  const [trussNodes, setTrussNodes] = useState<TrussNode[]>([]);
  const [trussMembers, setTrussMembers] = useState<TrussMember[]>([]);
  const [trussLoads, setTrussLoads] = useState<TrussNodeLoad[]>([]);
  const [trussResult, setTrussResult] = useState<TrussAnalysisResult | null>(null);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [savedNotif, setSavedNotif] = useState(false);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  // Execute Unified Beam Analysis (Auto Detects Statis Tertentu vs Statis Tak Tentu Cross)
  const runBeamAnalysis = (customLen?: number, customSupps?: Support[], customLoads?: StructuralLoad[]) => {
    const len = customLen !== undefined ? customLen : beamLength;
    const supps = customSupps !== undefined ? customSupps : supports;
    const lds = customLoads !== undefined ? customLoads : loads;

    if (len <= 0 || supps.length === 0) {
      setValidationMessage('Harap tentukan panjang bentang balok (L > 0 m) dan minimal satu tumpuan sebelum menjalankan analisis.');
      setTimeout(() => setValidationMessage(null), 4000);
      return;
    }
    setValidationMessage(null);
    setIsAnalyzing(true);
    setTimeout(() => {
      const res = solveUnifiedBeam(len, supps, lds, sectionI, materialE);
      setBeamResult(res);
      setIsAnalyzing(false);
    }, 60);
  };

  // Execute 2D Truss Analysis (Method of Joints)
  const runTrussAnalysis = (customNodes?: TrussNode[], customMembers?: TrussMember[], customLoads?: TrussNodeLoad[]) => {
    const nds = customNodes !== undefined ? customNodes : trussNodes;
    const mems = customMembers !== undefined ? customMembers : trussMembers;
    const lds = customLoads !== undefined ? customLoads : trussLoads;

    if (nds.length === 0 || mems.length === 0) {
      setValidationMessage('Harap buat titik buhul dan batang rangka sebelum menjalankan analisis.');
      setTimeout(() => setValidationMessage(null), 4000);
      return;
    }
    setValidationMessage(null);
    setIsAnalyzing(true);
    setTimeout(() => {
      const res = solveTruss2D(nds, mems, lds);
      setTrussResult(res);
      setIsAnalyzing(false);
    }, 60);
  };

  // Object Selection Handler
  const handleSelectObject = (type: 'support' | 'load' | 'beam' | null, id: string | null) => {
    setSelectedType(type);
    setSelectedId(id);
  };

  // Beam Presets (Determinate & Indeterminate Benchmarks)
  const loadBeamPreset = (preset: 'benchmark_beam' | 'triangular_beam' | 'cantilever' | 'overhang' | 'fixed_fixed' | 'propped_cantilever' | 'continuous_2span' | 'continuous_3span') => {
    let pLen = 6.0;
    let pSupps: Support[] = [];
    let pLoads: StructuralLoad[] = [];

    if (preset === 'benchmark_beam') {
      pLen = 6.0;
      pSupps = [
        { id: 'supp-1', nodeId: 'A', type: 'pin', position: 0, label: 'Tumpuan A (Sendi)' },
        { id: 'supp-2', nodeId: 'B', type: 'roller', position: 6.0, label: 'Tumpuan B (Rol)' }
      ];
      pLoads = [
        { id: 'load-1', type: 'point', startPos: 3.0, magnitude: 25, direction: 'down', label: 'P1' },
        { id: 'load-2', type: 'distributed', startPos: 0, endPos: 6.0, magnitude: 10, direction: 'down', label: 'q1' }
      ];
    } else if (preset === 'triangular_beam') {
      pLen = 6.0;
      pSupps = [
        { id: 'tb-1', nodeId: 'A', type: 'pin', position: 0, label: 'A (Sendi)' },
        { id: 'tb-2', nodeId: 'B', type: 'roller', position: 6.0, label: 'B (Rol)' }
      ];
      pLoads = [
        { id: 'tbl-1', type: 'triangular', startPos: 0, endPos: 6.0, magnitude: 0, magnitudeEnd: 24, direction: 'down', label: 'q segitiga' }
      ];
    } else if (preset === 'cantilever') {
      pLen = 4.0;
      pSupps = [{ id: 'c-1', nodeId: 'A', type: 'fixed', position: 0, label: 'Jepit A' }];
      pLoads = [
        { id: 'cl-1', type: 'point', startPos: 4.0, magnitude: 20, direction: 'down', label: 'P ujung' },
        { id: 'cl-2', type: 'distributed', startPos: 0, endPos: 4.0, magnitude: 10, direction: 'down', label: 'q merata' }
      ];
    } else if (preset === 'overhang') {
      pLen = 8.0;
      pSupps = [
        { id: 'ov-1', nodeId: 'A', type: 'pin', position: 0, label: 'A (Sendi)' },
        { id: 'ov-2', nodeId: 'B', type: 'roller', position: 6.0, label: 'B (Rol)' }
      ];
      pLoads = [
        { id: 'ol-1', type: 'distributed', startPos: 0, endPos: 6.0, magnitude: 15, direction: 'down', label: 'q bentang' },
        { id: 'ol-2', type: 'point', startPos: 8.0, magnitude: 25, direction: 'down', label: 'P overhang' }
      ];
    } else if (preset === 'fixed_fixed') {
      // Indeterminate: Fixed-Fixed (R=6, n=3)
      pLen = 6.0;
      pSupps = [
        { id: 'ff-1', nodeId: 'A', type: 'fixed', position: 0, label: 'Jepit A' },
        { id: 'ff-2', nodeId: 'B', type: 'fixed', position: 6.0, label: 'Jepit B' }
      ];
      pLoads = [
        { id: 'ffl-1', type: 'distributed', startPos: 0, endPos: 6.0, magnitude: 15, direction: 'down', label: 'q merata' },
        { id: 'ffl-2', type: 'point', startPos: 3.0, magnitude: 20, direction: 'down', label: 'P tengah' }
      ];
    } else if (preset === 'propped_cantilever') {
      // Indeterminate: Propped Cantilever Fixed-Roller (R=4, n=1)
      pLen = 6.0;
      pSupps = [
        { id: 'pc-1', nodeId: 'A', type: 'fixed', position: 0, label: 'Jepit A' },
        { id: 'pc-2', nodeId: 'B', type: 'roller', position: 6.0, label: 'Rol B' }
      ];
      pLoads = [
        { id: 'pcl-1', type: 'point', startPos: 3.0, magnitude: 30, direction: 'down', label: 'P beban' },
        { id: 'pcl-2', type: 'distributed', startPos: 0, endPos: 6.0, magnitude: 10, direction: 'down', label: 'q merata' }
      ];
    } else if (preset === 'continuous_2span') {
      // Indeterminate: Continuous 2 Spans Pin-Rol-Rol (R=4, n=1)
      pLen = 10.0;
      pSupps = [
        { id: 'c2-1', nodeId: 'A', type: 'pin', position: 0, label: 'Tumpuan A' },
        { id: 'c2-2', nodeId: 'B', type: 'roller', position: 5.0, label: 'Tumpuan B' },
        { id: 'c2-3', nodeId: 'C', type: 'roller', position: 10.0, label: 'Tumpuan C' }
      ];
      pLoads = [
        { id: 'c2l-1', type: 'distributed', startPos: 0, endPos: 10.0, magnitude: 15, direction: 'down', label: 'q beban menerus' }
      ];
    } else if (preset === 'continuous_3span') {
      // Indeterminate: Continuous 3 Spans Pin-Rol-Rol-Rol (R=5, n=2)
      pLen = 15.0;
      pSupps = [
        { id: 'c3-1', nodeId: 'A', type: 'pin', position: 0, label: 'Tumpuan A' },
        { id: 'c3-2', nodeId: 'B', type: 'roller', position: 5.0, label: 'Tumpuan B' },
        { id: 'c3-3', nodeId: 'C', type: 'roller', position: 10.0, label: 'Tumpuan C' },
        { id: 'c3-4', nodeId: 'D', type: 'roller', position: 15.0, label: 'Tumpuan D' }
      ];
      pLoads = [
        { id: 'c3l-1', type: 'distributed', startPos: 0, endPos: 15.0, magnitude: 12, direction: 'down', label: 'q merata' },
        { id: 'c3l-2', type: 'point', startPos: 7.5, magnitude: 25, direction: 'down', label: 'P bentang tengah' }
      ];
    }

    setBeamLength(pLen);
    setSupports(pSupps);
    setLoads(pLoads);
    runBeamAnalysis(pLen, pSupps, pLoads);
  };

  React.useEffect(() => {
    if (initialType) setAnalysisType(initialType);
    if (initialPreset) loadBeamPreset(initialPreset as any);
  }, [initialType, initialPreset]);

  // Truss Presets (Standard Benchmarks)
  const loadTrussPreset = (preset: 'warren' | 'pratt' | 'howe' | 'roof' | 'cantilever') => {
    let nds: TrussNode[] = [];
    let mems: TrussMember[] = [];
    let lds: TrussNodeLoad[] = [];

    if (preset === 'warren') {
      // Warren Truss: Span 8m, 4 panels, height 2.5m
      nds = [
        { id: 'n1', x: 0, y: 0, support: 'pin' },
        { id: 'n2', x: 2, y: 0 },
        { id: 'n3', x: 4, y: 0 },
        { id: 'n4', x: 6, y: 0 },
        { id: 'n5', x: 8, y: 0, support: 'roller' },
        { id: 'n6', x: 1, y: 2.5 },
        { id: 'n7', x: 3, y: 2.5 },
        { id: 'n8', x: 5, y: 2.5 },
        { id: 'n9', x: 7, y: 2.5 }
      ];
      mems = [
        // Bottom chord
        { id: 'm1', nodeStartId: 'n1', nodeEndId: 'n2', E: 200000, A: 1500 },
        { id: 'm2', nodeStartId: 'n2', nodeEndId: 'n3', E: 200000, A: 1500 },
        { id: 'm3', nodeStartId: 'n3', nodeEndId: 'n4', E: 200000, A: 1500 },
        { id: 'm4', nodeStartId: 'n4', nodeEndId: 'n5', E: 200000, A: 1500 },
        // Top chord
        { id: 'm5', nodeStartId: 'n6', nodeEndId: 'n7', E: 200000, A: 1500 },
        { id: 'm6', nodeStartId: 'n7', nodeEndId: 'n8', E: 200000, A: 1500 },
        { id: 'm7', nodeStartId: 'n8', nodeEndId: 'n9', E: 200000, A: 1500 },
        // Web diagonals
        { id: 'm8', nodeStartId: 'n1', nodeEndId: 'n6', E: 200000, A: 1200 },
        { id: 'm9', nodeStartId: 'n6', nodeEndId: 'n2', E: 200000, A: 1200 },
        { id: 'm10', nodeStartId: 'n2', nodeEndId: 'n7', E: 200000, A: 1200 },
        { id: 'm11', nodeStartId: 'n7', nodeEndId: 'n3', E: 200000, A: 1200 },
        { id: 'm12', nodeStartId: 'n3', nodeEndId: 'n8', E: 200000, A: 1200 },
        { id: 'm13', nodeStartId: 'n8', nodeEndId: 'n4', E: 200000, A: 1200 },
        { id: 'm14', nodeStartId: 'n4', nodeEndId: 'n9', E: 200000, A: 1200 },
        { id: 'm15', nodeStartId: 'n9', nodeEndId: 'n5', E: 200000, A: 1200 }
      ];
      lds = [
        { id: 'l1', nodeId: 'n2', Fx: 0, Fy: -20 },
        { id: 'l2', nodeId: 'n3', Fx: 0, Fy: -30 },
        { id: 'l3', nodeId: 'n4', Fx: 0, Fy: -20 }
      ];
    } else if (preset === 'pratt') {
      // Pratt Truss: 12m span, 4 panels, height 3m
      nds = [
        { id: 'p1', x: 0, y: 0, support: 'pin' },
        { id: 'p2', x: 3, y: 0 },
        { id: 'p3', x: 6, y: 0 },
        { id: 'p4', x: 9, y: 0 },
        { id: 'p5', x: 12, y: 0, support: 'roller' },
        { id: 'p6', x: 3, y: 3 },
        { id: 'p7', x: 6, y: 3 },
        { id: 'p8', x: 9, y: 3 }
      ];
      mems = [
        { id: 'pm1', nodeStartId: 'p1', nodeEndId: 'p2', E: 200000, A: 1500 },
        { id: 'pm2', nodeStartId: 'p2', nodeEndId: 'p3', E: 200000, A: 1500 },
        { id: 'pm3', nodeStartId: 'p3', nodeEndId: 'p4', E: 200000, A: 1500 },
        { id: 'pm4', nodeStartId: 'p4', nodeEndId: 'p5', E: 200000, A: 1500 },
        { id: 'pm5', nodeStartId: 'p6', nodeEndId: 'p7', E: 200000, A: 1500 },
        { id: 'pm6', nodeStartId: 'p7', nodeEndId: 'p8', E: 200000, A: 1500 },
        { id: 'pm7', nodeStartId: 'p1', nodeEndId: 'p6', E: 200000, A: 1500 },
        { id: 'pm8', nodeStartId: 'p2', nodeEndId: 'p6', E: 200000, A: 1200 },
        { id: 'pm9', nodeStartId: 'p2', nodeEndId: 'p7', E: 200000, A: 1200 },
        { id: 'pm10', nodeStartId: 'p3', nodeEndId: 'p7', E: 200000, A: 1200 },
        { id: 'pm11', nodeStartId: 'p4', nodeEndId: 'p7', E: 200000, A: 1200 },
        { id: 'pm12', nodeStartId: 'p4', nodeEndId: 'p8', E: 200000, A: 1200 },
        { id: 'pm13', nodeStartId: 'p5', nodeEndId: 'p8', E: 200000, A: 1500 }
      ];
      lds = [
        { id: 'pl1', nodeId: 'p2', Fx: 0, Fy: -25 },
        { id: 'pl2', nodeId: 'p3', Fx: 0, Fy: -35 },
        { id: 'pl3', nodeId: 'p4', Fx: 0, Fy: -25 }
      ];
    } else if (preset === 'roof') {
      // Pitched Roof Truss: 8m span x 2m height
      nds = [
        { id: 'r1', x: 0, y: 0, support: 'pin' },
        { id: 'r2', x: 2, y: 0 },
        { id: 'r3', x: 4, y: 0 },
        { id: 'r4', x: 6, y: 0 },
        { id: 'r5', x: 8, y: 0, support: 'roller' },
        { id: 'r6', x: 2, y: 1 },
        { id: 'r7', x: 4, y: 2 },
        { id: 'r8', x: 6, y: 1 }
      ];
      mems = [
        // Bottom Tie
        { id: 'rm1', nodeStartId: 'r1', nodeEndId: 'r2', E: 200000, A: 1200 },
        { id: 'rm2', nodeStartId: 'r2', nodeEndId: 'r3', E: 200000, A: 1200 },
        { id: 'rm3', nodeStartId: 'r3', nodeEndId: 'r4', E: 200000, A: 1200 },
        { id: 'rm4', nodeStartId: 'r4', nodeEndId: 'r5', E: 200000, A: 1200 },
        // Top Rafters
        { id: 'rm5', nodeStartId: 'r1', nodeEndId: 'r6', E: 200000, A: 1500 },
        { id: 'rm6', nodeStartId: 'r6', nodeEndId: 'r7', E: 200000, A: 1500 },
        { id: 'rm7', nodeStartId: 'r7', nodeEndId: 'r8', E: 200000, A: 1500 },
        { id: 'rm8', nodeStartId: 'r8', nodeEndId: 'r5', E: 200000, A: 1500 },
        // Web posts & struts
        { id: 'rm9', nodeStartId: 'r2', nodeEndId: 'r6', E: 200000, A: 1000 },
        { id: 'rm10', nodeStartId: 'r3', nodeEndId: 'r7', E: 200000, A: 1000 },
        { id: 'rm11', nodeStartId: 'r4', nodeEndId: 'r8', E: 200000, A: 1000 },
        { id: 'rm12', nodeStartId: 'r2', nodeEndId: 'r7', E: 200000, A: 1000 },
        { id: 'rm13', nodeStartId: 'r4', nodeEndId: 'r7', E: 200000, A: 1000 }
      ];
      lds = [
        { id: 'rl1', nodeId: 'r6', Fx: 0, Fy: -15 },
        { id: 'rl2', nodeId: 'r7', Fx: 0, Fy: -20 },
        { id: 'rl3', nodeId: 'r8', Fx: 0, Fy: -15 }
      ];
    } else if (preset === 'cantilever') {
      // Cantilever Truss
      nds = [
        { id: 'c1', x: 0, y: 0, support: 'pin' },
        { id: 'c2', x: 0, y: 2, support: 'pin' },
        { id: 'c3', x: 3, y: 0 },
        { id: 'c4', x: 3, y: 2 },
        { id: 'c5', x: 6, y: 0 }
      ];
      mems = [
        { id: 'cm1', nodeStartId: 'c1', nodeEndId: 'c2', E: 200000, A: 1500 },
        { id: 'cm2', nodeStartId: 'c1', nodeEndId: 'c3', E: 200000, A: 1500 },
        { id: 'cm3', nodeStartId: 'c2', nodeEndId: 'c4', E: 200000, A: 1500 },
        { id: 'cm4', nodeStartId: 'c3', nodeEndId: 'c4', E: 200000, A: 1500 },
        { id: 'cm5', nodeStartId: 'c1', nodeEndId: 'c4', E: 200000, A: 1200 },
        { id: 'cm6', nodeStartId: 'c3', nodeEndId: 'c5', E: 200000, A: 1500 },
        { id: 'cm7', nodeStartId: 'c4', nodeEndId: 'c5', E: 200000, A: 1500 }
      ];
      lds = [{ id: 'cl1', nodeId: 'c5', Fx: 0, Fy: -25 }];
    } else {
      // Howe Truss default
      nds = [
        { id: 'h1', x: 0, y: 0, support: 'pin' },
        { id: 'h2', x: 3, y: 0 },
        { id: 'h3', x: 6, y: 0 },
        { id: 'h4', x: 9, y: 0 },
        { id: 'h5', x: 12, y: 0, support: 'roller' },
        { id: 'h6', x: 3, y: 3 },
        { id: 'h7', x: 6, y: 3 },
        { id: 'h8', x: 9, y: 3 }
      ];
      mems = [
        { id: 'hm1', nodeStartId: 'h1', nodeEndId: 'h2', E: 200000, A: 1500 },
        { id: 'hm2', nodeStartId: 'h2', nodeEndId: 'h3', E: 200000, A: 1500 },
        { id: 'hm3', nodeStartId: 'h3', nodeEndId: 'h4', E: 200000, A: 1500 },
        { id: 'hm4', nodeStartId: 'h4', nodeEndId: 'h5', E: 200000, A: 1500 },
        { id: 'hm5', nodeStartId: 'h6', nodeEndId: 'h7', E: 200000, A: 1500 },
        { id: 'hm6', nodeStartId: 'h7', nodeEndId: 'h8', E: 200000, A: 1500 },
        { id: 'hm7', nodeStartId: 'h1', nodeEndId: 'h6', E: 200000, A: 1500 },
        { id: 'hm8', nodeStartId: 'h3', nodeEndId: 'h6', E: 200000, A: 1200 },
        { id: 'hm9', nodeStartId: 'h3', nodeEndId: 'h7', E: 200000, A: 1200 },
        { id: 'hm10', nodeStartId: 'h3', nodeEndId: 'h8', E: 200000, A: 1200 },
        { id: 'hm11', nodeStartId: 'h5', nodeEndId: 'h8', E: 200000, A: 1500 }
      ];
      lds = [
        { id: 'hl1', nodeId: 'h2', Fx: 0, Fy: -20 },
        { id: 'hl2', nodeId: 'h3', Fx: 0, Fy: -30 },
        { id: 'hl3', nodeId: 'h4', Fx: 0, Fy: -20 }
      ];
    }

    setTrussNodes(nds);
    setTrussMembers(mems);
    setTrussLoads(lds);
    runTrussAnalysis(nds, mems, lds);
  };

  const handleAddSupportAt = (pos: number, type: SupportType = 'roller') => {
    const nextChar = String.fromCharCode(65 + supports.length);
    const newSupp: Support = {
      id: 'supp-' + Date.now().toString(36),
      nodeId: nextChar,
      type,
      position: pos,
      label: `Tumpuan ${nextChar}`
    };
    setSupports([...supports, newSupp]);
    setTimeout(runBeamAnalysis, 50);
  };

  const handleAddLoadAt = (pos: number, type: LoadType = 'point', mag: number = 20) => {
    const newLoad: StructuralLoad = {
      id: 'load-' + Date.now().toString(36),
      type,
      startPos: pos,
      endPos: type === 'distributed' ? Math.min(beamLength, pos + 2) : undefined,
      magnitude: mag,
      direction: 'down',
      label: type === 'point' ? `P${loads.length + 1}` : `q${loads.length + 1}`
    };
    setLoads([...loads, newLoad]);
    setTimeout(runBeamAnalysis, 50);
  };

  const handleSaveCalculation = () => {
    if (!currentUser) return;
    if (analysisType === 'beam' && beamResult) {
      DatabaseService.saveCalculationRecord({
        userId: currentUser.uid,
        userEmail: currentUser.email,
        title: `Analisis Struktur: Balok ${beamResult.isDeterminate ? 'Statis Tertentu' : 'Statis Tak Tentu'} (L = ${beamResult.totalLength} m)`,
        category: 'structural_analysis',
        subType: 'beam',
        standard: 'Mekanika Rekayasa / Matrix Stiffness Engine',
        summary: `M maks = ${beamResult.maxMoment.value.toFixed(2)} kN.m | V maks = ${beamResult.maxShear.value.toFixed(2)} kN | ${beamResult.reactions.map(r => `R(${r.label})=${r.Ry}kN`).join(', ')}`,
        status: 'analyzed',
        inputData: { length: beamResult.totalLength, supports, loads },
        resultData: beamResult
      });
      setSavedNotif(true);
      setTimeout(() => setSavedNotif(false), 2500);
    } else if (analysisType === 'truss' && trussResult) {
      DatabaseService.saveCalculationRecord({
        userId: currentUser.uid,
        userEmail: currentUser.email,
        title: `Analisis Rangka Batang (2D Truss): ${trussNodes.length} Buhul, ${trussMembers.length} Batang`,
        category: 'structural_analysis',
        subType: 'truss',
        standard: 'Method of Joints / Direct Stiffness Engine',
        summary: `${trussResult.memberForces.filter(m => m.type === 'Tension').length} Batang Tarik, ${trussResult.memberForces.filter(m => m.type === 'Compression').length} Batang Tekan`,
        status: 'analyzed',
        inputData: { nodes: trussNodes, members: trussMembers, loads: trussLoads },
        resultData: trussResult
      });
      setSavedNotif(true);
      setTimeout(() => setSavedNotif(false), 2500);
    }
  };

  const totalLoadGravity = loads.reduce((sum, l) => {
    if (l.type === 'point') return sum + l.magnitude;
    if (l.type === 'distributed') return sum + l.magnitude * ((l.endPos ?? beamLength) - l.startPos);
    if (l.type === 'triangular') return sum + 0.5 * ((l.magnitudeEnd ?? 0) - l.magnitude) * ((l.endPos ?? beamLength) - l.startPos);
    return sum;
  }, 0);

  return (
    <div className="flex flex-col space-y-3">
      {/* Top Engineering Workspace Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between glass-slab border border-white/[0.08] rounded-3xl p-4 sm:p-5 gap-3 shadow-2xl">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToDashboard}
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs text-slate-200 hover:text-white font-mono transition border border-white/10"
          >
            ← Dashboard
          </button>
          <div>
            <h1 className="text-base font-bold text-white flex items-center gap-2">
              <Compass className="w-4 h-4 text-cyan-400" />
              Hybrid Structural Engineering Workspace
            </h1>
          </div>
        </div>

        {/* Structure Type Tabs: Unified Beam vs 2D Truss CAD (VisionOS Segmented Dock) */}
        <div className="flex bg-black/40 backdrop-blur-xl p-1 rounded-2xl border border-white/10 self-start md:self-auto text-xs shadow-inner">
          <button
            onClick={() => setAnalysisType('beam')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
              analysisType === 'beam' ? 'bg-white text-slate-950 font-bold shadow-md' : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Analisis Balok (Otomatis Tertentu & Tak Tentu)
          </button>
          <button
            onClick={() => setAnalysisType('truss')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
              analysisType === 'truss' ? 'bg-white text-slate-950 font-bold shadow-md' : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <GitCommit className="w-3.5 h-3.5" />
            Rangka Batang (2D Truss CAD)
          </button>
        </div>
      </div>

      {/* Preset Testing Bar for Beam Mode */}
      {analysisType === 'beam' && (
        <div className="glass-card border border-white/[0.08] rounded-2xl px-4 py-2.5 flex flex-wrap items-center justify-between text-xs gap-2">
          <div className="flex flex-wrap items-center gap-1.5 w-full">
            <span className="text-[11px] font-mono text-slate-400 mr-1 hidden sm:inline">Contoh Preset:</span>
            {/* Determinate Beams */}
            <button
              onClick={() => loadBeamPreset('benchmark_beam')}
              className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white rounded-xl border border-white/10 text-[11px] font-medium transition"
              title="Balok Sederhana Sendi-Rol (R=3): L=6m, P=25kN, q=10kN/m"
            >
              Sendi-Rol (R=3)
            </button>
            <button
              onClick={() => loadBeamPreset('triangular_beam')}
              className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white rounded-xl border border-white/10 text-[11px] font-medium transition"
            >
              Beban Segitiga
            </button>
            <button
              onClick={() => loadBeamPreset('cantilever')}
              className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white rounded-xl border border-white/10 text-[11px] font-medium transition"
            >
              Kantilever (Jepit Bebas)
            </button>
            <button
              onClick={() => loadBeamPreset('overhang')}
              className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white rounded-xl border border-white/10 text-[11px] font-medium transition"
            >
              Balok Overhang
            </button>

            <span className="text-white/20 font-mono px-1">|</span>

            {/* Indeterminate Beams (Cross Method Auto) */}
            <button
              onClick={() => loadBeamPreset('fixed_fixed')}
              className="px-2.5 py-1 bg-white/15 hover:bg-white/25 text-white rounded-xl border border-white/20 text-[11px] font-semibold transition shadow-sm"
              title="Balok Statis Tak Tentu Jepit-Jepit (R=6, n=3)"
            >
              Jepit-Jepit (R=6, n=3)
            </button>
            <button
              onClick={() => loadBeamPreset('propped_cantilever')}
              className="px-2.5 py-1 bg-white/15 hover:bg-white/25 text-white rounded-xl border border-white/20 text-[11px] font-semibold transition shadow-sm"
              title="Balok Statis Tak Tentu Jepit-Rol (R=4, n=1)"
            >
              Jepit-Rol (R=4, n=1)
            </button>
            <button
              onClick={() => loadBeamPreset('continuous_2span')}
              className="px-2.5 py-1 bg-white/15 hover:bg-white/25 text-white rounded-xl border border-white/20 text-[11px] font-semibold transition shadow-sm"
              title="Balok Menerus 2 Bentang (R=4, n=1)"
            >
              Menerus 2 Bentang
            </button>
            <button
              onClick={() => loadBeamPreset('continuous_3span')}
              className="px-2.5 py-1 bg-white/15 hover:bg-white/25 text-white rounded-xl border border-white/20 text-[11px] font-semibold transition shadow-sm"
              title="Balok Menerus 3 Bentang (R=5, n=2)"
            >
              Menerus 3 Bentang
            </button>
          </div>
        </div>
      )}

      {/* Beam Material & Section Stiffness Bar (Deflection Calculation Parameters) */}
      {analysisType === 'beam' && (
        <div className="glass-card border border-cyan-800/40 rounded-2xl px-4 py-2 flex flex-wrap items-center justify-between text-xs gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-mono text-cyan-300 font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
              Kekakuan & Lendutan Balok (E & I):
            </span>
            <div className="flex items-center gap-1.5 bg-slate-900/80 px-2 py-1 rounded-xl border border-slate-700">
              <label className="text-[10px] text-slate-400 font-mono">E:</label>
              <input
                type="number"
                value={materialE}
                onChange={e => {
                  const val = Number(e.target.value) || 200000;
                  setMaterialE(val);
                  if (beamLength > 0 && supports.length > 0) {
                    setTimeout(() => runBeamAnalysis(beamLength, supports, loads), 50);
                  }
                }}
                className="w-20 bg-slate-950 text-white font-mono text-xs px-1.5 py-0.5 rounded border border-slate-700"
                step="5000"
              />
              <span className="text-[10px] text-slate-400 font-mono">MPa</span>
            </div>
            {/* Quick E Presets */}
            <div className="flex gap-1 text-[10px] font-mono">
              <button
                onClick={() => {
                  setMaterialE(200000);
                  if (beamLength > 0 && supports.length > 0) setTimeout(() => runBeamAnalysis(beamLength, supports, loads), 50);
                }}
                className={`px-1.5 py-0.5 rounded border transition ${materialE === 200000 ? 'bg-cyan-900/60 border-cyan-500 text-cyan-200 font-bold' : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white'}`}
                title="Baja Struktural (E = 200.000 MPa)"
              >
                Baja (200k)
              </button>
              <button
                onClick={() => {
                  setMaterialE(23500);
                  if (beamLength > 0 && supports.length > 0) setTimeout(() => runBeamAnalysis(beamLength, supports, loads), 50);
                }}
                className={`px-1.5 py-0.5 rounded border transition ${materialE === 23500 ? 'bg-cyan-900/60 border-cyan-500 text-cyan-200 font-bold' : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white'}`}
                title="Beton Bertulang fc' 25 MPa (E = 4700√fc' ≈ 23.500 MPa)"
              >
                Beton (23,5k)
              </button>
              <button
                onClick={() => {
                  setMaterialE(10000);
                  if (beamLength > 0 && supports.length > 0) setTimeout(() => runBeamAnalysis(beamLength, supports, loads), 50);
                }}
                className={`px-1.5 py-0.5 rounded border transition ${materialE === 10000 ? 'bg-cyan-900/60 border-cyan-500 text-cyan-200 font-bold' : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white'}`}
                title="Kayu Struktural Kelas Kuat II (E = 10.000 MPa)"
              >
                Kayu (10k)
              </button>
            </div>

            <span className="text-white/20 font-mono px-1">|</span>

            <div className="flex items-center gap-1.5 bg-slate-900/80 px-2 py-1 rounded-xl border border-slate-700">
              <label className="text-[10px] text-slate-400 font-mono">Inersia I:</label>
              <input
                type="number"
                value={sectionI}
                onChange={e => {
                  const val = Number(e.target.value) || 100;
                  setSectionI(val);
                  if (beamLength > 0 && supports.length > 0) {
                    setTimeout(() => runBeamAnalysis(beamLength, supports, loads), 50);
                  }
                }}
                className="w-20 bg-slate-950 text-white font-mono text-xs px-1.5 py-0.5 rounded border border-slate-700"
                step="50"
              />
              <span className="text-[10px] text-slate-400 font-mono">×10⁶ mm⁴</span>
            </div>
            {/* Quick I Presets */}
            <div className="flex gap-1 text-[10px] font-mono">
              <button
                onClick={() => {
                  setSectionI(72.1);
                  if (beamLength > 0 && supports.length > 0) setTimeout(() => runBeamAnalysis(beamLength, supports, loads), 50);
                }}
                className={`px-1.5 py-0.5 rounded border transition ${sectionI === 72.1 ? 'bg-cyan-900/60 border-cyan-500 text-cyan-200 font-bold' : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white'}`}
                title="Baja Profil IWF 300x150 (I = 72.1 × 10⁶ mm⁴)"
              >
                WF 300x150
              </button>
              <button
                onClick={() => {
                  setSectionI(237);
                  if (beamLength > 0 && supports.length > 0) setTimeout(() => runBeamAnalysis(beamLength, supports, loads), 50);
                }}
                className={`px-1.5 py-0.5 rounded border transition ${sectionI === 237 ? 'bg-cyan-900/60 border-cyan-500 text-cyan-200 font-bold' : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white'}`}
                title="Baja Profil IWF 400x200 (I = 237 × 10⁶ mm⁴)"
              >
                WF 400x200
              </button>
              <button
                onClick={() => {
                  setSectionI(3125);
                  if (beamLength > 0 && supports.length > 0) setTimeout(() => runBeamAnalysis(beamLength, supports, loads), 50);
                }}
                className={`px-1.5 py-0.5 rounded border transition ${sectionI === 3125 ? 'bg-cyan-900/60 border-cyan-500 text-cyan-200 font-bold' : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white'}`}
                title="Balok Beton 300x500 mm (bh³/12 = 3.125 × 10⁶ mm⁴)"
              >
                Beton 30x50
              </button>
            </div>
          </div>
          {beamResult?.deflectionResult && (
            <div className="font-mono text-[11px] text-cyan-400 flex items-center gap-2 bg-cyan-950/40 px-2.5 py-1 rounded-xl border border-cyan-800/60 shadow-inner">
              <span>Lendutan δ_maks: <strong>{beamResult.deflectionResult.maxDeflection} mm</strong> di x = {beamResult.deflectionResult.maxDeflectionX}m</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${beamResult.deflectionResult.isPassL360 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : beamResult.deflectionResult.isPassL240 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'}`}>
                {beamResult.deflectionResult.isPassL360 ? '✓ AMAN (L/360)' : beamResult.deflectionResult.isPassL240 ? '✓ AMAN (L/240)' : '⚠️ DEFLEKSI > BATAS'}
              </span>
            </div>
          )}
        </div>
      )}

      {validationMessage && (
        <div className="bg-amber-950/80 border border-amber-500/80 text-amber-200 px-4 py-2 rounded-xl text-xs flex items-center justify-between shadow-lg">
          <span>⚠️ {validationMessage}</span>
          <button onClick={() => setValidationMessage(null)} className="text-amber-400 hover:text-white font-bold ml-2">
            ✕
          </button>
        </div>
      )}

      {savedNotif && (
        <div className="bg-emerald-950/90 border border-emerald-500 text-emerald-200 px-4 py-2 rounded-xl text-xs flex items-center justify-between shadow-lg">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            Laporan kalkulasi rekayasa berhasil disimpan ke database StructuraLab!
          </span>
          <button onClick={() => setSavedNotif(false)} className="text-emerald-400 hover:text-white font-bold ml-2">
            ✕
          </button>
        </div>
      )}

      {/* WORKSPACE CONTENT: BEAM MODE VS TRUSS CAD MODE */}
      {analysisType === 'beam' ? (
        <>
          {/* Contextual Toolbar for Beam */}
          <AnalysisToolbar
            activeTool={activeToolbarTool}
            onSelectTool={t => {
              setActiveToolbarTool(t);
              if (t === 'add_support') {
                const nextNode = String.fromCharCode(65 + supports.length);
                setSupports([
                  ...supports,
                  {
                    id: 'supp-' + Date.now().toString(36),
                    nodeId: nextNode,
                    type: 'roller',
                    position: Number((beamLength / 2).toFixed(1)),
                    label: `Tumpuan ${nextNode}`
                  }
                ]);
              } else if (t === 'add_load') {
                setLoads([
                  ...loads,
                  {
                    id: 'load-' + Date.now().toString(36),
                    type: 'point',
                    startPos: Number((beamLength / 2).toFixed(1)),
                    magnitude: 20,
                    direction: 'down',
                    label: `P${loads.length + 1}`
                  }
                ]);
              }
            }}
            onNewModel={() => {
              setBeamLength(6.0);
              setSupports([
                { id: 'supp-1', nodeId: 'A', type: 'pin', position: 0, label: 'Tumpuan A' },
                { id: 'supp-2', nodeId: 'B', type: 'roller', position: 6.0, label: 'Tumpuan B' }
              ]);
              setLoads([]);
              setBeamResult(null);
            }}
            onSaveModel={handleSaveCalculation}
            onRunAnalysis={() => runBeamAnalysis()}
            isAnalyzing={isAnalyzing}
            modelSummaryText={`L=${beamLength}m | ${supports.length} Tumpuan | ${loads.length} Beban`}
          />

          {/* Main Grid: Viewport on top for mobile (order-1), Sidebar on left for desktop (lg:order-1) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            {/* CENTER: Structural Viewport */}
            <div className="order-1 lg:order-2 lg:col-span-9 space-y-3">
              <StructuralViewport
                length={beamLength}
                supports={supports}
                loads={loads}
                reactions={beamResult?.reactions || []}
                diagramPoints={beamResult?.diagramPoints || []}
                selectedId={selectedId}
                onSelectObject={handleSelectObject}
                activeViewMode={activeViewMode}
                onChangeViewMode={setActiveViewMode}
                onAddSupportAt={handleAddSupportAt}
                onAddLoadAt={handleAddLoadAt}
              />

              {/* Properties Panel (appears when an element is clicked) */}
              {selectedId && (
                <PropertiesPanel
                  selectedType={selectedType}
                  selectedId={selectedId}
                  supports={supports}
                  onUpdateSupport={updated => {
                    setSupports(supports.map(s => (s.id === updated.id ? updated : s)));
                    setTimeout(runBeamAnalysis, 50);
                  }}
                  onDeleteSupport={id => {
                    setSupports(supports.filter(s => s.id !== id));
                    setSelectedId(null);
                    setTimeout(runBeamAnalysis, 50);
                  }}
                  loads={loads}
                  onUpdateLoad={updated => {
                    setLoads(loads.map(l => (l.id === updated.id ? updated : l)));
                    setTimeout(runBeamAnalysis, 50);
                  }}
                  onDeleteLoad={id => {
                    setLoads(loads.filter(l => l.id !== id));
                    setSelectedId(null);
                    setTimeout(runBeamAnalysis, 50);
                  }}
                  beamLength={beamLength}
                  onClose={() => setSelectedId(null)}
                />
              )}
            </div>

            {/* LEFT SIDEBAR: Model Explorer */}
            <div className="order-2 lg:order-1 lg:col-span-3 h-auto lg:h-[520px] rounded-3xl overflow-hidden glass-slab border border-white/[0.08]">
              <ModelExplorer
                beamLength={beamLength}
                onUpdateBeamLength={newLen => {
                  setBeamLength(newLen);
                  setSupports(supports.map((s, idx) => (idx === 1 ? { ...s, position: newLen } : s)));
                  setTimeout(runBeamAnalysis, 50);
                }}
                supports={supports}
                onUpdateSupports={newSupps => {
                  setSupports(newSupps);
                  setTimeout(runBeamAnalysis, 50);
                }}
                loads={loads}
                onUpdateLoads={newLoads => {
                  setLoads(newLoads);
                  setTimeout(runBeamAnalysis, 50);
                }}
                selectedId={selectedId}
                onSelectObject={handleSelectObject}
                materialE={materialE}
                onUpdateMaterialE={setMaterialE}
                sectionI={sectionI}
                onUpdateSectionI={setSectionI}
              />
            </div>
          </div>

          {/* Dedicated Load Manager Panel */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            <div className="lg:col-span-12">
              <LoadManager
                loads={loads}
                onUpdateLoads={newLoads => {
                  setLoads(newLoads);
                  setTimeout(runBeamAnalysis, 50);
                }}
                beamLength={beamLength}
                onSelectLoad={id => handleSelectObject('load', id)}
              />
            </div>
          </div>

          {/* BOTTOM PANEL: Resizable Tabbed Results & Calculation */}
          <ResultsPanel
            result={beamResult}
            analysisMode="beam"
            beamLength={beamLength}
            totalLoadGravity={totalLoadGravity}
          />
        </>
      ) : (
        /* 2D TRUSS CAD MODE */
        <div className="space-y-3">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            {/* Center: Interactive Truss CAD Viewport */}
            <div className="order-1 lg:order-2 lg:col-span-9">
              <TrussCADViewport
                nodes={trussNodes}
                members={trussMembers}
                loads={trussLoads}
                result={trussResult}
                onUpdateNodes={nds => {
                  setTrussNodes(nds);
                  if (nds.length > 0 && trussMembers.length > 0) {
                    setTimeout(() => runTrussAnalysis(nds, trussMembers, trussLoads), 50);
                  }
                }}
                onUpdateMembers={mems => {
                  setTrussMembers(mems);
                  if (trussNodes.length > 0 && mems.length > 0) {
                    setTimeout(() => runTrussAnalysis(trussNodes, mems, trussLoads), 50);
                  }
                }}
                onUpdateLoads={lds => {
                  setTrussLoads(lds);
                  if (trussNodes.length > 0 && trussMembers.length > 0) {
                    setTimeout(() => runTrussAnalysis(trussNodes, trussMembers, lds), 50);
                  }
                }}
                onRunAnalysis={() => runTrussAnalysis()}
                onLoadPreset={loadTrussPreset}
              />
            </div>

            {/* Left Sidebar: Truss Model Explorer */}
            <div className="order-2 lg:order-1 lg:col-span-3 h-auto lg:h-[520px] rounded-3xl overflow-hidden glass-slab border border-white/[0.08]">
              <TrussModelExplorer
                nodes={trussNodes}
                onUpdateNodes={nds => {
                  setTrussNodes(nds);
                  if (nds.length > 0 && trussMembers.length > 0) {
                    setTimeout(() => runTrussAnalysis(nds, trussMembers, trussLoads), 50);
                  }
                }}
                members={trussMembers}
                onUpdateMembers={mems => {
                  setTrussMembers(mems);
                  if (trussNodes.length > 0 && mems.length > 0) {
                    setTimeout(() => runTrussAnalysis(trussNodes, mems, trussLoads), 50);
                  }
                }}
                loads={trussLoads}
                onUpdateLoads={lds => {
                  setTrussLoads(lds);
                  if (trussNodes.length > 0 && trussMembers.length > 0) {
                    setTimeout(() => runTrussAnalysis(trussNodes, trussMembers, lds), 50);
                  }
                }}
                onRunAnalysis={() => runTrussAnalysis()}
                onLoadPreset={loadTrussPreset}
              />
            </div>
          </div>

          {/* Bottom Panel: Truss Results & Method of Joints */}
          <ResultsPanel
            trussResult={trussResult}
            analysisMode="truss"
            trussNodes={trussNodes}
            trussMembers={trussMembers}
            trussLoads={trussLoads}
          />
        </div>
      )}
    </div>
  );
};
