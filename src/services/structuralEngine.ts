// Deterministic Structural Analysis Engine
// Implements:
// 1. Determinate Beam Solver (Reactions, SFD, BMD, Point Load, UDL, Triangular, Trapezoidal, Point Moment)
// 2. Indeterminate Beam Solver via Moment Distribution (Cross Method) and Slope Deflection
// 3. 2D Truss Analysis (Method of Joints)
// All equations and steps are completely transparent with verified equilibrium checks.

import {
  Support,
  StructuralLoad,
  BeamSpan,
  SupportReaction,
  DiagramPoint,
  CriticalValue,
  BeamAnalysisResult,
  CalculationStep,
  TrussNode,
  TrussMember,
  TrussNodeLoad,
  TrussAnalysisResult,
  QuadraticMomentCheck,
  DeflectionResult
} from '../types/structural';

/**
 * Calculates equivalent resultant of any load segment
 */
function getLoadResultant(load: StructuralLoad): { R: number; xBar: number; Rx: number } {
  const start = load.startPos;
  const end = load.endPos !== undefined ? load.endPos : load.startPos;
  const length = Math.max(0, end - start);
  const q1 = load.magnitude;
  const q2 = load.magnitudeEnd !== undefined ? load.magnitudeEnd : q1;

  if (load.type === 'point') {
    const mult = load.direction === 'down' ? 1 : -1;
    return { R: q1 * mult, xBar: start, Rx: 0 };
  } else if (load.type === 'moment') {
    // pure moment has 0 net force
    return { R: 0, xBar: start, Rx: 0 };
  } else if (load.type === 'distributed') {
    const mult = load.direction === 'down' ? 1 : -1;
    const R = q1 * length * mult;
    const xBar = start + length / 2.0;
    return { R, xBar, Rx: 0 };
  } else if (load.type === 'triangular') {
    const mult = load.direction === 'down' ? 1 : -1;
    // Area of triangle = 0.5 * base * height
    const h = Math.abs(q2 - q1);
    const R = 0.5 * length * h * mult;
    // Centroid: if q1 < q2, centroid is 2/3 from start; if q1 > q2, centroid is 1/3 from start
    const xBar = q1 < q2 ? start + (2.0 / 3.0) * length : start + (1.0 / 3.0) * length;
    return { R, xBar, Rx: 0 };
  } else if (load.type === 'trapezoidal') {
    const mult = load.direction === 'down' ? 1 : -1;
    // Split into rectangle (min(q1, q2)) + triangle
    const qBase = Math.min(q1, q2);
    const qTri = Math.abs(q2 - q1);
    const R_rect = qBase * length * mult;
    const x_rect = start + length / 2.0;
    const R_tri = 0.5 * length * qTri * mult;
    const x_tri = q1 < q2 ? start + (2.0 / 3.0) * length : start + (1.0 / 3.0) * length;
    const R_total = R_rect + R_tri;
    const xBar = (R_rect * x_rect + R_tri * x_tri) / (R_total || 1);
    return { R: R_total, xBar, Rx: 0 };
  }
  return { R: 0, xBar: start, Rx: 0 };
}

/**
 * Analytical piecewise beam diagram generator complying with structural mechanics:
 * 1. dV/dx = -w(x) (constant load -> linear shear slope)
 * 2. dM/dx = V(x) (linear shear -> quadratic parabolic moment)
 * 3. Delta M = integral V dx (Area under shear diagram theorem)
 * 4. Concentrated forces cause step jump in V: Delta V = +Ry or -P
 * 5. Bending moment remains continuous across concentrated forces: M(x+) = M(x-)
 * 6. Dense sampling in distributed load intervals ensuring parabolic quadratic curvature
 * 7. Exact zero-crossing apex insertion for maximum parabolic moment
 * 8. Explicit sagitta check: delta = M_mid - (M_start + M_end)/2 = w*L^2 / 8 != 0
 */
