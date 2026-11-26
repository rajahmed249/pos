import { useState } from 'react';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  Phone,
} from 'lucide-react';
import { apiFetch } from '../lib/api.ts';
import type { BootstrapPayload, UserAccount } from '../types/pos.ts';

interface LoginViewProps {
  settings: Record<string, string>;
  setupRequired?: boolean;
  sessionNotice?: string | null;
  onSuccess: (payload: {
    token: string;
    user: UserAccount;
    expiresAt?: number;
    bootstrap?: BootstrapPayload;
    remember?: boolean;
  }) => void;
}

export function LoginView({
  settings,
  setupRequired = false,
  sessionNotice = null,
  onSuccess,
}: LoginViewProps) {
  const [mode, setMode] = useState<'login' | 'recover'>('login');
  const [recoverStep, setRecoverStep] = useState<'request' | 'verify' | 'reset'>('request');
  const [recoverChannel, setRecoverChannel] = useState<'email' | 'sms'>('email');
  const [identifier, setIdentifier] = useState('rajahmed249@gmail.com');
  const [recoverEmail, setRecoverEmail] = useState('rajahmed249@gmail.com');
  const [recoverPhone, setRecoverPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);

  const [recoveryCode, setRecoveryCode] = useState('');
  const [resetProof, setResetProof] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(
    sessionNotice ? { type: 'info', text: sessionNotice } : null
  );
  const [imgFailed, setImgFailed] = useState(false);

  const rawLogo = settings.shop_logo || '/assets/images/logo.jpg';
  const topImageSrc = rawLogo.startsWith('http') || rawLogo.startsWith('/') ? rawLogo : `/${rawLogo}`;

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setNotice(null);
    setSubmitting(true);
    try {
      const res = await apiFetch<{
        token: string;
        user: UserAccount;
        expiresAt?: number;
        bootstrap?: BootstrapPayload;
      }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier, password, remember }),
      });
      onSuccess({ ...res, remember });
    } catch (err) {
      setNotice({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to sign in. Please verify your credentials.',
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRequestRecoveryCode(e: React.FormEvent) {
    e.preventDefault();
    setNotice(null);
    const activeRecoverId = (recoverChannel === 'email' ? recoverEmail : recoverPhone).trim();
    if (!activeRecoverId) {
      setNotice({
        type: 'error',
        text:
          recoverChannel === 'email'
            ? 'Please enter your registered email address.'
            : 'Please enter your registered mobile number.',
      });
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiFetch<{ ok: boolean; channel: 'email' | 'sms'; message: string }>(
        '/api/auth/request-recovery-code',
        {
          method: 'POST',
          body: JSON.stringify({
            identifier: activeRecoverId,
            channel: recoverChannel,
          }),
        }
      );
      setRecoveryCode('');
      setResetProof('');
      setNotice({ type: 'success', text: res.message });
      setRecoverStep('verify');
    } catch (err) {
      setNotice({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to send recovery code.',
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyRecoveryCode(e: React.FormEvent) {
    e.preventDefault();
    setNotice(null);
    const activeRecoverId = (recoverChannel === 'email' ? recoverEmail : recoverPhone).trim() || identifier.trim();
    if (!/^\d{6}$/.test(recoveryCode.trim())) {
      setNotice({ type: 'error', text: 'Please enter the 6-digit verification code sent to you.' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiFetch<{ ok: boolean; reset_proof: string; message: string }>(
        '/api/auth/verify-recovery-code',
        {
          method: 'POST',
          body: JSON.stringify({
            identifier: activeRecoverId,
            code: recoveryCode.trim(),
          }),
        }
      );
      setResetProof(res.reset_proof);
      setNewPassword('');
      setConfirmPassword('');
      setNotice({ type: 'success', text: res.message });
      setRecoverStep('reset');
    } catch (err) {
      setResetProof('');
      setNotice({
        type: 'error',
        text: err instanceof Error ? err.message : 'Verification code did not match.',
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRecover(e: React.FormEvent) {
    e.preventDefault();
    setNotice(null);
    const activeRecoverId = (recoverChannel === 'email' ? recoverEmail : recoverPhone).trim() || identifier.trim();
    if (!resetProof) {
      setRecoverStep('verify');
      setNotice({ type: 'error', text: 'Please verify your 6-digit code first.' });
      return;
    }
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
          identifier: activeRecoverId,
          code: recoveryCode.trim(),
          reset_proof: resetProof,
          new_password: newPassword,
        }),
      });
      setNotice({ type: 'success', text: res.message });
      setPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setRecoveryCode('');
      setResetProof('');
      setRecoverStep('request');
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

  const shopLabel = settings.shop_name?.trim() || 'YOUTH IT POS';
  const isYouthItPos = shopLabel.toUpperCase().includes('YOUTH IT');

  return (
    <div
      className="login-bg-shift min-h-screen w-full flex items-center justify-center p-4 sm:p-6 relative overflow-hidden"
      style={{
        backgroundImage:
          'linear-gradient(125deg, #04071a 0%, #0f1747 28%, #1e114d 54%, #092042 78%, #04071a 100%)',
      }}
    >
      {/* Fast Kinetic Cyber-Aurora Background Outside Card */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Subtle Tech Dot Grid */}
        <div
          className="absolute inset-0 opacity-25"
          style={{
            backgroundImage: 'radial-gradient(rgba(165, 180, 252, 0.42) 1px, transparent 1px)',
            backgroundSize: '26px 26px',
            maskImage: 'radial-gradient(circle at 50% 50%, black 40%, transparent 92%)',
            WebkitMaskImage: 'radial-gradient(circle at 50% 50%, black 40%, transparent 92%)',
          }}
        />

        {/* Fast Rotating Conic Aurora Halo */}
        <div
          className="login-aurora-spin absolute left-1/2 top-1/2 w-[780px] h-[780px] rounded-full blur-[105px] opacity-40"
          style={{
            background:
              'conic-gradient(from 0deg, #06b6d4, #3b82f6, #8b5cf6, #ec4899, #fbbf24, #06b6d4)',
          }}
        />

        {/* Counter-Rotating Luminous Orbital Rings */}
        <div className="login-ring-cw absolute left-1/2 top-1/2 w-[540px] h-[540px] sm:w-[620px] sm:h-[620px] rounded-full border border-cyan-400/20 border-dashed" />
        <div className="login-ring-ccw absolute left-1/2 top-1/2 w-[680px] h-[680px] sm:w-[760px] sm:h-[760px] rounded-full border border-fuchsia-400/20" />

        {/* Fast Moving Vibrant Aurora Orbs */}
        <div
          className="login-aurora-1 absolute -top-24 -left-20 w-[440px] h-[440px] rounded-full blur-[90px] opacity-65"
          style={{
            background:
              'radial-gradient(circle, rgba(34,211,238,0.6) 0%, rgba(59,130,246,0.45) 42%, transparent 72%)',
          }}
        />
        <div
          className="login-aurora-2 absolute -bottom-28 -right-20 w-[480px] h-[480px] rounded-full blur-[95px] opacity-65"
          style={{
            background:
              'radial-gradient(circle, rgba(244,114,182,0.58) 0%, rgba(124,58,237,0.5) 45%, transparent 74%)',
          }}
        />
        <div
          className="login-aurora-1 absolute -bottom-20 left-[10%] w-[340px] h-[340px] rounded-full blur-[90px] opacity-45"
          style={{
            background:
              'radial-gradient(circle, rgba(52,211,153,0.48) 0%, rgba(14,165,233,0.32) 50%, transparent 75%)',
          }}
        />

        {/* Diagonal Shooting Neon Light Streaks */}
        <div
          className="login-beam absolute top-[12%] -left-1/4 w-[380px] h-[2px] rounded-full opacity-75"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, #38bdf8 55%, #ffffff 100%)',
            boxShadow: '0 0 14px rgba(56,189,248,0.85)',
            animationDuration: '3.6s',
          }}
        />
        <div
          className="login-beam absolute top-[45%] -left-1/4 w-[440px] h-[2px] rounded-full opacity-70"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, #c084fc 55%, #f0abfc 100%)',
            boxShadow: '0 0 16px rgba(217,70,239,0.85)',
            animationDelay: '1.4s',
            animationDuration: '4.4s',
          }}
        />
        <div
          className="login-beam absolute top-[72%] -left-1/4 w-[340px] h-[2px] rounded-full opacity-65"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, #34d399 55%, #60a5fa 100%)',
            boxShadow: '0 0 14px rgba(52,211,153,0.8)',
            animationDelay: '2.6s',
            animationDuration: '3.9s',
          }}
        />

        {/* Fast Rising Light Sparks */}
        <span className="login-particle absolute bottom-[12%] left-[12%] w-2 h-2 rounded-full bg-cyan-300/80 shadow-[0_0_8px_#67e8f9]" />
        <span
          className="login-particle absolute bottom-[18%] right-[14%] w-2.5 h-2.5 rounded-full bg-fuchsia-300/80 shadow-[0_0_10px_#f0abfc]"
          style={{ animationDelay: '0.8s', animationDuration: '3.2s' }}
        />
        <span
          className="login-particle absolute bottom-[26%] left-[22%] w-1.5 h-1.5 rounded-full bg-emerald-300/80 shadow-[0_0_8px_#6ee7b7]"
          style={{ animationDelay: '1.7s', animationDuration: '4.1s' }}
        />
        <span
          className="login-particle absolute bottom-[10%] right-[24%] w-2 h-2 rounded-full bg-amber-300/80 shadow-[0_0_8px_#fcd34d]"
          style={{ animationDelay: '2.3s', animationDuration: '3.5s' }}
        />
        <span
          className="login-particle absolute bottom-[40%] left-[8%] w-1.5 h-1.5 rounded-full bg-sky-300/80"
          style={{ animationDelay: '1.1s', animationDuration: '2.9s' }}
        />
        <span
          className="login-particle absolute bottom-[36%] right-[10%] w-2 h-2 rounded-full bg-violet-300/80"
          style={{ animationDelay: '2.8s', animationDuration: '3.7s' }}
        />
      </div>

      {/* Main Card — Sleek Narrower Width & Taller Bottom to Show Full Wave Design */}
      <div
        className="relative w-full max-w-[358px] rounded-[28px] overflow-hidden border border-[#7c3aed]/45 shadow-[0_24px_80px_rgba(15,10,48,0.85),0_0_45px_rgba(99,102,241,0.22)]"
        style={{
          background:
            'linear-gradient(180deg, #2b2a7d 0%, #17194a 26%, #0c1028 60%, #090c20 100%)',
        }}
      >
        {/* Thin Top Blue-Teal-Gold Accent Border */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[3px] z-20"
          style={{
            background:
              'linear-gradient(90deg, #0088d1 0%, #0ea5e9 34%, #1f8a88 68%, #938a34 100%)',
          }}
        />

        {/* Top soft radial illumination */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-[300px] h-[220px] rounded-full blur-3xl opacity-55"
          style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.55) 0%, transparent 70%)' }}
        />

        {/* Bottom luminous silk wave ribbons — clearly visible below the Login button */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-[118px] overflow-hidden">
          <div
            className="absolute inset-x-0 -bottom-5 h-28 blur-2xl opacity-65"
            style={{
              background:
                'radial-gradient(ellipse at 25% 80%, rgba(59,130,246,0.6), transparent 55%), radial-gradient(ellipse at 78% 75%, rgba(217,70,239,0.6), transparent 55%)',
            }}
          />
          <svg
            viewBox="0 0 400 120"
            preserveAspectRatio="none"
            className="w-full h-full block"
          >
            <defs>
              <linearGradient id="loginWave1" x1="0%" y1="50%" x2="100%" y2="50%">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.32" />
                <stop offset="45%" stopColor="#7c3aed" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#e879f9" stopOpacity="0.46" />
              </linearGradient>
              <linearGradient id="loginWave2" x1="0%" y1="50%" x2="100%" y2="50%">
                <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.48" />
                <stop offset="50%" stopColor="#8b5cf6" stopOpacity="0.32" />
                <stop offset="100%" stopColor="#d946ef" stopOpacity="0.6" />
              </linearGradient>
              <linearGradient id="loginWaveStroke" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.72" />
                <stop offset="50%" stopColor="#a78bfa" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#f0abfc" stopOpacity="0.75" />
              </linearGradient>
            </defs>
            <path
              d="M0,92 C75,50 145,108 225,72 C295,42 348,54 400,82 L400,120 L0,120 Z"
              fill="url(#loginWave1)"
            />
            <path
              d="M0,100 C62,68 120,36 195,78 C265,116 332,32 400,62 L400,120 L0,120 Z"
              fill="url(#loginWave2)"
            />
            <path
              d="M0,95 C68,52 128,42 198,80 C268,114 332,34 400,64"
              fill="none"
              stroke="url(#loginWaveStroke)"
              strokeWidth="1.5"
            />
          </svg>
        </div>

        {/* Content Stack */}
        <div className="relative z-10 px-6 pt-7 pb-[106px]">
          {/* Centered Classic Gold-Bordered Logo + YOUTH IT POS Header */}
          <div className="flex flex-col items-center text-center mb-5">
            <div className="w-[64px] h-[64px] rounded-[16px] bg-white border-2 border-[#ffd166] p-1 flex items-center justify-center mb-3 shadow-[0_10px_24px_rgba(255,209,102,0.28),0_10px_28px_rgba(15,10,48,0.65)] overflow-hidden">
              {!imgFailed ? (
                <img
                  key={topImageSrc}
                  src={topImageSrc}
                  alt={shopLabel}
                  referrerPolicy="no-referrer"
                  onError={() => setImgFailed(true)}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="w-full h-full rounded-[12px] bg-[#161a44] flex items-center justify-center font-brand text-xl font-black text-[#ffd166]">
                  {shopLabel.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>

            {mode === 'login' ? (
              <h1 className="font-brand-wordmark text-[27px] sm:text-[29px] font-extrabold leading-tight flex items-center justify-center gap-2">
                {isYouthItPos ? (
                  <>
                    <span className="bg-gradient-to-b from-[#bae6fd] via-[#38bdf8] to-[#2563eb] bg-clip-text text-transparent drop-shadow-[0_2px_10px_rgba(56,189,248,0.4)]">
                      Youth
                    </span>
                    <span className="bg-gradient-to-b from-[#fde68a] via-[#fbbf24] to-[#f97316] bg-clip-text text-transparent drop-shadow-[0_2px_10px_rgba(251,191,36,0.45)]">
                      IT
                    </span>
                    <span className="bg-gradient-to-b from-[#a7f3d0] via-[#34d399] to-[#059669] bg-clip-text text-transparent drop-shadow-[0_2px_10px_rgba(52,211,153,0.4)]">
                      POS
                    </span>
                  </>
                ) : (
                  <span className="bg-gradient-to-b from-white via-indigo-100 to-indigo-300 bg-clip-text text-transparent">
                    {shopLabel}
                  </span>
                )}
              </h1>
            ) : (
              <h1 className="font-display text-[25px] sm:text-[27px] font-bold tracking-tight text-white leading-tight">
                Reset Password
              </h1>
            )}
            <p className="text-[13px] text-indigo-100/75 mt-1">
              {mode === 'login'
                ? 'Welcome Back'
                : recoverStep === 'request'
                  ? 'Step 1: Send a 6-digit recovery code'
                  : recoverStep === 'verify'
                    ? 'Step 2: Verify the 6-digit code sent to you'
                    : 'Step 3: Create your new password'}
            </p>
          </div>

          {mode === 'recover' && (
            <div className="mb-4 px-1">
              <div className="grid grid-cols-3 items-start gap-1.5 relative">
                {[
                  { id: 'request', num: 1, label: 'Send Code' },
                  { id: 'verify', num: 2, label: 'Verify Code' },
                  { id: 'reset', num: 3, label: 'New Password' },
                ].map((step) => {
                  const order = { request: 1, verify: 2, reset: 3 } as const;
                  const currentNum = order[recoverStep];
                  const isDone = currentNum > step.num;
                  const isCurrent = currentNum === step.num;
                  return (
                    <div key={step.id} className="flex flex-col items-center text-center gap-1.5">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border transition-all ${
                          isDone
                            ? 'bg-emerald-500 border-emerald-400 text-white shadow-[0_0_12px_rgba(16,185,129,0.45)]'
                            : isCurrent
                              ? 'bg-[#7c3aed] border-[#c084fc] text-white shadow-[0_0_14px_rgba(124,58,237,0.55)]'
                              : 'bg-[#0e132d]/85 border-indigo-300/25 text-indigo-200/60'
                        }`}
                      >
                        {isDone ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : step.num}
                      </div>
                      <span
                        className={`text-[10px] font-semibold tracking-tight ${
                          isDone
                            ? 'text-emerald-300'
                            : isCurrent
                              ? 'text-white'
                              : 'text-indigo-200/55'
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2.5 h-1.5 w-full rounded-full bg-[#0e132d]/90 overflow-hidden border border-indigo-300/15">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width:
                      recoverStep === 'request'
                        ? '33.33%'
                        : recoverStep === 'verify'
                          ? '66.66%'
                          : '100%',
                    background: 'linear-gradient(90deg, #3b82f6 0%, #7c3aed 55%, #10b981 100%)',
                  }}
                />
              </div>
            </div>
          )}

          {setupRequired && !notice && mode === 'login' && (
            <div className="mb-4 px-3.5 py-2 rounded-xl border border-sky-400/35 bg-sky-500/15 text-sky-200 text-xs font-medium flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>No password is set yet. Click Forgot password? below to verify via code and set your password.</span>
            </div>
          )}

          {notice && (
            <div
              className={`mb-4 px-3.5 py-2 rounded-xl border text-xs font-medium flex items-start gap-2 ${
                notice.type === 'success'
                  ? 'bg-emerald-500/15 border-emerald-400/35 text-emerald-200'
                  : notice.type === 'info'
                    ? 'bg-sky-500/15 border-sky-400/35 text-sky-200'
                    : 'bg-rose-500/15 border-rose-400/35 text-rose-200'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{notice.text}</span>
            </div>
          )}

          {mode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-3">
              <div>
                <div className="relative flex items-center">
                  <Mail className="w-[18px] h-[18px] text-indigo-200/80 absolute left-4 pointer-events-none" />
                  <input
                    type="text"
                    required
                    aria-label="Email address or username"
                    value={identifier}
                    onChange={(e) => {
                      setIdentifier(e.target.value);
                      setImgFailed(false);
                    }}
                    placeholder="Email address"
                    className="w-full pl-11 pr-4 py-3 rounded-[14px] text-sm text-white placeholder:text-indigo-100/65 bg-[#0e132d]/85 border border-indigo-300/20 focus:outline-none focus:border-violet-400/75 focus:ring-2 focus:ring-violet-500/25 transition-all"
                  />
                </div>
              </div>

              <div>
                <div className="relative flex items-center">
                  <Lock className="w-[18px] h-[18px] text-indigo-200/80 absolute left-4 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    aria-label="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    className="w-full pl-11 pr-11 py-3 rounded-[14px] text-sm text-white placeholder:text-indigo-100/65 bg-[#0e132d]/85 border border-indigo-300/20 focus:outline-none focus:border-violet-400/75 focus:ring-2 focus:ring-violet-500/25 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3.5 text-indigo-200/80 hover:text-white p-1 cursor-pointer transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                  </button>
                </div>
              </div>

              {/* Remember Me + Forgot Password Row */}
              <div className="flex items-center justify-between gap-2 pt-0.5 pb-0.5 text-xs">
                <label className="inline-flex items-center gap-2.5 text-indigo-100/90 cursor-pointer select-none">
                  <span className="relative inline-flex items-center justify-center">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                      className="peer sr-only"
                    />
                    <span className="w-[17px] h-[17px] rounded-[5px] border border-indigo-200/50 bg-[#0e132d]/80 peer-checked:bg-[#7c3aed] peer-checked:border-[#a855f7] peer-focus-visible:ring-2 peer-focus-visible:ring-violet-400 flex items-center justify-center transition-colors">
                      {remember && <Check className="w-3 h-3 text-white stroke-[3]" />}
                    </span>
                  </span>
                  <span>Remember me</span>
                </label>

                <button
                  type="button"
                  onClick={() => {
                    setMode('recover');
                    setRecoverStep('request');
                    if (identifier.includes('@')) {
                      setRecoverEmail(identifier);
                    } else if (/\d{6,}/.test(identifier)) {
                      setRecoverPhone(identifier);
                    }
                    setNotice(null);
                  }}
                  className="font-medium text-[#c084fc] hover:text-[#e879f9] transition-colors cursor-pointer whitespace-nowrap"
                >
                  Forgot password?
                </button>
              </div>

              <button
                type="submit"
                disabled={submitting}
                style={{
                  background: 'linear-gradient(90deg, #3b82f6 0%, #7c3aed 52%, #e052f5 100%)',
                }}
                className="w-full py-3 px-5 rounded-[14px] text-[15px] font-semibold text-white shadow-[0_10px_28px_rgba(124,58,237,0.45)] hover:brightness-110 active:scale-[0.99] transition-all disabled:opacity-60 cursor-pointer"
              >
                {submitting ? 'Signing in...' : 'Login'}
              </button>
            </form>
          ) : recoverStep === 'request' ? (
            <form onSubmit={handleRequestRecoveryCode} className="space-y-3">
              <div className="grid grid-cols-2 gap-2 p-1 rounded-[12px] bg-[#0e132d]/85 border border-indigo-300/20 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => {
                    setRecoverChannel('email');
                    setNotice(null);
                  }}
                  className={`py-2 rounded-[9px] flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    recoverChannel === 'email'
                      ? 'bg-[#7c3aed] text-white shadow-sm'
                      : 'text-indigo-200/75 hover:text-white'
                  }`}
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Via Email</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRecoverChannel('sms');
                    setNotice(null);
                  }}
                  className={`py-2 rounded-[9px] flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    recoverChannel === 'sms'
                      ? 'bg-[#7c3aed] text-white shadow-sm'
                      : 'text-indigo-200/75 hover:text-white'
                  }`}
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Via Mobile SMS</span>
                </button>
              </div>

              <div className="relative flex items-center">
                {recoverChannel === 'email' ? (
                  <Mail className="w-[18px] h-[18px] text-indigo-200/80 absolute left-4 pointer-events-none" />
                ) : (
                  <Phone className="w-[18px] h-[18px] text-indigo-200/80 absolute left-4 pointer-events-none" />
                )}
                <input
                  type={recoverChannel === 'email' ? 'email' : 'tel'}
                  required
                  aria-label={recoverChannel === 'email' ? 'Registered email address' : 'Registered mobile number'}
                  value={recoverChannel === 'email' ? recoverEmail : recoverPhone}
                  onChange={(e) =>
                    recoverChannel === 'email'
                      ? setRecoverEmail(e.target.value)
                      : setRecoverPhone(e.target.value)
                  }
                  placeholder={
                    recoverChannel === 'email'
                      ? 'Registered email address'
                      : 'Registered mobile number (e.g. 01674297522)'
                  }
                  className="w-full pl-11 pr-4 py-3 rounded-[14px] text-sm text-white placeholder:text-indigo-100/65 bg-[#0e132d]/85 border border-indigo-300/20 focus:outline-none focus:border-violet-400/75 focus:ring-2 focus:ring-violet-500/25 transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                style={{
                  background: 'linear-gradient(90deg, #3b82f6 0%, #7c3aed 52%, #e052f5 100%)',
                }}
                className="w-full py-3 px-5 rounded-[14px] text-[15px] font-semibold text-white shadow-[0_10px_28px_rgba(124,58,237,0.45)] hover:brightness-110 transition-all disabled:opacity-60 cursor-pointer"
              >
                {submitting ? 'Sending code...' : 'Send Recovery Code'}
              </button>

              <div className="flex items-center justify-between pt-1 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setNotice(null);
                  }}
                  className="font-medium text-[#c084fc] hover:text-[#e879f9] inline-flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Login</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRecoverStep('verify');
                    setNotice(null);
                  }}
                  className="font-medium text-indigo-200/80 hover:text-white cursor-pointer"
                >
                  Have a code?
                </button>
              </div>
            </form>
          ) : recoverStep === 'verify' ? (
            <form onSubmit={handleVerifyRecoveryCode} className="space-y-3">
              <div className="relative flex items-center">
                <KeyRound className="w-[18px] h-[18px] text-indigo-200/80 absolute left-4 pointer-events-none" />
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  autoFocus
                  aria-label="6-digit verification code"
                  value={recoveryCode}
                  onChange={(e) => setRecoveryCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Enter 6-digit verification code"
                  className="w-full pl-11 pr-4 py-3 rounded-[14px] text-sm tracking-[0.22em] text-white placeholder:tracking-normal placeholder:text-indigo-100/65 bg-[#0e132d]/85 border border-indigo-300/20 focus:outline-none focus:border-violet-400/75 focus:ring-2 focus:ring-violet-500/25 transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={submitting || recoveryCode.trim().length !== 6}
                style={{
                  background: 'linear-gradient(90deg, #3b82f6 0%, #7c3aed 52%, #e052f5 100%)',
                }}
                className="w-full py-3 px-5 rounded-[14px] text-[15px] font-semibold text-white shadow-[0_10px_28px_rgba(124,58,237,0.45)] hover:brightness-110 transition-all disabled:opacity-60 cursor-pointer"
              >
                {submitting ? 'Verifying Code...' : 'Verify Code'}
              </button>

              <div className="flex items-center justify-between pt-1 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setRecoverStep('request');
                    setResetProof('');
                    setNotice(null);
                  }}
                  className="font-medium text-[#c084fc] hover:text-[#e879f9] inline-flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Resend code</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setRecoverStep('request');
                    setResetProof('');
                    setNotice(null);
                  }}
                  className="font-medium text-indigo-200/80 hover:text-white cursor-pointer"
                >
                  Back to Login
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRecover} className="space-y-2.5">
              <div className="px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-400/35 text-emerald-200 text-xs font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-300" />
                <span>Code verified! Enter your new password below.</span>
              </div>

              <div className="relative flex items-center">
                <Lock className="w-[18px] h-[18px] text-indigo-200/80 absolute left-4 pointer-events-none" />
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  autoFocus
                  aria-label="New Password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password (min 6 chars)"
                  className="w-full pl-11 pr-11 py-2.5 rounded-[14px] text-sm text-white placeholder:text-indigo-100/65 bg-[#0e132d]/85 border border-indigo-300/20 focus:outline-none focus:border-violet-400/75 focus:ring-2 focus:ring-violet-500/25 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((v) => !v)}
                  className="absolute right-3.5 text-indigo-200/80 hover:text-white p-1 cursor-pointer"
                  aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                >
                  {showNewPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                </button>
              </div>

              <div className="relative flex items-center">
                <Lock className="w-[18px] h-[18px] text-indigo-200/80 absolute left-4 pointer-events-none" />
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  aria-label="Confirm New Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="w-full pl-11 pr-4 py-2.5 rounded-[14px] text-sm text-white placeholder:text-indigo-100/65 bg-[#0e132d]/85 border border-indigo-300/20 focus:outline-none focus:border-violet-400/75 focus:ring-2 focus:ring-violet-500/25 transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                style={{
                  background: 'linear-gradient(90deg, #3b82f6 0%, #7c3aed 52%, #10b981 100%)',
                }}
                className="w-full py-3 px-5 rounded-[14px] text-[15px] font-semibold text-white shadow-[0_10px_28px_rgba(16,185,129,0.35)] hover:brightness-110 transition-all disabled:opacity-60 cursor-pointer"
              >
                {submitting ? 'Updating Password...' : 'Save New Password'}
              </button>

              <div className="flex items-center justify-between pt-1 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setRecoverStep('request');
                    setResetProof('');
                    setRecoveryCode('');
                    setNotice(null);
                  }}
                  className="font-medium text-[#c084fc] hover:text-[#e879f9] inline-flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Start over</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setRecoverStep('request');
                    setResetProof('');
                    setNotice(null);
                  }}
                  className="font-medium text-indigo-200/80 hover:text-white cursor-pointer"
                >
                  Back to Login
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
