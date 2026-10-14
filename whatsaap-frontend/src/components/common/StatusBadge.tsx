import { cn } from "@/lib/utils";

type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "brand";

const toneClass: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground border-border",
  success: "bg-success-soft text-success border-success/25",
  warning: "bg-warning-soft text-warning-foreground border-warning/30",
  danger: "bg-destructive-soft text-destructive border-destructive/25",
  info: "bg-info-soft text-info border-info/25",
  brand: "bg-primary-soft text-accent-foreground border-primary/20",
};

const map: Record<string, Tone> = {
  active: "success",
  connected: "success",
  completed: "success",
  delivered: "success",
  read: "brand",
  sent: "info",
  running: "info",
  outbound: "info",
  inbound: "neutral",
  pending: "warning",
  scheduled: "warning",
  paused: "warning",
  inactive: "neutral",
  draft: "neutral",
  invited: "warning",
  failed: "danger",
  error: "danger",
  blocked: "danger",
  suspended: "danger",
  connecting: "warning",
  qr_required: "warning",
  disconnected: "danger",
  session_expired: "danger",
  disconnecting: "warning",
};

export function StatusBadge({
  status,
  tone,
  dot = true,
  className,
}: {
  status: string;
  tone?: Tone;
  dot?: boolean;
  className?: string;
}) {
  const resolved = tone ?? map[status.toLowerCase().replace(/\s+/g, "_")] ?? "neutral";
  const label = status.replace(/_/g, " ");
  return (
    <span
      className={cn(
        "inline-flex whitespace-nowrap items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize leading-tight",
        toneClass[resolved],
        className,
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current opacity-80" />}
      {label}
    </span>
  );
}
