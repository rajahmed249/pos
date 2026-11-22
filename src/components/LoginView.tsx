import { useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  Phone,
} from 'lucide-react';
import { apiFetch } from '../lib/api.ts';
import type { UserAccount } from '../types/pos.ts';

interface LoginViewProps {
  settings: Record<string, string>;
  users?: UserAccount[];
  canReturnToWorkspace?: boolean;
  onReturnToWorkspace?: () => void;
  onSuccess: (payload: { token: string; user: UserAccount; firstTimeActivated?: boolean }) => void;
}

export function LoginView({
  settings,
  users = [],
  canReturnToWorkspace = false,
  onReturnToWorkspace,
  onSuccess,
}: LoginViewProps) {
  const [mode, setMode] = useState<'login' | 'recover'>('login');
  const [identifier, setIdentifier] = useState('rajahmed249@gmail.com');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);

  const [recoverPhone, setRecoverPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const rawLogo = settings.shop_logo || '/assets/images/logo.jpg';
  const logoSrc = rawLogo.startsWith('http') || rawLogo.startsWith('/') ? rawLogo : `/${rawLogo}`;

  const matchedUser = users.find(
    (u) =>
      u.email.toLowerCase() === identifier.trim().toLowerCase() ||
      u.name.toLowerCase() === identifier.trim().toLowerCase()
  );

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setNotice(null);
    setSubmitting(true);
    try {
      const res = await apiFetch<{ token: string; user: UserAccount; firstTimeActivated?: boolean }>(
        '/api/auth/login',
        {
          method: 'POST',
          body: JSON.stringify({ identifier, password, remember }),
        }
      );
      onSuccess(res);
    } catch (err) {
      setNotice({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to sign in. Please verify your credentials.',
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRecover(e: React.FormEvent) {
    e.preventDefault();
    setNotice(null);
    if (newPassword.length < 6) {
      setNotice({ type: 'error', text: 'New password must be at least 6 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setNotice({ type: 'error', text: 'New password and confirmation do not match.' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiFetch<{ ok: boolean; message: string }>('/api/auth/recover-password', {
        method: 'POST',
        body: JSON.stringify({
          identifier,
          phone: recoverPhone,
          new_password: newPassword,
        }),
      });
      setNotice({ type: 'success', text: res.message });
      setPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setRecoverPhone('');
      setMode('login');
    } catch (err) {
      setNotice({
        type: 'error',
        text: err instanceof Error ? err.message : 'Password recovery failed.',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 sm:p-6"
      style={{
        background:
          'radial-gradient(circle at top center, #eef2ff 0%, #f8fafc 45%, #f1f5f9 100%)',
      }}
    >
      <div className="w-full max-w-[440px] bg-white border border-slate-200/90 rounded-[24px] p-6 sm:p-8 shadow-[0_24px_60px_rgba(15,23,42,0.1)]">
        {/* Centered Brand Lockup */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-white border-2 border-indigo-100 p-1.5 shadow-sm flex items-center justify-center mb-3 overflow-hidden">
            <img src={logoSrc} alt="Youth IT Logo" className="w-full h-full object-contain" />
          </div>
          <div className="font-brand text-[26px] font-black tracking-tight leading-none">
            <span className="text-[#065AA4]">YOUTH</span>{' '}
            <span className="text-[#f97316]">IT</span>{' '}
            <span className="text-[#4f46e5]">POS</span>
          </div>
          <p className="text-xs text-slate-500 mt-1.5">
            {mode === 'login'
              ? 'Sign in with your account credentials to continue'
              : 'Verify your account email and phone to reset password'}
          </p>
        </div>

        {/* Mode Switcher */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl text-xs font-semibold mb-5">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setNotice(null);
            }}
            className={`py-2 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              mode === 'login' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('recover');
              setNotice(null);
            }}
            className={`py-2 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              mode === 'recover' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Forgot Password
          </button>
        </div>

        {notice && (
          <div
            className={`mb-5 px-4 py-3 rounded-xl border text-xs font-medium flex items-start gap-2.5 ${
              notice.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : notice.type === 'info'
                  ? 'bg-blue-50 border-blue-200 text-blue-800'
                  : 'bg-red-50 border-red-200 text-red-700'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{notice.text}</span>
          </div>
        )}

        {mode === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Email or Username
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="rajahmed249@gmail.com or username"
                  className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                />
              </div>
              {users.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-slate-500">
                  <span>Accounts:</span>
                  {users
                    .filter((u) => u.is_active)
                    .slice(0, 4)
                    .map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          setIdentifier(u.email);
                          setNotice(null);
                        }}
                        className={`underline-offset-2 hover:underline font-medium cursor-pointer ${
                          identifier.toLowerCase() === u.email.toLowerCase()
                            ? 'text-indigo-600 font-semibold'
                            : 'text-slate-600'
                        }`}
                      >
                        {u.name} ({u.role})
                      </button>
                    ))}
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700">Password</label>
                <button
                  type="button"
                  onClick={() => {
                    setMode('recover');
                    setNotice(null);
                  }}
                  className="text-xs font-semibold text-indigo-600 hover:underline cursor-pointer"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={
                    matchedUser && !matchedUser.has_password
                      ? 'Set initial password (min 6 chars)'
                      : 'Enter your password'
                  }
                  className="w-full pl-10 pr-11 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {matchedUser && !matchedUser.has_password && (
                <p className="mt-1.5 text-[11px] text-amber-700">
                  First-time activation for {matchedUser.name}: enter any 6+ character password to activate and lock this account.
                </p>
              )}
            </div>

            <label className="inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer pt-0.5">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600"
              />
              <span>Keep me signed in on this terminal</span>
            </label>

            <div className="pt-1 flex flex-wrap items-center gap-2.5">
              <button
                type="submit"
                disabled={submitting}
                style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
                className="flex-1 py-3 px-5 rounded-xl text-sm font-semibold text-white shadow-[0_6px_18px_rgba(79,70,229,0.28)] hover:opacity-95 transition-opacity disabled:opacity-60 inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <Lock className="w-4 h-4" />
                <span>{submitting ? 'Signing In...' : 'Sign In'}</span>
              </button>

              {canReturnToWorkspace && onReturnToWorkspace && (
                <button
                  type="button"
                  onClick={onReturnToWorkspace}
                  className="py-3 px-4 rounded-xl text-xs font-semibold text-slate-700 border border-slate-200 hover:bg-slate-50 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>
              )}
            </div>
          </form>
        ) : (
          <form onSubmit={handleRecover} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Account Email or Username
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="rajahmed249@gmail.com"
                  className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Registered Phone Number
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={recoverPhone}
                  onChange={(e) => setRecoverPhone(e.target.value)}
                  placeholder="e.g. 01674297522"
                  className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="w-full pl-10 pr-10 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Confirm Password
                </label>
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-600"
                />
              </div>
            </div>

            <div className="pt-1 flex flex-wrap items-center gap-2.5">
              <button
                type="submit"
                disabled={submitting}
                style={{ background: 'linear-gradient(135deg, #065AA4, #4f46e5)' }}
                className="flex-1 py-3 px-5 rounded-xl text-sm font-semibold text-white shadow-md hover:opacity-95 transition-opacity disabled:opacity-60 inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <KeyRound className="w-4 h-4" />
                <span>{submitting ? 'Resetting...' : 'Reset & Recover Password'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setNotice(null);
                }}
                className="py-3 px-4 rounded-xl text-xs font-semibold text-slate-700 border border-slate-200 hover:bg-slate-50 cursor-pointer"
              >
                Back
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

