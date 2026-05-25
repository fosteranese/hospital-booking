import { motion } from 'framer-motion'
import { HugeiconsIcon } from '@hugeicons/react'
import { Hospital01Icon, UserIcon, Doctor01Icon, Calendar01Icon, CheckmarkCircle02Icon, LockIcon } from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'

interface LeftPanelProps {
  step: string;
  wide?: boolean;
}

const displaySteps = [
  { label: 'Sign In', match: ['auth'], icon: LockIcon, subtitle: 'Verify your identity' },
  { label: 'Your Details', match: ['review', 'patient'], icon: UserIcon, subtitle: 'Confirm your information' },
  { label: 'Choose Doctor', match: ['doctor'], icon: Doctor01Icon, subtitle: 'Select your specialist' },
  { label: 'Date & Time', match: ['datetime'], icon: Calendar01Icon, subtitle: 'Pick your preferred time' },
  { label: 'Confirm', match: ['confirm', 'success'], icon: CheckmarkCircle02Icon, subtitle: 'Review and book' },
];

function StepDot({ status, icon: Icon }: { status: 'completed' | 'current' | 'upcoming'; icon: typeof LockIcon }) {
  if (status === 'completed') {
    return (
      <div className="size-10 rounded-full bg-white/25 flex items-center justify-center shrink-0">
        <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} className="size-4 text-white/80" />
      </div>
    );
  }
  if (status === 'current') {
    return (
      <div className="size-12 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-white/10 ring-2 ring-white/30 shrink-0">
        <HugeiconsIcon icon={Icon} strokeWidth={2} className="size-6 text-white" />
      </div>
    );
  }
  return (
    <div className="size-10 rounded-full border-2 border-white/30 flex items-center justify-center shrink-0">
      <HugeiconsIcon icon={Icon} strokeWidth={2} className="size-4 text-white/50" />
    </div>
  );
}

export function LeftPanel({ step, wide = false }: LeftPanelProps) {
  const currentIdx = step === 'success'
    ? displaySteps.length
    : displaySteps.findIndex(s => s.match.includes(step));

  return (
    <aside className={cn("hidden xl:flex relative h-screen overflow-hidden transition-all duration-500 ease-in-out border-r border-white/5", wide ? "w-[40%]" : "w-[30%]")}>
      <img
        src="https://mediportfertilityservices.com/_nuxt/slider-1.FULWOga4.jpg"
        alt="Mediport Fertility Clinic"
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-green-900/95 via-green-800/92 to-green-800/90" />
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="relative z-10 flex flex-col h-full px-12 py-10"
      >
        {(step === 'auth' || step === 'success') ? (
          <>
            <div className="flex items-center gap-3 shrink-0">
              <div className="size-10 rounded-xl bg-white/20 flex items-center justify-center shadow-lg shadow-black/10">
                <HugeiconsIcon icon={Hospital01Icon} strokeWidth={2} className="size-5 text-emerald-300" />
              </div>
              <span className="text-xl font-extrabold text-white tracking-tight">
                Mediport
              </span>
            </div>

            <div className="flex-1 flex items-center">
              {step === 'auth' ? (
                <div className="space-y-5">
                  <h1 className="text-4xl font-extrabold text-white leading-tight">
                    Fertility & Wellness
                    <br />
                    <span className="text-emerald-400">Services</span>
                  </h1>
                  <p className="text-lg text-white max-w-md leading-relaxed">
                    Book appointments with our experienced specialists. Compassionate care
                    tailored to your journey.
                  </p>
                  <div className="flex items-center gap-4 pt-1">
                    <div className="h-px w-12 bg-white/20" />
                    <span className="text-sm text-white/60 tracking-wider uppercase">
                      Since 2010
                    </span>
                    <div className="h-px w-12 bg-white/20" />
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  <h1 className="text-4xl font-extrabold text-white leading-tight">
                    Appointment
                    <br />
                    <span className="text-emerald-400">Confirmed</span>
                  </h1>
                  <p className="text-lg text-white max-w-md leading-relaxed">
                    Your appointment has been booked successfully. A confirmation message has been sent to your phone and email.
                  </p>
                  <div className="flex items-center gap-4 pt-1">
                    <div className="h-px w-12 bg-white/20" />
                    <span className="text-sm text-white/60 tracking-wider uppercase">
                      See you soon
                    </span>
                    <div className="h-px w-12 bg-white/20" />
                  </div>
                </div>
              )}
            </div>

            <div className="text-sm text-white/50 shrink-0">
              &copy; 2026 Mediport Fertility Services
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col flex-1">
              <div className="shrink-0">
                <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-white/20 flex items-center justify-center shadow-lg shadow-black/10">
                <HugeiconsIcon icon={Hospital01Icon} strokeWidth={2} className="size-5 text-emerald-300" />
              </div>
                  <span className="text-xl font-extrabold text-white tracking-tight">
                    Mediport
                  </span>
                </div>
              </div>

              <div className="flex-1 flex items-center justify-center">
                  <div className="space-y-0">
                    {displaySteps.map((s, i) => {
                      const status = i < currentIdx ? 'completed' : i === currentIdx ? 'current' : 'upcoming';
                      return (
                        <div key={s.label} className="flex items-start gap-4">
                          <div className="flex flex-col items-center">
                            <StepDot status={status} icon={s.icon} />
                            {i < displaySteps.length - 1 && (
                                <div className={cn(
                                  'w-px h-10',
                                i < currentIdx ? 'bg-white/25' : 'bg-white/10',
                              )} />
                            )}
                          </div>
                        <div className={cn(
                          'pt-2',
                          status === 'current' ? 'text-white' : '',
                          status === 'completed' ? 'text-white/70' : '',
                          status === 'upcoming' ? 'text-white/50' : '',
                        )}>
                          <div className={cn(
                            'font-medium transition-colors',
                            status === 'current' ? 'text-lg' : 'text-base',
                          )}>
                            {s.label}
                          </div>
                          {status === 'current' && s.subtitle && (
                            <p className="text-sm text-white/60 mt-1">{s.subtitle}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  </div>
              </div>
            </div>

            <div className="text-sm text-white/50 shrink-0">
              &copy; 2026 Mediport Fertility Services
            </div>
          </>
        )}
      </motion.div>
    </aside>
  )
}
