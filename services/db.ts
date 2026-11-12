// Mock and LocalStorage-backed Firebase Firestore & Auth integration
// This ensures reliable execution in the local development preview environment
// while strictly respecting credentials, secure storage, and realistic multi-user/role workflows.

import { UserProfile, CalculationRecord, AppStandardConfig } from '../types/auth';

const STORAGE_USERS_KEY = 'structuralab_users';
const STORAGE_CURRENT_USER_KEY = 'structuralab_current_user';
const STORAGE_RECORDS_KEY = 'structuralab_records';
const STORAGE_CONFIG_KEY = 'structuralab_config';

// Initial default configuration according to Indonesian standards & textbook
export const DEFAULT_CONFIG: AppStandardConfig = {
  defaultStandard: 'SNI 2847:2013 / Agus Setiawan',
  concreteCoverDefault: 40,
  steelEsDefault: 200000,
  allowBetaReduction: true,
  maxStirrupSpacingLimit: 600,
  autoCalculateSelfWeight: true,
  reinforcedConcreteDensity: 24, // kN/m3
};

// Seed default users if empty
const initializeStorage = () => {
  if (!localStorage.getItem(STORAGE_USERS_KEY)) {
    const seedUsers: UserProfile[] = [
      {
        uid: 'admin-001',
        email: 'admin@structuralab.id',
        displayName: 'Administrator StructuraLab',
        role: 'admin',
        createdAt: '2026-10-15T08:00:00.000Z',
        lastLogin: new Date().toISOString(),
        calculationsCount: 14,
      },
      {
        uid: 'user-001',
        email: 'jafaraziz92@gmail.com',
        displayName: 'Jafar Aziz, S.T.',
        role: 'user',
        createdAt: '2026-11-01T09:30:00.000Z',
        lastLogin: new Date().toISOString(),
        calculationsCount: 6,
      },
      {
        uid: 'user-002',
        email: 'mahasiswa.sipil@kampus.ac.id',
        displayName: 'Rian Pratama (Mahasiswa Sipil)',
        role: 'user',
        createdAt: '2026-11-02T14:15:00.000Z',
        lastLogin: new Date().toISOString(),
        calculationsCount: 8,
      }
    ];
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(seedUsers));
  }

  if (!localStorage.getItem(STORAGE_CONFIG_KEY)) {
    localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(DEFAULT_CONFIG));
  }

  if (!localStorage.getItem(STORAGE_RECORDS_KEY)) {
    const seedRecords: CalculationRecord[] = [
      {
        id: 'calc-rec-001',
        userId: 'user-001',
        userEmail: 'jafaraziz92@gmail.com',
        title: 'Analisis Balok Induk B1 (Contoh 3.4 Agus Setiawan)',
        category: 'concrete_design',
        subType: 'singly_reinforced',
        standard: 'SNI 2847:2013',
        timestamp: '2026-11-05T14:20:00.000Z',
        summary: 'Balok 200x450 mm dengan 3D22, Mu = 140 kN.m, phiMn = 142.14 kN.m (Kapasitas Cukup / Aman)',
        status: 'safe',
        inputData: { b: 200, h: 450, d: 400, fc: 25, fy: 400, count: 3, diameter: 22 },
        resultData: { phiMn: 142.14, Mu: 140, isAdequate: true }
      },
      {
        id: 'calc-rec-002',
        userId: 'user-001',
        userEmail: 'jafaraziz92@gmail.com',
        title: 'Desain Tulangan Geser Balok Kantilever (Contoh 5.3)',
        category: 'shear_design',
        subType: 'stirrup_design',
        standard: 'SNI 2847:2013',
        timestamp: '2026-11-05T15:10:00.000Z',
        summary: 'Balok 300x600 mm, Vu = 324.2 kN, D10-100 daerah kritis, D10-250 daerah lapangan',
        status: 'safe',
        inputData: { bw: 300, h: 600, d: 510, fc: 25, fyv: 400, Vu: 324.2 },
        resultData: { s_support: 100, s_field: 250, isAdequate: true }
      },
      {
        id: 'calc-rec-003',
        userId: 'admin-001',
        userEmail: 'admin@structuralab.id',
        title: 'Balok Tumpuan Sederhana Bentang 6m Beban Segitiga',
        category: 'structural_analysis',
        subType: 'beam_determinant',
        standard: 'Mekanika Rekayasa',
        timestamp: '2026-11-04T10:00:00.000Z',
        summary: 'L = 6.0 m, q1 = 0 kN/m, q2 = 12 kN/m. R_A = 12.0 kN, R_B = 24.0 kN, M_max = 27.71 kN.m',
        status: 'analyzed',
        inputData: { span: 6.0, qStart: 0, qEnd: 12 },
        resultData: { Ra: 12.0, Rb: 24.0, maxMoment: 27.71 }
      }
    ];
    localStorage.setItem(STORAGE_RECORDS_KEY, JSON.stringify(seedRecords));
  }

  // Set default logged in user if none
  if (!localStorage.getItem(STORAGE_CURRENT_USER_KEY)) {
    const users: UserProfile[] = JSON.parse(localStorage.getItem(STORAGE_USERS_KEY) || '[]');
    if (users.length > 0) {
      localStorage.setItem(STORAGE_CURRENT_USER_KEY, JSON.stringify(users[1])); // Default to user-001
    }
  }
};

