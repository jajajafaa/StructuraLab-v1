// Types for Structural Analysis Engine

export type SupportType = 'pin' | 'roller' | 'fixed' | 'free';

export interface Support {
  id: string;
  nodeId: string;
  type: SupportType;
  position: number; // position x along member or beam (m)
  label?: string;
}

export type LoadType = 'point' | 'distributed' | 'triangular' | 'trapezoidal' | 'moment';

export interface StructuralLoad {
  id: string;
  type: LoadType;
  // Position in meters along the beam/member
  startPos: number;
  endPos?: number;
  // Magnitudes: positive downward for gravity loads in engineering convention (or specified direction)
  magnitude: number; // kN for point load, kN/m for uniform/triangular start, kN.m for moment
  magnitudeEnd?: number; // for trapezoidal or triangular (kN/m)
  direction: 'down' | 'up' | 'cw' | 'ccw'; // clockwise or counter-clockwise for moment
  label?: string;
}

export interface BeamSpan {
  id?: string;
  length: number; // meters
  E: number; // MPa
  I: number; // mm^4 (or m^4 converted)
  A?: number; // mm^2
}

export interface SupportReaction {
  supportId: string;
  position: number;
  label: string;
  type: SupportType;
  Ry: number; // Vertical reaction (kN) (positive upwards)
  Rx: number; // Horizontal reaction (kN)
  M: number;  // Moment reaction (kN.m) (positive counter-clockwise)
}

export interface DiagramPoint {
  x: number; // meters from origin
  V: number; // Shear force in kN
  M: number; // Bending moment in kN.m
  N: number; // Axial force in kN
  deflection?: number; // Deflection in mm
}

export interface CriticalValue {
  type: 'max_moment' | 'min_moment' | 'max_shear' | 'min_shear' | 'zero_shear' | 'inflection_point';
  x: number;
  value: number;
  description: string;
}

export interface CalculationStep {
  stepNumber: number;
  title: string;
  description?: string;
  formula?: string;
  substitution?: string;
  result?: string;
  note?: string;
  explanation?: string;
}

export interface QuadraticMomentCheck {
  loadLabel: string;
  startPos: number;
  endPos: number;
  w: number;
  midPos: number;
  mMidActual: number;
  mMidLinearChord: number;
  parabolicSagitta: number;
  expectedSagitta: number;
  isQuadratic: boolean;
  shearAreaMatch: boolean;
  explanation: string;
}

export interface DeflectionResult {
  maxDeflection: number; // mm (positive downward magnitude)
  maxDeflectionX: number; // m location along beam
  allowableDeflectionL240: number; // L / 240 in mm
  allowableDeflectionL360: number; // L / 360 in mm
  isPassL240: boolean;
  isPassL360: boolean;
  E: number; // MPa
  I: number; // mm^4
  formulaDescription: string;
  deflectionPoints: Array<{ x: number; delta: number }>; // delta in mm along beam
}

export interface BeamAnalysisResult {
  isDeterminate: boolean;
  degreeOfIndeterminacy: number;
  methodUsed: string;
  totalLength: number;
  reactions: SupportReaction[];
  diagramPoints: DiagramPoint[];
  criticalValues: CriticalValue[];
  maxMoment: { x: number; value: number };
  minMoment: { x: number; value: number };
  maxShear: { x: number; value: number };
  minShear: { x: number; value: number };
  equilibriumCheck: {
    sumFy: number;
    sumM: number;
    isBalanced: boolean;
  };
  steps: CalculationStep[];
  quadraticMomentChecks?: QuadraticMomentCheck[];
  deflectionResult?: DeflectionResult;
  // Moment Distribution specifics if indeterminate
  crossTable?: {
    joints: string[];
    members: string[];
    distributionFactors: Record<string, number>;
    fem: Record<string, number>;
    cycles: Array<{
      distribution: Record<string, number>;
      carryOver: Record<string, number>;
    }>;
    finalMoments: Record<string, number>;
  };
}

// 2D Truss Types
export interface TrussNode {
  id: string;
  x: number;
  y: number;
  support?: SupportType;
}

export interface TrussMember {
  id: string;
  nodeStartId: string;
  nodeEndId: string;
  E: number;
  A: number;
}

export interface TrussNodeLoad {
  id: string;
  nodeId: string;
  Fx: number; // kN
  Fy: number; // kN (positive upwards)
}

export interface TrussAnalysisResult {
  isStable: boolean;
  isDeterminate: boolean;
  supportReactions: Array<{ nodeId: string; Rx: number; Ry: number }>;
  memberForces: Array<{
    memberId: string;
    force: number; // kN (+ tension, - compression)
    type: 'Tension' | 'Compression' | 'Zero-force';
    stress: number; // MPa
  }>;
  steps: CalculationStep[];
}
