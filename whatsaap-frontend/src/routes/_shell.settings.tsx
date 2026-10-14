import { Link, Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";
import {
  Bell,
  Building2,
  KeyRound,
  ShieldCheck,
  Smartphone,
  Users,
  CreditCard,
  UserCog,
} from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_shell/settings")({
  head: () => ({
    meta: [
      { title: "Settings — WAFlow" },
      {
        name: "description",
        content:
          "Manage your WAFlow profile, WhatsApp connection, notifications, security, team and API access.",
      },
      { property: "og:title", content: "Settings — WAFlow" },
      { property: "og:description", content: "Workspace settings for your WhatsApp automation." },
    ],
  }),
  component: SettingsLayout,
});

const nav = [
  { to: "/settings/profile", label: "Profile", icon: UserCog },
  { to: "/settings/account", label: "Account", icon: Building2 },
  { to: "/settings/whatsapp", label: "WhatsApp", icon: Smartphone },
  { to: "/settings/notifications", label: "Notifications", icon: Bell },
  { to: "/settings/security", label: "Security", icon: ShieldCheck },
  { to: "/settings/team", label: "Team", icon: Users },
  { to: "/settings/api", label: "API", icon: KeyRound },
  { to: "/billing", label: "Billing", icon: CreditCard },
] as const;

function SettingsLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="mx-auto max-w-6xl space-y-3">
      <PageHeader
        title="Settings"
        description="Manage your workspace, connection, security and team preferences."
      />
      <div className="grid gap-3 lg:grid-cols-[190px_1fr]">
        <nav className="card-surface h-fit p-1.5 rounded-lg border border-border lg:sticky lg:top-20">
          <ul className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
            {nav.map((item) => {
              const active = pathname === item.to;
              return (
                <li key={item.to} className="shrink-0 lg:shrink">
                  <Link
                    to={item.to}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                      active
                        ? "bg-primary-soft text-accent-foreground font-semibold"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                    )}
                  >
                    <item.icon className="size-3.5" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="min-w-0 space-y-3">
          {/* Required: settings sections render here. */}
          <Outlet />
        </div>
      </div>
    </div>
  );
}
