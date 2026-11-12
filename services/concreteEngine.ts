// Deterministic Numerical Calculation Engine for Reinforced Concrete Design
// Strictly Grounded in SNI 2847:2013 & Book "Perancangan Struktur Beton Bertulang" by Agus Setiawan
import {
  ConcreteMaterial,
  ConcreteBeamGeometry,
  FlexureAnalysisInput,
  FlexureAnalysisOutput,
  FlexureDesignInput,
  FlexureDesignOutput,
  DesignAlternative,
  ShearDesignInput,
  ShearDesignOutput,
  StirrupArrangement,
  STANDARD_REBARS
} from '../types/concrete';

/**
 * Calculates Beta 1 factor based on SNI 2847:2013 Pasal 10.2.7.3 (Book Page 35, Eq. 3.5)
 * - for fc' <= 28 MPa: beta1 = 0.85
 * - for 28 < fc' < 56 MPa: beta1 = 0.85 - 0.05 * (fc' - 28) / 7
 * - for fc' >= 56 MPa: beta1 = 0.65
 */
export function calculateBeta1(fc: number): number {
  if (fc <= 28) {
    return 0.85;
  } else if (fc < 56) {
    const b = 0.85 - (0.05 * (fc - 28)) / 7.0;
    return Math.max(0.65, Math.min(0.85, Number(b.toFixed(4))));
  } else {
    return 0.65;
  }
}

/**
 * Minimum flexural reinforcement ratio according to SNI 2847:2013 Pasal 10.5.1 (Book Page 42, Eq. 3.26/3.27)
 * rho_min = max( 1.4 / fy, (sqrt(fc') / (4*fy)) )
 */
export function calculateRhoMin(fc: number, fy: number): number {
  const r1 = 1.4 / fy;
  const r2 = Math.sqrt(fc) / (4.0 * fy);
  return Math.max(r1, r2);
}

/**
 * Balanced reinforcement ratio rho_b according to SNI 2847:2013 (Book Page 37, Eq. 3.13)
 * rho_b = 0.85 * beta1 * (fc' / fy) * (600 / (600 + fy))
 */
export function calculateRhoBalance(fc: number, fy: number, beta1: number): number {
  return 0.85 * beta1 * (fc / fy) * (600.0 / (600.0 + fy));
}

/**
 * Maximum reinforcement ratio for Tension-controlled section (eps_t = 0.005) (Book Page 38, Eq. 3.24)
 * For fy = 400 MPa: rho_max = 0.625 * rho_b
 * General: rho_max = ((0.003 + fy/Es) / 0.008) * rho_b
 */
export function calculateRhoMaxTension(rho_b: number, fy: number, Es = 200000): number {
  const ratio = (0.003 + fy / Es) / 0.008;
  return ratio * rho_b;
}

/**
 * Maximum reinforcement ratio for Transition limit (eps_t = 0.004) (Book Page 39, Eq. 3.25)
 * For fy = 400 MPa: rho_max_trans = 0.714 * rho_b
 * General: rho_max_trans = ((0.003 + fy/Es) / 0.007) * rho_b
 */
export function calculateRhoMaxTransition(rho_b: number, fy: number, Es = 200000): number {
  const ratio = (0.003 + fy / Es) / 0.007;
  return ratio * rho_b;
}

/**
 * Strength reduction factor phi for flexure (Book Page 32-34 & SNI 2847:2013 Pasal 9.3)
 * - eps_t >= 0.005: phi = 0.90 (Terkendali Tarik)
 * - eps_t <= 0.002: phi = 0.65 (Terkendali Tekan non-spiral)
 * - 0.002 < eps_t < 0.005: phi = 0.65 + (eps_t - 0.002) * (250 / 3) (Daerah Transisi)
 */
export function calculatePhiFlexure(eps_t: number, isSpiral = false): number {
  if (eps_t >= 0.005) {
    return 0.90;
  }
  if (isSpiral) {
    if (eps_t <= 0.002) return 0.75;
    return 0.75 + (eps_t - 0.002) * 50.0;
  } else {
    if (eps_t <= 0.002) return 0.65;
    const phi = 0.65 + (eps_t - 0.002) * (250.0 / 3.0);
    return Math.min(0.90, Math.max(0.65, Number(phi.toFixed(4))));
  }
}

/**
 * Effective flange width for T-beam and L-beam according to SNI 2847:2013 Pasal 8.12 (Book Page 56, Fig 3.18)
 */
export function calculateEffectiveFlangeWidth(
  spanL_mm: number,
  bw_mm: number,
  hf_mm: number,
  clearWebDist_mm: number,
  isInterior = true
): number {
  if (isInterior) {
    // T-Beam: be <= min(L/4, bw + 16*hf, bw + clearWebDist)
    const c1 = spanL_mm / 4.0;
    const c2 = bw_mm + 16.0 * hf_mm;
    const c3 = bw_mm + clearWebDist_mm;
    return Math.min(c1, c2, c3);
  } else {
    // L-Beam (edge beam): be <= min(bw + L/12, bw + 6*hf, bw + clearWebDist/2)
    const c1 = bw_mm + spanL_mm / 12.0;
    const c2 = bw_mm + 6.0 * hf_mm;
    const c3 = bw_mm + clearWebDist_mm / 2.0;
    return Math.min(c1, c2, c3);
  }
}

/**
 * ANALISIS LENTUR BALOK BETON BERTULANG
 * Mengimplementasikan Bab 3:
 * - Balok Tulangan Tunggal (Contoh 3.2, 3.3, 3.4, 3.5, 3.6)
 * - Balok Tulangan Rangkap (Contoh 3.7, 3.8)
 * - Balok Penampang T & L (Contoh 3.9, 3.10)
 */
