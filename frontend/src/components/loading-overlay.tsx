import { motion } from "framer-motion";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

interface LoadingOverlayProps {
  loading: boolean;
  message?: string;
  variant?: "fullscreen" | "inset";
}

function LoadingOverlay({ loading, message = "Loading...", variant = "fullscreen" }: LoadingOverlayProps) {
  if (!loading) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={cn(
        variant === "fullscreen"
          ? "fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-black/60"
          : "absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/70",
      )}
    >
      {variant === "fullscreen" ? (
        <div className="flex flex-col items-center gap-4">
          <div className="size-10 rounded-full border-[3px] border-white/30 border-t-white animate-spin" />
          <p className="text-sm font-medium text-white">{message}</p>
        </div>
      ) : (
        <div className="flex items-center gap-2.5">
          <Spinner />
          <span className="text-sm text-muted-foreground">{message}</span>
        </div>
      )}
    </motion.div>
  );
}

export { LoadingOverlay };