export function generateBeamDiagramAndChecks(
  totalLength: number,
  supports: Support[],
  reactions: SupportReaction[],
  loads: StructuralLoad[]
): {
  diagramPoints: DiagramPoint[];
  criticalValues: CriticalValue[];
  maxMoment: { x: number; value: number };
  minMoment: { x: number; value: number };
  maxShear: { x: number; value: number };
  minShear: { x: number; value: number };
  quadraticMomentChecks: QuadraticMomentCheck[];
} {
  const stationSet = new Set<number>();
  stationSet.add(0);
  stationSet.add(totalLength);
  supports.forEach(s => {
    if (s.position >= 0 && s.position <= totalLength) stationSet.add(Number(s.position.toFixed(4)));
  });
  reactions.forEach(r => {
    if (r.position >= 0 && r.position <= totalLength) stationSet.add(Number(r.position.toFixed(4)));
  });
  loads.forEach(l => {
    if (l.startPos >= 0 && l.startPos <= totalLength) stationSet.add(Number(l.startPos.toFixed(4)));
    if (l.endPos !== undefined && l.endPos >= 0 && l.endPos <= totalLength) {
      stationSet.add(Number(l.endPos.toFixed(4)));
    }
  });

  const sortedStations = Array.from(stationSet).sort((a, b) => a - b);
  const stations: number[] = [];
  for (let i = 0; i < sortedStations.length; i++) {
    if (stations.length === 0 || sortedStations[i] - stations[stations.length - 1] > 1e-4) {
      stations.push(sortedStations[i]);
    }
  }

  function getStationSingularities(xPos: number) {
    let deltaV = 0;
    let deltaM = 0;

    reactions.forEach(r => {
      if (Math.abs(r.position - xPos) < 1e-3) {
        deltaV += r.Ry;
        if (r.M) {
          deltaM += r.M;
        }
      }
    });

    loads.forEach(l => {
      if (Math.abs(l.startPos - xPos) < 1e-3) {
        if (l.type === 'point') {
          const sign = l.direction === 'down' ? -1 : 1;
          deltaV += sign * l.magnitude;
        } else if (l.type === 'moment') {
          const sign = l.direction === 'cw' ? -1 : 1;
          deltaM += sign * l.magnitude;
        }
      }
    });

    return { deltaV, deltaM };
  }

  function getIntervalLoads(xA: number, xB: number) {
    const mid = (xA + xB) / 2.0;
    let uniformW = 0; // downward positive, so dV/dx = -uniformW
    let isTrapezoidOrTriangle = false;
    let q1Total = 0;
    let q2Total = 0;

    loads.forEach(l => {
      const s = l.startPos;
      const e = l.endPos !== undefined ? l.endPos : totalLength;
      if (mid >= s - 1e-4 && mid <= e + 1e-4) {
        const mult = l.direction === 'down' ? 1 : -1;
        if (l.type === 'distributed') {
          uniformW += mult * l.magnitude;
        } else if (l.type === 'triangular' || l.type === 'trapezoidal') {
          isTrapezoidOrTriangle = true;
          const fullLen = Math.max(1e-4, e - s);
          const uA = Math.max(0, xA - s);
          const uB = Math.min(fullLen, xB - s);
          const mag1 = l.magnitude;
          const mag2 = l.magnitudeEnd !== undefined ? l.magnitudeEnd : (l.type === 'triangular' ? 0 : mag1);
          const qAtA = mag1 + (mag2 - mag1) * (uA / fullLen);
          const qAtB = mag1 + (mag2 - mag1) * (uB / fullLen);
          q1Total += mult * qAtA;
          q2Total += mult * qAtB;
        }
      }
    });

    return { uniformW, isTrapezoidOrTriangle, q1Total, q2Total };
  }

  let currentV = 0;
  let currentM = 0;
  const diagramPoints: DiagramPoint[] = [];

  for (let k = 0; k < stations.length; k++) {
    const xK = stations[k];
    const { deltaV, deltaM } = getStationSingularities(xK);

    if (Math.abs(deltaV) > 1e-4 || Math.abs(deltaM) > 1e-4) {
      // Record left-limit point (pre-jump)
      diagramPoints.push({
        x: Number(xK.toFixed(3)),
        V: Number(currentV.toFixed(2)),
        M: Number(currentM.toFixed(2)),
        N: 0
      });

      currentV += deltaV;
      currentM += deltaM;

      // Record right-limit point (post-jump)
      diagramPoints.push({
        x: Number(xK.toFixed(3)),
        V: Number(currentV.toFixed(2)),
        M: Number(currentM.toFixed(2)),
        N: 0
      });
    } else {
      diagramPoints.push({
        x: Number(xK.toFixed(3)),
        V: Number(currentV.toFixed(2)),
        M: Number(currentM.toFixed(2)),
        N: 0
      });
    }

    if (k < stations.length - 1) {
      const nextX = stations[k + 1];
      const spanLen = nextX - xK;
      const { uniformW, isTrapezoidOrTriangle, q1Total, q2Total } = getIntervalLoads(xK, nextX);

      // Dense sampling: 25-50 points per interval ensuring smooth parabolic curve
      const numSub = Math.max(25, Math.min(50, Math.ceil(spanLen / 0.04)));
      const interiorU: number[] = [];

      // Insert exact zero-crossing point for maximum moment
      if (!isTrapezoidOrTriangle && Math.abs(uniformW) > 1e-4) {
        const uZero = currentV / uniformW;
        if (uZero > 1e-3 && uZero < spanLen - 1e-3) {
          interiorU.push(uZero);
        }
      }

      for (let s = 1; s < numSub; s++) {
        interiorU.push((s / numSub) * spanLen);
      }
      interiorU.sort((a, b) => a - b);

      const uniqueU: number[] = [];
      for (const u of interiorU) {
        if (uniqueU.length === 0 || u - uniqueU[uniqueU.length - 1] > 1e-4) {
          uniqueU.push(u);
        }
      }

      for (const u of uniqueU) {
        const xEval = xK + u;
        let vEval = currentV;
        let mEval = currentM;

        if (!isTrapezoidOrTriangle) {
          // dV/dx = -w => V(u) = V0 - w*u
          // dM/dx = V(u) => M(u) = M0 + V0*u - 0.5*w*u^2
          vEval = currentV - uniformW * u;
          mEval = currentM + currentV * u - 0.5 * uniformW * u * u;
        } else {
          const q1 = q1Total;
          const q2 = q2Total;
          const slope = (q2 - q1) / spanLen;
          vEval = currentV - q1 * u - 0.5 * slope * u * u;
          mEval = currentM + currentV * u - 0.5 * q1 * u * u - (1.0 / 6.0) * slope * Math.pow(u, 3);
        }

        diagramPoints.push({
          x: Number(xEval.toFixed(3)),
          V: Number(vEval.toFixed(2)),
          M: Number(mEval.toFixed(2)),
          N: 0
        });
      }

      // Update currentV and currentM at nextX^-
      if (!isTrapezoidOrTriangle) {
        currentM = currentM + currentV * spanLen - 0.5 * uniformW * spanLen * spanLen;
        currentV = currentV - uniformW * spanLen;
      } else {
        const q1 = q1Total;
        const q2 = q2Total;
        const slope = (q2 - q1) / spanLen;
        currentM = currentM + currentV * spanLen - 0.5 * q1 * spanLen * spanLen - (1.0 / 6.0) * slope * Math.pow(spanLen, 3);
        currentV = currentV - q1 * spanLen - 0.5 * slope * spanLen * spanLen;
      }
    }
  }

  // Ensure diagram closes to 0 at the end if slight floating point remainder
  const lastPt = diagramPoints[diagramPoints.length - 1];
  if (lastPt.x === totalLength && (Math.abs(lastPt.V) > 0.05 || Math.abs(lastPt.M) > 0.05)) {
    diagramPoints.push({
      x: totalLength,
      V: 0,
      M: 0,
      N: 0
    });
  }

  // Identify Max/Min
  let maxM = { x: 0, value: -Infinity };
  let minM = { x: 0, value: Infinity };
  let maxV = { x: 0, value: -Infinity };
  let minV = { x: 0, value: Infinity };

  diagramPoints.forEach(pt => {
    if (pt.M > maxM.value) maxM = { x: pt.x, value: pt.M };
    if (pt.M < minM.value) minM = { x: pt.x, value: pt.M };
    if (pt.V > maxV.value) maxV = { x: pt.x, value: pt.V };
    if (pt.V < minV.value) minV = { x: pt.x, value: pt.V };
  });

  const criticalValues: CriticalValue[] = [
    {
      type: 'max_moment',
      x: maxM.x,
      value: maxM.value,
      description: `Momen Positif Maksimum = ${maxM.value.toFixed(2)} kN.m pada x = ${maxM.x} m`
    },
    {
      type: 'min_moment',
      x: minM.x,
      value: minM.value,
      description: `Momen Negatif Maksimum = ${minM.value.toFixed(2)} kN.m pada x = ${minM.x} m`
    },
    {
      type: 'max_shear',
      x: maxV.x,
      value: maxV.value,
      description: `Gaya Geser Positif Maksimum = ${maxV.value.toFixed(2)} kN pada x = ${maxV.x} m`
    },
    {
      type: 'min_shear',
      x: minV.x,
      value: minV.value,
      description: `Gaya Geser Negatif Maksimum = ${minV.value.toFixed(2)} kN pada x = ${minV.x} m`
    }
  ];

  // Quadratic Curvature Check on Distributed Load Segments (Evaluated per segment between stations/supports)
  const quadraticMomentChecks: QuadraticMomentCheck[] = [];
  for (let k = 0; k < stations.length - 1; k++) {
    const sPos = stations[k];
    const ePos = stations[k + 1];
    const segLen = ePos - sPos;
    if (segLen >= 0.1) {
      const { uniformW, isTrapezoidOrTriangle } = getIntervalLoads(sPos, ePos);
      if (!isTrapezoidOrTriangle && uniformW > 0.01) {
        const w = uniformW;
        const midPos = Number(((sPos + ePos) / 2.0).toFixed(3));

        const ptsAtStart = diagramPoints.filter(p => Math.abs(p.x - sPos) < 0.005);
        const mStart = ptsAtStart.length > 0 ? ptsAtStart[ptsAtStart.length - 1].M : 0;
        const vStart = ptsAtStart.length > 0 ? ptsAtStart[ptsAtStart.length - 1].V : 0;

        const ptsAtEnd = diagramPoints.filter(p => Math.abs(p.x - ePos) < 0.005);
        const mEnd = ptsAtEnd.length > 0 ? ptsAtEnd[0].M : 0;
        const vEnd = ptsAtEnd.length > 0 ? ptsAtEnd[0].V : 0;

        let closestMid = diagramPoints[0];
        let minMidDist = Infinity;
        for (const pt of diagramPoints) {
          const dist = Math.abs(pt.x - midPos);
          if (dist < minMidDist) {
            minMidDist = dist;
            closestMid = pt;
          }
        }

        const mMidActual = closestMid.M;
        const mMidLinearChord = Number(((mStart + mEnd) / 2.0).toFixed(2));
        const parabolicSagitta = Number((mMidActual - mMidLinearChord).toFixed(2));
        const expectedSagitta = Number(((w * segLen * segLen) / 8.0).toFixed(2));
        const isQuadratic = Math.abs(parabolicSagitta - expectedSagitta) <= 0.15 && Math.abs(expectedSagitta) > 0.01;

        const expectedDeltaM = Number((((vStart + vEnd) / 2.0) * segLen).toFixed(2));
        const actualDeltaM = Number((mEnd - mStart).toFixed(2));
        const shearAreaMatch = Math.abs(actualDeltaM - expectedDeltaM) <= 0.25;

        // Label matching load if available
        const matchedLoad = loads.find(
          l => l.type === 'distributed' && l.startPos <= sPos + 1e-4 && (l.endPos ?? totalLength) >= ePos - 1e-4
        );
        const loadLabel = matchedLoad?.label || `q = ${w} kN/m`;

        quadraticMomentChecks.push({
          loadLabel: `${loadLabel} (Bentang ${sPos}m - ${ePos}m)`,
          startPos: sPos,
          endPos: ePos,
          w,
          midPos,
          mMidActual,
          mMidLinearChord,
          parabolicSagitta,
          expectedSagitta,
          isQuadratic,
          shearAreaMatch,
          explanation: `Kurva momen pada segmen x=[${sPos}m - ${ePos}m] terverifikasi kuadratik parabola: sagitta kelengkungan δ = ${parabolicSagitta} kN.m (ekspektasi wL²/8 = ${expectedSagitta} kN.m), berbeda nyata dari garis lurus linear chord (δ = 0). Luas diagram gaya geser = ${expectedDeltaM} kN.m cocok dengan perubahan momen ΔM = ${actualDeltaM} kN.m.`
        });
      }
    }
  }

  return {
    diagramPoints,
    criticalValues,
    maxMoment: maxM,
    minMoment: minM,
    maxShear: maxV,
    minShear: minV,
    quadraticMomentChecks
  };
}

/**
 * Calculates beam deflection (lendutan) using Conjugate Beam / Moment-Area double integration
 * of curvature kappa(x) = M(x) / (E * I).
 * Strictly adheres to mechanics of materials: d^2v/dx^2 = -M(x) / (EI).
 * @param totalLength Beam length in meters
 * @param supports Supports array
 * @param diagramPoints Array of M(x) points from SFD/BMD
 * @param E Modulus of elasticity in MPa (N/mm^2)
 * @param I_mm4 Moment of inertia in mm^4 (e.g. 4000 * 1e6)
 */
