// Authentication and User Profile Models
export type UserRole = 'admin' | 'user';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt: string;
  lastLogin: string;
  calculationsCount: number;
  visitCount?: number;
  deviceInfo?: string;
  browser?: string;
  isGuest?: boolean;
}

// Calculation History Item
export interface CalculationRecord {
  id: string;
  userId: string;
  userEmail: string;
  title: string;
  category: 'structural_analysis' | 'concrete_design' | 'shear_design';
  subType: string; // 'beam_determinant' | 'cross_continuous' | 'slope_deflection' | 'truss' | 'singly_reinforced' | 'doubly_reinforced' | 't_beam' | 'stirrup_design'
  standard: string; // 'SNI 2847:2013' | 'Mekanika Rekayasa'
  timestamp: string;
  summary: string;
  status: 'safe' | 'unsafe' | 'analyzed' | 'optimized';
  inputData: any;
  resultData: any;
}

// App Settings managed by Admin
export interface AppStandardConfig {
  defaultStandard: string;
  concreteCoverDefault: number; // mm
  steelEsDefault: number; // MPa
  allowBetaReduction: boolean;
  maxStirrupSpacingLimit: number; // mm
  autoCalculateSelfWeight: boolean;
  reinforcedConcreteDensity: number; // kN/m3
}