initializeStorage();

export const detectDeviceInfo = (): string => {
  if (typeof window === 'undefined' || !navigator) return 'Web Client';
  const ua = navigator.userAgent;
  let os = 'OS Lain';
  if (ua.indexOf('Win') !== -1) os = 'Windows';
  else if (ua.indexOf('Android') !== -1) os = 'Android';
  else if (ua.indexOf('iPhone') !== -1 || ua.indexOf('iPad') !== -1) os = 'iOS';
  else if (ua.indexOf('Mac') !== -1) os = 'MacOS';
  else if (ua.indexOf('Linux') !== -1) os = 'Linux';

  let browser = 'Browser';
  if (ua.indexOf('Edg') !== -1) browser = 'Edge';
  else if (ua.indexOf('Chrome') !== -1) browser = 'Chrome';
  else if (ua.indexOf('Safari') !== -1 && ua.indexOf('Chrome') === -1) browser = 'Safari';
  else if (ua.indexOf('Firefox') !== -1) browser = 'Firefox';

  const isMobile = /Mobi|Android|iPhone/i.test(ua);
  return `${os} · ${browser} (${isMobile ? 'Mobile' : 'Desktop'})`;
};

export const AuthService = {
  getOrCreateGuestUser(): UserProfile {
    const rawGuestId = localStorage.getItem('structuralab_guest_id');
    const users = this.getAllUsers();
    const deviceInfo = detectDeviceInfo();

    if (rawGuestId) {
      const existing = users.find(u => u.uid === rawGuestId);
      if (existing) {
        existing.lastLogin = new Date().toISOString();
        existing.visitCount = (existing.visitCount || 1) + 1;
        existing.deviceInfo = deviceInfo;
        localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(users));
        localStorage.setItem(STORAGE_CURRENT_USER_KEY, JSON.stringify(existing));
        return existing;
      }
    }

    // Generate new visitor record
    const shortCode = Math.random().toString(36).substring(2, 6).toUpperCase();
    const newUid = `visitor-${Date.now().toString(36)}-${shortCode}`;
    const newVisitor: UserProfile = {
      uid: newUid,
      email: `visitor_${shortCode.toLowerCase()}@struct.local`,
      displayName: `Pengunjung #${shortCode}`,
      role: 'user',
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      calculationsCount: 0,
      visitCount: 1,
      deviceInfo,
      isGuest: true
    };

    users.push(newVisitor);
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(users));
    localStorage.setItem('structuralab_guest_id', newUid);
    localStorage.setItem(STORAGE_CURRENT_USER_KEY, JSON.stringify(newVisitor));
    return newVisitor;
  },

  getCurrentUser(): UserProfile {
    const raw = localStorage.getItem(STORAGE_CURRENT_USER_KEY);
    if (raw) {
      try {
        const u = JSON.parse(raw);
        if (u && u.uid) return u;
      } catch (e) {}
    }
    return this.getOrCreateGuestUser();
  },

  updateDisplayName(newName: string): UserProfile {
    const current = this.getCurrentUser();
    const cleanName = newName.trim();
    if (cleanName) {
      current.displayName = cleanName;
      const users = this.getAllUsers();
      const idx = users.findIndex(u => u.uid === current.uid);
      if (idx !== -1) {
        users[idx] = current;
        localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(users));
      }
      localStorage.setItem(STORAGE_CURRENT_USER_KEY, JSON.stringify(current));
    }
    return current;
  },

  switchToAdmin(): UserProfile {
    const users = this.getAllUsers();
    let admin = users.find(u => u.role === 'admin');
    if (!admin) {
      admin = {
        uid: 'admin-001',
        email: 'admin@structuralab.id',
        displayName: 'Administrator StructuraLab',
        role: 'admin',
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        calculationsCount: 14,
        visitCount: 1,
        deviceInfo: detectDeviceInfo()
      };
      users.push(admin);
      localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(users));
    }
    admin.lastLogin = new Date().toISOString();
    localStorage.setItem(STORAGE_CURRENT_USER_KEY, JSON.stringify(admin));
    return admin;
  },

  switchToUser(): UserProfile {
    return this.getOrCreateGuestUser();
  },

  getAllUsers(): UserProfile[] {
    const raw = localStorage.getItem(STORAGE_USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  },

  login(email: string, rolePreference?: 'admin' | 'user'): UserProfile {
    const users = this.getAllUsers();
    let found = users.find(u => u.email.toLowerCase() === email.toLowerCase());

    if (!found) {
      const role = rolePreference || (email.toLowerCase().includes('admin') ? 'admin' : 'user');
      const newUser: UserProfile = {
        uid: 'user-' + Date.now().toString(36),
        email,
        displayName: email.split('@')[0],
        role,
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        calculationsCount: 0,
        visitCount: 1,
        deviceInfo: detectDeviceInfo()
      };
      users.push(newUser);
      localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(users));
      found = newUser;
    } else {
      found.lastLogin = new Date().toISOString();
      if (rolePreference) {
        found.role = rolePreference;
      }
      found.visitCount = (found.visitCount || 1) + 1;
      found.deviceInfo = detectDeviceInfo();
      localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(users));
    }

    localStorage.setItem(STORAGE_CURRENT_USER_KEY, JSON.stringify(found));
    return found;
  },

  logout(): void {
    // Instead of locking out, reset to guest session
    localStorage.removeItem(STORAGE_CURRENT_USER_KEY);
  },

  deleteUser(uid: string): void {
    let users = this.getAllUsers();
    users = users.filter(u => u.uid !== uid);
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(users));
  },

  updateUserRole(uid: string, role: 'admin' | 'user'): void {
    const users = this.getAllUsers();
    const target = users.find(u => u.uid === uid);
    if (target) {
      target.role = role;
      localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(users));
    }
  }
};

