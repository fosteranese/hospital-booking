import * as React from "react"
import { createContext, useContext } from "react"
import { OTPInput, OTPInputContext } from "input-otp"

import { cn } from "@/lib/utils"
import { HugeiconsIcon } from "@hugeicons/react"
import { MinusSignIcon } from "@hugeicons/core-free-icons"

const OTPInputSizeContext = createContext<"default" | "xl">("default")

function InputOTP({
  className,
  containerClassName,
  inputSize,
  ...props
}: React.ComponentProps<typeof OTPInput> & {
  containerClassName?: string
  inputSize?: "xl"
}) {
  return (
    <OTPInputSizeContext.Provider value={inputSize ?? "default"}>
      <OTPInput
        data-slot="input-otp"
        data-size={inputSize ?? "default"}
        containerClassName={cn(
          "cn-input-otp flex items-center has-disabled:opacity-50",
          inputSize === "xl" && "gap-5",
          containerClassName
        )}
        spellCheck={false}
        className={cn("disabled:cursor-not-allowed", inputSize === "xl" && "gap-5", className)}
        {...props}
      />
    </OTPInputSizeContext.Provider>
  )
}

function InputOTPGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="input-otp-group"
      className={cn(
        "flex items-center has-aria-invalid:border-destructive has-aria-invalid:ring-3 has-aria-invalid:ring-destructive/20 dark:has-aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

function InputOTPSlot({
  index,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  index: number
}) {
  const inputOTPContext = React.useContext(OTPInputContext)
  const size = useContext(OTPInputSizeContext)
  const { char, hasFakeCaret, isActive } = inputOTPContext?.slots[index] ?? {}

  return (
    <div
      data-slot="input-otp-slot"
      data-active={isActive}
      className={cn(
        "relative flex items-center justify-center border-y border-r border-input shadow-xs transition-all outline-none first:rounded-l-md first:border-l last:rounded-r-md aria-invalid:border-destructive data-[active=true]:z-10 data-[active=true]:border-ring data-[active=true]:ring-3 data-[active=true]:ring-ring/50 data-[active=true]:aria-invalid:border-destructive data-[active=true]:aria-invalid:ring-destructive/20 dark:bg-input/30 dark:data-[active=true]:aria-invalid:ring-destructive/40",
        size === "xl" ? "size-12 text-lg" : "size-9 text-sm",
        className
      )}
      {...props}
    >
      {char}
      {hasFakeCaret && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className={cn("w-px animate-caret-blink bg-foreground duration-1000", size === "xl" ? "h-6" : "h-4")} />
        </div>
      )}
    </div>
  )
}

function InputOTPSeparator({ className, ...props }: React.ComponentProps<"div">) {
  const size = useContext(OTPInputSizeContext)
  return (
    <div
      data-slot="input-otp-separator"
      role="separator"
      className={cn(
        "flex items-center [&_svg:not([class*='size-'])]:size-4",
        size === "xl" && "[&_svg:not([class*='size-'])]:size-6 px-1",
        className
      )}
      {...props}
    >
      <HugeiconsIcon icon={MinusSignIcon} strokeWidth={2} />
    </div>
  )
}

export { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator }
