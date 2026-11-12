// Centralized Structural Model State according to Matrix Structural Analysis design pattern

import { SupportType, LoadType } from './structural';

export interface ModelNode {
  id: string;
  name: string;
  x: number; // meters
  y: number; // meters
  support?: {
    type: SupportType;
    restraints: {
      ux: boolean; // horizontal restraint
      uy: boolean; // vertical restraint
      rz: boolean; // rotational restraint (moment)
    };
  };
}

export interface ModelMaterial {
  id: string;
  name: string; // e.g., 'Beton f\'c 25 MPa', 'Baja BJ41'
  E: number;    // Modulus of Elasticity in MPa
  density: number; // kN/m³
}

export interface ModelSection {
  id: string;
  name: string;
  b: number; // mm
  h: number; // mm
  A: number; // mm²
  I: number; // mm⁴
}

export interface ModelMember {
  id: string;
  name: string;
  startNodeId: string;
  endNodeId: string;
  materialId: string;
  sectionId: string;
}

export interface ModelLoad {
  id: string;
  memberId: string;
  type: LoadType;
  startPos: number; // m from start node
  endPos?: number;   // m from start node
  magnitude: number; // kN or kN/m or kN.m
  magnitudeEnd?: number; // for trapezoidal or triangular (kN/m)
  direction: 'down' | 'up' | 'cw' | 'ccw';
  label: string;
}

export interface CentralStructuralModel {
  nodes: ModelNode[];
  members: ModelMember[];
  materials: ModelMaterial[];
  sections: ModelSection[];
  loads: ModelLoad[];
}
