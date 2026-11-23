import { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Check,
  Edit3,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Search,
  Shield,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserCheck,
  UserCog,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { apiFetch } from '../lib/api.ts';
import { showCenterPopup } from '../lib/popup.ts';
import type { UserAccount } from '../types/pos.ts';

interface UsersViewProps {
  currentUser?: UserAccount | null;
  initialTab?: 'directory' | 'roles' | 'account';
  onCurrentUserUpdated?: (user: UserAccount) => void;
  onOpenLoginPage?: () => void;
}

const ROLE_CAPABILITIES = [
  {
    role: 'admin',
    title: 'Administrator',
    badgeClass: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    accentBar: 'from-indigo-600 via-blue-600 to-cyan-500',
    iconBg: 'bg-indigo-50 text-indigo-600',
    checkColor: 'text-indigo-600',
    summary: 'Full unrestricted control across POS, Inventory, Finance, Users, Menus & Backups.',
    permissions: [
      'POS Billing & Invoices',
      'Products, Units, Categories & Brands',
      'Purchases, Suppliers & Stock Ledger',
      'Owners, Bank Accounts & Cash Book',
      'Employees, Salary & Expenses',
      'Reports, User Roles, Shop Settings & Backup',
    ],
  },
  {
    role: 'manager',
    title: 'Manager',
    badgeClass: 'bg-violet-100 text-violet-700 border-violet-200',
    accentBar: 'from-violet-600 via-purple-600 to-fuchsia-500',
    iconBg: 'bg-violet-50 text-violet-600',
    checkColor: 'text-violet-600',
    summary: 'Operations control for POS, Inventory, Suppliers, Accounts, Cash Book & Reports.',
    permissions: [
      'POS Billing & Invoices',
      'Products, Units, Categories & Brands',
      'Purchases, Suppliers & Stock Ledger',
      'Owners, Bank Accounts & Cash Book',
      'Employees, Salary & Expenses',
      'Financial & Stock Reports',
    ],
  },
  {
    role: 'staff',
    title: 'Cashier / Staff',
    badgeClass: 'bg-teal-100 text-teal-700 border-teal-200',
    accentBar: 'from-emerald-500 via-teal-500 to-cyan-500',
    iconBg: 'bg-teal-50 text-teal-600',
    checkColor: 'text-teal-600',
    summary: 'Front-counter sales, estimates, customer lookup & product stock availability.',
    permissions: [
      'POS Terminal & Checkout',
      'Sales History & Invoice Print',
      'Customer Lookup & Addition',
      'Quotations / Estimates',
      'Stock Availability View',
    ],
  },
];

const PERMISSION_MATRIX: Array<{ module: string; admin: boolean; manager: boolean; staff: boolean }> = [
  { module: 'Dashboard & Live Metrics', admin: true, manager: true, staff: true },
  { module: 'POS Billing & Quotations', admin: true, manager: true, staff: true },
  { module: 'Sales & Due Collection', admin: true, manager: true, staff: true },
  { module: 'Products, Categories & Brands', admin: true, manager: true, staff: false },
  { module: 'Purchases, Returns & Damages', admin: true, manager: true, staff: false },
  { module: 'Owners, Bank Accounts & Cash Book', admin: true, manager: true, staff: false },
  { module: 'Employee & Salary Payroll', admin: true, manager: true, staff: false },
  { module: 'Reports & Profit/Loss Analytics', admin: true, manager: true, staff: false },
  { module: 'User Roles, Shop Settings & Backup', admin: true, manager: false, staff: false },
];

function getInitials(name: string): string {
  const parts = String(name || 'U')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function getRoleStyle(role: string) {
  if (role === 'super_admin') {
    return {
      badge: 'bg-amber-50 text-amber-800 border-amber-300',
      avatarBg: 'from-amber-500 to-indigo-600',
      label: 'Super Admin',
    };
  }
  if (role === 'admin') {
    return {
      badge: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      avatarBg: 'from-indigo-600 to-blue-600',
      label: 'Admin',
    };
  }
  if (role === 'manager') {
    return {
      badge: 'bg-violet-50 text-violet-700 border-violet-200',
      avatarBg: 'from-violet-600 to-fuchsia-600',
      label: 'Manager',
    };
  }
  return {
    badge: 'bg-teal-50 text-teal-700 border-teal-200',
    avatarBg: 'from-emerald-500 to-teal-600',
    label: 'Staff',
  };
}

function resizeAvatarToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Please select a valid PNG, JPG, or WEBP image file.'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the selected image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Unsupported or corrupted image file.'));
      img.onload = () => {
        const size = 320;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas rendering unavailable.'));
          return;
        }
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, size, size);
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.88));
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}

