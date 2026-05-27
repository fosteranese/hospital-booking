import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon, CheckmarkCircle02Icon } from '@hugeicons/core-free-icons';
import { ErrorMessage } from '@/components/ui/error-message';
import { COUNTRY_CODES } from '@/lib/country-codes';
import { api, Patient } from '@/lib/api';

interface EditProfileModalProps {
  patient: Patient;
  token: string;
  onClose: () => void;
  onSaved: (updated: Patient) => void;
}

export function EditProfileModal({ patient, token, onClose, onSaved }: EditProfileModalProps) {
  const [firstName, setFirstName] = useState(patient.first_name);
  const [lastName, setLastName] = useState(patient.last_name);
  const [email, setEmail] = useState(patient.email);
  const [countryCode, setCountryCode] = useState(() => {
    const match = COUNTRY_CODES.find((c) => patient.phone.startsWith(c.code));
    return match ? match.code : '+233';
  });
  const [phoneNumber, setPhoneNumber] = useState(() => {
    const match = COUNTRY_CODES.find((c) => patient.phone.startsWith(c.code));
    return match ? patient.phone.slice(match.code.length) : patient.phone;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      setError('First and last name are required');
      return;
    }
    setSaving(true);
    setError('');
    const phone = phoneNumber ? `${countryCode}${phoneNumber.replace(/\D/g, '')}` : '';
    try {
      const updated = await api.updatePatient(patient.id, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone,
        email: email.trim(),
      }, token);
      onSaved(updated);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/10 backdrop-blur-xs p-0 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="relative w-full max-w-md bg-white rounded-2xl flex flex-col overflow-hidden max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between bg-white px-5 pt-4 pb-3 border-b border-foreground/5 shrink-0">
          <p className="text-sm font-semibold text-foreground">Edit profile</p>
          <button
            type="button"
            onClick={onClose}
            className="size-7 flex items-center justify-center rounded-full hover:bg-muted/60 transition-colors"
          >
            <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="size-4 text-muted-foreground" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-first-name">First name</Label>
              <Input
                id="edit-first-name"
                inputSize="xl"
                placeholder="First name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="bg-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-last-name">Last name</Label>
              <Input
                id="edit-last-name"
                inputSize="xl"
                placeholder="Last name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="bg-white"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-email">Email</Label>
            <Input
              id="edit-email"
              type="email"
              inputSize="xl"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-white"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-phone">Phone</Label>
            <div className="flex border rounded-lg overflow-hidden bg-white focus-within:ring-3 focus-within:ring-ring/50 focus-within:border-ring border-input">
              <Select value={countryCode} onValueChange={(v) => v && setCountryCode(v)}>
                <SelectTrigger size="xl" className="w-[120px] shrink-0 border-0 rounded-none shadow-none bg-white pl-3">
                  <SelectValue>
                    {(() => {
                      const c = COUNTRY_CODES.find((cc) => cc.code === countryCode);
                      return c ? <> <span>{c.flag}</span> <span className="ps-2">{c.code} </span> </> : null;
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
                  id="edit-phone"
                  type="tel"
                  inputSize="xl"
                  placeholder="Phone number"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value.replace(/[^\d\s\-()]/g, ''))}
                  className="border-0 rounded-none shadow-none bg-white"
                />
              </div>
            </div>
          </div>

          {error && <ErrorMessage message={error} />}
        </div>

        <div className="sticky bottom-0 flex items-center gap-2 bg-white px-5 py-4 border-t border-foreground/5">
          <Button variant="outline" className="flex-1 h-10 text-sm" onClick={onClose}>
            Cancel
          </Button>
          <Button className="flex-1 h-10 text-sm gap-1.5" onClick={handleSave} disabled={saving}>
            <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} className="size-4" />
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
