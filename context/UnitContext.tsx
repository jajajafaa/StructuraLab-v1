import React, { createContext, useContext, useState, useEffect } from 'react';

export type UnitSystem = 'si' | 'imperial';

export interface UnitSymbols {
  length: string;      // m vs ft
  dim: string;         // mm vs in
  area: string;        // mm² vs in²
  force: string;       // kN vs kip
  distLoad: string;    // kN/m vs kip/ft
  moment: string;      // kN·m vs kip·ft
  stress: string;      // MPa vs ksi
  density: string;     // kN/m³ vs pcf
  inertia: string;     // mm⁴ vs in⁴
}

export interface UnitContextValue {
  unitSystem: UnitSystem;
  setUnitSystem: (system: UnitSystem) => void;
  toggleUnitSystem: () => void;
  symbols: UnitSymbols;
  
  // Convert canonical SI values to current display system
  convertLength: (m: number) => number;
  convertDim: (mm: number) => number;
  convertArea: (mm2: number) => number;
  convertForce: (kN: number) => number;
  convertDistLoad: (kNm: number) => number;
  convertMoment: (kNm: number) => number;
  convertStress: (MPa: number) => number;

  // Convert current user input back to canonical SI
  toSILength: (val: number) => number;
  toSIDim: (val: number) => number;
  toSIArea: (val: number) => number;
  toSIForce: (val: number) => number;
  toSIDistLoad: (val: number) => number;
  toSIMoment: (val: number) => number;
  toSIStress: (val: number) => number;

  // Formatting helpers
  formatLength: (m: number, decimals?: number) => string;
  formatDim: (mm: number, decimals?: number) => string;
  formatForce: (kN: number, decimals?: number) => string;
  formatDistLoad: (kNm: number, decimals?: number) => string;
  formatMoment: (kNm: number, decimals?: number) => string;
  formatStress: (MPa: number, decimals?: number) => string;
}

const STORAGE_KEY = 'structuralab_unit_system';

// Conversion Constants
const M_TO_FT = 3.280839895;
const MM_TO_IN = 0.0393700787;
const MM2_TO_IN2 = 0.0015500031;
const KN_TO_KIP = 0.2248089431;
const KNM_TO_KIPFT = 0.0685217659; // for distributed load (kN/m to kip/ft)
const KNM_MOMENT_TO_KIPFT = 0.7375621493; // for moment (kN·m to kip·ft)
const MPA_TO_KSI = 0.1450377377;

export const SI_SYMBOLS: UnitSymbols = {
  length: 'm',
  dim: 'mm',
  area: 'mm²',
  force: 'kN',
  distLoad: 'kN/m',
  moment: 'kN·m',
  stress: 'MPa',
  density: 'kN/m³',
  inertia: 'mm⁴'
};

export const IMPERIAL_SYMBOLS: UnitSymbols = {
  length: 'ft',
  dim: 'in',
  area: 'in²',
  force: 'kip',
  distLoad: 'kip/ft',
  moment: 'kip·ft',
  stress: 'ksi',
  density: 'pcf',
  inertia: 'in⁴'
};

const UnitContext = createContext<UnitContextValue | undefined>(undefined);

export const UnitProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [unitSystem, setUnitSystemState] = useState<UnitSystem>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return (saved === 'imperial' || saved === 'si') ? saved : 'si';
    } catch {
      return 'si';
    }
  });

  const setUnitSystem = (system: UnitSystem) => {
    setUnitSystemState(system);
    try {
      localStorage.setItem(STORAGE_KEY, system);
    } catch {}
  };

  const toggleUnitSystem = () => {
    setUnitSystem(unitSystem === 'si' ? 'imperial' : 'si');
  };

  const symbols = unitSystem === 'si' ? SI_SYMBOLS : IMPERIAL_SYMBOLS;

  // Conversion functions from SI
  const convertLength = (m: number): number => {
    return unitSystem === 'si' ? m : m * M_TO_FT;
  };

  const convertDim = (mm: number): number => {
    return unitSystem === 'si' ? mm : mm * MM_TO_IN;
  };

  const convertArea = (mm2: number): number => {
    return unitSystem === 'si' ? mm2 : mm2 * MM2_TO_IN2;
  };

  const convertForce = (kN: number): number => {
    return unitSystem === 'si' ? kN : kN * KN_TO_KIP;
  };

  const convertDistLoad = (kNm: number): number => {
    return unitSystem === 'si' ? kNm : kNm * KNM_TO_KIPFT;
  };

  const convertMoment = (kNm: number): number => {
    return unitSystem === 'si' ? kNm : kNm * KNM_MOMENT_TO_KIPFT;
  };

  const convertStress = (MPa: number): number => {
    return unitSystem === 'si' ? MPa : MPa * MPA_TO_KSI;
  };

  // Conversion functions to SI
  const toSILength = (val: number): number => {
    return unitSystem === 'si' ? val : val / M_TO_FT;
  };

  const toSIDim = (val: number): number => {
    return unitSystem === 'si' ? val : val / MM_TO_IN;
  };

  const toSIArea = (val: number): number => {
    return unitSystem === 'si' ? val : val / MM2_TO_IN2;
  };

  const toSIForce = (val: number): number => {
    return unitSystem === 'si' ? val : val / KN_TO_KIP;
  };

  const toSIDistLoad = (val: number): number => {
    return unitSystem === 'si' ? val : val / KNM_TO_KIPFT;
  };

  const toSIMoment = (val: number): number => {
    return unitSystem === 'si' ? val : val / KNM_MOMENT_TO_KIPFT;
  };

  const toSIStress = (val: number): number => {
    return unitSystem === 'si' ? val : val / MPA_TO_KSI;
  };

  // Formatter helpers
  const formatLength = (m: number, decimals = 2): string => {
    const val = convertLength(m);
    return `${val.toFixed(decimals)} ${symbols.length}`;
  };

  const formatDim = (mm: number, decimals = 1): string => {
    const val = convertDim(mm);
    return `${val.toFixed(decimals)} ${symbols.dim}`;
  };

  const formatForce = (kN: number, decimals = 2): string => {
    const val = convertForce(kN);
    return `${val.toFixed(decimals)} ${symbols.force}`;
  };

  const formatDistLoad = (kNm: number, decimals = 2): string => {
    const val = convertDistLoad(kNm);
    return `${val.toFixed(decimals)} ${symbols.distLoad}`;
  };

  const formatMoment = (kNm: number, decimals = 2): string => {
    const val = convertMoment(kNm);
    return `${val.toFixed(decimals)} ${symbols.moment}`;
  };

  const formatStress = (MPa: number, decimals = 1): string => {
    const val = convertStress(MPa);
    return `${val.toFixed(decimals)} ${symbols.stress}`;
  };

  return (
    <UnitContext.Provider
      value={{
        unitSystem,
        setUnitSystem,
        toggleUnitSystem,
        symbols,
        convertLength,
        convertDim,
        convertArea,
        convertForce,
        convertDistLoad,
        convertMoment,
        convertStress,
        toSILength,
        toSIDim,
        toSIArea,
        toSIForce,
        toSIDistLoad,
        toSIMoment,
        toSIStress,
        formatLength,
        formatDim,
        formatForce,
        formatDistLoad,
        formatMoment,
        formatStress
      }}
    >
      {children}
    </UnitContext.Provider>
  );
};

export const useUnits = (): UnitContextValue => {
  const context = useContext(UnitContext);
  if (!context) {
    throw new Error('useUnits must be used within a UnitProvider');
  }
  return context;
};
