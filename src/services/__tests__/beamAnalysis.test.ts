import test from 'node:test';
import assert from 'node:assert/strict';
import {
  solveDeterminateBeam,
  solveIndeterminateCrossBeam,
  generateBeamDiagramAndChecks,
  solveTruss2D
} from '../structuralEngine';
import { Support, StructuralLoad, BeamSpan, TrussNode, TrussMember, TrussNodeLoad } from '../../types/structural';

test('Simple beam with constant UDL (w = 10 kN/m, L = 6 m) produces true quadratic parabola', () => {
  const supports: Support[] = [
    { id: 's1', nodeId: 'A', type: 'pin', position: 0 },
    { id: 's2', nodeId: 'B', type: 'roller', position: 6 }
  ];
  const loads: StructuralLoad[] = [
    { id: 'l1', type: 'distributed', startPos: 0, endPos: 6, magnitude: 10, direction: 'down' }
  ];

  const result = solveDeterminateBeam(6, supports, loads);

  // 1. Reactions check
  assert.equal(result.reactions[0].Ry, 30);
  assert.equal(result.reactions[1].Ry, 30);
  assert.equal(result.equilibriumCheck.isBalanced, true);

  // 2. Maximum moment check (w*L^2 / 8 = 10 * 36 / 8 = 45 kN.m)
  assert.equal(result.maxMoment.value, 45);
  assert.equal(result.maxMoment.x, 3);

  // 3. Quadratic curvature check: sagitta delta = w*L^2/8 = 45 kN.m
  assert.ok(result.quadraticMomentChecks, 'quadraticMomentChecks must exist');
  assert.equal(result.quadraticMomentChecks.length, 1);
  const check = result.quadraticMomentChecks[0];
  assert.equal(check.expectedSagitta, 45);
  assert.equal(check.parabolicSagitta, 45);
  assert.equal(check.isQuadratic, true);
  assert.equal(check.shearAreaMatch, true);

  // 4. Differential law check dV/dx = -w:
  const p1 = result.diagramPoints.find(p => p.x >= 1.0 && p.x <= 1.5);
  const p2 = result.diagramPoints.find(p => p.x >= 2.0 && p.x <= 2.5);
  assert.ok(p1 && p2);
  const slopeV = (p2.V - p1.V) / (p2.x - p1.x);
  assert.ok(Math.abs(slopeV - (-10)) < 0.2, `dV/dx expected -10, got ${slopeV}`);

  // 5. Differential law check dM/dx = V:
  const slopeM = (p2.M - p1.M) / (p2.x - p1.x);
  const avgV = (p1.V + p2.V) / 2;
  assert.ok(Math.abs(slopeM - avgV) < 0.3, `dM/dx expected ${avgV}, got ${slopeM}`);
});

test('Point load causes vertical step jump in SFD while BMD remains continuous', () => {
  const supports: Support[] = [
    { id: 's1', nodeId: 'A', type: 'pin', position: 0 },
    { id: 's2', nodeId: 'B', type: 'roller', position: 6 }
  ];
  const loads: StructuralLoad[] = [
    { id: 'l1', type: 'point', startPos: 3, magnitude: 24, direction: 'down' }
  ];

  const result = solveDeterminateBeam(6, supports, loads);

  // Reaction check: 12 kN at each support
  assert.equal(result.reactions[0].Ry, 12);
  assert.equal(result.reactions[1].Ry, 12);

  // At x = 3, there should be both pre-jump and post-jump points
  const pointsAt3 = result.diagramPoints.filter(p => Math.abs(p.x - 3) < 0.005);
  assert.ok(pointsAt3.length >= 2, 'Should have pre-jump and post-jump points at point load station');
  const vPre = pointsAt3[0].V;
  const vPost = pointsAt3[pointsAt3.length - 1].V;
  assert.equal(vPre, 12, 'Pre-jump shear should be +12');
  assert.equal(vPost, -12, 'Post-jump shear should be -12');
  assert.equal(vPost - vPre, -24, 'Shear jump Delta V must equal -P');

  // Moment at x = 3 must be continuous (same before and after jump)
  assert.equal(pointsAt3[0].M, 36);
  assert.equal(pointsAt3[pointsAt3.length - 1].M, 36);
});

