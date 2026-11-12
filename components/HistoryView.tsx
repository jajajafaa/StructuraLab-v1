import React, { useState, useEffect } from 'react';
import { CalculationRecord, UserProfile } from '../types/auth';
import { DatabaseService } from '../services/db';
import { History, Trash2, Download, Eye, FileText, CheckCircle2, Clock } from 'lucide-react';
import jsPDF from 'jspdf';

interface HistoryViewProps {
  currentUser: UserProfile;
  onOpenRecord: (record: CalculationRecord) => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({ currentUser, onOpenRecord }) => {
  const [records, setRecords] = useState<CalculationRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<CalculationRecord | null>(null);

  useEffect(() => {
    // If admin, show all or filtered; if user, show user's records
    const list = DatabaseService.getCalculationRecords(currentUser.role === 'admin' ? undefined : currentUser.uid);
    setRecords(list);
  }, [currentUser]);

  const handleDelete = (id: string) => {
    if (confirm('Hapus riwayat perhitungan ini?')) {
      DatabaseService.deleteCalculationRecord(id);
      setRecords(DatabaseService.getCalculationRecords(currentUser.role === 'admin' ? undefined : currentUser.uid));
      if (selectedRecord?.id === id) setSelectedRecord(null);
    }
  };

  const handleExportPDF = (record: CalculationRecord) => {
    const doc = new jsPDF();

    // Header styling
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, 210, 35, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('StructuraLab - Engineering Report', 14, 18);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(56, 189, 248); // cyan-400
    doc.text('Aplikasi Rekayasa Analisis Struktur & Desain Beton Bertulang (SNI 2847:2013)', 14, 27);

    // Metadata
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(record.title, 14, 48);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`User: ${record.userEmail} | Tanggal: ${new Date(record.timestamp).toLocaleString('id-ID')}`, 14, 56);
    doc.text(`Standar Desain: ${record.standard} | Kategori: ${record.category.toUpperCase()} (${record.subType})`, 14, 62);
    doc.text(`Status Keamanan Struktur: ${record.status.toUpperCase()}`, 14, 68);

    doc.setDrawColor(203, 213, 225);
    doc.line(14, 72, 196, 72);

    // Summary Box
    doc.setFillColor(248, 250, 252);
    doc.rect(14, 76, 182, 24, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('Ringkasan Hasil Perhitungan:', 18, 84);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(record.summary, 18, 92);

    // Detail steps
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('Langkah-Langkah Perhitungan Matematis (Transparent Steps):', 14, 112);

    let yPos = 120;
    const steps = record.resultData?.steps || [];
    steps.forEach((st: any, idx: number) => {
      if (yPos > 260) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(2, 132, 199);
      doc.text(`${idx + 1}. ${st.title || `Tahap ${idx + 1}`}`, 14, yPos);
      yPos += 6;

      doc.setFont('courier', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);

      if (st.formula) {
        doc.text(`Rumus: ${st.formula}`, 18, yPos);
        yPos += 5;
      }
      if (st.substitution) {
        doc.text(`Substitusi: ${st.substitution}`, 18, yPos);
        yPos += 5;
      }
      if (st.result) {
        doc.setFont('courier', 'bold');
        doc.text(`Hasil: ${st.result}`, 18, yPos);
        yPos += 5;
      }
      if (st.explanation) {
        doc.setFont('helvetica', 'italic');
        doc.text(`Catatan: ${st.explanation}`, 18, yPos);
        yPos += 6;
      }
      yPos += 3;
    });

    // Footer signature
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text('StructuraLab - Generated via Engineering Calculation Engine', 14, 285);
    doc.text('Halaman ' + doc.getNumberOfPages(), 180, 285);

    doc.save(`${record.title.replace(/[^a-zA-Z0-9]/g, '_')}_StructuraLab.pdf`);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl text-white space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-2">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <History className="w-5 h-5 text-cyan-400" /> Riwayat & Arsip Perhitungan (Calculation History)
          </h2>
          <p className="text-xs text-slate-400">
            Daftar sesi kalkulasi yang tersimpan secara deterministik. Pengguna dapat membuka kembali atau mengekspor PDF laporan resmi.
          </p>
        </div>
        <span className="text-xs font-mono text-cyan-400 bg-cyan-950/40 px-3 py-1 rounded-lg border border-cyan-800/40 self-start sm:self-auto">
          {records.length} Dokumen Tersimpan
        </span>
      </div>

      {records.length === 0 ? (
        <div className="p-12 text-center bg-slate-950 rounded-xl border border-slate-800 space-y-3">
          <FileText className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="font-semibold text-slate-300 text-sm">Belum ada riwayat perhitungan yang tersimpan</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Jalankan analisis struktur atau desain beton bertulang, lalu klik tombol "Simpan Riwayat" untuk menyimpan hasil ke database.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {records.map(rec => (
            <div
              key={rec.id}
              className="p-4 bg-slate-950 hover:bg-slate-950/80 rounded-xl border border-slate-800 transition flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-white">{rec.title}</h3>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                      rec.status === 'safe'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : rec.status === 'unsafe'
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                    }`}
                  >
                    {rec.status}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 font-mono">
                    {rec.standard}
                  </span>
                </div>
                <p className="text-xs text-slate-400">{rec.summary}</p>
                <div className="flex items-center gap-3 text-[11px] text-slate-500 font-mono pt-1">
                  <span>Oleh: {rec.userEmail}</span>
                  <span>•</span>
                  <span>{new Date(rec.timestamp).toLocaleString('id-ID')}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end md:self-center">
                <button
                  onClick={() => handleExportPDF(rec)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 border border-blue-500/30 rounded-lg text-xs transition"
                  title="Unduh Laporan PDF"
                >
                  <Download className="w-3.5 h-3.5" /> Unduh PDF
                </button>
                <button
                  onClick={() => handleDelete(rec.id)}
                  className="p-1.5 text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-lg transition"
                  title="Hapus riwayat"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
