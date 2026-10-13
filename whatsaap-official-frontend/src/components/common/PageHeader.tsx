import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
  className,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={cn("relative flex flex-col gap-1 sm:gap-1.5", className)}>
      <div className="flex flex-wrap items-start justify-between gap-2 sm:flex-nowrap sm:items-center">
        <div className="min-w-0 pr-8 sm:pr-0">
          <h1 className="truncate text-lg sm:text-xl font-bold tracking-tight text-foreground leading-tight">{title}</h1>
          {description && (
            <p className="mt-0.5 max-w-2xl text-xs text-muted-foreground hidden sm:block leading-tight">{description}</p>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-1.5 mt-0.5 sm:mt-0">{actions}</div>}
      </div>
      {children}
    </div>
  );
}