export function UsersView({
  currentUser,
  initialTab = 'directory',
  onCurrentUserUpdated,
  onOpenLoginPage,
}: UsersViewProps) {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [tab, setTab] = useState<'directory' | 'roles' | 'account'>(initialTab);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'manager' | 'staff'>('all');

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    role: 'staff',
    password: '',
  });
  const [showCreatePass, setShowCreatePass] = useState(false);

  const [editTarget, setEditTarget] = useState<UserAccount | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    role: 'staff',
    password: '',
  });
  const [uploadingAvatarId, setUploadingAvatarId] = useState<number | null>(null);

  const activeAccount = currentUser || users[0] || null;
  const [accountProfile, setAccountProfile] = useState({
    name: activeAccount?.name || '',
    email: activeAccount?.email || '',
    phone: activeAccount?.phone || '',
    address: activeAccount?.address || '',
  });
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const myAvatarInputRef = useRef<HTMLInputElement | null>(null);
  const editAvatarInputRef = useRef<HTMLInputElement | null>(null);

  function load() {
    apiFetch<UserAccount[]>('/api/users').then((list) => {
      setUsers(list);
      const target = currentUser ? list.find((u) => u.id === currentUser.id) : list[0];
      if (target) {
        setAccountProfile({
          name: target.name,
          email: target.email,
          phone: target.phone || '',
          address: target.address || '',
        });
      }
    });
  }

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    load();
  }, [currentUser?.id]);

  async function handleAvatarUpload(userId: number, file: File | null) {
    if (!file) return;
    setUploadingAvatarId(userId);
    setNotice(null);
    try {
      const dataUrl = await resizeAvatarToDataUrl(file);
      const updated = await apiFetch<UserAccount>(`/api/users/${userId}/avatar`, {
        method: 'POST',
        body: JSON.stringify({ image_data: dataUrl }),
      });
      if (activeAccount && updated.id === activeAccount.id && onCurrentUserUpdated) {
        onCurrentUserUpdated(updated);
      }
      if (editTarget && editTarget.id === updated.id) {
        setEditTarget(updated);
      }
      const msg = `Profile photo updated for ${updated.name}.`;
      setNotice({ type: 'success', text: msg });
      showCenterPopup({ type: 'success', title: 'Photo Updated', message: msg });
      load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to upload profile photo.';
      setNotice({ type: 'error', text: msg });
      showCenterPopup({ type: 'error', title: 'Upload Failed', message: msg });
    } finally {
      setUploadingAvatarId(null);
    }
  }

  async function handleRemoveAvatar(user: UserAccount) {
    setUploadingAvatarId(user.id);
    setNotice(null);
    try {
      const updated = await apiFetch<UserAccount>(`/api/users/${user.id}/avatar`, {
        method: 'POST',
        body: JSON.stringify({ image_data: '' }),
      });
      if (activeAccount && updated.id === activeAccount.id && onCurrentUserUpdated) {
        onCurrentUserUpdated(updated);
      }
      if (editTarget && editTarget.id === updated.id) {
        setEditTarget(updated);
      }
      const msg = `Profile photo removed for ${updated.name}.`;
      setNotice({ type: 'success', text: msg });
      showCenterPopup({ type: 'info', title: 'Photo Removed', message: msg });
      load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to remove photo.';
      setNotice({ type: 'error', text: msg });
      showCenterPopup({ type: 'error', title: 'Action Failed', message: msg });
    } finally {
      setUploadingAvatarId(null);
    }
  }

  async function addUser(e: React.FormEvent) {
    e.preventDefault();
    setNotice(null);
    try {
      await apiFetch('/api/users', { method: 'POST', body: JSON.stringify(form) });
      const createdName = form.name;
      setForm({ name: '', email: '', phone: '', address: '', role: 'staff', password: '' });
      const msg = `User account "${createdName}" created successfully.`;
      setNotice({ type: 'success', text: msg });
      showCenterPopup({ type: 'success', title: 'User Created', message: msg });
      load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create user.';
      setNotice({ type: 'error', text: msg });
      showCenterPopup({ type: 'error', title: 'Cannot Create User', message: msg });
    }
  }

  async function saveEditUser(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget) return;
    setNotice(null);
    try {
      const updated = await apiFetch<UserAccount>(`/api/users/${editTarget.id}`, {
        method: 'PUT',
        body: JSON.stringify(editForm),
      });
      if (activeAccount && updated.id === activeAccount.id && onCurrentUserUpdated) {
        onCurrentUserUpdated(updated);
      }
      setEditTarget(null);
      const msg = `Updated account details for ${updated.name}.`;
      setNotice({ type: 'success', text: msg });
      showCenterPopup({ type: 'success', title: 'Account Updated', message: msg });
      load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update user.';
      setNotice({ type: 'error', text: msg });
      showCenterPopup({ type: 'error', title: 'Update Failed', message: msg });
    }
  }

  async function toggleUser(id: number) {
    setNotice(null);
    try {
      await apiFetch(`/api/users/${id}/toggle`, { method: 'PATCH' });
      load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update status.';
      setNotice({ type: 'error', text: msg });
      showCenterPopup({ type: 'error', title: 'Status Update Failed', message: msg });
    }
  }

  async function deleteUser(u: UserAccount) {
    setNotice(null);
    try {
      await apiFetch(`/api/users/${u.id}`, { method: 'DELETE' });
      const msg = `Removed user ${u.name}.`;
      setNotice({ type: 'success', text: msg });
      showCenterPopup({ type: 'info', title: 'User Removed', message: msg });
      load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to delete user.';
      setNotice({ type: 'error', text: msg });
      showCenterPopup({ type: 'error', title: 'Delete Failed', message: msg });
    }
  }

  async function saveMyProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!activeAccount) return;
    setNotice(null);
    try {
      const updated = await apiFetch<UserAccount>(`/api/users/${activeAccount.id}`, {
        method: 'PUT',
        body: JSON.stringify(accountProfile),
      });
      if (onCurrentUserUpdated) onCurrentUserUpdated(updated);
      const msg = 'Your account profile has been saved.';
      setNotice({ type: 'success', text: msg });
      showCenterPopup({ type: 'success', title: 'Profile Saved', message: msg });
      load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Profile update failed.';
      setNotice({ type: 'error', text: msg });
      showCenterPopup({ type: 'error', title: 'Profile Update Failed', message: msg });
    }
  }

  async function updateMyPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!activeAccount) return;
    setNotice(null);
    if (pwForm.new_password.length < 6) {
      const msg = 'New password must be at least 6 characters.';
      setNotice({ type: 'error', text: msg });
      showCenterPopup({ type: 'warning', title: 'Weak Password', message: msg });
      return;
    }
    if (pwForm.new_password !== pwForm.confirm_password) {
      const msg = 'New password and confirmation do not match.';
      setNotice({ type: 'error', text: msg });
      showCenterPopup({ type: 'error', title: 'Password Mismatch', message: msg });
      return;
    }
    try {
      const res = await apiFetch<{ ok: boolean; user: UserAccount }>('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          user_id: activeAccount.id,
          current_password: pwForm.current_password,
          new_password: pwForm.new_password,
        }),
      });
      if (onCurrentUserUpdated) onCurrentUserUpdated(res.user);
      setPwForm({ current_password: '', new_password: '', confirm_password: '' });
      const msg = 'Account password updated securely.';
      setNotice({ type: 'success', text: msg });
      showCenterPopup({ type: 'success', title: 'Password Updated', message: msg });
      load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Password change failed.';
      setNotice({ type: 'error', text: msg });
      showCenterPopup({ type: 'error', title: 'Password Update Failed', message: msg });
    }
  }

  const filteredUsers = users.filter((u) => {
    const matchesRole =
      roleFilter === 'all' ||
      u.role === roleFilter ||
      (roleFilter === 'admin' && u.role === 'super_admin');
    const q = search.trim().toLowerCase();
    const matchesQuery =
      !q ||
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.phone || '').toLowerCase().includes(q);
    return matchesRole && matchesQuery;
  });

  const activeCount = users.filter((u) => u.is_active).length;
  const adminMgrCount = users.filter(
    (u) => u.role === 'super_admin' || u.role === 'admin' || u.role === 'manager'
  ).length;
  const staffCount = users.filter((u) => u.role === 'staff').length;

  return (
    <div className="space-y-6">
      {/* Vibrant Modern Hub Header */}
      <div
        className="rounded-2xl p-5 sm:p-6 text-white shadow-md flex flex-wrap items-center justify-between gap-4"
        style={{ background: 'linear-gradient(135deg, #065AA4 0%, #4f46e5 55%, #7c3aed 100%)' }}
      >
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-12 h-12 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center shrink-0">
            <UserCog className="w-6 h-6 text-[#ffd166]" />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-white">
              User, Role &amp; Account Hub
            </h1>
            <p className="text-xs text-white/80 mt-0.5">
              Manage team accounts, role permissions, profile photos &amp; security credentials.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-950/25 border border-white/15 rounded-xl text-xs font-semibold w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setTab('directory')}
              className={`px-3.5 py-2 rounded-lg transition-all whitespace-nowrap cursor-pointer inline-flex items-center gap-1.5 ${
                tab === 'directory'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-white/85 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>User Management</span>
            </button>
            <button
              type="button"
              onClick={() => setTab('roles')}
              className={`px-3.5 py-2 rounded-lg transition-all whitespace-nowrap cursor-pointer inline-flex items-center gap-1.5 ${
                tab === 'roles'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-white/85 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>User Roles</span>
            </button>
            <button
              type="button"
              onClick={() => setTab('account')}
              className={`px-3.5 py-2 rounded-lg transition-all whitespace-nowrap cursor-pointer inline-flex items-center gap-1.5 ${
                tab === 'account'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-white/85 hover:bg-white/10 hover:text-white'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>My Account</span>
            </button>
          </div>

          {onOpenLoginPage && (
            <button
              type="button"
              onClick={onOpenLoginPage}
              className="px-3.5 py-2 rounded-xl bg-[#ffd166] hover:bg-[#fbbf24] text-[#1a1a2e] text-xs font-bold whitespace-nowrap inline-flex items-center gap-1.5 shadow-sm cursor-pointer transition-colors"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Switch User</span>
            </button>
          )}
        </div>
      </div>

      {/* Colorful KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="min-w-0 bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-slate-500">Total Accounts</div>
            <div className="mt-0.5 text-2xl font-bold text-slate-900 tabular-nums">{users.length}</div>
          </div>
        </div>

        <div className="min-w-0 bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <UserCheck className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-slate-500">Active Operators</div>
            <div className="mt-0.5 text-2xl font-bold text-emerald-600 tabular-nums">{activeCount}</div>
          </div>
        </div>

        <div className="min-w-0 bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-slate-500">Admins &amp; Managers</div>
            <div className="mt-0.5 text-2xl font-bold text-violet-600 tabular-nums">{adminMgrCount}</div>
          </div>
        </div>

        <div className="min-w-0 bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-slate-500">Cashier / Staff</div>
            <div className="mt-0.5 text-2xl font-bold text-amber-600 tabular-nums">{staffCount}</div>
          </div>
        </div>
      </div>

      {notice && (
        <div
          className={`px-4 py-3 rounded-xl text-xs font-semibold border ${
            notice.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {notice.text}
        </div>
      )}

      {tab === 'directory' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Create User Panel */}
          <div className="lg:col-span-4 min-w-0 bg-white border border-slate-200 rounded-2xl overflow-hidden h-fit">
            <div className="h-1.5 bg-gradient-to-r from-indigo-600 via-violet-600 to-cyan-500" />
            <div className="p-5">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="font-display text-base font-bold text-slate-900">Add New User</h2>
                  <p className="text-[11px] text-slate-500">Create operator login &amp; role</p>
                </div>
              </div>

              <form onSubmit={addUser} className="space-y-3 text-sm">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Full Name</label>
                  <input
                    required
                    placeholder="e.g. Tariqul Islam"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Email Address</label>
                  <input
                    required
                    type="email"
                    placeholder="name@youthit.com.bd"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-600"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Phone</label>
                    <input
                      placeholder="01XXXXXXXXX"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Assigned Role</label>
                    <select
                      value={form.role}
                      onChange={(e) => setForm({ ...form, role: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-indigo-600"
                    >
                      <option value="staff">Staff</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Account Password <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showCreatePass ? 'text' : 'password'}
                      minLength={6}
                      required
                      placeholder="Required (min 6 characters)"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      className="w-full px-3 pr-9 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-600"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCreatePass((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      {showCreatePass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Login strictly verifies this exact password.
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Address</label>
                  <input
                    placeholder="Optional branch or home address"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-600"
                  />
                </div>

                <button
                  type="submit"
                  style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
                  className="w-full py-2.5 text-white rounded-xl font-semibold shadow-sm hover:opacity-95 transition-opacity cursor-pointer"
                >
                  Create User Account
                </button>
              </form>
            </div>
          </div>

          {/* Directory Table */}
          <div className="lg:col-span-8 min-w-0 bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, email or phone..."
                  className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-600"
                />
              </div>
              <div className="flex items-center gap-1 p-1 bg-white border border-slate-200 rounded-xl text-xs font-medium">
                {(['all', 'admin', 'manager', 'staff'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRoleFilter(r)}
                    className={`px-2.5 py-1 rounded-lg capitalize cursor-pointer transition-colors ${
                      roleFilter === r
                        ? 'bg-indigo-600 text-white font-semibold'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 font-semibold">User &amp; Contact</th>
                    <th className="px-4 py-3 font-semibold">Role</th>
                    <th className="px-4 py-3 font-semibold">Security</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.map((u) => {
                    const rStyle = getRoleStyle(u.role);
                    return (
                      <tr key={u.id} className="hover:bg-indigo-50/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3 min-w-0">
                            {u.profile_image ? (
                              <img
                                src={u.profile_image}
                                alt={u.name}
                                className="w-10 h-10 rounded-full object-cover border-2 border-indigo-100 shrink-0"
                              />
                            ) : (
                              <div
                                className={`w-10 h-10 rounded-full bg-gradient-to-br ${rStyle.avatarBg} text-white text-xs font-bold flex items-center justify-center shrink-0 shadow-xs`}
                              >
                                {getInitials(u.name)}
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-900 truncate">
                                {u.name}
                                {activeAccount?.id === u.id && (
                                  <span className="ml-2 text-[11px] font-bold text-indigo-600">(You)</span>
                                )}
                              </div>
                              <div className="text-xs text-slate-500 mt-0.5 truncate">
                                {u.email}
                                {u.phone ? ` · ${u.phone}` : ''}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-lg border text-[11px] font-bold uppercase tracking-wide ${rStyle.badge}`}
                          >
                            {rStyle.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs whitespace-nowrap">
                          <span className={u.has_password ? 'text-emerald-700 font-semibold' : 'text-amber-700 font-semibold'}>
                            {u.has_password ? 'Password Active' : 'Password Not Set'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs font-semibold whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-[11px] font-bold ${
                              u.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
                            }`}
                          >
                            {u.is_active ? 'Active' : 'Disabled'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap space-x-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEditTarget(u);
                              setEditForm({
                                name: u.name,
                                email: u.email,
                                phone: u.phone || '',
                                address: u.address || '',
                                role: u.role,
                                password: '',
                              });
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50/70 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 cursor-pointer"
                          >
                            <Edit3 className="w-3 h-3" /> Edit
                          </button>
                          {u.id !== 1 && u.role !== 'super_admin' && (
                            <>
                              <button
                                type="button"
                                onClick={() => toggleUser(u.id)}
                                className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
                              >
                                {u.is_active ? 'Disable' : 'Enable'}
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteUser(u)}
                                className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 cursor-pointer"
                                title="Delete user"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-xs text-slate-400">
                        No users match your search filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'roles' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {ROLE_CAPABILITIES.map((rc) => {
              const count = users.filter(
                (u) => u.role === rc.role || (rc.role === 'admin' && u.role === 'super_admin')
              ).length;
              return (
                <div
                  key={rc.role}
                  className="min-w-0 bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col justify-between"
                >
                  <div className={`h-1.5 bg-gradient-to-r ${rc.accentBar}`} />
                  <div className="p-5 flex-1">
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-9 h-9 rounded-xl ${rc.iconBg} flex items-center justify-center shrink-0`}>
                          <Shield className="w-4 h-4" />
                        </div>
                        <h3 className="font-display text-base font-bold text-slate-900">{rc.title}</h3>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-lg border text-xs font-bold tabular-nums ${rc.badgeClass}`}>
                        {count} users
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed mb-4">{rc.summary}</p>
                    <ul className="space-y-2 text-xs text-slate-700">
                      {rc.permissions.map((perm) => (
                        <li key={perm} className="flex items-center gap-2">
                          <Check className={`w-3.5 h-3.5 ${rc.checkColor} shrink-0`} />
                          <span>{perm}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
              <h3 className="font-display text-base font-bold text-slate-900">Module Access Matrix</h3>
              <span className="text-xs font-semibold text-indigo-600">Role-Based Permissions</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Module / Capability</th>
                    <th className="px-5 py-3 font-semibold text-center text-indigo-700">Admin</th>
                    <th className="px-5 py-3 font-semibold text-center text-violet-700">Manager</th>
                    <th className="px-5 py-3 font-semibold text-center text-teal-700">Staff</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {PERMISSION_MATRIX.map((row) => (
                    <tr key={row.module} className="hover:bg-slate-50/70">
                      <td className="px-5 py-3 font-medium text-slate-800">{row.module}</td>
                      <td className="px-5 py-3 text-center">
                        {row.admin ? <Check className="w-4 h-4 text-emerald-600 mx-auto" /> : <X className="w-4 h-4 text-slate-300 mx-auto" />}
                      </td>
                      <td className="px-5 py-3 text-center">
                        {row.manager ? <Check className="w-4 h-4 text-emerald-600 mx-auto" /> : <X className="w-4 h-4 text-slate-300 mx-auto" />}
                      </td>
                      <td className="px-5 py-3 text-center">
                        {row.staff ? <Check className="w-4 h-4 text-emerald-600 mx-auto" /> : <X className="w-4 h-4 text-slate-300 mx-auto" />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'account' && activeAccount && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Profile Information & Photo Upload */}
          <div className="min-w-0 bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-[#065AA4] via-indigo-600 to-violet-600" />
            <div className="p-6">
              <div className="flex flex-wrap items-center gap-4 pb-5 mb-5 border-b border-slate-100">
                <div className="relative shrink-0">
                  {activeAccount.profile_image ? (
                    <img
                      src={activeAccount.profile_image}
                      alt={activeAccount.name}
                      className="w-20 h-20 rounded-full object-cover border-4 border-indigo-100 shadow-sm"
                    />
                  ) : (
                    <div
                      className="w-20 h-20 rounded-full text-white text-xl font-bold flex items-center justify-center border-4 border-indigo-100 shadow-sm"
                      style={{ background: 'linear-gradient(135deg, #065AA4, #4f46e5)' }}
                    >
                      {getInitials(activeAccount.name)}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => myAvatarInputRef.current?.click()}
                    disabled={uploadingAvatarId === activeAccount.id}
                    title="Upload profile photo"
                    className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center border-2 border-white shadow-sm cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5" />
                  </button>
                  <input
                    ref={myAvatarInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      e.target.value = '';
                      void handleAvatarUpload(activeAccount.id, file);
                    }}
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-lg font-bold text-slate-900 truncate">
                      {activeAccount.name}
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 text-[11px] font-bold uppercase">
                      {getRoleStyle(activeAccount.role).label}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">{activeAccount.email}</p>
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => myAvatarInputRef.current?.click()}
                      disabled={uploadingAvatarId === activeAccount.id}
                      className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold cursor-pointer transition-colors"
                    >
                      {uploadingAvatarId === activeAccount.id ? 'Uploading...' : 'Upload Photo'}
                    </button>
                    {activeAccount.profile_image && (
                      <button
                        type="button"
                        onClick={() => handleRemoveAvatar(activeAccount)}
                        disabled={uploadingAvatarId === activeAccount.id}
                        className="px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold cursor-pointer transition-colors"
                      >
                        Remove Photo
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <form onSubmit={saveMyProfile} className="space-y-3.5 text-sm">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Full Name</label>
                  <input
                    required
                    value={accountProfile.name}
                    onChange={(e) => setAccountProfile({ ...accountProfile, name: e.target.value })}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={accountProfile.email}
                    onChange={(e) => setAccountProfile({ ...accountProfile, email: e.target.value })}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-600"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Recovery Phone</label>
                    <input
                      value={accountProfile.phone}
                      onChange={(e) => setAccountProfile({ ...accountProfile, phone: e.target.value })}
                      className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Address</label>
                    <input
                      value={accountProfile.address}
                      onChange={(e) => setAccountProfile({ ...accountProfile, address: e.target.value })}
                      className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-600"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
                  className="px-5 py-2.5 text-white rounded-xl text-xs font-semibold shadow-sm hover:opacity-95 cursor-pointer"
                >
                  Save Account Profile
                </button>
              </form>
            </div>
          </div>

          {/* Password & Security */}
          <div className="min-w-0 bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />
            <div className="p-6">
              <div className="flex items-center gap-2.5 mb-1">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="font-display text-base font-bold text-slate-900">Password &amp; Recovery Security</h2>
                  <p className="text-xs text-slate-500">
                    {activeAccount.has_password
                      ? 'Update password or use your recovery phone from Sign In.'
                      : 'Set a password below to lock this operator account.'}
                  </p>
                </div>
              </div>
              <form onSubmit={updateMyPassword} className="space-y-3.5 text-sm mt-5">
                {activeAccount.has_password && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Current Password</label>
                    <input
                      type="password"
                      required
                      value={pwForm.current_password}
                      onChange={(e) => setPwForm({ ...pwForm, current_password: e.target.value })}
                      className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-emerald-600"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">New Password</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={pwForm.new_password}
                    onChange={(e) => setPwForm({ ...pwForm, new_password: e.target.value })}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Confirm New Password</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={pwForm.confirm_password}
                    onChange={(e) => setPwForm({ ...pwForm, confirm_password: e.target.value })}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <button
                  type="submit"
                  style={{ background: 'linear-gradient(135deg, #059669, #0d9488)' }}
                  className="px-5 py-2.5 text-white rounded-xl text-xs font-semibold shadow-sm hover:opacity-95 cursor-pointer"
                >
                  Update Password
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit User & Photo Modal */}
      {editTarget && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
          onClick={() => setEditTarget(null)}
        >
          <form
            onSubmit={saveEditUser}
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-slate-200 rounded-2xl overflow-hidden w-full max-w-md shadow-2xl"
          >
            <div className="h-1.5 bg-gradient-to-r from-indigo-600 via-violet-600 to-cyan-500" />
            <div className="p-6 space-y-3.5 text-sm">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-base font-bold text-slate-900">
                  Edit User &middot; {editTarget.name}
                </h3>
                <button type="button" onClick={() => setEditTarget(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Photo Upload Row inside Edit Modal */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                {editTarget.profile_image ? (
                  <img
                    src={editTarget.profile_image}
                    alt={editTarget.name}
                    className="w-12 h-12 rounded-full object-cover border-2 border-indigo-200 shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-white text-sm font-bold flex items-center justify-center shrink-0">
                    {getInitials(editTarget.name)}
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => editAvatarInputRef.current?.click()}
                    disabled={uploadingAvatarId === editTarget.id}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold cursor-pointer"
                  >
                    {uploadingAvatarId === editTarget.id ? 'Uploading...' : 'Change Photo'}
                  </button>
                  {editTarget.profile_image && (
                    <button
                      type="button"
                      onClick={() => handleRemoveAvatar(editTarget)}
                      disabled={uploadingAvatarId === editTarget.id}
                      className="px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 text-xs font-semibold cursor-pointer"
                    >
                      Remove
                    </button>
                  )}
                  <input
                    ref={editAvatarInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      e.target.value = '';
                      void handleAvatarUpload(editTarget.id, file);
                    }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Name</label>
                <input
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Email</label>
                <input
                  required
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Phone</label>
                  <input
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Role</label>
                  {editTarget.id === 1 || editTarget.role === 'super_admin' ? (
                    <input
                      type="text"
                      disabled
                      value="Super Admin (Protected)"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 text-slate-600 font-semibold"
                    />
                  ) : (
                    <select
                      value={editForm.role}
                      onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white"
                    >
                      <option value="staff">Staff</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Admin</option>
                    </select>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Reset Password (leave blank to keep current)
                </label>
                <input
                  type="password"
                  minLength={6}
                  placeholder="New password (min 6 chars)"
                  value={editForm.password}
                  onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditTarget(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
                  className="px-5 py-2 rounded-xl text-xs font-semibold text-white cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
