import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, LoginResponse } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { HugeiconsIcon } from '@hugeicons/react';
import { Hospital01Icon, AlertCircleIcon, Mail01Icon, CallIcon, FingerPrintScanIcon, ArrowLeft01Icon, Loading02Icon, CheckmarkCircle01Icon, Key01Icon, ViewOffIcon, ViewIcon, ShieldKeyIcon, ArrowRight01Icon, InformationCircleIcon } from '@hugeicons/core-free-icons';

type Step = 'password' | 'mfa-picker' | 'mfa-code' | 'forgot-email' | 'forgot-explain' | 'forgot-verify' | 'forgot-transition' | 'forgot-reset' | 'forgot-success';

const STEP_LABELS: Record<Step, string> = {
  password: 'Sign In',
  'mfa-picker': 'Verify',
  'mfa-code': 'Verify',
  'forgot-email': 'Forgot Password',
  'forgot-explain': 'Verify Identity',
  'forgot-verify': 'Verify Identity',
  'forgot-transition': 'Verify Identity',
  'forgot-reset': 'Reset Password',
  'forgot-success': 'Complete',
};

const MFA_OPTIONS: Record<string, { label: string; icon: any; description: string }> = {
  email: { label: 'Email', icon: Mail01Icon, description: 'Send code to your email' },
  phone: { label: 'Phone', icon: CallIcon, description: 'Send code via SMS' },
  authenticator: { label: 'Authenticator', icon: FingerPrintScanIcon, description: 'Use authenticator app' },
};

const MFA_METHOD_LABELS: Record<string, string> = {
  email: 'Email',
  phone: 'Phone (SMS)',
  authenticator: 'Authenticator App',
};

function OtpDigitInput({ value, onChange, onComplete }: { value: string; onChange: (v: string) => void; onComplete: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const digits = value.split('');

  useEffect(() => { ref.current?.focus(); }, []);

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="flex gap-3" onClick={() => ref.current?.focus()}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className={`size-12 rounded-xl border-2 flex items-center justify-center text-xl font-bold transition-all duration-150 cursor-text ${
              digits[i]
                ? 'border-primary bg-primary/5 text-foreground scale-100 shadow-sm'
                : i === digits.length
                  ? 'border-primary ring-4 ring-primary/15 scale-105 bg-primary/[0.02]'
                  : 'border-muted bg-muted/20 text-muted-foreground/30'
            }`}
          >
            {digits[i] ? (
              <span className="animate-in fade-in zoom-in duration-100">{digits[i]}</span>
            ) : (
              <span className="text-lg leading-none">—</span>
            )}
          </div>
        ))}
      </div>
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, '').slice(0, 6);
          onChange(v);
          if (v.length === 6) setTimeout(onComplete, 250);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && value.length >= 4) onComplete();
        }}
        className="opacity-0 absolute size-0 pointer-events-none"
        autoComplete="one-time-code"
      />
    </div>
  );
}

function ForgotProgressBar({ currentStep, totalSteps }: { currentStep: number; totalSteps: number }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {Array.from({ length: totalSteps }).map((_, i) => (
        <div key={i} className="flex-1 h-1 rounded-full overflow-hidden bg-muted">
          <div
            className={`h-full transition-all duration-500 ease-out ${
              i < currentStep ? 'bg-primary' : 'bg-transparent'
            }`}
          />
        </div>
      ))}
    </div>
  );
}

