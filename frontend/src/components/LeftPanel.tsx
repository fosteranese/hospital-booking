import { motion } from 'framer-motion'
import { HugeiconsIcon } from '@hugeicons/react'
import { Hospital01Icon } from '@hugeicons/core-free-icons'

export function LeftPanel() {
  return (
    <aside className="hidden xl:flex relative w-[40%] h-screen overflow-hidden">
      <img
        src="https://mediportfertilityservices.com/_nuxt/slider-1.FULWOga4.jpg"
        alt="Mediport Fertility Clinic"
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-gray-900/95 via-gray-900/70 to-gray-900/30" />
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="relative z-10 flex flex-col justify-between h-full p-12"
      >
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/25">
            <HugeiconsIcon icon={Hospital01Icon} strokeWidth={2} className="size-5 text-white" />
          </div>
          <span className="text-xl font-extrabold text-white tracking-tight">
            Mediport
          </span>
        </div>
        <div className="space-y-4">
          <h1 className="text-4xl font-extrabold text-white leading-tight">
            Your Journey to
            <br />
            <span className="text-amber-300">Wellness Starts Here</span>
          </h1>
          <p className="text-base text-gray-300 max-w-md leading-relaxed">
            Thoughtfully designed care, experienced specialists, and a warm
            welcome — every step of the way.
          </p>
          <div className="flex items-center gap-4 pt-2">
            <div className="h-px w-12 bg-amber-500/40" />
            <span className="text-sm text-gray-400 tracking-wider uppercase">
              Since 2010
            </span>
            <div className="h-px w-12 bg-amber-500/40" />
          </div>
        </div>
        <div className="text-sm text-gray-500">
          &copy; 2026 Mediport Fertility Services
        </div>
      </motion.div>
    </aside>
  )
}
