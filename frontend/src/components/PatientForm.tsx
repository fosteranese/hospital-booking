import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { HugeiconsIcon } from '@hugeicons/react';
import { CallIcon } from '@hugeicons/core-free-icons';
import { COUNTRY_CODES } from '@/lib/country-codes';
import { api } from '@/lib/api';

interface PatientFormProps {
  defaultFirstName: string;
  defaultLastName: string;
  defaultPhone: string;
  defaultEmail: string;
  otpIdentifier?: string;
  onComplete: (firstName: string, lastName: string, phone: string, email: string) => void;
}

export function PatientForm({ defaultFirstName, defaultLastName, defaultPhone, defaultEmail, otpIdentifier, onComplete }: PatientFormProps) {
  const [firstName, setFirstName] = useState(defaultFirstName);
  const [lastName, setLastName] = useState(defaultLastName);
  const [countryCode, setCountryCode] = useState('+233');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState(defaultEmail);
  const [emailError, setEmailError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [checkingPhone, setCheckingPhone] = useState(false);
  const emailTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const phoneTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const usedEmail = otpIdentifier?.includes('@') ?? false;
  const usedPhone = otpIdentifier ? !otpIdentifier.includes('@') : false;

  useEffect(() => {
    setFirstName(defaultFirstName);
    setLastName(defaultLastName);
    setEmail(defaultEmail);
    if (defaultPhone) {
      const match = COUNTRY_CODES.find((c) => defaultPhone.startsWith(c.code));
      if (match) {
        setCountryCode(match.code);
        setPhoneNumber(defaultPhone.slice(match.code.length));
      } else {
        setPhoneNumber(defaultPhone);
      }
    }
  }, [defaultFirstName, defaultLastName, defaultPhone, defaultEmail]);

  useEffect(() => {
    if (usedEmail || !email) { setEmailError(''); return; }
    clearTimeout(emailTimer.current);
    emailTimer.current = setTimeout(() => {
      setCheckingEmail(true);
      api.checkPatientExists({ email: email.trim().toLowerCase() })
        .then((res) => setEmailError(res.email_taken ? 'This email is already registered' : ''))
        .catch(() => {})
        .finally(() => setCheckingEmail(false));
    }, 500);
    return () => clearTimeout(emailTimer.current);
  }, [email, usedEmail]);

  useEffect(() => {
    if (usedPhone || !phoneNumber) { setPhoneError(''); return; }
    const phone = `${countryCode}${phoneNumber.replace(/\D/g, '')}`;
    clearTimeout(phoneTimer.current);
    phoneTimer.current = setTimeout(() => {
      setCheckingPhone(true);
      api.checkPatientExists({ phone })
        .then((res) => setPhoneError(res.phone_taken ? 'This phone number is already registered' : ''))
        .catch(() => {})
        .finally(() => setCheckingPhone(false));
    }, 500);
    return () => clearTimeout(phoneTimer.current);
  }, [phoneNumber, countryCode, usedPhone]);

  const phone = phoneNumber ? `${countryCode}${phoneNumber.replace(/\D/g, '')}` : '';
  const allFilled = firstName && lastName;
  const hasError = (!!email && !!emailError) || (!!phone && !!phoneError);

  const handleSubmit = () => {
    if (!allFilled || hasError) return;
    onComplete(firstName, lastName, phone, email);
  };

  return (
    <Card className="w-full mx-auto bg-transparent ring-0 shadow-none overflow-visible">
      <CardHeader className="px-0">
        <CardTitle className="text-foreground">Tell us about yourself</CardTitle>
        <CardDescription>We just need a few details to get started</CardDescription>
      </CardHeader>
      <CardContent className="px-0 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="firstName">First Name</Label>
            <Input id="firstName" inputSize="xl" placeholder="John" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="bg-white data-[size=xl]:pl-4" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">Last Name</Label>
            <Input id="lastName" inputSize="xl" placeholder="Doe" value={lastName} onChange={(e) => setLastName(e.target.value)} className="bg-white data-[size=xl]:pl-4" />
          </div>
        </div>
        {!usedPhone && (
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <div className={`flex border rounded-lg overflow-hidden bg-white focus-within:ring-3 focus-within:ring-ring/50 focus-within:border-ring ${phoneError ? 'border-destructive' : 'border-input'}`}>
            <Select value={countryCode} onValueChange={(v) => v && setCountryCode(v)}>
              <SelectTrigger size="xl" className="w-[120px] shrink-0 border-0 rounded-none shadow-none bg-white pl-3">
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
            <div className="shrink-0 self-stretch flex flex-col w-px">
              <div className="w-px h-[10px] bg-transparent" />
              <div className="w-px bg-border flex-1" />
              <div className="w-px h-[10px] bg-transparent" />
            </div>
            <div className="flex-1">
              <Input
                id="phone"
                type="tel"
                inputSize="xl"
                placeholder="Phone number"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value.replace(/[^\d\s\-()]/g, ''))}
                className="border-0 rounded-none shadow-none bg-white data-[size=xl]:pl-4"
              />
            </div>
          </div>
          {phoneError && <p className="text-xs text-destructive">{checkingPhone ? 'Checking...' : phoneError}</p>}
        </div>
        )}
        {!usedEmail && (
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            inputSize="xl"
            placeholder="john@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`bg-white data-[size=xl]:pl-4 ${emailError ? 'border-destructive focus-visible:ring-destructive/30' : ''}`}
          />
          {emailError && <p className="text-xs text-destructive">{checkingEmail ? 'Checking...' : emailError}</p>}
        </div>
        )}
        <Button className="w-full h-11 text-base shadow-xs" onClick={handleSubmit} disabled={!allFilled || hasError}>
          Continue
        </Button>
      </CardContent>
    </Card>
  );
}