test('Cantilever with uniform load (L = 4 m, w = 10 kN/m)', () => {
  const supports: Support[] = [
    { id: 's1', nodeId: 'A', type: 'fixed', position: 0 }
  ];
  const loads: StructuralLoad[] = [
    { id: 'l1', type: 'distributed', startPos: 0, endPos: 4, magnitude: 10, direction: 'down' }
  ];

  const result = solveDeterminateBeam(4, supports, loads);

  assert.equal(result.reactions[0].Ry, 40);
  assert.equal(result.reactions[0].M, -80);

  // End of cantilever (x = 4) has zero moment
  const endPoint = result.diagramPoints[result.diagramPoints.length - 1];
  assert.equal(endPoint.M, 0);

  // Sagitta check: delta = w*L^2/8 = 10 * 16 / 8 = 20 kN.m
  assert.ok(result.quadraticMomentChecks);
  const chk = result.quadraticMomentChecks[0];
  assert.equal(chk.expectedSagitta, 20);
  assert.equal(chk.parabolicSagitta, 20);
  assert.equal(chk.isQuadratic, true);
});

test('Continuous 2-span beam (Metode Cross) with multi-span UDL (w = 15 kN/m across L = 10 m)', () => {
  const spans: BeamSpan[] = [
    { id: 'sp1', length: 5, E: 200000, I: 0.0001 },
    { id: 'sp2', length: 5, E: 200000, I: 0.0001 }
  ];
  const supports: Support[] = [
    { id: 's1', nodeId: 'A', type: 'pin', position: 0 },
    { id: 's2', nodeId: 'B', type: 'roller', position: 5 },
    { id: 's3', nodeId: 'C', type: 'roller', position: 10 }
  ];
  const loads: StructuralLoad[] = [
    { id: 'l1', type: 'distributed', startPos: 0, endPos: 10, magnitude: 15, direction: 'down' }
  ];

  const result = solveIndeterminateCrossBeam(spans, supports, loads);

  // Check middle support negative moment MB = -w*L^2/8 = -15*25/8 = -46.88 kN.m
  assert.ok(Math.abs(result.minMoment.value - (-46.88)) < 0.2, `Expected MB around -46.88, got ${result.minMoment.value}`);

  // Reactions check: R_A = 28.125, R_B = 93.75, R_C = 28.125
  const rA = result.reactions.find(r => Math.abs(r.position - 0) < 0.1);
  const rB = result.reactions.find(r => Math.abs(r.position - 5) < 0.1);
  const rC = result.reactions.find(r => Math.abs(r.position - 10) < 0.1);
  assert.ok(rA && rB && rC);
  assert.ok(Math.abs(rA.Ry - 28.13) < 0.2);
  assert.ok(Math.abs(rB.Ry - 93.75) < 0.2);
  assert.ok(Math.abs(rC.Ry - 28.13) < 0.2);

  // Quadratic check: Sagitta delta on both spans [0, 5] and [5, 10] = w*L_span^2 / 8 = 15 * 25 / 8 = 46.88
  assert.ok(result.quadraticMomentChecks);
  assert.equal(result.quadraticMomentChecks.length, 2, 'Should verify both continuous spans individually');
  const chk1 = result.quadraticMomentChecks[0];
  const chk2 = result.quadraticMomentChecks[1];
  assert.equal(chk1.isQuadratic, true);
  assert.equal(chk2.isQuadratic, true);
  assert.equal(chk1.expectedSagitta, 46.88);
  assert.equal(chk2.expectedSagitta, 46.88);
});

test('3-span beam benchmark from reference PDF (Span 1: L=6, P=40; Span 2: L=8, q=20; Span 3: L=6)', () => {
  const spans: BeamSpan[] = [
    { id: 'sp1', length: 6, E: 200000, I: 0.0001 },
    { id: 'sp2', length: 8, E: 200000, I: 0.0001 },
    { id: 'sp3', length: 6, E: 200000, I: 0.0001 }
  ];
  const supports: Support[] = [
    { id: 's1', nodeId: 'A', type: 'pin', position: 0 },
    { id: 's2', nodeId: 'B', type: 'roller', position: 6 },
    { id: 's3', nodeId: 'C', type: 'roller', position: 14 },
    { id: 's4', nodeId: 'D', type: 'roller', position: 20 }
  ];
  const loads: StructuralLoad[] = [
    { id: 'l1', type: 'point', startPos: 3, magnitude: 40, direction: 'down' },
    { id: 'l2', type: 'distributed', startPos: 6, endPos: 14, magnitude: 20, direction: 'down' }
  ];

  const result = solveIndeterminateCrossBeam(spans, supports, loads);

  // Cross table verification
  assert.ok(result.crossTable);
  // Span 2 has UDL q=20 from 6 to 14 (L = 8 m)
  // Expected sagitta delta = q * L^2 / 8 = 20 * 64 / 8 = 160 kN.m
  assert.ok(result.quadraticMomentChecks);
  const chkSpan2 = result.quadraticMomentChecks.find(c => c.startPos === 6 && c.endPos === 14);
  assert.ok(chkSpan2);
  assert.equal(chkSpan2.expectedSagitta, 160);
  assert.equal(chkSpan2.isQuadratic, true);
  assert.equal(chkSpan2.shearAreaMatch, true);
});