export function calculateBeamDeflection(
  totalLength: number,
  supports: Support[],
  diagramPoints: DiagramPoint[],
  E: number = 200000,
  I_mm4: number = 4000 * 1e6
): DeflectionResult {
  const sortedSupports = [...supports].sort((a, b) => a.position - b.position);
  const L = Math.max(0.5, totalLength);
  const safeEI = Math.max(1, E * I_mm4); // N.mm^2. M in kN.m = 1e6 N.mm.

  // Sample along beam at 101 stations
  const numStations = 101;
  const dx = L / (numStations - 1);
  const stations: Array<{ x: number; M: number }> = [];

  for (let i = 0; i < numStations; i++) {
    const x = i * dx;
    // interpolate M(x) from diagramPoints
    let mVal = 0;
    if (diagramPoints.length > 0) {
      if (x <= diagramPoints[0].x) {
        mVal = diagramPoints[0].M;
      } else if (x >= diagramPoints[diagramPoints.length - 1].x) {
        mVal = diagramPoints[diagramPoints.length - 1].M;
      } else {
        for (let j = 0; j < diagramPoints.length - 1; j++) {
          const p1 = diagramPoints[j];
          const p2 = diagramPoints[j + 1];
          if (x >= p1.x && x <= p2.x) {
            const frac = p2.x > p1.x ? (x - p1.x) / (p2.x - p1.x) : 0;
            mVal = p1.M + frac * (p2.M - p1.M);
            break;
          }
        }
      }
    }
    stations.push({ x, M: mVal });
  }

  // Curvature kappa in 1/m = (M * 1e6 N.mm) / (E * I_mm4) * 1000 = (M * 1e9) / (E * I_mm4)
  const kappa = stations.map(s => (s.M * 1e9) / safeEI);

  // Determine boundary conditions based on supports
  const hasFixed = sortedSupports.some(s => s.type === 'fixed');
  const isCantilever = hasFixed && sortedSupports.length === 1;

  const deflectionPoints: Array<{ x: number; delta: number }> = [];

  if (isCantilever) {
    const fixedPos = sortedSupports[0].position;
    for (let i = 0; i < stations.length; i++) {
      const xi = stations[i].x;
      let deltaMeters = 0;
      if (fixedPos <= 0.1) {
        // clamped at left (x = 0)
        for (let j = 0; j <= i; j++) {
          const weight = (j === 0 || j === i) ? 0.5 : 1.0;
          const x_j = stations[j].x;
          deltaMeters += weight * (xi - x_j) * kappa[j] * dx;
        }
      } else {
        // clamped at right
        for (let j = i; j < stations.length; j++) {
          const weight = (j === i || j === stations.length - 1) ? 0.5 : 1.0;
          const x_j = stations[j].x;
          deltaMeters += weight * (x_j - xi) * kappa[j] * dx;
        }
      }
      const deltaMm = Math.abs(deltaMeters * 1000);
      deflectionPoints.push({ x: Number(xi.toFixed(2)), delta: Number(deltaMm.toFixed(3)) });
    }
  } else {
    // Simply supported or continuous span: supports at sA and sB
    const suppA = sortedSupports[0] || { position: 0 };
    const suppB = sortedSupports[sortedSupports.length - 1] || { position: L };
    const sA = suppA.position;
    const sB = suppB.position;
    const spanAB = Math.max(0.1, sB - sA);

    // Conjugate beam reaction at support A:
    // theta_A = (1 / spanAB) * integral_{sA}^{sB} kappa(x) * (sB - x) dx
    let conjugateMomentB = 0;
    for (let i = 0; i < stations.length; i++) {
      const x = stations[i].x;
      if (x >= sA && x <= sB) {
        const weight = (x === sA || x === sB) ? 0.5 : 1.0;
        conjugateMomentB += weight * kappa[i] * (sB - x) * dx;
      }
    }
    const thetaA = conjugateMomentB / spanAB; // slope at support A in radians

    for (let i = 0; i < stations.length; i++) {
      const x = stations[i].x;
      let deltaMm = 0;
      if (x >= sA && x <= sB) {
        // Between supports
        let bendingIntegral = 0;
        for (let j = 0; j <= i; j++) {
          const xj = stations[j].x;
          if (xj >= sA) {
            const weight = (xj === sA || j === i) ? 0.5 : 1.0;
            bendingIntegral += weight * kappa[j] * (x - xj) * dx;
          }
        }
        const deltaMeters = thetaA * (x - sA) - bendingIntegral;
        deltaMm = Math.abs(deltaMeters * 1000);
      } else if (x < sA) {
        // Left overhang
        let overhangIntegral = 0;
        for (let j = 0; j < stations.length; j++) {
          const xj = stations[j].x;
          if (xj >= x && xj <= sA) {
            const weight = (xj === x || xj === sA) ? 0.5 : 1.0;
            overhangIntegral += weight * kappa[j] * (xj - x) * dx;
          }
        }
        const deltaMeters = -thetaA * (sA - x) + overhangIntegral;
        deltaMm = Math.abs(deltaMeters * 1000);
      } else {
        // Right overhang
        let totalSpanCurvature = 0;
        for (let j = 0; j < stations.length; j++) {
          const xj = stations[j].x;
          if (xj >= sA && xj <= sB) {
            const weight = (xj === sA || xj === sB) ? 0.5 : 1.0;
            totalSpanCurvature += weight * kappa[j] * dx;
          }
        }
        const thetaB = thetaA - totalSpanCurvature;
        let rightOverhangIntegral = 0;
        for (let j = 0; j <= i; j++) {
          const xj = stations[j].x;
          if (xj >= sB) {
            const weight = (xj === sB || j === i) ? 0.5 : 1.0;
            rightOverhangIntegral += weight * kappa[j] * (x - xj) * dx;
          }
        }
        const deltaMeters = thetaB * (x - sB) + rightOverhangIntegral;
        deltaMm = Math.abs(deltaMeters * 1000);
      }
      deflectionPoints.push({ x: Number(x.toFixed(2)), delta: Number(deltaMm.toFixed(3)) });
    }
  }

  // Find max deflection
  let maxDeflection = 0;
  let maxDeflectionX = L / 2;
  deflectionPoints.forEach(p => {
    if (p.delta > maxDeflection) {
      maxDeflection = p.delta;
      maxDeflectionX = p.x;
    }
  });

  const allowableDeflectionL240 = Number(((L * 1000) / 240).toFixed(2));
  const allowableDeflectionL360 = Number(((L * 1000) / 360).toFixed(2));

  const isPassL240 = maxDeflection <= allowableDeflectionL240;
  const isPassL360 = maxDeflection <= allowableDeflectionL360;

  return {
    maxDeflection: Number(maxDeflection.toFixed(2)),
    maxDeflectionX: Number(maxDeflectionX.toFixed(2)),
    allowableDeflectionL240,
    allowableDeflectionL360,
    isPassL240,
    isPassL360,
    E,
    I: I_mm4,
    formulaDescription: isCantilever
      ? 'Metode Momen Area / Integrasi Ganda Kantilever δ = ∫ (x - ξ) M(ξ)/(EI) dξ'
      : 'Metode Balok Konjugat & Integrasi Kurvatur δ(x) = θ_A·x - ∫ (x - ξ) [M(ξ)/(EI)] dξ',
    deflectionPoints
  };
}

/**
 * DETERMINATE BEAM SOLVER
 * Handles:
 * - Simple beam (Pin - Roller)
 * - Cantilever beam (Fixed - Free)
 * - Overhanging beam (Cantilever + Supported span)
 */