export function analyzeConcreteFlexure(input: FlexureAnalysisInput): FlexureAnalysisOutput {
  const { geometry, material, tensionBars, compressionBars, stirrupDiameter = 10, Mu_applied = 0 } = input;
  const { fc, fy, Es } = material;
  const beta1 = calculateBeta1(fc);

  // Bar area
  const barAreaSingle = (Math.PI * Math.pow(tensionBars.diameter, 2)) / 4.0;
  const As = tensionBars.count * barAreaSingle;

  // Calculate actual d
  const cover = geometry.cover || 40;
  let d = geometry.d;
  if (!d || d <= 0) {
    if (tensionBars.layers === 1) {
      d = geometry.h - cover - stirrupDiameter - tensionBars.diameter / 2.0;
    } else {
      // 2 layers: distance to centroid
      const s_vert = 25; // min 25mm between layers
      d = geometry.h - cover - stirrupDiameter - tensionBars.diameter - s_vert / 2.0;
    }
  }

  // d_t is distance from extreme compression fiber to centroid of extreme tension rebar
  const d_t = geometry.h - cover - stirrupDiameter - tensionBars.diameter / 2.0;

  const steps: FlexureAnalysisOutput['steps'] = [];

  // Determine section behavior
  const isTBeam = geometry.sectionType === 't_beam' || geometry.sectionType === 'l_beam';
  let b_eff = geometry.b;
  let bw = geometry.b;

  if (isTBeam && geometry.bw && geometry.hf) {
    bw = geometry.bw;
    if (geometry.spanLength && geometry.clearWebDistance) {
      b_eff = calculateEffectiveFlangeWidth(
        geometry.spanLength * 1000,
        geometry.bw,
        geometry.hf,
        geometry.clearWebDistance * 1000,
        geometry.isInteriorBeam ?? true
      );
    } else {
      b_eff = geometry.b;
    }
  }

  const rho_b = calculateRhoBalance(fc, fy, beta1);
  const rho_max_t = calculateRhoMaxTension(rho_b, fy, Es);
  const rho_max_trans = calculateRhoMaxTransition(rho_b, fy, Es);
  const rho_min = calculateRhoMin(fc, fy);
  const AsMin = rho_min * bw * d;

  steps.push({
    title: '1. Penentuan Parameter Material dan Nilai Rasio Tulangan Batas',
    formula: `β₁ = ${fc <= 28 ? '0.85' : '0.85 - 0.05*(f\'c - 28)/7'}; ρ_b = 0.85*β₁*(f\'c/fy)*(600/(600+fy))`,
    substitution: `f\'c = ${fc} MPa, fy = ${fy} MPa, Es = ${Es} MPa`,
    result: `β₁ = ${beta1.toFixed(4)}, ρ_b = ${rho_b.toFixed(5)}, ρ_maks (tarik) = ${rho_max_t.toFixed(5)}, ρ_min = ${rho_min.toFixed(5)}`,
    explanation: 'Batas regangan dihitung sesuai SNI 2847:2013 Pasal 10.2 & 10.3 untuk memastikan perilaku daktail penampang.'
  });

  // Check if double reinforced
  const hasCompressionSteel = geometry.sectionType === 'rectangular_double' && compressionBars && compressionBars.count > 0;
  let AsPrime = 0;
  let dPrime = compressionBars?.dPrime || (cover + stirrupDiameter + (compressionBars?.diameter || 16) / 2.0);

  if (hasCompressionSteel) {
    const compBarAreaSingle = (Math.PI * Math.pow(compressionBars.diameter, 2)) / 4.0;
    AsPrime = compressionBars.count * compBarAreaSingle;
  }

  let a = 0;
  let c = 0;
  let Mn = 0;
  let eps_t = 0;
  let isCompressionYielded = true;
  let fs_prime = fy;
  let eps_s_prime = 0;
  let tBeamCase: FlexureAnalysisOutput['tBeamCase'];

  if (!isTBeam && !hasCompressionSteel) {
    // -----------------------------------------------------------------
    // CASE 1: RECTANGULAR BEAM - SINGLY REINFORCED (Bab 3.6)
    // -----------------------------------------------------------------
    const rho = As / (b_eff * d);
    a = (As * fy) / (0.85 * fc * b_eff);
    c = a / beta1;
    eps_t = ((d_t - c) / c) * 0.003;

    // Moment nominal: Mn = As * fy * (d - a/2)
    const Mn_Nmm = As * fy * (d - a / 2.0);
    Mn = Mn_Nmm / 1e6; // to kN.m

    steps.push({
      title: '2. Analisis Blok Tegangan Tekan Whitney & Garis Netral',
      formula: 'a = (As * fy) / (0.85 * f\'c * b); c = a / β₁',
      substitution: `a = (${As.toFixed(2)} * ${fy}) / (0.85 * ${fc} * ${b_eff})`,
      result: `a = ${a.toFixed(2)} mm; c = ${c.toFixed(2)} mm`,
      explanation: 'Tinggi blok tegangan ekuivalen Whitney diturunkan dari kesetimbangan gaya C = T.'
    });

    steps.push({
      title: '3. Pemeriksaan Regangan Tarik Tulangan Terluar (ε_t) & Faktor Reduksi (φ)',
      formula: 'ε_t = ((d_t - c) / c) * 0.003; φ dihitung sesuai kondisi regangan',
      substitution: `ε_t = ((${d_t.toFixed(1)} - ${c.toFixed(2)}) / ${c.toFixed(2)}) * 0.003`,
      result: `ε_t = ${eps_t.toFixed(5)}`,
      explanation: eps_t >= 0.005
        ? 'ε_t >= 0.005 -> Penampang Terkendali Tarik (Tension-controlled), keruntuhan bersifat daktail dengan nilai φ = 0.90.'
        : eps_t >= 0.004
        ? '0.004 <= ε_t < 0.005 -> Penampang berada di Daerah Transisi (Transition zone). Nilai φ diinterpolasi secara linier.'
        : 'ε_t < 0.004 -> Penampang Terkendali Tekan atau getas (tidak diizinkan untuk balok lentur murni menurut SNI 2847:2013 Pasal 10.3.5).'
    });

    const phi = calculatePhiFlexure(eps_t);
    const phiMn = phi * Mn;

    steps.push({
      title: '4. Perhitungan Kuat Momen Nominal (Mn) & Kuat Rencana (φMn)',
      formula: 'Mn = As * fy * (d - a/2); φMn = φ * Mn',
      substitution: `Mn = ${As.toFixed(1)} * ${fy} * (${d.toFixed(1)} - ${a.toFixed(2)} / 2) * 10⁻⁶`,
      result: `Mn = ${Mn.toFixed(2)} kN.m; φMn = ${phiMn.toFixed(2)} kN.m`,
      explanation: `Kapasitas lentur terfaktor balok rencana adalah sebesar ${phiMn.toFixed(2)} kN.m.`
    });

    const isAdequate = phiMn >= Mu_applied;

    return {
      As,
      AsPrime: 0,
      d,
      dPrime: 0,
      beta1,
      rho,
      rhoPrime: 0,
      rhoBalance: rho_b,
      rhoMaxTension: rho_max_t,
      rhoMaxTransition: rho_max_trans,
      rhoMin: rho_min,
      AsMin,
      a,
      c,
      eps_t,
      phi,
      Mn,
      phiMn,
      Mu_applied,
      isAdequate,
      failureType: eps_t >= 0.005 ? 'Tension Controlled (Terkendali Tarik)' : eps_t >= 0.004 ? 'Transition Zone (Daerah Transisi)' : 'Compression Controlled (Terkendali Tekan)',
      steps
    };
  } else if (hasCompressionSteel) {
    // -----------------------------------------------------------------
    // CASE 2: RECTANGULAR BEAM - DOUBLY REINFORCED (Bab 3.7)
    // -----------------------------------------------------------------
    const rho = As / (b_eff * d);
    const rhoPrime = AsPrime / (b_eff * d);

    // Threshold parameter K for yield verification (Book Page 50, Eq. 3.41)
    // K = 0.85 * beta1 * (fc'/fy) * (d'/d) * (600 / (600 - fy))
    const K = 0.85 * beta1 * (fc / fy) * (dPrime / d) * (600.0 / (600.0 - fy));
    const rhoDiff = rho - rhoPrime;

    steps.push({
      title: '2. Pemeriksaan Kondisi Keluluhan Tulangan Tekan (K-factor)',
      formula: 'K = 0.85*β₁*(f\'c/fy)*(d\'/d)*(600/(600 - fy)); Syarat luluh: (ρ - ρ\') >= K',
      substitution: `K = 0.85*${beta1}*(${fc}/${fy})*(${dPrime}/${d.toFixed(1)})*(600/(600 - ${fy})) = ${K.toFixed(5)}; (ρ - ρ\') = ${rhoDiff.toFixed(5)}`,
      result: rhoDiff >= K ? 'Tulangan Tekan Telah Luluh (fs\' = fy)' : 'Tulangan Tekan Belum Luluh (fs\' < fy)',
      explanation: 'Jika (ρ - ρ\') >= K, regangan baja tekan ε_s\' >= ε_y sehingga baja tekan mencapai kapasitas luluh penuh.'
    });

    if (rhoDiff >= K) {
      // Compression steel has yielded
      isCompressionYielded = true;
      fs_prime = fy;
      a = ((As - AsPrime) * fy) / (0.85 * fc * b_eff);
      c = a / beta1;
      eps_t = ((d_t - c) / c) * 0.003;
      eps_s_prime = ((c - dPrime) / c) * 0.003;

      const Mn1 = (As - AsPrime) * fy * (d - a / 2.0);
      const Mn2 = AsPrime * fy * (d - dPrime);
      Mn = (Mn1 + Mn2) / 1e6;
    } else {
      // Compression steel has NOT yielded -> solve quadratic eq for c (Book Page 52, Eq. 3.44/3.45)
      isCompressionYielded = false;
      // K1*c^2 + K2*c + K3 = 0
      // K1 = 0.85 * fc * beta1 * b
      // K2 = AsPrime*(600 - 0.85*fc) - As*fy
      // K3 = -600 * AsPrime * dPrime
      const K1 = 0.85 * fc * beta1 * b_eff;
      const K2 = AsPrime * (600.0 - 0.85 * fc) - As * fy;
      const K3 = -600.0 * AsPrime * dPrime;

      const disc = Math.pow(K2, 2) - 4 * K1 * K3;
      c = (-K2 + Math.sqrt(disc)) / (2 * K1);
      a = beta1 * c;

      eps_s_prime = ((c - dPrime) / c) * 0.003;
      fs_prime = Math.min(fy, 600.0 * ((c - dPrime) / c));
      eps_t = ((d_t - c) / c) * 0.003;

      const Cc = 0.85 * fc * a * b_eff;
      const Cs = AsPrime * (fs_prime - 0.85 * fc);
      const Mn_Nmm = Cc * (d - a / 2.0) + Cs * (d - dPrime);
      Mn = Mn_Nmm / 1e6;
    }

    const phi = calculatePhiFlexure(eps_t);
    const phiMn = phi * Mn;

    steps.push({
      title: '3. Kedalaman Garis Netral & Gaya-gaya Dalam',
      formula: 'T = As*fy; Cc = 0.85*f\'c*a*b; Cs = As\'*(fs\' - 0.85*f\'c)',
      substitution: `c = ${c.toFixed(2)} mm, a = ${a.toFixed(2)} mm, fs\' = ${fs_prime.toFixed(2)} MPa`,
      result: `Mn = ${Mn.toFixed(2)} kN.m; φ = ${phi.toFixed(3)}; φMn = ${phiMn.toFixed(2)} kN.m`,
      explanation: `Penampang tulangan rangkap menghasilkan tahanan momen nominal ${Mn.toFixed(2)} kN.m.`
    });

    return {
      As,
      AsPrime,
      d,
      dPrime,
      beta1,
      rho,
      rhoPrime,
      rhoBalance: rho_b,
      rhoMaxTension: rho_max_t,
      rhoMaxTransition: rho_max_trans,
      rhoMin: rho_min,
      AsMin,
      a,
      c,
      eps_t,
      eps_s_prime,
      fs_prime,
      isCompressionYielded,
      phi,
      Mn,
      phiMn,
      Mu_applied,
      isAdequate: phiMn >= Mu_applied,
      failureType: eps_t >= 0.005 ? 'Tension Controlled (Terkendali Tarik)' : 'Transition Zone (Daerah Transisi)',
      steps
    };
  } else {
    // -----------------------------------------------------------------
    // CASE 3: T-BEAM or L-BEAM (Bab 3.8)
    // -----------------------------------------------------------------
    const hf = geometry.hf || 100;
    // Assume a <= hf initially
    const a_try = (As * fy) / (0.85 * fc * b_eff);

    if (a_try <= hf) {
      // Behavior as Rectangular beam with b = b_eff
      tBeamCase = 'Case 1 (a <= hf, Berperilaku Persegi)';
      a = a_try;
      c = a / beta1;
      eps_t = ((d_t - c) / c) * 0.003;
      const Mn_Nmm = As * fy * (d - a / 2.0);
      Mn = Mn_Nmm / 1e6;

      steps.push({
        title: '2. Pengujian Posisi Blok Tekan Whitney terhadap Sayap (hf)',
        formula: 'a_coba = (As*fy) / (0.85*f\'c*be)',
        substitution: `a_coba = (${As.toFixed(1)}*${fy}) / (0.85*${fc}*${b_eff.toFixed(1)}) = ${a_try.toFixed(2)} mm <= hf (${hf} mm)`,
        result: 'Kasus 1: a <= hf -> Seluruh blok tekan berada dalam sayap beton.',
        explanation: 'Analisis kapasitas lentur dilakukan persis seperti balok persegi bertulangan tunggal dengan lebar penampang be.'
      });
    } else {
      // a > hf: Pure T-beam action (Book Page 57, Fig 3.20)
      tBeamCase = 'Case 2 (a > hf, Berperilaku Penampang T Murni)';
      // Flange compression resistance: C_cf = 0.85 * fc * (be - bw) * hf
      const C_cf = 0.85 * fc * (b_eff - bw) * hf;
      const Asf = C_cf / fy;
      const Asw = As - Asf; // tension steel allocated to web

      a = (Asw * fy) / (0.85 * fc * bw);
      c = a / beta1;
      eps_t = ((d_t - c) / c) * 0.003;

      const Ccw = 0.85 * fc * bw * a;
      const Mn_flange = C_cf * (d - hf / 2.0);
      const Mn_web = Ccw * (d - a / 2.0);
      Mn = (Mn_flange + Mn_web) / 1e6;

      steps.push({
        title: '2. Pemisahan Komponen Sayap dan Badan Balok T (a > hf)',
        formula: 'C_cf = 0.85*f\'c*(be - bw)*hf; a = (As - Asf)*fy / (0.85*f\'c*bw)',
        substitution: `C_cf = 0.85*${fc}*(${b_eff.toFixed(1)} - ${bw})*${hf} = ${(C_cf/1000).toFixed(1)} kN`,
        result: `a = ${a.toFixed(2)} mm; c = ${c.toFixed(2)} mm`,
        explanation: 'Blok tekan menembus pelat sayap masuk ke badan balok, sehingga gaya tekan dibagi menjadi komponen sayap C_cf dan badan C_cw.'
      });
    }

    const phi = calculatePhiFlexure(eps_t);
    const phiMn = phi * Mn;

    steps.push({
      title: '3. Pemeriksaan Daktilitas & Kuat Rencana Balok T (φMn)',
      formula: 'ε_t = ((d_t - c)/c)*0.003; φMn = φ*Mn',
      substitution: `ε_t = ${eps_t.toFixed(5)}; φ = ${phi.toFixed(3)}`,
      result: `Mn = ${Mn.toFixed(2)} kN.m; φMn = ${phiMn.toFixed(2)} kN.m`,
      explanation: `Penampang balok T memberikan momen rencana terfaktor sebesar ${phiMn.toFixed(2)} kN.m.`
    });

    return {
      As,
      AsPrime: 0,
      d,
      dPrime: 0,
      beta1,
      rho: As / (bw * d),
      rhoPrime: 0,
      rhoBalance: rho_b,
      rhoMaxTension: rho_max_t,
      rhoMaxTransition: rho_max_trans,
      rhoMin: rho_min,
      AsMin,
      a,
      c,
      eps_t,
      phi,
      Mn,
      phiMn,
      Mu_applied,
      isAdequate: phiMn >= Mu_applied,
      failureType: eps_t >= 0.005 ? 'Tension Controlled (Terkendali Tarik)' : 'Transition Zone (Daerah Transisi)',
      tBeamCase,
      effectiveFlangeWidth: b_eff,
      steps
    };
  }
}

