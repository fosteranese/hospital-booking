import { motion } from 'framer-motion'

interface StepIndicatorProps {
  steps: string[]
  currentIdx: number
  highestCompleted: number
  onStepClick: (idx: number) => void
  vertical?: boolean
}

export function StepIndicator({ steps, currentIdx, highestCompleted, onStepClick, vertical }: StepIndicatorProps) {
  return (
    <div className={`flex items-center ${vertical ? 'flex-col gap-2' : 'gap-1'}`}>
      {steps.map((label, i) => {
        const isActive = i === currentIdx
        const isCompleted = i <= highestCompleted
        const isClickable = i <= highestCompleted

        return (
          <div key={label} className={`flex items-center ${vertical ? 'flex-col' : ''}`}>
            <button
              type="button"
              disabled={!isClickable}
              onClick={() => onStepClick(i)}
              className={`relative flex items-center gap-2 rounded-full text-sm font-medium transition-colors outline-none disabled:opacity-40 disabled:cursor-default ${vertical ? 'flex-row px-3 py-2 w-full' : 'px-3 py-2'}`}
            >
              {isCompleted && (
                <motion.span
                  layoutId={vertical ? undefined : 'step-bg'}
                  className={`absolute inset-0 rounded-full ${isActive ? 'bg-primary shadow-md' : 'bg-primary/15'}`}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <span
                className={`relative z-10 flex size-6 items-center justify-center rounded-full text-xs font-bold border-2 shrink-0 ${
                  isActive
                    ? 'border-white bg-white text-primary'
                    : isCompleted
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-muted-foreground/30 bg-transparent text-muted-foreground'
                }`}
              >
                {i + 1}
              </span>
              <span
                className={`relative z-10 text-sm font-medium ${
                  vertical ? 'inline' : 'hidden sm:inline'
                } ${
                  isActive
                    ? vertical ? 'text-primary' : 'text-primary-foreground'
                    : isCompleted
                      ? 'text-primary'
                      : 'text-muted-foreground'
                }`}
              >
                {label}
              </span>
            </button>
            {i < steps.length - 1 && (
              <div
                className={`transition-colors duration-300 ${
                  vertical
                    ? `w-px h-3 md:h-6 mx-auto ${i < highestCompleted ? 'bg-primary/40' : 'bg-border'}`
                    : `w-3 md:w-6 h-px mx-0.5 ${i < highestCompleted ? 'bg-primary/40' : 'bg-border'}`
                }`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