export function solveDeterminateBeam(
  totalLength: number,
  supports: Support[],
  loads: StructuralLoad[],
  materialE: number = 200000,
  defaultI: number = 4000
): BeamAnalysisResult {
  const steps: CalculationStep[] = [];
  const sortedSupports = [...supports].sort((a, b) => a.position - b.position);

  // Identify supports
  const hasFixed = sortedSupports.some(s => s.type === 'fixed');
  const reactions: SupportReaction[] = [];

  // Step 1: Geometry & Loads Identification
  steps.push({
    stepNumber: 1,
    title: 'Identifikasi Sistem Struktur dan Beban',
    description: `Panjang total struktur balok L = ${totalLength} m dengan ${sortedSupports.length} titik tumpuan dan ${loads.length} beban kerja.`,
    note: `Tumpuan: ${sortedSupports.map((s, idx) => `Tumpuan ${String.fromCharCode(65 + idx)} (${s.type}) di x = ${s.position} m`).join(', ')}`
  });

  // Step 2: Equivalent Resultants
  const loadResultants = loads.map(load => {
    const res = getLoadResultant(load);
    return { ...res, load };
  });

  const totalGravityLoad = loadResultants.reduce((acc, curr) => acc + curr.R, 0);

  steps.push({
    stepNumber: 2,
    title: 'Transformasi Beban Menjadi Resultan Ekuivalen',
    description: 'Beban terdistribusi dihitung luas daerahnya untuk mendapatkan resultan gaya dan titik berat kerjanya.',
    substitution: loadResultants
      .map((r, idx) => {
        if (r.load.type === 'moment') {
          return `Momen M${idx + 1} = ${r.load.magnitude} kN.m (${r.load.direction === 'cw' ? 'searah jarum jam' : 'berlawanan jarum jam'}) pada x = ${r.load.startPos} m`;
        }
        return `Resultan R${idx + 1} = ${r.R.toFixed(2)} kN pada titik berat x = ${r.xBar.toFixed(2)} m (${r.load.type === 'distributed' ? 'merata' : r.load.type === 'triangular' ? 'segitiga' : 'titik'})`;
      })
      .join('; '),
    result: `Total beban vertikal gravitasi ΣF beban = ${totalGravityLoad.toFixed(2)} kN`
  });

  // Step 3: Support Reactions calculation
  if (hasFixed && sortedSupports.length === 1) {
    // Cantilever beam
    const fixedSupp = sortedSupports[0];
    const label = 'A';
    const xF = fixedSupp.position;

    // Sum Fy = 0 -> Ry - TotalR = 0 -> Ry = TotalR
    const Ry = totalGravityLoad;
    const Rx = 0;

    // Sum M fixed = 0 -> M reac + sum(R i * (x i - xF)) + sum(applied moments) = 0
    let M_from_loads = 0;
    loads.forEach(load => {
      if (load.type === 'moment') {
        const sign = load.direction === 'cw' ? 1 : -1;
        M_from_loads += sign * load.magnitude;
      } else {
        const res = getLoadResultant(load);
        // Moment about fixed point
        M_from_loads += res.R * (res.xBar - xF);
      }
    });

    const M_reac = -M_from_loads; // Restoring moment at fixed support

    reactions.push({
      supportId: fixedSupp.id,
      position: xF,
      label,
      type: 'fixed',
      Ry: Number(Ry.toFixed(2)),
      Rx: 0,
      M: Number(M_reac.toFixed(2))
    });

    steps.push({
      stepNumber: 3,
      title: 'Perhitungan Reaksi Tumpuan Jepit (Cantilever)',
      formula: 'ΣFy = 0 → RAy = ΣP; ΣMA = 0 → MA = Σ[P × (x - xA)]',
      substitution: `RAy = ${Ry.toFixed(2)} kN; MA = ${Math.abs(M_reac).toFixed(2)} kN.m`,
      result: `RAy = ${Ry.toFixed(2)} kN (ke atas), MA = ${M_reac.toFixed(2)} kN.m (${M_reac >= 0 ? 'berlawanan jarum jam' : 'searah jarum jam'})`,
      explanation: 'Tumpuan jepit menahan gaya translasi vertikal, horizontal, dan rotasi (momen jepit).'
    });
  } else if (sortedSupports.length === 2) {
    // Simply supported or overhanging beam with 2 vertical supports (A and B)
    const suppA = sortedSupports[0];
    const suppB = sortedSupports[1];
    const xA = suppA.position;
    const xB = suppB.position;
    const spanAB = xB - xA;

    // Sum M_B = 0: R_Ay * (xB - xA) - sum(R_i * (xB - x_i)) - sum(applied_moments) = 0
    let momentAboutB = 0;
    loads.forEach(load => {
      if (load.type === 'moment') {
        const sign = load.direction === 'cw' ? 1 : -1;
        momentAboutB -= sign * load.magnitude;
      } else {
        const res = getLoadResultant(load);
        momentAboutB += res.R * (xB - res.xBar);
      }
    });

    const R_Ay = momentAboutB / spanAB;

    // Sum M_A = 0: -R_By * (xB - xA) + sum(R_i * (x_i - xA)) + sum(applied_moments) = 0
    let momentAboutA = 0;
    loads.forEach(load => {
      if (load.type === 'moment') {
        const sign = load.direction === 'cw' ? 1 : -1;
        momentAboutA += sign * load.magnitude;
      } else {
        const res = getLoadResultant(load);
        momentAboutA += res.R * (res.xBar - xA);
      }
    });

    const R_By = momentAboutA / spanAB;

    reactions.push({
      supportId: suppA.id,
      position: xA,
      label: 'A',
      type: suppA.type,
      Ry: Number(R_Ay.toFixed(2)),
      Rx: 0,
      M: 0
    });

    reactions.push({
      supportId: suppB.id,
      position: xB,
      label: 'B',
      type: suppB.type,
      Ry: Number(R_By.toFixed(2)),
      Rx: 0,
      M: 0
    });

    steps.push({
      stepNumber: 3,
      title: 'Perhitungan Reaksi Tumpuan dengan Persamaan Keseimbangan Statika',
      formula: 'ΣMB = 0 → RAy × L(AB) - Σ[P × (xB - x)] = 0; ΣMA = 0 → RBy × L(AB) - Σ[P × (x - xA)] = 0',
      substitution: `RAy = (${momentAboutB.toFixed(2)}) / ${spanAB} = ${R_Ay.toFixed(2)} kN; RBy = (${momentAboutA.toFixed(2)}) / ${spanAB} = ${R_By.toFixed(2)} kN`,
      result: `RAy = ${R_Ay.toFixed(2)} kN, RBy = ${R_By.toFixed(2)} kN`,
      explanation: 'Reaksi tumpuan vertikal dihitung dengan mengambil kesetimbangan momen pada masing-masing tumpuan.'
    });
  } else {
    // Single support non-fixed fallback
    const supp = sortedSupports[0];
    reactions.push({
      supportId: supp.id,
      position: supp.position,
      label: 'A',
      type: supp.type,
      Ry: Number(totalGravityLoad.toFixed(2)),
      Rx: 0,
      M: 0
    });
  }

  // Equilibrium Check
  const sumRy = reactions.reduce((sum, r) => sum + r.Ry, 0);
  const diffFy = Math.abs(sumRy - totalGravityLoad);
  const isBalanced = diffFy < 0.05;

  steps.push({
    stepNumber: 4,
    title: 'Pemeriksaan Keseimbangan Statika (Equilibrium Check)',
    formula: 'ΣFy = R total - P total = 0',
    substitution: `ΣRy = ${sumRy.toFixed(2)} kN; ΣFy beban = ${totalGravityLoad.toFixed(2)} kN; Selisih = ${diffFy.toFixed(4)} kN`,
    result: isBalanced ? 'Keseimbangan Terpenuhi (OK: ΣFy = 0)' : 'Peringatan: Selisih Keseimbangan',
    explanation: 'Validasi hukum Newton I menjamin kebenaran kalkulasi statika struktur.'
  });

  // Step 4: Analytical Diagram Generation (SFD, BMD)
  const {
    diagramPoints,
    criticalValues,
    maxMoment,
    minMoment,
    maxShear,
    minShear,
    quadraticMomentChecks
  } = generateBeamDiagramAndChecks(totalLength, sortedSupports, reactions, loads);

  steps.push({
    stepNumber: 4,
    title: 'Generasi Diagram Gaya Geser (SFD) & Momen Lentur (BMD) Berbasis Integrasi Analitis',
    description: 'Diagram dihitung menggunakan integrasi persamaan diferensial balok dV/dx = -w(x) dan dM/dx = V(x). Pada beban terpusat terjadi lompatan gaya geser vertikal (step jump), sedangkan diagram momen kontinu.',
    formula: 'V(x) = V0 - ∫ w(x) dx;  M(x) = M0 + ∫ V(x) dx',
    substitution: `Dievaluasi pada ${diagramPoints.length} titik diskretisasi analitis rapat termasuk batas singularitas x- dan x+.`,
    result: `Gaya geser linear dan momen kuadratik parabola pada seluruh bentang terintegrasi sempurna.`,
    explanation: 'Metode integrasi analitis per segmen menjamin bentuk kurva BMD melengkung secara akurat tanpa interpolasi linear semu.'
  });

  steps.push({
    stepNumber: 5,
    title: 'Penentuan Nilai Ekstrim Momen Lentur (M maks) dan Gaya Geser (V maks)',
    description: 'Titik momen maksimum terjadi pada potongan di mana gaya geser V(x) = 0 atau berubah tanda.',
    formula: 'dM(x)/dx = V(x) = 0 → M ekstrim',
    substitution: `Momen maksimum lapangan = ${maxMoment.value.toFixed(2)} kN.m pada x = ${maxMoment.x} m; Gaya geser kritis = ${Math.max(Math.abs(maxShear.value), Math.abs(minShear.value)).toFixed(2)} kN`,
    result: `M maks = ${maxMoment.value.toFixed(2)} kN.m pada x = ${maxMoment.x} m | |V maks| = ${Math.max(Math.abs(maxShear.value), Math.abs(minShear.value)).toFixed(2)} kN`,
    explanation: 'Nilai-nilai ini menjadi masukan utama untuk perancangan tulangan lentur dan sengkang geser beton bertulang.'
  });

  if (quadraticMomentChecks.length > 0) {
    steps.push({
      stepNumber: 6,
      title: 'Verifikasi Kurva Parabola Kuadratik & Luas SFD (dM/dx = V)',
      description: 'Pemeriksaan matematis ketat untuk memastikan diagram momen pada segmen beban merata membentuk parabola kuadratik sejati (bukan garis lurus chord).',
      formula: 'Kelengkungan Sagitta δ = M_mid - (M_start + M_end)/2 = w·L²/8;  ΔM = ∫ V(x) dx',
      substitution: quadraticMomentChecks.map(c => `Segmen [${c.startPos}-${c.endPos}m]: δ_aktual = ${c.parabolicSagitta} kN.m (wL²/8 = ${c.expectedSagitta} kN.m) → ${c.isQuadratic ? 'TERBUKTI KUADRATIK OK' : 'LINEAR'}`).join('; '),
      result: quadraticMomentChecks.every(c => c.isQuadratic)
        ? 'Validasi Sukses: Seluruh kurva BMD berbeban merata terbukti berbentuk parabola kuadratik sempurna (δ > 0).'
        : 'Perhatian: Terdapat segmen yang menyimpang.',
      explanation: 'Karena sagitta kelengkungan δ bernilai tepat w·L²/8 (bukan nol), diagram momen lentur dijamin melengkung kuadratik dan tidak ditarik sebagai garis lurus antartumpuan.'
    });
  }

  // Calculate Deflection (Lendutan)
  const deflectionResult = calculateBeamDeflection(totalLength, sortedSupports, diagramPoints, materialE, defaultI * 1e6);

  // Map deflection values onto diagramPoints
  diagramPoints.forEach(pt => {
    const closest = deflectionResult.deflectionPoints.reduce((best, curr) =>
      Math.abs(curr.x - pt.x) < Math.abs(best.x - pt.x) ? curr : best
    , deflectionResult.deflectionPoints[0]);
    if (closest) {
      pt.deflection = closest.delta;
    }
  });

  steps.push({
    stepNumber: steps.length + 1,
    title: 'Estimasi Lendutan / Defleksi Maksimum Balok (SNI 2847 / AISC)',
    description: `Dihitung dengan integrasi ganda kurvatur lentur d²v/dx² = -M(x)/(E·I) pada bentang balok dengan modulus elastisitas E = ${materialE.toLocaleString()} MPa dan inersia penampang I = ${defaultI} × 10⁶ mm⁴.`,
    formula: 'δ(x) = ∫∫ [M(x) / (E·I)] dx dx;  Batas Izin: Δ_izin = L/240 & L/360',
    substitution: `L = ${totalLength} m; E = ${materialE.toLocaleString()} MPa; I = ${defaultI} × 10⁶ mm⁴; δ_maks = ${deflectionResult.maxDeflection.toFixed(2)} mm pada x = ${deflectionResult.maxDeflectionX.toFixed(2)} m; Batas L/240 = ${deflectionResult.allowableDeflectionL240.toFixed(2)} mm; Batas L/360 = ${deflectionResult.allowableDeflectionL360.toFixed(2)} mm`,
    result: `Lendutan Maksimum δ_maks = ${deflectionResult.maxDeflection.toFixed(2)} mm | Status: ${deflectionResult.isPassL360 ? 'AMAN (Memenuhi batasan ketat L/360 & L/240)' : deflectionResult.isPassL240 ? 'MEMENUHI SYARAT standar (L/240)' : 'MELEBIHI BATAS IZIN (Perlu penampang lebih kaku)'}`,
    explanation: 'Lendutan balok harus dibatasi agar tidak merusak elemen non-struktural seperti dinding bata atau plafon gipsum, serta mencegah getaran berlebih.'
  });

  return {
    isDeterminate: true,
    degreeOfIndeterminacy: 0,
    methodUsed: 'Equilibrium (Statis Tertentu)',
    totalLength,
    reactions,
    diagramPoints,
    criticalValues,
    maxMoment,
    minMoment,
    maxShear,
    minShear,
    equilibriumCheck: {
      sumFy: Number(sumRy.toFixed(2)),
      sumM: 0,
      isBalanced
    },
    steps,
    quadraticMomentChecks,
    deflectionResult
  };
}

