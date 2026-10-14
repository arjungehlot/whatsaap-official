import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  actions,
  className,
  iconClassName,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  actions?: ReactNode;
  className?: string;
  iconClassName?: string;
}) {
  return (
    <div
      className={cn(
        "card-surface flex flex-col items-center justify-center px-4 py-7 text-center bg-white rounded-lg border border-slate-200/80 shadow-xs",
        className,
      )}
    >
      <span
        className={cn(
          "flex size-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 ring-1 ring-emerald-500/20 shadow-xs",
          iconClassName,
        )}
      >
        <Icon className="size-4.5" />
      </span>
      <h3 className="mt-2.5 text-xs sm:text-[13px] font-semibold text-slate-900 tracking-tight">{title}</h3>
      <p className="mt-1 max-w-sm text-[11px] leading-relaxed text-muted-foreground">{description}</p>
      {actions && <div className="mt-3.5 flex flex-wrap justify-center gap-2">{actions}</div>}
    </div>
  );
}
