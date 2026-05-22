import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

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
  const [phone, setPhone] = useState(defaultPhone);
  const [email, setEmail] = useState(defaultEmail);

  useEffect(() => {
    setFirstName(defaultFirstName);
    setLastName(defaultLastName);
    setPhone(defaultPhone);
    setEmail(defaultEmail);
  }, [defaultFirstName, defaultLastName, defaultPhone, defaultEmail]);

  const isEmailReadonly = otpIdentifier?.includes('@') ?? false;
  const isPhoneReadonly = otpIdentifier ? !otpIdentifier.includes('@') : false;

  const allFilled = firstName && lastName && phone && email;

  const handleSubmit = () => {
    if (!allFilled) return;
    onComplete(firstName, lastName, phone, email);
  };

  return (
    <Card className="w-full max-w-lg mx-auto bg-transparent ring-0 shadow-none overflow-visible">
      <CardHeader className="px-0">
        <CardTitle className="text-foreground">Your Details</CardTitle>
        <CardDescription>Enter your personal information</CardDescription>
      </CardHeader>
      <CardContent className="px-0 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="firstName">First Name</Label>
            <Input id="firstName" inputSize="xl" placeholder="John" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="bg-white" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">Last Name</Label>
            <Input id="lastName" inputSize="xl" placeholder="Doe" value={lastName} onChange={(e) => setLastName(e.target.value)} className="bg-white" />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            inputSize="xl"
            placeholder="+1234567890"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            readOnly={isPhoneReadonly}
            className={`bg-white ${isPhoneReadonly ? 'bg-muted cursor-not-allowed' : ''}`}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            inputSize="xl"
            placeholder="john@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            readOnly={isEmailReadonly}
            className={`bg-white ${isEmailReadonly ? 'bg-muted cursor-not-allowed' : ''}`}
          />
        </div>
        <Button className="w-full h-12 text-base" onClick={handleSubmit} disabled={!allFilled}>
          Continue
        </Button>
      </CardContent>
    </Card>
  );
}
