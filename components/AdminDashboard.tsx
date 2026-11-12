import React, { useState, useEffect } from 'react';
import { UserProfile, AppStandardConfig, CalculationRecord } from '../types/auth';
import { AuthService, DatabaseService } from '../services/db';
import { Users, BarChart3, Settings, ShieldAlert, Trash2, CheckCircle2, Clock, Calculator } from 'lucide-react';

interface AdminDashboardProps {
  currentUser: UserProfile;
  onClose: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ currentUser, onClose }) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [records, setRecords] = useState<CalculationRecord[]>([]);
  const [config, setConfig] = useState<AppStandardConfig>(DatabaseService.getAppConfig());
  const [activeTab, setActiveTab] = useState<'users' | 'analytics' | 'settings'>('analytics');
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    setUsers(AuthService.getAllUsers());
    setRecords(DatabaseService.getCalculationRecords());
  }, []);

  const handleDeleteUser = (uid: string) => {
    if (confirm('Apakah Anda yakin ingin menghapus user ini?')) {
      AuthService.deleteUser(uid);
      setUsers(AuthService.getAllUsers());
    }
  };

  const handleRoleToggle = (user: UserProfile) => {
    const newRole = user.role === 'admin' ? 'user' : 'admin';
    AuthService.updateUserRole(user.uid, newRole);
    setUsers(AuthService.getAllUsers());
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    DatabaseService.saveAppConfig(config);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  // Metrics
  const totalCalculations = records.length;
  const concreteCount = records.filter(r => r.category === 'concrete_design' || r.category === 'shear_design').length;
  const analysisCount = records.filter(r => r.category === 'structural_analysis').length;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl text-white">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-800 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              PANEL ADMINISTRATOR
            </span>
            <span className="text-xs text-slate-400">Verifikasi Server-side Autentikasi</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white mt-1">
            Sistem Manajemen & Kontrol StructuraLab
          </h2>
          <p className="text-sm text-slate-400">
            Kelola akun pengguna, pantau aktivitas kalkulasi teknik, dan atur parameter standar SNI.
          </p>
        </div>

        <button
          onClick={onClose}
          className="self-start md:self-auto px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-lg border border-slate-700 transition"
        >
          Kembali ke Aplikasi
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 my-6 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('analytics')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
            activeTab === 'analytics'
              ? 'bg-blue-600/20 text-cyan-400 border border-cyan-500/40'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <BarChart3 className="w-4 h-4" /> Statistik & Analisis Penggunaan
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
            activeTab === 'users'
              ? 'bg-blue-600/20 text-cyan-400 border border-cyan-500/40'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" /> Daftar Pengguna Terdaftar ({users.length})
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
            activeTab === 'settings'
              ? 'bg-blue-600/20 text-cyan-400 border border-cyan-500/40'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Settings className="w-4 h-4" /> Konfigurasi Standar Rekayasa
        </button>
      </div>

      {/* Tab: Analytics */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <span className="text-xs text-slate-400 uppercase font-mono">Total Akun Terdaftar</span>
              <p className="text-3xl font-extrabold text-white mt-1">{users.length}</p>
              <span className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Semua akun aktif
              </span>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <span className="text-xs text-slate-400 uppercase font-mono">Total Perhitungan Tersimpan</span>
              <p className="text-3xl font-extrabold text-cyan-400 mt-1">{totalCalculations}</p>
              <span className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Tercatat otomatis di Firestore
              </span>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <span className="text-xs text-slate-400 uppercase font-mono">Modul Beton (Reinforced Concrete)</span>
              <p className="text-3xl font-extrabold text-indigo-400 mt-1">{concreteCount}</p>
              <span className="text-[11px] text-indigo-300 mt-1">
                {totalCalculations > 0 ? ((concreteCount / totalCalculations) * 100).toFixed(0) : 0}% dari seluruh sesi
              </span>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <span className="text-xs text-slate-400 uppercase font-mono">Modul Analisis Struktur (Mechanics)</span>
              <p className="text-3xl font-extrabold text-amber-400 mt-1">{analysisCount}</p>
              <span className="text-[11px] text-amber-300 mt-1">
                {totalCalculations > 0 ? ((analysisCount / totalCalculations) * 100).toFixed(0) : 0}% dari seluruh sesi
              </span>
            </div>
          </div>

          {/* Activity list */}
          <div className="bg-slate-950 rounded-xl border border-slate-800 p-5">
            <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
              <Calculator className="w-4 h-4 text-cyan-400" /> Aktivitas Perhitungan Terbaru
            </h3>
            <div className="space-y-3">
              {records.slice(0, 5).map(rec => (
                <div key={rec.id} className="p-3 bg-slate-900/60 rounded-lg border border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs">
                  <div>
                    <span className="font-semibold text-white">{rec.title}</span>
                    <p className="text-slate-400 text-[11px] mt-0.5">{rec.summary}</p>
                  </div>
                  <div className="flex items-center gap-3 text-slate-400 text-[11px]">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                      {rec.standard}
                    </span>
                    <span>{new Date(rec.timestamp).toLocaleDateString('id-ID')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Users & Visitors Monitoring */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
            <span>
              Menampilkan seluruh pengunjung dan akun yang tercatat aktif menggunakan StructuraLab.
            </span>
            <span className="font-mono text-cyan-400 font-bold bg-cyan-950/80 px-2.5 py-1 rounded border border-cyan-800">
              Total Pengunjung Terlacak: {users.length}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border border-slate-800 rounded-xl overflow-hidden">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 font-mono uppercase">
                <tr>
                  <th className="p-3">Identitas Pengunjung</th>
                  <th className="p-3">Perangkat & Browser</th>
                  <th className="p-3 text-center">Kunjungan</th>
                  <th className="p-3 text-center">Kalkulasi</th>
                  <th className="p-3">Status / Role</th>
                  <th className="p-3">Terakhir Aktif</th>
                  <th className="p-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {users.map(u => (
                  <tr key={u.uid} className="hover:bg-slate-800/40">
                    <td className="p-3">
                      <div className="font-semibold text-white flex items-center gap-2">
                        {u.displayName}
                        {u.isGuest && (
                          <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.2 rounded font-mono">
                            TAMU
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">{u.email}</div>
                    </td>
                    <td className="p-3">
                      <span className="text-slate-300 font-mono text-[11px] bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                        {u.deviceInfo || 'Web Client'}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <span className="font-mono font-bold text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-900">
                        {u.visitCount || 1}x
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <span className="font-mono font-bold text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-900">
                        {u.calculationsCount || 0}
                      </span>
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                          u.role === 'admin'
                            ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="p-3 text-slate-400">
                      <div>{new Date(u.lastLogin).toLocaleDateString('id-ID')}</div>
                      <div className="text-[10px] font-mono text-slate-500">{new Date(u.lastLogin).toLocaleTimeString('id-ID')}</div>
                    </td>
                    <td className="p-3 text-right space-x-2">
                      <button
                        onClick={() => {
                          const newName = prompt('Ubah nama/catatan untuk pengunjung ini:', u.displayName);
                          if (newName && newName.trim()) {
                            u.displayName = newName.trim();
                            const all = AuthService.getAllUsers();
                            const idx = all.findIndex(x => x.uid === u.uid);
                            if (idx !== -1) {
                              all[idx].displayName = newName.trim();
                              localStorage.setItem('structuralab_users', JSON.stringify(all));
                              setUsers([...all]);
                            }
                          }
                        }}
                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded text-[11px] transition"
                        title="Beri nama atau catatan"
                      >
                        Beri Nama
                      </button>
                      <button
                        onClick={() => handleRoleToggle(u)}
                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] transition"
                      >
                        {u.role === 'admin' ? 'Jadikan User' : 'Jadikan Admin'}
                      </button>
                      {u.uid !== currentUser.uid && (
                        <button
                          onClick={() => handleDeleteUser(u.uid)}
                          className="p-1 text-rose-400 hover:text-rose-300"
                          title="Hapus sesi pengunjung"
                        >
                          <Trash2 className="w-4 h-4 inline" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Standard Settings */}
      {activeTab === 'settings' && (
        <form onSubmit={handleSaveConfig} className="bg-slate-950 p-6 rounded-xl border border-slate-800 max-w-2xl space-y-4 text-xs">
          {saveSuccess && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Pengaturan standar berhasil diperbarui dan diterapkan ke seluruh kalkulasi.
            </div>
          )}

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Standar Desain Acuan Default</label>
            <input
              type="text"
              value={config.defaultStandard}
              onChange={e => setConfig({ ...config, defaultStandard: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
            />
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              Berdasarkan rujukan resmi SNI 2847:2013 & Buku Perancangan Struktur Beton Bertulang (Agus Setiawan).
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Selimut Beton Bersih Default (mm)</label>
              <input
                type="number"
                value={config.concreteCoverDefault}
                onChange={e => setConfig({ ...config, concreteCoverDefault: Number(e.target.value) })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Modulus Elastisitas Baja Es (MPa)</label>
              <input
                type="number"
                value={config.steelEsDefault}
                onChange={e => setConfig({ ...config, steelEsDefault: Number(e.target.value) })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Berat Jenis Beton Bertulang (kN/m³)</label>
              <input
                type="number"
                value={config.reinforcedConcreteDensity}
                onChange={e => setConfig({ ...config, reinforcedConcreteDensity: Number(e.target.value) })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Batas Maksimum Jarak Sengkang (mm)</label>
              <input
                type="number"
                value={config.maxStirrupSpacingLimit}
                onChange={e => setConfig({ ...config, maxStirrupSpacingLimit: Number(e.target.value) })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
              />
            </div>
          </div>

          <button
            type="submit"
            className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-medium rounded-lg text-xs shadow-lg transition"
          >
            Simpan Konfigurasi Standar
          </button>
        </form>
      )}
    </div>
  );
};