export function LoginPage() {
  const { setAll } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [sessionToken, setSessionToken] = useState('');
  const [mfaMethods, setMfaMethods] = useState<string[]>([]);
  const [selectedMethod, setSelectedMethod] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Forgot password state
  const [forgotSessionToken, setForgotSessionToken] = useState('');
  const [forgotMethods, setForgotMethods] = useState<string[]>([]);
  const [forgotNextMethod, setForgotNextMethod] = useState('');
  const [forgotPhase, setForgotPhase] = useState<'first' | 'second'>('first');
  const [forgotResetToken, setForgotResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => { emailRef.current?.focus(); }, []);

  const resetAuthState = () => {
    setSessionToken('');
    setMfaMethods([]);
    setSelectedMethod('');
    setOtp('');
  };

  const resetForgotState = () => {
    setForgotSessionToken('');
    setForgotMethods([]);
    setForgotNextMethod('');
    setForgotPhase('first');
    setForgotResetToken('');
    setNewPassword('');
    setConfirmPassword('');
    setShowPassword(false);
  };

  const goTo = (s: Step) => {
    setError('');
    setMessage('');
    setStep(s);
  };

  const handlePasswordLogin = async () => {
    if (!email.trim() || !password) return;
    setError('');
    setSubmitting(true);
    try {
      const res: LoginResponse = await api.login(email.trim(), password);
      if (res.token && res.role) {
        setAll(res.token, res.role, email.trim());
        navigate('/dashboard');
        return;
      }
      if (res.session_token && res.mfa_methods.length > 0) {
        setSessionToken(res.session_token);
        setMfaMethods(res.mfa_methods);
        setStep('mfa-picker');
      }
    } catch (e: any) {
      setError(e.message || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelectMfaMethod = async (method: string) => {
    setError('');
    setSelectedMethod(method);
    setSubmitting(true);

    if (method === 'authenticator') {
      setMessage('Open your authenticator app and enter the code');
      setSubmitting(false);
      setStep('mfa-code');
      return;
    }

    try {
      const res = await api.mfaChallenge(sessionToken, method);
      setSessionToken(res.session_token);
      setMessage(res.message);
      setStep('mfa-code');
    } catch (e: any) {
      setError(e.message || 'Failed to send code');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyMfa = async () => {
    if (!otp.trim()) return;
    setError('');
    setSubmitting(true);
    try {
      const res = await api.mfaVerify(sessionToken, selectedMethod, otp.trim());
      setAll(res.token, res.role, email.trim());
      navigate('/dashboard');
    } catch (e: any) {
      setError(e.message || 'Invalid code');
      setSubmitting(false);
    }
  };

  // ─── Forgot Password handlers ──────────────────────────────────────────

  const handleForgotInit = async () => {
    if (!email.trim()) return;
    setError('');
    setSubmitting(true);
    try {
      const res = await api.forgotPasswordInit(email.trim());
      setForgotSessionToken(res.session_token);
      setForgotMethods(res.mfa_methods);
      setForgotNextMethod(res.next_method);
      setForgotPhase('first');
      setOtp('');
      setStep('forgot-explain');
    } catch (e: any) {
      setError(e.message || 'Failed to start password reset');
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotStartVerify = () => {
    setError('');
    setMessage('');
    setOtp('');
    setStep('forgot-verify');
  };

  const handleForgotVerify = async () => {
    if (!otp.trim()) return;
    setError('');
    setSubmitting(true);
    try {
      const res = await api.forgotPasswordVerify(forgotSessionToken, forgotNextMethod, otp.trim());

      if (res.phase === 'second' && res.session_token) {
        setForgotSessionToken(res.session_token);
        setForgotNextMethod(res.next_method || '');
        setForgotPhase('second');
        setOtp('');
        setMessage(res.message);
        setSubmitting(false);
        setStep('forgot-transition');
      } else if (res.phase === 'done' && res.reset_token) {
        setForgotResetToken(res.reset_token);
        setStep('forgot-reset');
        setSubmitting(false);
      }
    } catch (e: any) {
      setError(e.message || 'Invalid code');
      setSubmitting(false);
    }
  };

  const handleForgotContinueToSecondVerify = () => {
    setError('');
    setMessage('');
    setOtp('');
    setStep('forgot-verify');
  };

  const handleForgotReset = async () => {
    if (!newPassword || !confirmPassword) return;
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const res = await api.forgotPasswordReset(forgotResetToken, newPassword);
      setMessage(res.message);
      setStep('forgot-success');
    } catch (e: any) {
      setError(e.message || 'Failed to reset password');
    } finally {
      setSubmitting(false);
    }
  };

  const isForgotFlow = step.startsWith('forgot-');

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-white">
      {/* Background layer */}
      <img
        src="https://mediportfertilityservices.com/_nuxt/slider-1.FULWOga4.jpg"
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-green-900/95 via-green-800/92 to-green-800/90" />

      {/* Content */}
      <div className="relative w-full max-w-[416px] animate-in fade-in duration-700 ease-out">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex size-13 items-center justify-center rounded-2xl bg-white/15 shadow-lg shadow-black/5 ring-1 ring-white/20 mb-4">
            <HugeiconsIcon icon={Hospital01Icon} className="size-6 text-emerald-300" />
          </div>
          <h1 className="text-[22px] font-bold leading-none text-white tracking-tight">Staff Dashboard</h1>
          <p className="text-sm text-white/[0.55] mt-2 font-medium">Sign in to manage your clinic</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl shadow-black/15 ring-1 ring-black/[0.04]">
          {/* Header with step indicator */}
          <div className="px-8 pt-7 pb-0">
            <div className="flex items-center justify-between mb-5">
              <span className="text-xs font-semibold text-muted-foreground tracking-wider uppercase">{STEP_LABELS[step]}</span>
              {!isForgotFlow && (
                <div className="flex items-center gap-1">
                  {(['password', 'mfa-picker', 'mfa-code'] as Step[]).map((s, i) => (
                    <div key={s} className="flex items-center gap-1">
                      <div className={`rounded-full transition-all duration-300 ${
                        step === s
                          ? 'size-2 bg-primary'
                          : i < ['password', 'mfa-picker', 'mfa-code'].indexOf(step)
                            ? 'size-2 bg-primary/30'
                            : 'size-1.5 bg-muted-foreground/15'
                      }`} />
                      {i < 2 && (
                        <div className={`w-3 h-px transition-colors duration-300 ${
                          ['password', 'mfa-picker', 'mfa-code'].indexOf(step) > i ? 'bg-primary/20' : 'bg-muted-foreground/10'
                        }`} />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Body */}
          <div className="px-8 pb-8">
            {/* Error / Success */}
            {error && (
              <div className="flex items-start gap-2.5 text-sm text-destructive bg-destructive/5 px-3.5 py-2.5 rounded-xl mb-5 ring-1 ring-destructive/10 animate-in fade-in slide-in-from-top-1 duration-200">
                <HugeiconsIcon icon={AlertCircleIcon} className="size-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
            {message && step !== 'forgot-success' && !isForgotFlow && (
              <div className="flex items-start gap-2.5 text-sm text-emerald-700 bg-emerald-50 px-3.5 py-2.5 rounded-xl mb-5 ring-1 ring-emerald-200/60 animate-in fade-in slide-in-from-top-1 duration-200">
                <HugeiconsIcon icon={AlertCircleIcon} className="size-4 shrink-0 mt-0.5 text-emerald-500" />
                <span>{message}</span>
              </div>
            )}

            {/* Step: Password */}
            {step === 'password' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-1 duration-300">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-muted-foreground tracking-wider uppercase">Email</label>
                  <div className="relative">
                    <input
                      ref={emailRef}
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      className="w-full h-11 rounded-xl border border-input bg-background/50 pl-3.5 pr-3.5 text-sm shadow-xs outline-none transition-all duration-200 focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/10 focus-visible:bg-background placeholder:text-muted-foreground/40"
                      onKeyDown={(e) => e.key === 'Enter' && document.getElementById('login-password')?.focus()}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold text-muted-foreground tracking-wider uppercase">Password</label>
                  </div>
                  <div className="relative">
                    <input
                      id="login-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full h-11 rounded-xl border border-input bg-background/50 pl-3.5 pr-3.5 text-sm shadow-xs outline-none transition-all duration-200 focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/10 focus-visible:bg-background placeholder:text-muted-foreground/40"
                      onKeyDown={(e) => e.key === 'Enter' && handlePasswordLogin()}
                    />
                  </div>
                </div>
                <button
                  onClick={handlePasswordLogin}
                  disabled={!email.trim() || !password || submitting}
                  className="w-full h-11 rounded-xl bg-gradient-to-b from-primary to-primary/90 text-primary-foreground text-sm font-semibold shadow-[0_1px_8px_rgba(0,0,0,0.08)] hover:shadow-[0_2px_12px_rgba(0,0,0,0.12)] hover:brightness-110 disabled:opacity-40 disabled:pointer-events-none transition-all duration-200 active:scale-[0.98] mt-1"
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2.5">
                      <HugeiconsIcon icon={Loading02Icon} className="size-4 animate-spin" />
                      <span>Signing in…</span>
                    </span>
                  ) : (
                    <span className="tracking-wide">Sign In</span>
                  )}
                </button>
                <button
                  onClick={() => { goTo('forgot-email'); setError(''); setMessage(''); }}
                  className="w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors pt-0.5"
                >
                  Forgot your password?
                </button>
              </div>
            )}

            {/* Step: MFA Picker */}
            {step === 'mfa-picker' && (
              <div className="space-y-2 animate-in fade-in slide-in-from-right-1 duration-300">
                <div className="text-center space-y-2 mb-4">
                  <div className="inline-flex size-12 items-center justify-center rounded-xl bg-primary/8 text-primary">
                    <HugeiconsIcon icon={ShieldKeyIcon} className="size-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Choose a verification method</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Select how you'd like to receive your verification code</p>
                  </div>
                </div>
                {mfaMethods.map((method) => {
                  const m = MFA_OPTIONS[method];
                  if (!m) return null;
                  const selected = selectedMethod === method;
                  return (
                    <button
                      key={method}
                      onClick={() => handleSelectMfaMethod(method)}
                      disabled={submitting}
                      className={`w-full flex items-center gap-3.5 p-3.5 rounded-xl border-2 text-left transition-all duration-200 group min-h-[56px] ${
                        selected
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-muted bg-muted/15 hover:border-muted-foreground/20 hover:bg-muted/30'
                      } ${submitting ? 'pointer-events-none opacity-60' : 'active:scale-[0.99]'}`}
                    >
                      <div className={`size-11 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                        selected ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted-foreground/10 text-primary group-hover:bg-muted-foreground/15'
                      }`}>
                        <HugeiconsIcon icon={m.icon} className="size-5" />
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <p className={`text-sm font-semibold ${selected ? 'text-foreground' : 'text-foreground'}`}>{m.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{m.description}</p>
                      </div>
                    </button>
                  );
                })}
                <div className="flex items-center justify-between pt-4">
                  <button
                    onClick={() => { goTo('password'); resetAuthState(); }}
                    className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <HugeiconsIcon icon={ArrowLeft01Icon} className="size-3.5" />
                    Back
                  </button>
                  <button
                    onClick={() => { goTo('forgot-email'); resetAuthState(); }}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
              </div>
            )}

            {/* Step: MFA Code */}
            {step === 'mfa-code' && (
              <div className="space-y-5 animate-in fade-in slide-in-from-right-1 duration-300">
                <div className="text-center space-y-3">
                  <div className={`inline-flex size-12 items-center justify-center rounded-xl ${
                    selectedMethod === 'authenticator' ? 'bg-amber-50 text-amber-600' : 'bg-primary/8 text-primary'
                  }`}>
                    <HugeiconsIcon icon={MFA_OPTIONS[selectedMethod]?.icon || Mail01Icon} className="size-5" />
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed max-w-[260px] mx-auto">
                    {selectedMethod === 'authenticator'
                      ? 'Enter the 6-digit code from your authenticator app'
                      : `Enter the 6-digit code sent to ${selectedMethod === 'email' ? 'your email' : 'your phone'}`
                    }
                  </p>
                </div>

                <OtpDigitInput
                  value={otp}
                  onChange={setOtp}
                  onComplete={handleVerifyMfa}
                />

                <button
                  onClick={handleVerifyMfa}
                  disabled={otp.length < 4 || submitting}
                  className="w-full h-11 rounded-xl bg-gradient-to-b from-primary to-primary/90 text-primary-foreground text-sm font-semibold shadow-[0_1px_8px_rgba(0,0,0,0.08)] hover:shadow-[0_2px_12px_rgba(0,0,0,0.12)] hover:brightness-110 disabled:opacity-40 disabled:pointer-events-none transition-all duration-200 active:scale-[0.98]"
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2.5">
                      <HugeiconsIcon icon={Loading02Icon} className="size-4 animate-spin" />
                      <span>Verifying…</span>
                    </span>
                  ) : (
                    <span className="tracking-wide">Verify Code</span>
                  )}
                </button>

                <button
                  onClick={() => { goTo('mfa-picker'); setOtp(''); setMessage(''); }}
                  className="w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <HugeiconsIcon icon={ArrowLeft01Icon} className="size-3.5" />
                  Use a different method
                </button>
              </div>
            )}

            {/* Step: Forgot Email */}
            {step === 'forgot-email' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-1 duration-300">
                <div className="text-center space-y-2 mb-1">
                  <div className="inline-flex size-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600 mb-1">
                    <HugeiconsIcon icon={Key01Icon} className="size-5" />
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Enter your email to reset your password. You'll need to verify your identity using two different methods.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-muted-foreground tracking-wider uppercase">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="w-full h-11 rounded-xl border border-input bg-background/50 pl-3.5 pr-3.5 text-sm shadow-xs outline-none transition-all duration-200 focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/10 focus-visible:bg-background placeholder:text-muted-foreground/40"
                    onKeyDown={(e) => e.key === 'Enter' && handleForgotInit()}
                  />
                </div>
                <button
                  onClick={handleForgotInit}
                  disabled={!email.trim() || submitting}
                  className="w-full h-11 rounded-xl bg-gradient-to-b from-primary to-primary/90 text-primary-foreground text-sm font-semibold shadow-[0_1px_8px_rgba(0,0,0,0.08)] hover:shadow-[0_2px_12px_rgba(0,0,0,0.12)] hover:brightness-110 disabled:opacity-40 disabled:pointer-events-none transition-all duration-200 active:scale-[0.98]"
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2.5">
                      <HugeiconsIcon icon={Loading02Icon} className="size-4 animate-spin" />
                      <span>Checking…</span>
                    </span>
                  ) : (
                    <span className="tracking-wide">Continue</span>
                  )}
                </button>
                <button
                  onClick={() => { goTo('password'); resetForgotState(); }}
                  className="w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <HugeiconsIcon icon={ArrowLeft01Icon} className="size-3.5" />
                  Back to sign in
                </button>
              </div>
            )}

            {/* Step: Forgot Explain */}
            {step === 'forgot-explain' && (
              <div className="space-y-5 animate-in fade-in slide-in-from-right-1 duration-300">
                <ForgotProgressBar currentStep={1} totalSteps={4} />

                <div className="text-center space-y-3">
                  <div className="inline-flex size-12 items-center justify-center rounded-xl bg-primary/8 text-primary">
                    <HugeiconsIcon icon={ShieldKeyIcon} className="size-5" />
                  </div>
                  <div>
                    <p className="text-base font-bold text-foreground">Verify Your Identity</p>
                    <p className="text-sm text-muted-foreground leading-relaxed mt-1 max-w-[280px] mx-auto">
                      For your security, we need to confirm it's really you before resetting your password.
                    </p>
                  </div>
                </div>

                <div className="bg-muted/30 rounded-xl p-4 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground tracking-wider uppercase">How it works</p>
                  <div className="space-y-2.5">
                    <div className="flex items-start gap-3">
                      <div className="size-6 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-xs font-bold">1</div>
                      <p className="text-sm text-foreground leading-relaxed">We'll send a verification code to your first method</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="size-6 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-xs font-bold">2</div>
                      <p className="text-sm text-foreground leading-relaxed">Then we'll verify with a second, different method</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="size-6 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-xs font-bold">3</div>
                      <p className="text-sm text-foreground leading-relaxed">Once both are confirmed, you can set a new password</p>
                    </div>
                  </div>
                </div>

                <div className="bg-amber-50 rounded-xl p-3.5 ring-1 ring-amber-200/60">
                  <div className="flex items-start gap-2.5">
                    <HugeiconsIcon icon={InformationCircleIcon} className="size-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800 leading-relaxed">
                      You have <strong>{forgotMethods.length} verification methods</strong> available:{' '}
                      {forgotMethods.map((m, i) => (
                        <span key={m}>
                          {MFA_METHOD_LABELS[m] || m}
                          {i < forgotMethods.length - 1 ? ', ' : ''}
                        </span>
                      ))}
                      . We'll use <strong>{MFA_METHOD_LABELS[forgotNextMethod] || forgotNextMethod}</strong> first.
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleForgotStartVerify}
                  disabled={submitting}
                  className="w-full h-11 rounded-xl bg-gradient-to-b from-primary to-primary/90 text-primary-foreground text-sm font-semibold shadow-[0_1px_8px_rgba(0,0,0,0.08)] hover:shadow-[0_2px_12px_rgba(0,0,0,0.12)] hover:brightness-110 disabled:opacity-40 disabled:pointer-events-none transition-all duration-200 active:scale-[0.98]"
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2.5">
                      <HugeiconsIcon icon={Loading02Icon} className="size-4 animate-spin" />
                      <span>Sending code…</span>
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2 tracking-wide">
                      <span>Start Verification</span>
                      <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
                    </span>
                  )}
                </button>

                <button
                  onClick={() => { goTo('forgot-email'); setError(''); }}
                  className="w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <HugeiconsIcon icon={ArrowLeft01Icon} className="size-3.5" />
                  Back
                </button>
              </div>
            )}

            {/* Step: Forgot Verify */}
            {step === 'forgot-verify' && (
              <div className="space-y-5 animate-in fade-in slide-in-from-right-1 duration-300">
                <ForgotProgressBar currentStep={forgotPhase === 'first' ? 2 : 3} totalSteps={4} />

                <div className="text-center space-y-3">
                  <div className="inline-flex size-12 items-center justify-center rounded-xl bg-primary/8 text-primary">
                    <HugeiconsIcon icon={MFA_OPTIONS[forgotNextMethod]?.icon || Mail01Icon} className="size-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground tracking-wider uppercase mb-1">
                      Verification {forgotPhase === 'first' ? '1' : '2'} of 2
                    </p>
                    <p className="text-sm font-medium text-foreground">
                      {MFA_METHOD_LABELS[forgotNextMethod] || forgotNextMethod}
                    </p>
                    <p className="text-sm text-muted-foreground leading-relaxed max-w-[260px] mx-auto mt-1">
                      {forgotNextMethod === 'authenticator'
                        ? 'Open your authenticator app and enter the current 6-digit code'
                        : forgotNextMethod === 'email'
                          ? `Enter the 6-digit code we sent to ${email}`
                          : `Enter the 6-digit code sent to your phone`
                      }
                    </p>
                  </div>
                </div>

                {message && (
                  <div className="flex items-start gap-2.5 text-sm text-emerald-700 bg-emerald-50 px-3.5 py-2.5 rounded-xl ring-1 ring-emerald-200/60 animate-in fade-in slide-in-from-top-1 duration-200">
                    <HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-4 shrink-0 mt-0.5 text-emerald-500" />
                    <span>{message}</span>
                  </div>
                )}

                <OtpDigitInput
                  value={otp}
                  onChange={setOtp}
                  onComplete={handleForgotVerify}
                />

                <button
                  onClick={handleForgotVerify}
                  disabled={otp.length < 4 || submitting}
                  className="w-full h-11 rounded-xl bg-gradient-to-b from-primary to-primary/90 text-primary-foreground text-sm font-semibold shadow-[0_1px_8px_rgba(0,0,0,0.08)] hover:shadow-[0_2px_12px_rgba(0,0,0,0.12)] hover:brightness-110 disabled:opacity-40 disabled:pointer-events-none transition-all duration-200 active:scale-[0.98]"
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2.5">
                      <HugeiconsIcon icon={Loading02Icon} className="size-4 animate-spin" />
                      <span>Verifying…</span>
                    </span>
                  ) : (
                    <span className="tracking-wide">
                      {forgotPhase === 'first' ? 'Continue to Next Step' : 'Complete Verification'}
                    </span>
                  )}
                </button>

                <div className="flex items-center justify-between">
                  <button
                    onClick={() => {
                      if (forgotPhase === 'first') {
                        goTo('forgot-explain');
                        setOtp('');
                        setMessage('');
                      } else {
                        goTo('forgot-transition');
                        setOtp('');
                        setMessage('');
                      }
                    }}
                    className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <HugeiconsIcon icon={ArrowLeft01Icon} className="size-3.5" />
                    Back
                  </button>
                  {forgotNextMethod !== 'authenticator' && (
                    <button
                      onClick={async () => {
                        setOtp('');
                        setMessage('');
                        setSubmitting(true);
                        try {
                          if (forgotPhase === 'first') {
                            const res = await api.forgotPasswordInit(email.trim());
                            setForgotSessionToken(res.session_token);
                            setMessage(res.message || 'Code resent');
                          }
                        } catch (e: any) {
                          setError(e.message || 'Failed to resend code');
                        } finally {
                          setSubmitting(false);
                        }
                      }}
                      className="text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                    >
                      Resend code
                    </button>
                  )}
                </div>

                {forgotPhase === 'first' && (
                  <div className="bg-muted/20 rounded-lg p-3 text-center">
                    <p className="text-xs text-muted-foreground">
                      After this step, you'll verify with <strong>{forgotMethods.filter(m => m !== forgotNextMethod)[0] ? MFA_METHOD_LABELS[forgotMethods.filter(m => m !== forgotNextMethod)[0]] : 'another method'}</strong>
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Step: Forgot Transition */}
            {step === 'forgot-transition' && (
              <div className="space-y-5 animate-in fade-in slide-in-from-right-1 duration-300">
                <ForgotProgressBar currentStep={2} totalSteps={4} />

                <div className="text-center space-y-3">
                  <div className="inline-flex size-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200/60">
                    <HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-6" />
                  </div>
                  <div>
                    <p className="text-base font-bold text-foreground">First Verification Complete</p>
                    <p className="text-sm text-muted-foreground leading-relaxed mt-1 max-w-[280px] mx-auto">
                      Great progress! Now we need to verify your identity with a second method.
                    </p>
                  </div>
                </div>

                <div className="bg-primary/5 rounded-xl p-4 space-y-3 ring-1 ring-primary/10">
                  <p className="text-xs font-semibold text-primary tracking-wider uppercase">Next Step</p>
                  <div className="flex items-start gap-3">
                    <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <HugeiconsIcon icon={MFA_OPTIONS[forgotNextMethod]?.icon || Mail01Icon} className="size-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {MFA_METHOD_LABELS[forgotNextMethod] || forgotNextMethod}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {forgotNextMethod === 'authenticator'
                          ? 'Open your authenticator app and enter the current code'
                          : forgotNextMethod === 'email'
                            ? `We'll send a code to ${email}`
                            : `We'll send a code to your phone number`
                        }
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground leading-relaxed text-center">
                    This two-step verification ensures only you can reset your password, even if someone has access to one of your verification methods.
                  </p>
                </div>

                <button
                  onClick={handleForgotContinueToSecondVerify}
                  className="w-full h-11 rounded-xl bg-gradient-to-b from-primary to-primary/90 text-primary-foreground text-sm font-semibold shadow-[0_1px_8px_rgba(0,0,0,0.08)] hover:shadow-[0_2px_12px_rgba(0,0,0,0.12)] hover:brightness-110 transition-all duration-200 active:scale-[0.98]"
                >
                  <span className="flex items-center justify-center gap-2 tracking-wide">
                    <span>Continue to Second Verification</span>
                    <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
                  </span>
                </button>

                <button
                  onClick={() => { goTo('password'); resetForgotState(); }}
                  className="w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel and return to sign in
                </button>
              </div>
            )}

            {/* Step: Forgot Reset */}
            {step === 'forgot-reset' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-1 duration-300">
                <ForgotProgressBar currentStep={4} totalSteps={4} />

                <div className="text-center space-y-2 mb-1">
                  <div className="inline-flex size-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200/60 mb-1">
                    <HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-5" />
                  </div>
                  <p className="text-sm font-medium text-foreground">Identity Verified</p>
                  <p className="text-xs text-muted-foreground">Choose a strong new password for your account</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-muted-foreground tracking-wider uppercase">New Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      className="w-full h-11 rounded-xl border border-input bg-background/50 pl-3.5 pr-10 text-sm shadow-xs outline-none transition-all duration-200 focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/10 focus-visible:bg-background placeholder:text-muted-foreground/40"
                      onKeyDown={(e) => e.key === 'Enter' && document.getElementById('reset-confirm-password')?.focus()}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <HugeiconsIcon icon={showPassword ? ViewIcon : ViewOffIcon} className="size-4" />
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-muted-foreground tracking-wider uppercase">Confirm Password</label>
                  <input
                    id="reset-confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="w-full h-11 rounded-xl border border-input bg-background/50 pl-3.5 pr-3.5 text-sm shadow-xs outline-none transition-all duration-200 focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/10 focus-visible:bg-background placeholder:text-muted-foreground/40"
                    onKeyDown={(e) => e.key === 'Enter' && handleForgotReset()}
                  />
                </div>

                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Password must be at least 8 characters. Use a mix of letters, numbers, and symbols for better security.
                  </p>
                </div>

                <button
                  onClick={handleForgotReset}
                  disabled={!newPassword || !confirmPassword || submitting}
                  className="w-full h-11 rounded-xl bg-gradient-to-b from-primary to-primary/90 text-primary-foreground text-sm font-semibold shadow-[0_1px_8px_rgba(0,0,0,0.08)] hover:shadow-[0_2px_12px_rgba(0,0,0,0.12)] hover:brightness-110 disabled:opacity-40 disabled:pointer-events-none transition-all duration-200 active:scale-[0.98]"
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2.5">
                      <HugeiconsIcon icon={Loading02Icon} className="size-4 animate-spin" />
                      <span>Resetting…</span>
                    </span>
                  ) : (
                    <span className="tracking-wide">Reset Password</span>
                  )}
                </button>
              </div>
            )}

            {/* Step: Forgot Success */}
            {step === 'forgot-success' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-1 duration-300 text-center">
                <div className="inline-flex size-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200/60">
                  <HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-7" />
                </div>
                <div className="space-y-1">
                  <p className="text-base font-bold text-foreground">Password Reset</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Your password has been successfully reset. You can now sign in with your new password.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setEmail('');
                    setPassword('');
                    setOtp('');
                    setMessage('');
                    setError('');
                    resetAuthState();
                    resetForgotState();
                    goTo('password');
                  }}
                  className="w-full h-11 rounded-xl bg-gradient-to-b from-primary to-primary/90 text-primary-foreground text-sm font-semibold shadow-[0_1px_8px_rgba(0,0,0,0.08)] hover:shadow-[0_2px_12px_rgba(0,0,0,0.12)] hover:brightness-110 transition-all duration-200 active:scale-[0.98]"
                >
                  <span className="tracking-wide">Sign In</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
