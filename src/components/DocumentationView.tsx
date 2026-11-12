import React from 'react';
import { BookOpen, Layers, CheckCircle2, ShieldCheck, ExternalLink } from 'lucide-react';

export const DocumentationView: React.FC = () => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl text-white space-y-8 max-w-4xl mx-auto">
      <div className="pb-4 border-b border-slate-800">
        <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider">
          Pedoman & Dokumentasi Teknis
        </span>
        <h2 className="text-2xl font-bold tracking-tight text-white mt-1">
          Landasan Teori & Standar Perancangan StructuraLab
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          Referensi matematis resmi yang digunakan oleh calculation engine untuk analisis struktur dan desain beton bertulang.
        </p>
      </div>

      {/* Reference Book Card */}
      <div className="bg-gradient-to-r from-slate-950 to-indigo-950/40 p-5 rounded-xl border border-indigo-900/60 flex flex-col sm:flex-row items-start gap-4">
        <div className="p-3 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
          <BookOpen className="w-8 h-8" />
        </div>
        <div className="space-y-1">
          <h3 className="font-bold text-base text-white">
            Perancangan Struktur Beton Bertulang (Berdasarkan SNI 2847:2013)
          </h3>
          <p className="text-xs text-indigo-300 font-mono">
            Penulis: Agus Setiawan, S.T., M.T. | Penerbit Erlangga, 2016
          </p>
          <p className="text-xs text-slate-400 leading-relaxed pt-1">
            Buku ajar standar yang mencakup Bab 3 (Analisis Lentur Balok), Bab 4 (Desain Lentur Balok Bertulangan Tunggal dan Rangkap), Bab 5 (Desain Balok terhadap Gaya Geser), serta lampiran tabel nilai Ru dan ρ.
          </p>
        </div>
      </div>

      {/* Chapters Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
          <span className="font-mono text-cyan-400 font-bold block">BAB 3: ANALISIS LENTUR BALOK</span>
          <ul className="space-y-1 text-slate-300 list-disc list-inside">
            <li>Asumsi blok tegangan ekuivalen Whitney (β₁ = 0.85 hingga 0.65).</li>
            <li>Rasio tulangan seimbang: ρb = 0.85*β₁*(f'c/fy)*(600/(600+fy)).</li>
            <li>Batas daktilitas terkendali tarik: ε_t ≥ 0.005 (ρ_maks = 0.625*ρb).</li>
            <li>Faktor reduksi kekuatan lentur: φ = 0.65 hingga 0.90 (interpolasi linier pada zona transisi).</li>
            <li>Balok bertulangan rangkap dengan faktor keluluhan K dan kompatibilitas regangan.</li>
            <li>Balok penampang T (Kasus 1: a ≤ hf; Kasus 2: a &gt; hf).</li>
          </ul>
        </div>

        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
          <span className="font-mono text-cyan-400 font-bold block">BAB 4: DESAIN LENTUR BALOK</span>
          <ul className="space-y-1 text-slate-300 list-disc list-inside">
            <li>Kapasitas indeks tahanan: Ru = φ * ρ * fy * [1 - (ρ * fy) / (1.7 * f'c)].</li>
            <li>Kebutuhan luas tulangan tarik As = ρ * b * d.</li>
            <li>Pemeriksaan spasi bersih tulangan (min 25 mm atau db) dan tebal selimut (40 mm).</li>
            <li>Desain tulangan rangkap bila momen perlu Mu &gt; φMn_maks penampang tunggal.</li>
            <li>Rekomendasi konfigurasi tulangan optimal berdasarkan ketersediaan batang D10–D36.</li>
          </ul>
        </div>

        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
          <span className="font-mono text-cyan-400 font-bold block">BAB 5: DESAIN TULANGAN GESER (SENGKANG)</span>
          <ul className="space-y-1 text-slate-300 list-disc list-inside">
            <li>Kuat geser beton nominal: Vc = 0.17 * λ * √(f'c) * bw * d.</li>
            <li>Kuat geser tulangan geser: Vs = (Vu - φ*Vc) / φ dengan φ = 0.75.</li>
            <li>Batas maksimum tahanan geser: Vs ≤ 0.66 * √(f'c) * bw * d.</li>
            <li>Jarak sengkang vertikal: s = (Av * fyt * d) / Vs.</li>
            <li>Batas spasi maksimum s_maks = min(d/2, 600) atau min(d/4, 300) jika gaya tinggi.</li>
            <li>Zonasi sengkang tumpuan (daerah kritis 0 s/d 2h) dan daerah lapangan.</li>
          </ul>
        </div>

        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
          <span className="font-mono text-cyan-400 font-bold block">MODUL ANALISIS MEKANIKA STRUKTUR</span>
          <ul className="space-y-1 text-slate-300 list-disc list-inside">
            <li>Balok statis tertentu: Keseimbangan ΣFx=0, ΣFy=0, ΣM=0.</li>
            <li>Beban titik, beban merata (UDL), segitiga, trapesium, dan momen terpusat.</li>
            <li>Generasi kontinu diagram gaya lintang (SFD) dan momen lentur (BMD).</li>
            <li>Metode Cross (Moment Distribution Method) untuk balok menerus statis tak tentu.</li>
            <li>Analisis Rangka Batang 2D (Truss) dengan Metode Titik Buhul (Method of Joints).</li>
          </ul>
        </div>
      </div>

      {/* Compliance statement */}
      <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
        <span className="text-slate-400 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" /> Seluruh formula dihitung secara deterministik oleh TypeScript Math Engine tanpa simulasi generatif palsu.
        </span>
        <span className="font-mono text-cyan-400 font-bold">SNI 2847:2013</span>
      </div>
    </div>
  );
};