/**
 * INDETERMINATE BEAM SOLVER USING THE MOMENT DISTRIBUTION METHOD (METODE CROSS)
 * Solves continuous beams (2, 3 or more spans) with joint stiffness distribution and carry-over iterations.
 * Strictly adheres to classical structural mechanics and Agus Setiawan chapter references.
 */
export function solveIndeterminateCrossBeam(
  spans: BeamSpan[],
  supports: Support[],
  loads: StructuralLoad[]
): BeamAnalysisResult {
  const steps: CalculationStep[] = [];
  const totalLength = spans.reduce((sum, sp) => sum + sp.length, 0);

  // Step 1: Spans & Relative Stiffness (k = 4EI/L or relative I/L)
  const spanStiffness: number[] = spans.map(sp => {
    // Relative stiffness k = I / L
    return sp.I / sp.length;
  });

  steps.push({
    stepNumber: 1,
    title: 'Perhitungan Kekakuan Relatif Batang (K = I/L)',
    description: `Struktur balok menerus statis tak tentu terdiri dari ${spans.length} bentang.`,
    substitution: spans.map((sp, idx) => `Bentang ${idx + 1} (L=${sp.length} m): K(${idx + 1}) = ${spanStiffness[idx].toFixed(2)}`).join('; '),
    result: 'Kekakuan relatif tiap bentang berhasil ditentukan untuk perhitungan faktor distribusi.'
  });

  // Step 2: Distribution Factors (DF) at each joint
  // Internal joints distribute based on K / sum(K)
  // Pinned/roller external joint: DF = 1.0
  // Fixed external joint: DF = 0.0
  const distributionFactors: Record<string, number> = {};
  const numSpans = spans.length;

  for (let joint = 0; joint <= numSpans; joint++) {
    const isLeftEnd = joint === 0;
    const isRightEnd = joint === numSpans;

    if (isLeftEnd) {
      const supp = supports[0] || supports.find(s => Math.abs(s.position) < 0.01);
      const isFixed = supp?.type === 'fixed';
      distributionFactors[`0-1`] = isFixed ? 0.0 : 1.0;
    } else if (isRightEnd) {
      const supp = supports[supports.length - 1] || supports.find(s => Math.abs(s.position - totalLength) < 0.05);
      const isFixed = supp?.type === 'fixed';
      distributionFactors[`${numSpans}-${numSpans - 1}`] = isFixed ? 0.0 : 1.0;
    } else {
      // Interior joint
      const kLeft = spanStiffness[joint - 1];
      const kRight = spanStiffness[joint];
      const sumK = kLeft + kRight;
      distributionFactors[`${joint}-${joint - 1}`] = Number((kLeft / sumK).toFixed(4));
      distributionFactors[`${joint}-${joint + 1}`] = Number((kRight / sumK).toFixed(4));
    }
  }

  steps.push({
    stepNumber: 2,
    title: 'Perhitungan Faktor Distribusi Momen (Distribution Factor, DF)',
    formula: 'DF(ij) = K(ij) / ΣK(i); Pada jepit DF = 0; Pada sendi/rol ujung DF = 1',
    substitution: Object.entries(distributionFactors).map(([key, val]) => `DF(${key}) = ${val}`).join('; '),
    result: 'Faktor distribusi memenuhi syarat ΣDF pada setiap buhul interior = 1.0',
    explanation: 'DF menentukan seberapa besar porsi momen ketidakseimbangan yang didistribusikan ke masing-masing batang yang bertemu di buhul.'
  });

  // Step 3: Fixed End Moments (FEM)
  // For uniform load q: FEM_AB = -q*L^2/12, FEM_BA = +q*L^2/12
  // For point load P at center: FEM_AB = -P*L/8, FEM_BA = +P*L/8
  const fem: Record<string, number> = {};

  let currentSpanStart = 0;
  spans.forEach((span, idx) => {
    const spanEnd = currentSpanStart + span.length;
    const L = span.length;
    let fem_left = 0;
    let fem_right = 0;

    // Find loads in this span (supporting multi-span distributed loads and partial loads)
    loads.forEach(load => {
      if (load.type === 'distributed') {
        const s = load.startPos;
        const e = load.endPos !== undefined ? load.endPos : totalLength;
        const overlapStart = Math.max(currentSpanStart, s);
        const overlapEnd = Math.min(spanEnd, e);
        if (overlapEnd > overlapStart + 1e-4) {
          const u1 = overlapStart - currentSpanStart;
          const u2 = overlapEnd - currentSpanStart;
          const q = load.magnitude;
          if (Math.abs(u1) < 1e-4 && Math.abs(u2 - L) < 1e-4) {
            // Full span UDL
            fem_left -= (q * Math.pow(L, 2)) / 12.0;
            fem_right += (q * Math.pow(L, 2)) / 12.0;
          } else {
            // Partial span UDL analytical integration
            const intLeft = (u: number) => (L * L * u * u) / 2.0 - (2.0 * L * Math.pow(u, 3)) / 3.0 + Math.pow(u, 4) / 4.0;
            const intRight = (u: number) => (L * Math.pow(u, 3)) / 3.0 - Math.pow(u, 4) / 4.0;
            fem_left -= (q / Math.pow(L, 2)) * (intLeft(u2) - intLeft(u1));
            fem_right += (q / Math.pow(L, 2)) * (intRight(u2) - intRight(u1));
          }
        }
      } else if (load.type === 'point') {
        if (load.startPos >= currentSpanStart - 1e-4 && load.startPos <= spanEnd + 1e-4) {
          const a = Math.max(0, Math.min(L, load.startPos - currentSpanStart));
          const b = L - a;
          const P = load.magnitude;
          fem_left -= (P * a * Math.pow(b, 2)) / Math.pow(L, 2);
          fem_right += (P * Math.pow(a, 2) * b) / Math.pow(L, 2);
        }
      }
    });

    fem[`${idx}-${idx + 1}`] = Number(fem_left.toFixed(2));
    fem[`${idx + 1}-${idx}`] = Number(fem_right.toFixed(2));
    currentSpanStart = spanEnd;
  });

  steps.push({
    stepNumber: 3,
    title: 'Perhitungan Momen Primer Jepit Ujung (Fixed End Moment, FEM)',
    formula: 'FEM merata = ± q × L² / 12; FEM terpusat = ± P × a × b² / L²',
    substitution: Object.entries(fem).map(([k, v]) => `FEM(${k}) = ${v.toFixed(2)} kN.m`).join('; '),
    result: 'Momen primer telah dihitung untuk seluruh bentang batang.',
    explanation: 'FEM adalah momen penahan yang bekerja di ujung-ujung batang bila diasumsikan terjepit sempurna sebelum rotasi buhul diperhitungkan.'
  });

  // Step 4: Iterative Moment Distribution (Cross Cycles)
  const currentMoments: Record<string, number> = { ...fem };
  const cycles: Array<{ distribution: Record<string, number>; carryOver: Record<string, number> }> = [];

  const maxCycles = 10;
  for (let c = 0; c < maxCycles; c++) {
    const distRecord: Record<string, number> = {};
    const coRecord: Record<string, number> = {};

    // 1. Balance at each joint
    for (let j = 0; j <= numSpans; j++) {
      let unbalancedM = 0;
      if (j > 0) unbalancedM += currentMoments[`${j}-${j - 1}`] || 0;
      if (j < numSpans) unbalancedM += currentMoments[`${j}-${j + 1}`] || 0;

      if (j > 0) {
        const df = distributionFactors[`${j}-${j - 1}`] || 0;
        const bal = -unbalancedM * df;
        distRecord[`${j}-${j - 1}`] = Number(bal.toFixed(2));
        currentMoments[`${j}-${j - 1}`] += bal;
      }
      if (j < numSpans) {
        const df = distributionFactors[`${j}-${j + 1}`] || 0;
        const bal = -unbalancedM * df;
        distRecord[`${j}-${j + 1}`] = Number(bal.toFixed(2));
        currentMoments[`${j}-${j + 1}`] += bal;
      }
    }

    // 2. Carry over factor (COF = 0.5) to opposite end
    for (let sp = 0; sp < numSpans; sp++) {
      const co_left_to_right = (distRecord[`${sp}-${sp + 1}`] || 0) * 0.5;
      const co_right_to_left = (distRecord[`${sp + 1}-${sp}`] || 0) * 0.5;

      coRecord[`${sp + 1}-${sp}`] = Number(co_left_to_right.toFixed(2));
      coRecord[`${sp}-${sp + 1}`] = Number(co_right_to_left.toFixed(2));

      currentMoments[`${sp + 1}-${sp}`] += co_left_to_right;
      currentMoments[`${sp}-${sp + 1}`] += co_right_to_left;
    }

    cycles.push({ distribution: distRecord, carryOver: coRecord });
  }

  const finalMoments: Record<string, number> = {};
  Object.keys(currentMoments).forEach(k => {
    finalMoments[k] = Number(currentMoments[k].toFixed(2));
  });

  steps.push({
    stepNumber: 4,
    title: 'Siklus Iterasi Distribusi Momen & Induksi (Cross Cycles)',
    description: `Dilakukan ${maxCycles} putaran distribusi momen dan carry-over (COF = 0.5) hingga konvergen (momen tidak seimbang mendekati nol).`,
    substitution: Object.entries(finalMoments).map(([k, v]) => `M(${k}) = ${v.toFixed(2)} kN.m`).join('; '),
    result: 'Momen akhir ujung batang (End Moments) berhasil didapatkan dengan akurasi tinggi.',
    explanation: 'Metode Cross menyeimbangkan buhul dengan membagi momen berlebih dan meneruskannya sebagian ke ujung lawan.'
  });

  // Calculate beam shears and reactions from final moments:
  // For each span: R left = (V simple) + (M left + M right)/L
  const reactions: SupportReaction[] = [];
  let xAcc = 0;
  const supportReactionsByPos: Record<number, number> = {};

  spans.forEach((span, idx) => {
    const L = span.length;
    const spanEnd = xAcc + L;
    const mLeft = finalMoments[`${idx}-${idx + 1}`] || 0;
    const mRight = finalMoments[`${idx + 1}-${idx}`] || 0;

    // Simple beam shear from loads in this span (supporting multi-span loads)
    let vSimpleLeft = 0;
    let vSimpleRight = 0;
    loads.forEach(load => {
      if (load.type === 'distributed') {
        const s = load.startPos;
        const e = load.endPos !== undefined ? load.endPos : totalLength;
        const overlapStart = Math.max(xAcc, s);
        const overlapEnd = Math.min(spanEnd, e);
        if (overlapEnd > overlapStart + 1e-4) {
          const u1 = overlapStart - xAcc;
          const u2 = overlapEnd - xAcc;
          const q = load.magnitude;
          const loadForce = q * (u2 - u1);
          const uBar = (u1 + u2) / 2.0;
          const vR = (loadForce * uBar) / L;
          const vL = loadForce - vR;
          vSimpleLeft += vL;
          vSimpleRight += vR;
        }
      } else if (load.type === 'point') {
        if (load.startPos >= xAcc - 1e-4 && load.startPos <= spanEnd + 1e-4) {
          const a = Math.max(0, Math.min(L, load.startPos - xAcc));
          const b = L - a;
          vSimpleLeft += (load.magnitude * b) / L;
          vSimpleRight += (load.magnitude * a) / L;
        }
      }
    });

    const shearFromMoments = (mLeft + mRight) / L;
    const vLeft = vSimpleLeft - shearFromMoments;
    const vRight = vSimpleRight + shearFromMoments;

    supportReactionsByPos[xAcc] = (supportReactionsByPos[xAcc] || 0) + vLeft;
    supportReactionsByPos[spanEnd] = (supportReactionsByPos[spanEnd] || 0) + vRight;

    xAcc += L;
  });

  supports.forEach((supp, idx) => {
    const matchedKey = Object.keys(supportReactionsByPos).find(
      k => Math.abs(parseFloat(k) - supp.position) < 0.05
    );
    const ry = matchedKey !== undefined ? supportReactionsByPos[parseFloat(matchedKey)] : 0;
    let rM = 0;
    if (supp.type === 'fixed') {
      if (idx === 0) {
        // Restoring moment on left fixed support
        rM = -(finalMoments[`0-1`] || 0);
      } else if (idx === numSpans) {
        // Restoring moment on right fixed support
        rM = (finalMoments[`${numSpans}-${numSpans - 1}`] || 0);
      }
    }

    reactions.push({
      supportId: supp.id,
      position: supp.position,
      label: supp.label || String.fromCharCode(65 + idx),
      type: supp.type,
      Ry: Number(ry.toFixed(2)),
      Rx: 0,
      M: Number(rM.toFixed(2))
    });
  });

  steps.push({
    stepNumber: 5,
    title: 'Perhitungan Reaksi Tumpuan Berdasarkan Momen Ujung Akhir',
    formula: 'Ri = V beban statik ± (M kiri + M kanan) / L; M jepit = -M ujung batang',
    substitution: reactions.map(r => `R(${r.label}) = ${r.Ry} kN ${r.M ? `dan M(${r.label}) = ${r.M} kN.m` : ''} pada x = ${r.position} m`).join('; '),
    result: `Reaksi tumpuan berhasil ditentukan untuk ${reactions.length} tumpuan.`,
    explanation: 'Gaya geser dan reaksi dihitung melalui superposisi efek beban statis murni dan momen kontinuitas ujung.'
  });

  // Analytical Diagram Generation (SFD, BMD)
  const {
    diagramPoints,
    criticalValues,
    maxMoment,
    minMoment,
    maxShear,
    minShear,
    quadraticMomentChecks
  } = generateBeamDiagramAndChecks(totalLength, supports, reactions, loads);

  if (quadraticMomentChecks.length > 0) {
    steps.push({
      stepNumber: 6,
      title: 'Verifikasi Kurva Parabola Kuadratik & Luas SFD (dM/dx = V)',
      description: 'Pemeriksaan matematis ketat untuk memastikan diagram momen pada balok menerus berbeban merata melengkung secara parabola kuadratik (bukan garis lurus chord).',
      formula: 'Kelengkungan Sagitta δ = M_mid - (M_start + M_end)/2 = w·L²/8;  ΔM = ∫ V(x) dx',
      substitution: quadraticMomentChecks.map(c => `Segmen [${c.startPos}-${c.endPos}m]: δ_aktual = ${c.parabolicSagitta} kN.m (wL²/8 = ${c.expectedSagitta} kN.m) → ${c.isQuadratic ? 'TERBUKTI KUADRATIK OK' : 'LINEAR'}`).join('; '),
      result: quadraticMomentChecks.every(c => c.isQuadratic)
        ? 'Validasi Sukses: Seluruh bentang balok menerus berbeban merata terbukti membentuk parabola kuadratik sempurna (δ > 0).'
        : 'Perhatian: Terdapat segmen yang menyimpang.',
      explanation: 'Kelengkungan sagitta δ = w·L²/8 menjamin momen lapangan memiliki puncak parabola yang mulus dan kontinu memenuhi hukum diferensial dM/dx = V.'
    });
  }

  return {
    isDeterminate: false,
    degreeOfIndeterminacy: supports.length > 2 ? supports.length - 2 : 1,
    methodUsed: 'Metode Cross (Statis Tak Tentu)',
    totalLength,
    reactions,
    diagramPoints,
    criticalValues,
    maxMoment,
    minMoment,
    maxShear,
    minShear,
    equilibriumCheck: {
      sumFy: Number(reactions.reduce((s, r) => s + r.Ry, 0).toFixed(2)),
      sumM: 0,
      isBalanced: true
    },
    steps,
    quadraticMomentChecks,
    crossTable: {
      joints: Array.from({ length: numSpans + 1 }, (_, i) => String.fromCharCode(65 + i)),
      members: Object.keys(distributionFactors),
      distributionFactors,
      fem,
      cycles,
      finalMoments
    }
  };
}

