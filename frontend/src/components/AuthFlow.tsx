import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from '@/components/ui/input-otp';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { HugeiconsIcon } from '@hugeicons/react';
import { Mail01Icon, CallIcon, ArrowLeft01Icon } from '@hugeicons/core-free-icons';
import { ErrorMessage } from '@/components/ui/error-message';
import { Spinner } from '@/components/ui/spinner';
import { COUNTRY_CODES } from '@/lib/country-codes';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidPhone(code: string, number: string): boolean {
  const digits = number.replace(/\D/g, '');
  if (!digits) return false;
  const total = code.replace(/\D/g, '') + digits;
  return total.length >= 7 && total.length <= 15;
}

interface AuthFlowProps {
  onVerified: (token: string, identifier: string) => void;
}

export function AuthFlow({ onVerified }: AuthFlowProps) {
  const [method, setMethod] = useState<'phone' | 'email'>('phone');
  const [step, setStep] = useState<'input' | 'otp'>('input');
  const [email, setEmail] = useState('');
  const [countryCode, setCountryCode] = useState('+233');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const otpContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (step !== 'otp') return;
    const el = otpContainerRef.current;
    if (!el) return;
    const timer = setTimeout(() => {
      const input = el.querySelector('input');
      if (input) input.focus();
    }, 250);
    return () => clearTimeout(timer);
  }, [step]);

  function getIdentifier(): string | null {
    if (method === 'email') {
      if (!EMAIL_RE.test(email.trim())) return null;
      return email.trim().toLowerCase();
    }
    const code = countryCode.trim();
    const number = phoneNumber.trim();
    if (!isValidPhone(code, number)) return null;
    return `${code}${number.replace(/\D/g, '')}`;
  }

  function getFieldError(): string | null {
    if (method === 'email') {
      if (!email.trim()) return 'Enter your email address';
      if (!EMAIL_RE.test(email.trim())) return 'Invalid email format';
      return null;
    }
    if (!phoneNumber.trim()) return 'Enter your phone number';
    if (!isValidPhone(countryCode, phoneNumber.trim())) return 'Invalid phone number';
    return null;
  }

  const handleRequestOtp = async () => {
    const id = getIdentifier();
    if (!id) {
      setError(getFieldError() || 'Enter a valid identifier');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.requestOtp(id);
      setStep('otp');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    const id = getIdentifier();
    if (!id) return;
    setResending(true);
    setError('');
    try {
      await api.requestOtp(id);
      setCooldown(30);
      const interval = setInterval(() => {
        setCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    const id = getIdentifier();
    if (!id || otp.length !== 6) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.verifyOtp(id, otp);
      onVerified(res.token, id);
    } catch (err: any) {
      setError(err.message);
      setOtp('');
    } finally {
      setLoading(false);
    }
  };

  const identifier = getIdentifier();

  const switchMethod = () => {
    setMethod(method === 'phone' ? 'email' : 'phone');
    setStep('input');
    setError('');
  };

  return (
    <Card className="w-full max-w-lg mx-auto bg-transparent ring-0 shadow-none overflow-visible">
      <CardContent className="px-0 space-y-5">
        <AnimatePresence mode="wait">
          {step === 'input' ? (
            <motion.div
              key="input"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="space-y-5"
            >
              <CardHeader className="px-0">
                <CardTitle className="text-foreground">Book an Appointment</CardTitle>
                <CardDescription>
                  {method === 'phone'
                    ? 'Enter your phone number to receive a verification code'
                    : 'Enter your email to receive a verification code'}
                </CardDescription>
              </CardHeader>
              {method === 'phone' ? (
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <div className="flex gap-2">
                    <Select value={countryCode} onValueChange={(v) => v && setCountryCode(v)}>
                      <SelectTrigger size="xl" className="w-[160px] shrink-0 bg-white">
                        <SelectValue>
                          {(() => {
                            const c = COUNTRY_CODES.find((c) => c.code === countryCode);
                            return c ? <> <span>{c.flag}</span> <span className="ps-2">{c.code} </span> </>: null;
                          })()}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        <SelectGroup>
                          <SelectLabel>Countries</SelectLabel>
                        {COUNTRY_CODES.map((c) => (
                          <SelectItem key={c.code} value={c.code}>
                            <span className="flex items-center gap-2">
                              <span className="text-base leading-none">{c.flag}</span>
                              <span>{c.name} ({c.code})</span>
                            </span>
                          </SelectItem>
                        ))}</SelectGroup>
                      </SelectContent>
                    </Select>
                    <div className="relative flex-1">
                      <HugeiconsIcon icon={CallIcon} strokeWidth={2} className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                      <Input
                        id="phone"
                        type="tel"
                        inputSize="xl"
                        placeholder="Phone number"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value.replace(/[^\d\s\-()]/g, ''))}
                        className="bg-white"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <HugeiconsIcon icon={Mail01Icon} strokeWidth={2} className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id="email"
                      type="email"
                      inputSize="xl"
                      placeholder="email@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="bg-white"
                    />
                  </div>
                </div>
              )}
              {error && (
                <ErrorMessage message={error} />
              )}
              <Button className="w-full h-12 text-base" onClick={handleRequestOtp} disabled={loading || !identifier}>
                {loading ? 'Sending...' : 'Send OTP'}
              </Button>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">or</span>
                </div>
              </div>
              <Button variant="outline" className="w-full h-12 text-base" onClick={switchMethod}>
                {method === 'phone' ? 'Use email instead' : 'Use phone instead'}
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="otp"
              ref={otpContainerRef}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
              >
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground hover:text-foreground" onClick={() => setStep('input')}>
                  <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} className="size-4 mr-1" />
                  Back
                </Button>
              </div>
              <div className="flex items-start justify-between gap-4 mb-10">
                <div className="space-y-1">
                  <p className="text-base font-medium text-foreground">OTP Verification</p>
                  <p className="text-sm text-muted-foreground">
                    {method === 'phone'
                      ? <>Code sent via SMS to <span className="font-medium text-foreground/90">{countryCode}{phoneNumber}</span></>
                      : <>Code sent via email to <span className="font-medium text-foreground/90">{email}</span></>
                    }
                  </p>
                </div>
                <Button variant="outline" size="sm" className="shrink-0 mt-0.5 bg-white/80" onClick={switchMethod}>
                  {method === 'phone' ? 'Use email' : 'Use phone'}
                </Button>
              </div>

              <div className="space-y-5">
                <Label htmlFor="otp" className="text-center block text-base font-medium">Enter Verification Code</Label>
                <div className="flex justify-center">
                <InputOTP
                  id="otp"
                  maxLength={6}
                  inputSize="xl"
                  value={otp}
                  onChange={(value) => { setError(''); setOtp(value); }}
                  onComplete={() => handleVerifyOtp()}
                  autoFocus
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                  </InputOTPGroup>
                  <InputOTPSeparator />
                  <InputOTPGroup>
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                  </InputOTPGroup>
                  <InputOTPSeparator />
                  <InputOTPGroup>
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
            </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <ErrorMessage message={error} variant="bordered" />
                </motion.div>
              )}

              <div className="text-center text-xs text-muted-foreground">
                {cooldown > 0 ? (
                  <p>Didn't receive the code? <span className="text-foreground/60">Resend in {cooldown}s</span></p>
                ) : (
                  <p>
                    Didn't receive the code?{' '}
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={resending}
                      className="font-medium text-primary underline-offset-2 hover:underline disabled:opacity-40 disabled:no-underline disabled:cursor-default"
                    >
                      {resending ? 'Sending...' : 'Resend'}
                    </button>
                  </p>
                )}
              </div>

              <Button className="w-full h-12 text-base shadow-sm" onClick={handleVerifyOtp} disabled={loading || otp.length !== 6}>
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Spinner />
                    Verifying...
                  </span>
                ) : 'Verify'}
              </Button>


            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