test('Beam deflection calculation for simple span with UDL (5*w*L^4 / 384*EI)', () => {
  const supports: Support[] = [
    { id: 's1', nodeId: 'A', type: 'pin', position: 0 },
    { id: 's2', nodeId: 'B', type: 'roller', position: 6 }
  ];
  const loads: StructuralLoad[] = [
    { id: 'l1', type: 'distributed', startPos: 0, endPos: 6, magnitude: 10, direction: 'down' }
  ];

  // E = 200,000 MPa, I = 83.333333 * 1e6 mm4 (e.g. WF 300x150 or 250x500 concrete beam)
  const result = solveDeterminateBeam(6, supports, loads, 200000, 83.333333);
  assert.ok(result.deflectionResult);
  const defl = result.deflectionResult;

  // Theoretical delta_max = 5 * w * L^4 / (384 * E * I)
  // w = 10 kN/m = 10 N/mm
  // L = 6000 mm
  // E = 200,000 N/mm2
  // I = 83,333,333 mm4
  // delta_max = 5 * 10 * 6000^4 / (384 * 200000 * 83333333) = 10.125 mm at midspan x = 3.0 m
  assert.ok(defl.maxDeflection > 9.5 && defl.maxDeflection < 10.5, `Expected max deflection near 10.12mm, got ${defl.maxDeflection}`);
  assert.ok(Math.abs(defl.maxDeflectionX - 3.0) < 0.25, `Expected max deflection near x=3.0, got ${defl.maxDeflectionX}`);
  assert.equal(defl.allowableDeflectionL240, 25); // 6000 / 240 = 25 mm
  assert.ok(defl.isPassL240);
  assert.ok(defl.deflectionPoints.length > 50);
});

test('2D Truss equilibrium solver for arbitrary triangular truss', () => {
  const nodes: TrussNode[] = [
    { id: 'n1', x: 0, y: 0, support: 'pin' },
    { id: 'n2', x: 4, y: 0, support: 'roller' },
    { id: 'n3', x: 2, y: 3, support: 'free' }
  ];
  const members: TrussMember[] = [
    { id: 'm1', nodeStartId: 'n1', nodeEndId: 'n2', E: 200000, A: 2000 },
    { id: 'm2', nodeStartId: 'n1', nodeEndId: 'n3', E: 200000, A: 2000 },
    { id: 'm3', nodeStartId: 'n2', nodeEndId: 'n3', E: 200000, A: 2000 }
  ];
  const loads: TrussNodeLoad[] = [
    { id: 'l1', nodeId: 'n3', Fx: 0, Fy: -30 }
  ];

  const trussRes = solveTruss2D(nodes, members, loads);
  assert.ok(trussRes);
  assert.equal(trussRes.memberForces.length, 3);
  assert.ok(trussRes.steps.length >= 2);

  // Reaction checks: Total downward = 30 kN -> RA_y = 15 kN, RB_y = 15 kN
  const r1 = trussRes.supportReactions.find(r => r.nodeId === 'n1');
  const r2 = trussRes.supportReactions.find(r => r.nodeId === 'n2');
  assert.ok(r1 && r2);
  assert.equal(r1.Ry, 15);
  assert.equal(r2.Ry, 15);

  // Symmetry: m2 (AC) and m3 (BC) should have identical compression force
  const mAC = trussRes.memberForces.find(m => m.memberId === 'm2');
  const mBC = trussRes.memberForces.find(m => m.memberId === 'm3');
  assert.ok(mAC && mBC);
  assert.equal(mAC.type, 'Compression');
  assert.equal(mBC.type, 'Compression');
  assert.ok(Math.abs(Math.abs(mAC.force) - Math.abs(mBC.force)) < 0.2);
});

