import { cn } from "@/lib/utils"

interface ErrorMessageProps {
  message: string;
  variant?: "simple" | "bordered";
  className?: string;
}

function ErrorMessage({ message, variant = "simple", className }: ErrorMessageProps) {
  return (
    <div
      className={cn(
        variant === "simple"
          ? "rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
          : "rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-2.5 text-sm text-destructive text-center",
        className,
      )}
    >
      {message}
    </div>
  );
}

export { ErrorMessage };