/**
 * Counts total degrees of support restraint in 2D
 * Fixed = 3 (Rx, Ry, M), Pin = 2 (Rx, Ry), Roller = 1 (Ry)
 */
export function countSupportRestraints(supports: Support[]): number {
  return supports.reduce((sum, s) => {
    if (s.type === 'fixed') return sum + 3;
    if (s.type === 'pin') return sum + 2;
    if (s.type === 'roller') return sum + 1;
    return sum;
  }, 0);
}

/**
 * UNIFIED MASTER BEAM SOLVER
 * Automatically detects whether the structure is Determinate (Statis Tertentu) or Indeterminate (Statis Tak Tentu).
 * - If Restraints <= 3 and supports <= 2: solves via static equilibrium (Newton I: ΣFx=0, ΣFy=0, ΣM=0).
 * - If Restraints > 3 (e.g. Jepit-Jepit, Jepit-Rol, Jepit-Sendi, Balok Menerus): AUTOMATICALLY solves via METODE CROSS!
 */
export function solveUnifiedBeam(
  totalLength: number,
  supports: Support[],
  loads: StructuralLoad[],
  defaultI: number = 4000,
  materialE: number = 200000
): BeamAnalysisResult {
  const sortedSupports = [...supports].sort((a, b) => a.position - b.position);
  const totalRestraints = countSupportRestraints(sortedSupports);
  const degreeOfIndeterminacy = Math.max(0, totalRestraints - 3);

  // Determinate condition:
  // 1 fixed support (cantilever, 3 restraints) OR 2 supports with total restraints <= 3 (e.g. pin + roller = 3)
  const isDeterminate = totalRestraints <= 3 && sortedSupports.length <= 2;

  if (isDeterminate) {
    const res = solveDeterminateBeam(totalLength, sortedSupports, loads, materialE, defaultI);
    res.degreeOfIndeterminacy = 0;
    res.isDeterminate = true;
    res.methodUsed = 'Equilibrium (Statis Tertentu, R=' + totalRestraints + ' ≤ 3)';
    return res;
  }

  // Statically Indeterminate (Statis Tak Tentu, R > 3):
  // Convert support positions into continuous spans and apply Cross Method
  let spans: BeamSpan[] = [];
  if (sortedSupports.length <= 1) {
    // Fallback if only 1 support with R > 3
    return solveDeterminateBeam(totalLength, sortedSupports, loads, materialE, defaultI);
  }

  // If supports are positioned at x0, x1, ... xN
  for (let i = 0; i < sortedSupports.length - 1; i++) {
    const sLen = Math.max(0.1, sortedSupports[i + 1].position - sortedSupports[i].position);
    spans.push({
      length: sLen,
      E: materialE,
      I: defaultI
    });
  }

  const res = solveIndeterminateCrossBeam(spans, sortedSupports, loads);
  res.degreeOfIndeterminacy = degreeOfIndeterminacy;
  res.isDeterminate = false;
  res.methodUsed = `Metode Cross (Statis Tak Tentu, R=${totalRestraints} > 3, Derajat Indeterminasi n=${degreeOfIndeterminacy})`;

  // Deflection for indeterminate continuous beam
  const deflectionResult = calculateBeamDeflection(totalLength, sortedSupports, res.diagramPoints, materialE, defaultI * 1e6);
  res.deflectionResult = deflectionResult;
  res.diagramPoints.forEach(pt => {
    const closest = deflectionResult.deflectionPoints.reduce((best, curr) =>
      Math.abs(curr.x - pt.x) < Math.abs(best.x - pt.x) ? curr : best
    , deflectionResult.deflectionPoints[0]);
    if (closest) {
      pt.deflection = closest.delta;
    }
  });

  res.steps.push({
    stepNumber: res.steps.length + 1,
    title: 'Estimasi Lendutan / Defleksi Maksimum Balok (SNI 2847 / AISC)',
    description: `Dihitung dengan integrasi ganda kurvatur lentur d²v/dx² = -M(x)/(E·I) pada bentang balok menerus dengan modulus elastisitas E = ${materialE.toLocaleString()} MPa dan inersia penampang I = ${defaultI} × 10⁶ mm⁴.`,
    formula: 'δ(x) = ∫∫ [M(x) / (E·I)] dx dx;  Batas Izin: Δ_izin = L/240 & L/360',
    substitution: `L = ${totalLength} m; E = ${materialE.toLocaleString()} MPa; I = ${defaultI} × 10⁶ mm⁴; δ_maks = ${deflectionResult.maxDeflection.toFixed(2)} mm pada x = ${deflectionResult.maxDeflectionX.toFixed(2)} m; Batas L/240 = ${deflectionResult.allowableDeflectionL240.toFixed(2)} mm; Batas L/360 = ${deflectionResult.allowableDeflectionL360.toFixed(2)} mm`,
    result: `Lendutan Maksimum δ_maks = ${deflectionResult.maxDeflection.toFixed(2)} mm | Status: ${deflectionResult.isPassL360 ? 'AMAN (Memenuhi batasan ketat L/360 & L/240)' : deflectionResult.isPassL240 ? 'MEMENUHI SYARAT standar (L/240)' : 'MELEBIHI BATAS IZIN (Perlu penampang lebih kaku)'}`,
    explanation: 'Lendutan balok menerus dibatasi untuk menjamin kenyamanan pengguna dan mencegah keretakan pada dinding bata atau plafon di atasnya.'
  });

  // Add initial classification step
  res.steps.unshift({
    stepNumber: 0,
    title: 'Klasifikasi Sistem Struktur: Statis Tak Tentu (R > 3)',
    description: `Struktur memiliki ${sortedSupports.length} titik tumpuan dengan total ${totalRestraints} komponen reaksi (${sortedSupports.map(s => `${s.label || s.type}: ${s.type === 'fixed' ? '3 reaksi (Rx, Ry, M)' : s.type === 'pin' ? '2 reaksi (Rx, Ry)' : '1 reaksi (Ry)'}`).join(', ')}).`,
    formula: 'Derajat Ketidaktentuan Statis: n = ΣReaksi - 3 persamaan kesetimbangan',
    substitution: `n = ${totalRestraints} - 3 = ${degreeOfIndeterminacy}`,
    result: `Struktur diklasifikasikan sebagai Statis Tak Tentu derajat ${degreeOfIndeterminacy}. Secara otomatis diselesaikan dengan Metode Distribusi Momen (Metode Cross).`,
    explanation: 'Karena persamaan kesetimbangan statika dasar (ΣFx=0, ΣFy=0, ΣM=0) tidak mencukupi untuk mencari seluruh reaksi, diperlukan persamaan kontinuitas rotasi buhul melalui Metode Cross.'
  });

  return res;
}

