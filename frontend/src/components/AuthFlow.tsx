import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from '@/components/ui/input-otp';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { HugeiconsIcon } from '@hugeicons/react';
import { Mail01Icon, CallIcon } from '@hugeicons/core-free-icons';

const COUNTRY_CODES = [
  { code: '+61', flag: '🇦🇺', countryCode: 'AU', name: 'Australia' },
  { code: '+55', flag: '🇧🇷', countryCode: 'BR', name: 'Brazil' },
  { code: '+86', flag: '🇨🇳', countryCode: 'CN', name: 'China' },
  { code: '+20', flag: '🇪🇬', countryCode: 'EG', name: 'Egypt' },
  { code: '+33', flag: '🇫🇷', countryCode: 'FR', name: 'France' },
  { code: '+49', flag: '🇩🇪', countryCode: 'DE', name: 'Germany' },
  { code: '+233', flag: '🇬🇭', countryCode: 'GH', name: 'Ghana' },
  { code: '+91', flag: '🇮🇳', countryCode: 'IN', name: 'India' },
  { code: '+39', flag: '🇮🇹', countryCode: 'IT', name: 'Italy' },
  { code: '+81', flag: '🇯🇵', countryCode: 'JP', name: 'Japan' },
  { code: '+31', flag: '🇳🇱', countryCode: 'NL', name: 'Netherlands' },
  { code: '+234', flag: '🇳🇬', countryCode: 'NG', name: 'Nigeria' },
  { code: '+7', flag: '🇷🇺', countryCode: 'RU', name: 'Russia' },
  { code: '+966', flag: '🇸🇦', countryCode: 'SA', name: 'Saudi Arabia' },
  { code: '+27', flag: '🇿🇦', countryCode: 'ZA', name: 'South Africa' },
  { code: '+82', flag: '🇰🇷', countryCode: 'KR', name: 'South Korea' },
  { code: '+34', flag: '🇪🇸', countryCode: 'ES', name: 'Spain' },
  { code: '+46', flag: '🇸🇪', countryCode: 'SE', name: 'Sweden' },
  { code: '+971', flag: '🇦🇪', countryCode: 'AE', name: 'United Arab Emirates' },
  { code: '+44', flag: '🇬🇧', countryCode: 'UK', name: 'United Kingdom' },
  { code: '+1', flag: '🇺🇸', countryCode: 'US', name: 'United States' },
];

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
  const [step, setStep] = useState<'input' | 'otp'>('input');
  const [email, setEmail] = useState('');
  const [countryCode, setCountryCode] = useState('+233');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  function getIdentifier(): string | null {
    const hasEmail = email.trim().length > 0;
    const hasPhone = phoneNumber.trim().length > 0;

    if (!hasEmail && !hasPhone) return null;

    if (hasEmail) {
      if (!EMAIL_RE.test(email.trim())) return null;
      return email.trim().toLowerCase();
    }

    const code = countryCode.trim();
    const number = phoneNumber.trim();
    if (!isValidPhone(code, number)) return null;
    return `${code}${number.replace(/\D/g, '')}`;
  }

  function getFieldError(): string | null {
    const hasEmail = email.trim().length > 0;
    const hasPhone = phoneNumber.trim().length > 0;

    if (!hasEmail && !hasPhone) return 'Enter an email or phone number';

    if (hasEmail && !EMAIL_RE.test(email.trim())) return 'Invalid email format';

    if (hasPhone && !isValidPhone(countryCode, phoneNumber.trim())) return 'Invalid phone number';

    return null;
  }

  const handleRequestOtp = async () => {
    const id = getIdentifier();
    if (!id) {
      setError(getFieldError() || 'Enter an email or phone number');
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

  return (
    <Card className="w-full max-w-lg mx-auto bg-transparent ring-0 shadow-none overflow-visible">
      <CardHeader className="px-0">
        <CardTitle className="text-foreground">Book an Appointment</CardTitle>
        <CardDescription>Enter your email or phone to receive a verification code</CardDescription>
      </CardHeader>
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
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">or</span>
                <div className="flex-1 h-px bg-border" />
              </div>
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
              {error && (
                <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}
              <Button className="w-full h-12 text-base" onClick={handleRequestOtp} disabled={loading || !identifier}>
                {loading ? 'Sending...' : 'Send OTP'}
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="otp"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="space-y-5"
            >
              <div className="rounded-lg bg-primary/5 border border-primary/10 px-4 py-3 text-sm text-muted-foreground text-center">
                Code sent to <span className="font-medium text-foreground">{identifier}</span>
              </div>
              <div className="space-y-3">
                <Label htmlFor="otp" className="text-center block">Verification Code</Label>
                <div className="flex justify-center">
                  <InputOTP
                    id="otp"
                    maxLength={6}
                    inputSize="xl"
                    value={otp}
                    onChange={(value) => setOtp(value)}
                    onComplete={() => handleVerifyOtp()}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                    </InputOTPGroup>
                    <InputOTPSeparator />
                    <InputOTPGroup>
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
              </div>
              {error && (
                <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}
              <Button className="w-full h-12 text-base" onClick={handleVerifyOtp} disabled={loading || otp.length !== 6}>
                {loading ? 'Verifying...' : 'Verify OTP'}
              </Button>
              <div className="flex items-center gap-2">
                <Button variant="ghost" className="flex-1" onClick={() => setStep('input')}>
                  Change email/phone
                </Button>
                <Button
                  variant="ghost"
                  className="flex-1"
                  onClick={handleResendOtp}
                  disabled={resending || cooldown > 0}
                >
                  {resending ? 'Sending...' : cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend OTP'}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
