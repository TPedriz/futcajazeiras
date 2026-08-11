import { cn } from "@/lib/utils";

/** Selo "BAxVI" — exibido quando um baba é do tipo Bahia × Vitória. */
export function BadgeBaxvi({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-gold/50 bg-gold/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-gold",
        className,
      )}
    >
      ⚔️ BAxVI
    </span>
  );
}
