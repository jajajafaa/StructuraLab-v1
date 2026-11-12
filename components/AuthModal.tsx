import React, { useState } from 'react';
import { UserProfile } from '../types/auth';
import { AuthService } from '../services/db';
import { ShieldCheck, UserCheck, KeyRound, ArrowRight, BookOpen, Layers } from 'lucide-react';

interface AuthModalProps {
  onSuccess: (user: UserProfile) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onSuccess }) => {
  const [email, setEmail] = useState('jafaraziz92@gmail.com');
  const [role, setRole] = useState<'user' | 'admin'>('user');
  const [isRegister, setIsRegister] = useState(false);
  const [password, setPassword] = useState('structura2026');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setErrorMsg('Masukkan alamat email yang valid.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Kata sandi minimal 6 karakter.');
      return;
    }
    setErrorMsg('');
    const user = AuthService.login(email, role);
    onSuccess(user);
  };

  const quickDemoLogin = (demoRole: 'admin' | 'user') => {
    const demoEmail = demoRole === 'admin' ? 'admin@structuralab.id' : 'jafaraziz92@gmail.com';
    setEmail(demoEmail);
    setRole(demoRole);
    const user = AuthService.login(demoEmail, demoRole);
    onSuccess(user);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-900/60 via-slate-900 to-cyan-950/60 p-6 border-b border-slate-800 text-center relative">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600/20 border border-blue-500/40 text-blue-400 mb-3 shadow-lg">
            <Layers className="w-6 h-6 text-cyan-400" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
            Structura<span className="text-cyan-400">Lab</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest font-mono">
            Analyze. Design. Understand.
          </p>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 text-xs bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-lg">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Email Pengguna / Akun</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
              placeholder="nama@email.com"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Kata Sandi (Password)</label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 pr-10"
                placeholder="Minimal 6 karakter"
                required
              />
              <KeyRound className="w-4 h-4 text-slate-500 absolute right-3 top-3" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Tipe Akses Akun</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRole('user')}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium border transition-colors ${
                  role === 'user'
                    ? 'bg-blue-600/20 border-blue-500 text-blue-300 shadow-sm'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <UserCheck className="w-4 h-4" /> User (Engineer/Mhs)
              </button>
              <button
                type="button"
                onClick={() => setRole('admin')}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium border transition-colors ${
                  role === 'admin'
                    ? 'bg-cyan-600/20 border-cyan-500 text-cyan-300 shadow-sm'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <ShieldCheck className="w-4 h-4" /> Administrator
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="w-full mt-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-medium py-2.5 rounded-lg text-sm shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
          >
            {isRegister ? 'Daftar Akun Baru' : 'Masuk ke StructuraLab'}
            <ArrowRight className="w-4 h-4" />
          </button>

          {/* Quick Demo Switcher */}
          <div className="pt-3 border-t border-slate-800/80">
            <span className="text-[11px] text-slate-400 block mb-2 text-center">
              Akses Cepat Demo Pengujian (1-Klik):
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => quickDemoLogin('user')}
                className="flex-1 py-1.5 px-2 bg-slate-800/80 hover:bg-slate-700/80 text-[11px] text-slate-300 rounded border border-slate-700 text-center"
              >
                Login as User
              </button>
              <button
                type="button"
                onClick={() => quickDemoLogin('admin')}
                className="flex-1 py-1.5 px-2 bg-slate-800/80 hover:bg-slate-700/80 text-[11px] text-cyan-300 rounded border border-slate-700 text-center"
              >
                Login as Admin
              </button>
            </div>
          </div>
        </form>

        {/* Footer info */}
        <div className="p-4 bg-slate-950/70 border-t border-slate-800 text-center text-[11px] text-slate-500 flex items-center justify-center gap-2">
          <BookOpen className="w-3.5 h-3.5 text-cyan-500" />
          Berdasarkan Standar SNI 2847:2013 & Agus Setiawan
        </div>
      </div>
    </div>
  );
};