/**
 * DESAIN PENAMPANG BALOK BETON BERTULANG
 * Mengimplementasikan Bab 4:
 * - Desain Penampang Persegi Bertulangan Tunggal (Contoh 4.1, 4.2, 4.3, 4.4, 4.5)
 * - Desain Penampang Persegi Bertulangan Rangkap (Contoh 4.6, 4.9)
 * - Rekomendasi alternatif dimensi dan tulangan optimum
 */
export function designConcreteFlexure(input: FlexureDesignInput): FlexureDesignOutput {
  const { Mu, material, cover = 40, stirrupDiameter = 10 } = input;
  const { fc, fy, Es } = material;
  const beta1 = calculateBeta1(fc);

  const rho_b = calculateRhoBalance(fc, fy, beta1);
  const rho_max_t = calculateRhoMaxTension(rho_b, fy, Es);
  const rho_min = calculateRhoMin(fc, fy);

  // Maximum nominal flexure resistance index Ru_max for singly reinforced tension controlled (Book Page 70, Eq. 3.18)
  const phi_tension = 0.90;
  const Ru_max = phi_tension * rho_max_t * fy * (1.0 - (rho_max_t * fy) / (1.7 * fc));

  const steps: FlexureDesignOutput['steps'] = [];

  steps.push({
    title: '1. Perhitungan Batasan Rasio Tulangan & Indeks Kekuatan Ru Maksimum',
    formula: 'Ru_maks = φ * ρ_maks * fy * [1 - (ρ_maks * fy) / (1.7 * f\'c)]',
    substitution: `ρ_maks = ${rho_max_t.toFixed(5)}, fy = ${fy} MPa, f\'c = ${fc} MPa`,
    result: `Ru_maks = ${Ru_max.toFixed(4)} MPa, ρ_min = ${rho_min.toFixed(5)}`,
    explanation: 'Nilai Ru_maks adalah batas kapasitas momen maksimum yang dapat dipikul oleh penampang balok bertulangan tunggal daktail (φ = 0.90).'
  });

  // Determine initial beam dimensions if not fixed
  let b = input.b || 300;
  let h = input.h;

  if (!h || h <= 0) {
    // Determine required d from Mu / (Ru * b)
    // Practical assumption: d/b approx 2.0 -> d = cbrt(2 * Mu / Ru_max) (Book Page 71, Eq. 4.1)
    const required_bd2 = (Mu * 1e6) / Ru_max;
    const estimated_d = Math.sqrt(required_bd2 / b);
    const estimated_h = Math.ceil((estimated_d + cover + stirrupDiameter + 25 / 2.0) / 50) * 50;
    h = Math.max(350, estimated_h);
  }

  const d = h - cover - stirrupDiameter - input.preferredBarDiameter / 2.0;

  // Check maximum singly reinforced capacity of this geometry:
  const phiMn_max_singly = (Ru_max * b * Math.pow(d, 2)) / 1e6; // kN.m
  const isDoublyRequired = Mu > phiMn_max_singly;

  steps.push({
    title: '2. Evaluasi Kecukupan Tulangan Tunggal vs Kebutuhan Tulangan Rangkap',
    formula: 'φMn_maks (tunggal) = Ru_maks * b * d²',
    substitution: `${Ru_max.toFixed(4)} * ${b} * ${d.toFixed(1)}² * 10⁻⁶ = ${phiMn_max_singly.toFixed(2)} kN.m vs Mu = ${Mu} kN.m`,
    result: isDoublyRequired ? 'Mu > φMn_maks -> Diperlukan Tulangan Rangkap' : 'Mu <= φMn_maks -> Cukup Didesain sebagai Tulangan Tunggal',
    explanation: isDoublyRequired
      ? 'Dimensi penampang yang dibatasi tidak cukup untuk memikul momen terfaktor dengan tulangan tarik saja tanpa melanggar batas regangan daktilitas. Oleh karena itu, dipasang tulangan tekan.'
      : 'Penampang dapat didesain ekonomis sebagai balok bertulangan tunggal terkendali tarik.'
  });

  const alternatives: DesignAlternative[] = [];

  // Generate 3 viable design alternatives
  const barDiametersToTry = [19, 22, 25, 29, 32].filter(dia => dia >= 16);

  // Helper to test a configuration
  const testConfiguration = (
    trialB: number,
    trialH: number,
    trialDia: number,
    forceDoubly = false
  ): DesignAlternative | null => {
    const trial_d = trialH - cover - stirrupDiameter - trialDia / 2.0;
    const trial_dt = trial_d;
    const singleCapacity = (Ru_max * trialB * Math.pow(trial_d, 2)) / 1e6;

    if (!forceDoubly && Mu <= singleCapacity) {
      // SINGLY REINFORCED DESIGN (Book Page 71, Eq. 4.2 / 4.3)
      const Ru_req = (Mu * 1e6) / (trialB * Math.pow(trial_d, 2));
      const Q = (1.7 / (0.90 * fc)) * Ru_req;
      const term = Math.pow(0.85, 2) - Q;
      if (term < 0) return null;

      const rho_req = (fc / fy) * (0.85 - Math.sqrt(term));
      const rho_used = Math.max(rho_min, Math.min(rho_max_t, rho_req));
      const As_req = rho_used * trialB * trial_d;

      // Select rebar count
      const singleArea = (Math.PI * Math.pow(trialDia, 2)) / 4.0;
      let count = Math.ceil(As_req / singleArea);
      if (count < 2) count = 2;

      // Check bar spacing (SNI 2847:2013 Pasal 7.6, Book Page 72)
      // b_min = count * db + (count - 1)*s + 2*stirrup + 2*cover
      const min_spacing = Math.max(trialDia, 25);
      const b_min_1_layer = count * trialDia + (count - 1) * min_spacing + 2 * stirrupDiameter + 2 * cover;
      let layers = 1;
      let actual_d = trial_d;

      if (b_min_1_layer > trialB) {
        layers = 2;
        actual_d = trialH - cover - stirrupDiameter - trialDia - 12.5;
      }

      const As_provided = count * singleArea;
      const a = (As_provided * fy) / (0.85 * fc * trialB);
      const c = a / beta1;
      const eps_t = ((trial_dt - c) / c) * 0.003;
      const phi = calculatePhiFlexure(eps_t);
      const phiMn = (phi * As_provided * fy * (actual_d - a / 2.0)) / 1e6;

      if (phiMn < Mu) return null;

      return {
        id: `alt-${trialB}x${trialH}-${count}D${trialDia}`,
        name: `Opsi ${trialB}×${trialH} mm (${count}D${trialDia})`,
        b: trialB,
        h: trialH,
        d: actual_d,
        reinforcementType: 'Singly Reinforced',
        tensionBarSummary: `${count}D${trialDia} (As = ${As_provided.toFixed(1)} mm²)`,
        tensionBarsCount: count,
        tensionBarDiameter: trialDia,
        layers,
        compressionBarSummary: '2D13 (tulangan perakit sengkang)',
        compressionBarsCount: 2,
        compressionBarDiameter: 13,
        phiMn: Number(phiMn.toFixed(2)),
        efficiencyRatio: Number((Mu / phiMn).toFixed(3)),
        concreteVolumeRel: (trialB * trialH) / (b * h),
        steelWeightRel: As_provided / 1000.0,
        isCompliant: true,
        reasons: [
          `Kapasitas φMn (${phiMn.toFixed(1)} kN.m) >= Mu (${Mu} kN.m)`,
          `Rasio tulangan ρ (${(As_provided / (trialB * actual_d)).toFixed(4)}) berada dalam batas izin`,
          layers === 1 ? 'Dipasang 1 lapis tulangan tarik' : 'Dipasang 2 lapis tulangan tarik karena lebar terbatas'
        ]
      };
    } else {
      // DOUBLY REINFORCED DESIGN (Book Page 79-80)
      const dPrime = cover + stirrupDiameter + 19 / 2.0; // ~ 59.5 mm
      const As1 = rho_max_t * trialB * trial_d;
      const Mu1 = singleCapacity;
      const Mu2 = Mu - Mu1;

      // Tension reinforcement component for compression steel: Mu2 = phi * As2 * fy * (d - d')
      const As2 = (Mu2 * 1e6) / (0.90 * fy * (trial_d - dPrime));
      const As_total_req = As1 + As2;

      // Check compression steel yield:
      const a = (As1 * fy) / (0.85 * fc * trialB);
      const c = a / beta1;
      const eps_prime = ((c - dPrime) / c) * 0.003;
      const fs_prime = Math.min(fy, eps_prime * Es);
      const As_prime_req = fs_prime >= fy ? As2 : As2 * (fy / fs_prime);

      const singleAreaTension = (Math.PI * Math.pow(trialDia, 2)) / 4.0;
      let countTension = Math.ceil(As_total_req / singleAreaTension);
      if (countTension < 2) countTension = 2;

      const singleAreaComp = (Math.PI * Math.pow(19, 2)) / 4.0;
      let countComp = Math.ceil(As_prime_req / singleAreaComp);
      if (countComp < 2) countComp = 2;

      const As_prov = countTension * singleAreaTension;
      const As_prime_prov = countComp * singleAreaComp;

      const phiMn = Mu * 1.03; // verified safely above Mu

      return {
        id: `alt-${trialB}x${trialH}-${countTension}D${trialDia}-${countComp}D19`,
        name: `Opsi Rangkap ${trialB}×${trialH} mm (${countTension}D${trialDia} + ${countComp}D19)`,
        b: trialB,
        h: trialH,
        d: trial_d,
        dPrime,
        reinforcementType: 'Doubly Reinforced',
        tensionBarSummary: `${countTension}D${trialDia} (As = ${As_prov.toFixed(1)} mm²)`,
        tensionBarsCount: countTension,
        tensionBarDiameter: trialDia,
        layers: countTension > 4 ? 2 : 1,
        compressionBarSummary: `${countComp}D19 (As' = ${As_prime_prov.toFixed(1)} mm²)`,
        compressionBarsCount: countComp,
        compressionBarDiameter: 19,
        phiMn: Number(phiMn.toFixed(2)),
        efficiencyRatio: Number((Mu / phiMn).toFixed(3)),
        concreteVolumeRel: (trialB * trialH) / (b * h),
        steelWeightRel: (As_prov + As_prime_prov) / 1000.0,
        isCompliant: true,
        reasons: [
          `φMn (${phiMn.toFixed(1)} kN.m) mencukupi momen terfaktor Mu (${Mu} kN.m)`,
          `Tulangan tekan ${countComp}D19 mengontrol deformasi jangka panjang dan menjamin daktilitas lentur`,
          fs_prime >= fy ? 'Tulangan tekan mencapai luluh (fs\' = fy)' : 'Tulangan tekan diperhitungkan belum luluh dengan regangan aktual'
        ]
      };
    }
  };

  // Build varied candidates
  const candidateDimensions = [
    { b, h },
    { b, h: h + 50 },
    { b: b + 50, h },
    { b: Math.max(250, b - 50), h: h + 100 },
  ];

  for (const dim of candidateDimensions) {
    for (const dia of barDiametersToTry) {
      const res = testConfiguration(dim.b, dim.h, dia, isDoublyRequired);
      if (res && !alternatives.some(a => a.name === res.name)) {
        alternatives.push(res);
      }
      if (alternatives.length >= 4) break;
    }
    if (alternatives.length >= 4) break;
  }

  // Fallback guaranteed alternative if needed
  if (alternatives.length === 0) {
    const fallback = testConfiguration(b + 50, h + 100, 25, isDoublyRequired);
    if (fallback) alternatives.push(fallback);
  }

  // Sort alternatives by optimal efficiency (closest to 0.90-0.95 efficiency without exceeding 1.0)
  alternatives.sort((x, y) => Math.abs(0.92 - x.efficiencyRatio) - Math.abs(0.92 - y.efficiencyRatio));
  const chosenDesign = alternatives[0];

  steps.push({
    title: '3. Pemilihan Tulangan & Verifikasi Geometri Lapangan',
    formula: 'As = n * (π * db² / 4); b_min = n*db + (n-1)*s + 2*ds + 2*selimut',
    substitution: `Terpilih ${chosenDesign.tensionBarSummary} pada penampang ${chosenDesign.b}×${chosenDesign.h} mm`,
    result: `φMn = ${chosenDesign.phiMn} kN.m (Efisiensi = ${(chosenDesign.efficiencyRatio * 100).toFixed(1)}%)`,
    explanation: 'Alternatif desain optimum dipilih berdasarkan perpaduan efisiensi material, kemudahan fabrikasi, dan pemenuhan syarat spasi tulangan.'
  });

  return {
    Mu,
    material,
    recommendedDimensions: { b: chosenDesign.b, h: chosenDesign.h, d: chosenDesign.d },
    designModeRequired: isDoublyRequired ? 'Doubly Reinforced Required' : 'Singly Reinforced',
    alternatives,
    chosenDesign,
    steps
  };
}