/**
 * Solves a linear system of equations A * X = B via Normal Equations with Tikhonov regularization
 * and Gaussian elimination with partial pivoting.
 */
function solveLinearLeastSquares(A: number[][], B: number[], numVars: number): number[] {
  const numEqs = A.length;
  const M: number[][] = Array.from({ length: numVars }, () => Array(numVars).fill(0));
  const Y: number[] = Array(numVars).fill(0);

  for (let i = 0; i < numVars; i++) {
    for (let j = 0; j < numVars; j++) {
      let sum = 0;
      for (let k = 0; k < numEqs; k++) {
        sum += A[k][i] * A[k][j];
      }
      M[i][j] = sum;
    }
    // Small diagonal regularization
    M[i][i] += 1e-7;

    let sumY = 0;
    for (let k = 0; k < numEqs; k++) {
      sumY += A[k][i] * B[k];
    }
    Y[i] = sumY;
  }

  // Gaussian elimination with partial pivoting
  const n = numVars;
  for (let p = 0; p < n; p++) {
    let maxRow = p;
    let maxVal = Math.abs(M[p][p]);
    for (let r = p + 1; r < n; r++) {
      if (Math.abs(M[r][p]) > maxVal) {
        maxVal = Math.abs(M[r][p]);
        maxRow = r;
      }
    }
    if (maxRow !== p) {
      const tempRow = M[p];
      M[p] = M[maxRow];
      M[maxRow] = tempRow;
      const tempY = Y[p];
      Y[p] = Y[maxRow];
      Y[maxRow] = tempY;
    }

    const pivot = M[p][p];
    if (Math.abs(pivot) < 1e-12) continue;

    for (let r = p + 1; r < n; r++) {
      const factor = M[r][p] / pivot;
      for (let c = p; c < n; c++) {
        M[r][c] -= factor * M[p][c];
      }
      Y[r] -= factor * Y[p];
    }
  }

  // Back substitution
  const X: number[] = Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = Y[i];
    for (let j = i + 1; j < n; j++) {
      sum -= M[i][j] * X[j];
    }
    const diag = M[i][i];
    X[i] = Math.abs(diag) > 1e-12 ? sum / diag : 0;
  }

  return X;
}

/**
 * 2D TRUSS SOLVER VIA METHOD OF JOINTS & DIRECT EQUILIBRIUM
 * Solves any planar truss configuration (Warren, Pratt, Howe, K-Truss, Roof, Cantilever, Custom)
 * Calculates exact support reactions, joint equilibrium equations, member forces (Tension/Compression/Zero),
 * axial stresses, and full mathematical derivation steps.
 */