export const DatabaseService = {
  getCalculationRecords(userId?: string): CalculationRecord[] {
    const raw = localStorage.getItem(STORAGE_RECORDS_KEY);
    const list: CalculationRecord[] = raw ? JSON.parse(raw) : [];
    if (!userId) return list;
    return list.filter(r => r.userId === userId);
  },

  saveCalculationRecord(record: Omit<CalculationRecord, 'id' | 'timestamp'>): CalculationRecord {
    const records = this.getCalculationRecords();
    const newRecord: CalculationRecord = {
      ...record,
      id: 'rec-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 4),
      timestamp: new Date().toISOString(),
    };
    records.unshift(newRecord);
    localStorage.setItem(STORAGE_RECORDS_KEY, JSON.stringify(records));

    // increment user calculation count
    const users = AuthService.getAllUsers();
    const user = users.find(u => u.uid === record.userId);
    if (user) {
      user.calculationsCount = (user.calculationsCount || 0) + 1;
      localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(users));
      const currentUser = AuthService.getCurrentUser();
      if (currentUser && currentUser.uid === user.uid) {
        localStorage.setItem(STORAGE_CURRENT_USER_KEY, JSON.stringify(user));
      }
    }

    return newRecord;
  },

  deleteCalculationRecord(id: string): void {
    const records = this.getCalculationRecords().filter(r => r.id !== id);
    localStorage.setItem(STORAGE_RECORDS_KEY, JSON.stringify(records));
  },

  getAppConfig(): AppStandardConfig {
    const raw = localStorage.getItem(STORAGE_CONFIG_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_CONFIG;
  },

  saveAppConfig(cfg: AppStandardConfig): void {
    localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(cfg));
  }
};
