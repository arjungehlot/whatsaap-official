import { CheckCheck, MessageSquareText, Send, Users } from "lucide-react";

const bars = [62, 78, 54, 88, 71, 96, 82];

/** Pure-CSS product screenshot for the landing hero — no external assets. */
export function DashboardPreview() {
  return (
    <div className="card-surface overflow-hidden shadow-pop">
      <div className="flex items-center gap-2 border-b border-border bg-surface-muted px-4 py-3">
        <span className="size-2.5 rounded-full bg-destructive/60" />
        <span className="size-2.5 rounded-full bg-warning/70" />
        <span className="size-2.5 rounded-full bg-success/60" />
        <span className="ml-3 rounded-md bg-surface px-2.5 py-1 text-[11px] text-muted-foreground">
          app.waflow.io/dashboard
        </span>
      </div>

      <div className="grid grid-cols-[auto_1fr] gap-0">
        <div className="hidden w-40 border-r border-border p-3 sm:block">
          <div className="flex items-center gap-2 px-1 pb-4">
            <span className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <MessageSquareText className="size-3" />
            </span>
            <span className="text-xs font-semibold">WAFlow</span>
          </div>
          {["Dashboard", "Inbox", "Contacts", "Campaigns", "Automations", "Analytics"].map(
            (l, i) => (
              <div
                key={l}
                className={`mb-1 rounded-md px-2 py-1.5 text-[11px] font-medium ${
                  i === 0 ? "bg-primary-soft text-accent-foreground" : "text-muted-foreground"
                }`}
              >
                {l}
              </div>
            ),
          )}
        </div>

        <div className="space-y-3 p-4">
          <div className="flex items-center justify-between gap-2 rounded-lg border border-success/25 bg-success-soft px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-success" />
              <span className="text-[11px] font-medium text-success">
                WhatsApp connected · +91 98765 43210
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground">482 sent today</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Sent", value: "2,481", icon: Send },
              { label: "Delivered", value: "2,341", icon: CheckCheck },
              { label: "Contacts", value: "12,540", icon: Users },
            ].map((k) => (
              <div key={k.label} className="rounded-lg border border-border p-2.5">
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <k.icon className="size-3" /> {k.label}
                </div>
                <p className="mt-1 text-sm font-semibold">{k.value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold">Messages overview</p>
              <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                7 days
              </span>
            </div>
            <div className="mt-3 flex h-24 items-end gap-2">
              {bars.map((h, i) => (
                <div key={i} className="flex flex-1 flex-col justify-end gap-0.5">
                  <div className="rounded-t-sm bg-primary/85" style={{ height: `${h}%` }} />
                  <div className="rounded-b-sm bg-info/40" style={{ height: `${h / 3}%` }} />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-1.5 rounded-lg border border-border p-3">
            <p className="text-[11px] font-semibold">Recent campaigns</p>
            {[
              ["Summer Sale", "Running", "2,500"],
              ["Product Launch", "Completed", "5,000"],
              ["Festival Offer", "Scheduled", "1,250"],
            ].map(([name, status, count]) => (
              <div key={name} className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">{name}</span>
                <span className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-1.5 py-0.5 ${
                      status === "Running"
                        ? "bg-info-soft text-info"
                        : status === "Completed"
                          ? "bg-success-soft text-success"
                          : "bg-warning-soft text-warning-foreground"
                    }`}
                  >
                    {status}
                  </span>
                  <span className="tabular-nums text-muted-foreground">{count}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
