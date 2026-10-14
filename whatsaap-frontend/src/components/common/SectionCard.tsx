import type { ReactNode } from "react"; 
import { cn } from "@/lib/utils";

export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
  footer,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  footer?: ReactNode;
}) {
  return (
    <section className={cn("card-surface overflow-hidden bg-white rounded-lg border border-slate-200/90 shadow-xs", className)}>
      {(title || actions) && (
        <header className="flex flex-nowrap items-center justify-between gap-2 border-b border-border px-3 py-1.5">
          <div className="min-w-0">
            {title && <h2 className="text-xs sm:text-[13px] font-semibold tracking-tight leading-tight">{title}</h2>}
            {description && (
              <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">{description}</p>
            )}
          </div>
          {actions && <div className="flex flex-nowrap items-center gap-1.5 shrink-0 overflow-x-auto no-scrollbar">{actions}</div>}
        </header>
      )}
      <div className={cn("p-2.5", bodyClassName)}>{children}</div>
      {footer && <div className="border-t border-border px-3 py-1.5">{footer}</div>}
    </section>
  );
}
