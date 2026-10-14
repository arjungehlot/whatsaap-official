import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react"; 
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  change,
  comparison = "vs previous period",
  icon: Icon,
  iconColor,
  iconBg,
  spark,
  sparkColor,
  className,
}: {
  label: string;
  value: string;
  change?: number;
  comparison?: string;
  icon?: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  spark?: number[];
  sparkColor?: string;
  className?: string;
}) {
  return (
    <div className={cn("card-surface p-2 md:p-2.5 transition-all hover:shadow-sm rounded-lg border border-slate-200 shadow-sm bg-white flex items-center gap-2", className)}>
      {Icon && (
        <div className={cn("flex size-7 shrink-0 items-center justify-center rounded shadow-sm", iconBg || "bg-primary-soft")}>
          <Icon className={cn("size-3.5 drop-shadow-sm", iconColor || "text-accent-foreground")} />
        </div>
      )}
      
      <div className="flex-1 min-w-0">
        <p className="text-[10px] md:text-[11px] font-medium text-slate-500 truncate leading-none mb-1">{label}</p>
        <div className="flex items-end gap-1">
           <p className="text-sm md:text-[15px] font-bold tracking-tight text-slate-900 leading-none">{value}</p>
        </div>
      </div>

      {spark && (
         <div className="hidden sm:block w-10 shrink-0">
            <Sparkline points={spark} color={sparkColor || "text-emerald-500"} />
         </div>
      )}
    </div>
  );
}

function Sparkline({ points, color }: { points: number[]; color: string }) {
  const max = Math.max(...points);
  const min = Math.min(...points);
  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * 100;
    const y = 24 - ((p - min) / Math.max(max - min, 1)) * 22;
    return { x, y };
  });
  
  const path = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const lastCoord = coords[coords.length - 1];

  return (
    <svg viewBox="-2 -2 104 30" className="h-8 w-full overflow-visible" preserveAspectRatio="none">
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        className={color}
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {lastCoord && (
        <circle 
          cx={lastCoord.x} 
          cy={lastCoord.y} 
          r="2.5" 
          fill="currentColor" 
          className={color}
        />
      )}
    </svg>
  );
}