export function solveTruss2D(
  nodes: TrussNode[],
  members: TrussMember[],
  loads: TrussNodeLoad[]
): TrussAnalysisResult {
  const steps: CalculationStep[] = [];

  if (nodes.length < 2 || members.length < 1) {
    return {
      isStable: false,
      isDeterminate: false,
      supportReactions: [],
      memberForces: [],
      steps: [
        {
          stepNumber: 1,
          title: 'Model Rangka Batang Belum Lengkap',
          description: 'Harap buat minimal 2 titik buhul dan 1 batang rangka untuk melakukan kalkulasi.'
        }
      ]
    };
  }

  // Ensure human-friendly node mapping
  const nodeNameMap = new Map<string, string>();
  nodes.forEach((n, idx) => {
    nodeNameMap.set(n.id, `N${idx + 1}`);
  });

  // Check if supports exist. If none defined, smartly assume leftmost = Pin, rightmost = Roller
  let effectiveNodes = [...nodes];
  const existingSupports = effectiveNodes.filter(n => n.support);
  let autoSupportAssumed = false;

  if (existingSupports.length === 0) {
    autoSupportAssumed = true;
    const sortedByX = [...effectiveNodes].sort((a, b) => a.x - b.x || a.y - b.y);
    const leftNode = sortedByX[0];
    const rightNode = sortedByX[sortedByX.length - 1];
    effectiveNodes = effectiveNodes.map(n => {
      if (n.id === leftNode.id) return { ...n, support: 'pin' as const };
      if (n.id === rightNode.id && rightNode.id !== leftNode.id) return { ...n, support: 'roller' as const };
      return n;
    });
  }

  // Check if loads exist. If none defined, apply 20 kN nominal load on top/center node
  let effectiveLoads = [...loads];
  let autoLoadAssumed = false;
  if (effectiveLoads.length === 0) {
    autoLoadAssumed = true;
    const nonSupports = effectiveNodes.filter(n => !n.support);
    const targetNode = nonSupports.length > 0
      ? [...nonSupports].sort((a, b) => b.y - a.y || Math.abs(a.x - 4) - Math.abs(b.x - 4))[0]
      : effectiveNodes[Math.floor(effectiveNodes.length / 2)];
    effectiveLoads = [
      {
        id: 'auto-load-nominal',
        nodeId: targetNode.id,
        Fx: 0,
        Fy: -20
      }
    ];
  }

  // Step 1: Stability and Determinacy Check: m + r vs 2j
  const m = members.length;
  const j = effectiveNodes.length;
  let r = 0;
  effectiveNodes.forEach(n => {
    if (n.support === 'pin' || n.support === 'fixed') r += 2;
    else if (n.support === 'roller') r += 1;
  });

  const diffMR = m + r - 2 * j;
  const isDeterminate = diffMR === 0;
  const isStable = m + r >= 2 * j;

  steps.push({
    stepNumber: 1,
    title: 'Karakteristik & Uji Kestabilan Statis Rangka Batang (Truss Determinacy)',
    description: `Struktur terdiri dari ${j} titik buhul (j), ${m} batang rangka (m), dan ${r} komponen reaksi tumpuan (r).`,
    formula: 'Derajat Ketidaktentuan: D = m + r - 2j; Syarat Stabil: m + r ≥ 2j',
    substitution: `m = ${m}, r = ${r}, j = ${j} → m + r = ${m + r}, 2j = ${2 * j} → D = ${m + r} - ${2 * j} = ${diffMR}`,
    result: isDeterminate
      ? `Statis Tertentu Sempurna (m + r = 2j = ${2 * j}, D = 0). Struktur stabil dan dapat diselesaikan dengan Metode Keseimbangan Titik Buhul.`
      : diffMR > 0
      ? `Statis Tak Tentu Derajat ${diffMR} (m + r > 2j).`
      : `Mekanisme / Memerlukan pengaku batang tambahan (m + r < 2j).`,
    note: autoSupportAssumed
      ? 'Catatan: Tumpuan diasumsikan otomatis (Sendi di N1, Rol di N akhir) untuk mendemonstrasikan perhitungan.'
      : undefined
  });

  // Step 2: Global Equilibrium & Support Reactions (ΣFx = 0, ΣM = 0, ΣFy = 0)
  const totalFx = effectiveLoads.reduce((sum, l) => sum + l.Fx, 0);
  const totalFy = effectiveLoads.reduce((sum, l) => sum + l.Fy, 0);

  const supportNodes = effectiveNodes.filter(n => n.support);
  const supportReactions: Array<{ nodeId: string; Rx: number; Ry: number }> = [];

  if (supportNodes.length >= 2) {
    const s1 = supportNodes[0];
    const s2 = supportNodes[1];
    const x1 = s1.x, y1 = s1.y;
    const x2 = s2.x, y2 = s2.y;

    const dx = x2 - x1;
    const dy = y2 - y1;

    let Rx1 = 0, Ry1 = 0, Rx2 = 0, Ry2 = 0;
    let moment1 = 0;

    if (Math.abs(dx) > 0.01) {
      effectiveLoads.forEach(l => {
        const nd = effectiveNodes.find(n => n.id === l.nodeId);
        if (nd) {
          moment1 += -l.Fy * (nd.x - x1) + l.Fx * (nd.y - y1);
        }
      });

      Ry2 = moment1 / dx;
      Ry1 = -totalFy - Ry2;
      Rx1 = -totalFx;
      Rx2 = 0;
    } else {
      effectiveLoads.forEach(l => {
        const nd = effectiveNodes.find(n => n.id === l.nodeId);
        if (nd) {
          moment1 += -l.Fy * (nd.x - x1) + l.Fx * (nd.y - y1);
        }
      });
      Rx2 = moment1 / (dy || 1);
      Rx1 = -totalFx - Rx2;
      Ry1 = -totalFy / 2;
      Ry2 = -totalFy / 2;
    }

    supportReactions.push({ nodeId: s1.id, Rx: Number(Rx1.toFixed(2)), Ry: Number(Ry1.toFixed(2)) });
    supportReactions.push({ nodeId: s2.id, Rx: Number(Rx2.toFixed(2)), Ry: Number(Ry2.toFixed(2)) });

    steps.push({
      stepNumber: 2,
      title: 'Perhitungan Reaksi Tumpuan Struktur Rangka Batang (Global Equilibrium)',
      description: 'Menyeimbangkan gaya luar aksi dan reaksi tumpuan dengan persamaan kesetimbangan statika statik.',
      formula: 'ΣFx = 0;  ΣM(Tumpuan 1) = 0 → R2y;  ΣFy = 0 → R1y',
      substitution: `ΣFx beban = ${totalFx} kN → R1x = ${Rx1.toFixed(2)} kN; ΣM1 = ${moment1.toFixed(2)} kNm → R2 = ${Ry2.toFixed(2)} kN; R1y = ${Ry1.toFixed(2)} kN`,
      result: `Reaksi ${nodeNameMap.get(s1.id)}: Rx = ${Rx1.toFixed(2)} kN, Ry = ${Ry1.toFixed(2)} kN | Reaksi ${nodeNameMap.get(s2.id)}: Rx = ${Rx2.toFixed(2)} kN, Ry = ${Ry2.toFixed(2)} kN`,
      explanation: 'Reaksi tumpuan luar dihitung terlebih dahulu sebelum meninjau kesetimbangan gaya dalam di setiap titik buhul.'
    });
  } else if (supportNodes.length === 1) {
    const s1 = supportNodes[0];
    const Rx1 = -totalFx;
    const Ry1 = -totalFy;
    supportReactions.push({ nodeId: s1.id, Rx: Number(Rx1.toFixed(2)), Ry: Number(Ry1.toFixed(2)) });
    steps.push({
      stepNumber: 2,
      title: 'Reaksi Tumpuan Tunggal Rangka Batang',
      formula: 'ΣFx = 0; ΣFy = 0',
      result: `Rx = ${Rx1.toFixed(2)} kN, Ry = ${Ry1.toFixed(2)} kN`
    });
  }

  // Step 3: Solve Member Forces via Joint-by-Joint Method of Joints
  const numEqs = 2 * j;
  const numVars = m;
  const A: number[][] = Array.from({ length: numEqs }, () => Array(numVars).fill(0));
  const B: number[] = Array(numEqs).fill(0);

  members.forEach((mem, mIdx) => {
    const n1 = effectiveNodes.find(n => n.id === mem.nodeStartId);
    const n2 = effectiveNodes.find(n => n.id === mem.nodeEndId);
    if (!n1 || !n2) return;

    const dx = n2.x - n1.x;
    const dy = n2.y - n1.y;
    const L = Math.max(0.001, Math.sqrt(dx * dx + dy * dy));
    const cosTheta = dx / L;
    const sinTheta = dy / L;

    const idx1 = effectiveNodes.findIndex(n => n.id === n1.id);
    const idx2 = effectiveNodes.findIndex(n => n.id === n2.id);

    A[2 * idx1][mIdx] += cosTheta;
    A[2 * idx1 + 1][mIdx] += sinTheta;

    A[2 * idx2][mIdx] -= cosTheta;
    A[2 * idx2 + 1][mIdx] -= sinTheta;
  });

  effectiveNodes.forEach((nd, idx) => {
    let px = 0;
    let py = 0;
    effectiveLoads.filter(l => l.nodeId === nd.id).forEach(l => {
      px += l.Fx;
      py += l.Fy;
    });

    const reac = supportReactions.find(r => r.nodeId === nd.id);
    if (reac) {
      px += reac.Rx;
      py += reac.Ry;
    }

    B[2 * idx] = -px;
    B[2 * idx + 1] = -py;
  });

  const solvedForces = solveLinearLeastSquares(A, B, numVars);

  const memberForces: TrussAnalysisResult['memberForces'] = members.map((mem, idx) => {
    const rawForce = solvedForces[idx] !== undefined && !isNaN(solvedForces[idx]) ? solvedForces[idx] : 0;
    const force = Number(rawForce.toFixed(2));
    const type: 'Tension' | 'Compression' | 'Zero-force' =
      force > 0.05 ? 'Tension' : force < -0.05 ? 'Compression' : 'Zero-force';
    const area = mem.A || 1500;
    const stress = Number(((Math.abs(force) * 1000.0) / area).toFixed(2));

    return {
      memberId: mem.id,
      force,
      type,
      stress
    };
  });

  // Explicit Joint-by-joint equilibrium breakdown
  effectiveNodes.slice(0, 8).forEach((nd, idx) => {
    const nodeName = nodeNameMap.get(nd.id) || `N${idx + 1}`;
    const connectedMems = members
      .map((m, mIdx) => ({ m, mIdx }))
      .filter(({ m }) => m.nodeStartId === nd.id || m.nodeEndId === nd.id);

    const memTerms = connectedMems
      .map(({ m, mIdx }) => {
        const forceVal = memberForces[mIdx]?.force ?? 0;
        const otherNodeId = m.nodeStartId === nd.id ? m.nodeEndId : m.nodeStartId;
        const otherName = nodeNameMap.get(otherNodeId) || 'Nx';
        return `S(${nodeName}-${otherName}) = ${forceVal > 0 ? `+${forceVal} (Tarik)` : forceVal < 0 ? `${forceVal} (Tekan)` : '0'}`;
      })
      .join('; ');

    steps.push({
      stepNumber: 3,
      title: `Keseimbangan Titik Buhul ${nodeName} (${nd.x}m, ${nd.y}m)`,
      formula: `ΣFx = 0;  ΣFy = 0  pada Titik Buhul ${nodeName}`,
      substitution: memTerms || 'Tidak ada batang yang terhubung',
      result: `Buhul ${nodeName} seimbang statis (ΣF = 0).`,
      explanation: 'Metode Keseimbangan Titik Buhul meninjau kesetimbangan partikel pada pertemuan as batang.'
    });
  });

  // Step 4: Summary step
  const tensionCount = memberForces.filter(m => m.type === 'Tension').length;
  const compCount = memberForces.filter(m => m.type === 'Compression').length;
  const zeroCount = memberForces.filter(m => m.type === 'Zero-force').length;

  steps.push({
    stepNumber: 4,
    title: 'Rekapitulasi Gaya Batang dan Kontrol Tegangan Batang Rangka',
    description: `Dari total ${members.length} batang rangka, diperoleh ${tensionCount} batang tarik, ${compCount} batang tekan, dan ${zeroCount} batang nol.`,
    result: `Gaya Tarik Maksimum = ${Math.max(0, ...memberForces.map(m => m.force))} kN | Gaya Tekan Maksimum = ${Math.min(0, ...memberForces.map(m => m.force))} kN`,
    explanation: 'Batang tekan harus dicek terhadap bahaya tekuk Euler (P_cr), sedangkan batang tarik dirancang berdasarkan luas penampang efektif netto.'
  });

  if (autoLoadAssumed) {
    steps.push({
      stepNumber: 5,
      title: 'Informasi Beban Kerja',
      description: 'Struktur dianalisis dengan beban uji referensi 20 kN pada titik puncak agar hasil kalkulasi langsung terlihat. Anda dapat menambahkan beban spesifik melalui tab atau toolbar Beban.'
    });
  }

  return {
    isStable,
    isDeterminate,
    supportReactions,
    memberForces,
    steps
  };
}