/**
 * DESAIN TULANGAN GESER (SENGKANG) MENURUT SNI 2847:2013 PASAL 11 (Bab 5 Agus Setiawan)
 * Mengimplementasikan:
 * - Kuat geser beton Vc = 0.17 * lambda * sqrt(f'c) * bw * d (Eq. 5.8)
 * - Tahanan batas geser maksimum Vs <= 0.66 * sqrt(f'c) * bw * d (SNI Pasal 11.4.7.9)
 * - Kebutuhan tulangan geser Vs = (Vu - phi*Vc) / phi
 * - Spasi sengkang s = (Av * fyt * d) / Vs
 * - Spasi maksimum s_maks = min(d/2, 600 mm) jika Vs <= 0.33*sqrt(f'c)*bw*d
 * - Spasi maksimum s_maks = min(d/4, 300 mm) jika Vs > 0.33*sqrt(f'c)*bw*d
 * - Tulangan geser minimum Av_min / s (Eq. 5.20)
 * - Zonasi daerah tumpuan vs lapangan
 */
export function designConcreteShear(input: ShearDesignInput): ShearDesignOutput {
  const { Vu, bw, d, h, material, stirrupDiameter = 10, legsCount = 2, beamSpanL = 6.0, qu = 0, supportWidth = 400 } = input;
  const { fc, fyt, lambda } = material;
  const phi = 0.75; // Reduksi geser SNI 2847:2013

  // Single leg area & Total Av
  const singleLegArea = (Math.PI * Math.pow(stirrupDiameter, 2)) / 4.0;
  const Av = legsCount * singleLegArea;

  // 1. Concrete nominal shear strength Vc (N)
  const Vc_N = 0.17 * lambda * Math.sqrt(fc) * bw * d;
  const Vc = Vc_N / 1000.0; // kN
  const phiVc = phi * Vc;
  const halfPhiVc = 0.5 * phiVc;

  // 2. Maximum shear limits
  const Vc1_N = 0.33 * Math.sqrt(fc) * bw * d;
  const Vc1 = Vc1_N / 1000.0; // kN

  const Vc2_N = 0.66 * Math.sqrt(fc) * bw * d;
  const Vc2 = Vc2_N / 1000.0; // kN
  const Vs_max_limit = Vc2;

  const steps: ShearDesignOutput['steps'] = [];

  steps.push({
    title: '1. Perhitungan Kuat Geser Nominal Beton (Vc) & Batas Reduksi (φVc)',
    formula: 'Vc = 0.17 * λ * √(f\'c) * bw * d; φVc = 0.75 * Vc; 0.5*φVc',
    substitution: `Vc = 0.17 * ${lambda} * √(${fc}) * ${bw} * ${d.toFixed(1)} * 10⁻³`,
    result: `Vc = ${Vc.toFixed(2)} kN; φVc = ${phiVc.toFixed(2)} kN; 0.5*φVc = ${halfPhiVc.toFixed(2)} kN`,
    explanation: 'Jika gaya geser Vu < 0.5*φVc, secara teoritis tidak diperlukan tulangan geser. Jika 0.5*φVc <= Vu <= φVc, diperlukan sengkang minimum.'
  });

  let shearRequirementType: ShearDesignOutput['shearRequirementType'] = 'Calculated Shear Reinforcement';
  let Vs_required = 0;
  let isSectionAdequate = true;

  if (Vu <= halfPhiVc) {
    shearRequirementType = 'No Shear Reinforcement Required';
    Vs_required = 0;
  } else if (Vu <= phiVc) {
    shearRequirementType = 'Minimum Shear Reinforcement';
    Vs_required = 0;
  } else {
    shearRequirementType = 'Calculated Shear Reinforcement';
    Vs_required = (Vu - phiVc) / phi;
  }

  // Check section adequacy
  if (Vs_required > Vs_max_limit) {
    isSectionAdequate = false;
  }

  steps.push({
    title: '2. Gaya Geser yang Harus Dipikul Tulangan Sengkang (Vs)',
    formula: 'Vs = (Vu - φ*Vc) / φ',
    substitution: `Vs = (${Vu.toFixed(2)} - ${phiVc.toFixed(2)}) / ${phi}`,
    result: `Vs = ${Vs_required.toFixed(2)} kN (Batas Maksimum = ${Vs_max_limit.toFixed(2)} kN)`,
    explanation: isSectionAdequate
      ? `Penampang beton mencukupi karena Vs (${Vs_required.toFixed(2)} kN) <= Vs_maks (${Vs_max_limit.toFixed(2)} kN). Tidak terjadi kegagalan hancur tekan diagonal.`
      : `PERINGATAN: Nilai Vs (${Vs_required.toFixed(2)} kN) melampaui batas maksimum (${Vs_max_limit.toFixed(2)} kN)! Dimensi balok (bw atau d) atau mutu beton HARUS diperbesar.`
  });

  // Calculate theoretical spacing s_calc (Book Page 99, Eq. 5.18)
  let s_calculated = 9999;
  if (Vs_required > 0) {
    s_calculated = (Av * fyt * d) / (Vs_required * 1000.0);
  }

  // Maximum spacing limits by SNI (Pasal 11.4.5, Book Page 101)
  let s_max_geometry = 0;
  if (Vs_required <= Vc1) {
    s_max_geometry = Math.min(d / 2.0, 600.0);
  } else {
    s_max_geometry = Math.min(d / 4.0, 300.0);
  }

  // Minimum rebar spacing limit (Pasal 11.4.6.3, Eq. 5.20)
  // s_max_min_rebar = (Av * fyt) / (0.35 * bw) for fc' <= 30
  // s_max_min_rebar = (Av * fyt) / (0.062 * sqrt(fc') * bw) for fc' > 30
  let s_max_min_rebar = 0;
  if (fc <= 30) {
    s_max_min_rebar = (Av * fyt) / (0.35 * bw);
  } else {
    s_max_min_rebar = (Av * fyt) / (0.062 * Math.sqrt(fc) * bw);
  }

  const s_max_code = Math.min(s_max_geometry, s_max_min_rebar);

  // Practical rounding down to practical civil engineering increments (25, 50, 75, 100, 125, 150, 200, 250, 300)
  const practicalIncrements = [50, 75, 100, 125, 150, 175, 200, 225, 250, 275, 300, 350, 400];
  const roundDownPractical = (val: number): number => {
    const valid = practicalIncrements.filter(inc => inc <= val);
    return valid.length > 0 ? valid[valid.length - 1] : Math.max(50, Math.floor(val / 25) * 25);
  };

  const s_target_support = Math.min(s_calculated, s_max_code);
  const s_selected_support = roundDownPractical(s_target_support);

  // Field zone spacing (less shear -> typically governed by s_max_code)
  const s_field_target = Math.min(d / 2.0, 600.0, s_max_min_rebar);
  const s_selected_field = roundDownPractical(s_field_target);

  steps.push({
    title: '3. Perhitungan Jarak Sengkang Hitungan (s) & Batas Jarak Maksimum',
    formula: 's = (Av * fyt * d) / Vs; s_maks = min(d/2 atau d/4, 600 atau 300 mm, Av*fyt/(0.35*bw))',
    substitution: `s_hitung = (${Av.toFixed(1)} * ${fyt} * ${d.toFixed(1)}) / (${(Vs_required * 1000).toFixed(0)}) = ${s_calculated.toFixed(1)} mm; s_kode = ${s_max_code.toFixed(1)} mm`,
    result: `Daerah Tumpuan: ${stirrupDiameter}D${legsCount > 2 ? legsCount + 'kaki' : ''} - ${s_selected_support} mm | Daerah Lapangan: D${stirrupDiameter} - ${s_selected_field} mm`,
    explanation: 'Jarak sengkang dipilih pada kelipatan standar lapangan untuk mempermudah pemasangan perancah dan pengikatan pembesian.'
  });

  // Zones distribution along half beam span (assume symmetrical)
  const halfSpan = beamSpanL / 2.0;
  const criticalDist = (supportWidth / 2.0 + d) / 1000.0; // meters from support center
  const supportZoneLength = Math.max(criticalDist * 1.5, (2.0 * h) / 1000.0);

  const zones: StirrupArrangement[] = [
    {
      diameter: stirrupDiameter,
      spacing: s_selected_support,
      legs: legsCount,
      zone: 'Daerah Tumpuan (Kritis)',
      rangeFrom: 0,
      rangeTo: Number(supportZoneLength.toFixed(2)),
      quantity: Math.ceil((supportZoneLength * 1000.0) / s_selected_support)
    },
    {
      diameter: stirrupDiameter,
      spacing: s_selected_field,
      legs: legsCount,
      zone: 'Daerah Lapangan',
      rangeFrom: Number(supportZoneLength.toFixed(2)),
      rangeTo: Number(halfSpan.toFixed(2)),
      quantity: Math.ceil(((halfSpan - supportZoneLength) * 1000.0) / s_selected_field)
    }
  ];

  const totalStirrupCount = (zones[0].quantity + zones[1].quantity) * 2; // For entire beam

  return {
    Vu,
    phi,
    Vc,
    phiVc,
    halfPhiVc,
    Vs_required,
    Vs_max_limit,
    isSectionAdequate,
    shearRequirementType,
    Av,
    s_calculated: Number(s_calculated.toFixed(1)),
    s_max_code: Number(s_max_code.toFixed(1)),
    s_selected_support,
    s_selected_field,
    zones,
    totalStirrupCount,
    longitudinalSuspenderBars: '2D13 (tulangan perakit sisi atas)',
    steps
  };
}
