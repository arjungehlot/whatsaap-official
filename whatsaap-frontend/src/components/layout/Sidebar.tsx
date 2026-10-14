import { Link, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  CalendarClock,
  ChevronsLeft,
  ChevronsRight,
  Code2,
  Webhook,
  CreditCard,
  Inbox,
  LayoutDashboard,
  LifeBuoy,
  LockKeyhole,
  Megaphone,
  MessageSquareText,
  ScrollText,
  Send,
  Settings,
  Smartphone,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import LogoLight from "@/Assets/LogoLight1.png";
import LogoDark from "@/Assets/LogoDark.png";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { authService } from "@/services";
import { useWorkspaceSnapshot } from "@/hooks/use-workspace-snapshot";

type NavItemColor = "emerald" | "blue" | "amber" | "violet" | "rose" | "info" | "gray";

type NavItem = { 
  to: string; 
  label: string; 
  icon: LucideIcon; 
  badge?: string; 
  feature?: string;
  color?: NavItemColor;
};

const groups: { title: string; items: NavItem[] }[] = [
  { 
    title: "Overview", 
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, color: "emerald" },
      // { to: "/analytics", label: "Analytics", icon: BarChart3, color: "info" }
    ] 
  },
  {
    title: "Messaging",
    items: [
      { to: "/whatsapp", label: "Device", icon: Smartphone, color: "blue" },
      { to: "/send-message", label: "Send message", icon: Send, feature: "send-message", color: "violet" },
      { to: "/inbox", label: "Inbox", icon: Inbox, feature: "inbox", color: "amber" },

      { to: "/contacts", label: "Contacts", icon: Users, color: "rose" },
      { to: "/campaigns", label: "Campaigns", icon: Megaphone, feature: "campaign-message", color: "info" },
      { to: "/templates", label: "Templates", icon: MessageSquareText, feature: "template", color: "emerald" },
      { to: "/logs", label: "Message logs", icon: ScrollText, color: "gray" },
      { to: "/automations", label: "Schedulers", icon: CalendarClock, feature: "scheduler", color: "violet" },
    ],
  },
  {
    title: "Developers",
    items: [
      { to: "/webhooks", label: "Webhooks", icon: Webhook, feature: "webhook", color: "amber" },
      { to: "/api-docs", label: "API & Docs", icon: Code2, feature: "api-keys", color: "violet" },
    ],
  },
  {
    title: "Account",
    items: [{ to: "/pricing", label: "Pricing", icon: CreditCard, color: "rose" }],
  },

];

const colorMap: Record<NavItemColor, string> = {
  emerald: "from-emerald-400 to-emerald-600 shadow-emerald-500/30",
  blue: "from-blue-400 to-blue-600 shadow-blue-500/30",
  amber: "from-amber-400 to-amber-600 shadow-amber-500/30",
  violet: "from-violet-400 to-violet-600 shadow-violet-500/30",
  rose: "from-rose-400 to-rose-600 shadow-rose-500/30",
  info: "from-cyan-400 to-cyan-600 shadow-cyan-500/30",
  gray: "from-slate-400 to-slate-600 shadow-slate-500/30",
};

export function Logo({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2">
      {collapsed ? (
        <div className="h-8 w-8 flex items-center justify-center overflow-hidden shrink-0 mix-blend-multiply">
          <video src="/LogoIcon.mp4" autoPlay loop muted playsInline className="scale-[.75] min-w-[120px]" />
        </div>
      ) : (
        <>
          <div className="h-8 w-8 flex items-center justify-center overflow-hidden shrink-0 mix-blend-multiply">
            <video src="/LogoIcon.mp4" autoPlay loop muted playsInline className="scale-[.85] min-w-[120px]" />
          </div>
          <img src={LogoLight} alt="WAFlow Logo" className="h-8 w-auto dark:hidden" />
          <img src={LogoDark} alt="WAFlow Logo" className="hidden h-8 w-auto dark:block" />
        </>
      )}
    </Link>
  );
}

export function SidebarNav({
  collapsed,
  onNavigate,
  onToggleCollapse,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
  onToggleCollapse?: () => void;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const workspace = useWorkspaceSnapshot();
  const user = workspace.data?.user ?? authService.currentUser();
  const features = workspace.data?.features ?? null;
  const adminItems: NavItem[] =
    user.role === "super_admin" ? [{ to: "/admin", label: "Super Admin", icon: Settings, color: "gray" }] : [];

  return (
    <TooltipProvider delayDuration={150}>
      <div className="relative flex h-full flex-col bg-sidebar">
        <div
          className={cn(
            "flex h-12 shrink-0 items-center border-b border-sidebar-border",
            collapsed ? "justify-center px-1" : "justify-start px-3",
          )}
        >
          <Logo collapsed={collapsed} />
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="absolute -right-3 top-3 z-50 hidden size-6 items-center justify-center rounded-full border border-sidebar-border bg-background text-muted-foreground shadow-xs transition-colors hover:bg-sidebar-accent hover:text-foreground lg:flex"
            >
              {collapsed ? <ChevronsRight className="size-3.5" /> : <ChevronsLeft className="size-3.5" />}
            </button>
          )}
        </div>

        <nav 
          className="flex-1 space-y-2 overflow-y-auto px-1.5 py-2"
          style={{ scrollbarWidth: "thin" }}
        >
          {[
            ...groups,
            ...(adminItems.length ? [{ title: "Administration", items: adminItems }] : []),
          ].map((group) => (
            <div key={group.title}>
              {!collapsed && (
                <p className="px-1.5 pb-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground/80">
                  {group.title}
                </p>
              )}
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const locked = Boolean(item.feature && features && !features[item.feature]);
                  const active =
                    !locked && (pathname === item.to || pathname.startsWith(`${item.to}/`));
                  const link = (
                    <Link
                      to={locked ? "/pricing" : item.to}
                      onClick={onNavigate}
                      className={cn(
                        "group flex items-center gap-2 rounded-md px-2 py-1 text-xs font-medium transition-all relative",
                        collapsed && "justify-center px-0 py-1.5",
                        active
                          ? "bg-primary/10 text-primary font-bold shadow-2xs border-l-2.5 border-primary rounded-l-none pl-1.5"
                          : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900",
                      )}
                    >
                      <div
                        className={cn(
                          "flex shrink-0 items-center justify-center rounded-md ring-1 ring-white/20 transition-transform duration-300 group-hover:scale-105",
                          collapsed ? "size-6" : "size-5",
                          item.color ? `bg-gradient-to-br ${colorMap[item.color]} shadow-xs` : "bg-muted text-muted-foreground",
                          active && "ring-2 ring-primary/40 shadow-sm"
                        )}
                        style={{ transformStyle: "preserve-3d" }}
                      >
                        <item.icon className="size-3 text-white drop-shadow-xs" />
                      </div>
                      {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                      {!collapsed && locked && (
                        <LockKeyhole className="size-3 text-muted-foreground" />
                      )}
                      {!collapsed && item.badge && (
                        <span className="rounded-full bg-primary px-1.5 py-0.2 text-[9px] font-semibold text-primary-foreground">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                  return (
                    <li key={item.to}>
                      {collapsed ? (
                        <Tooltip>
                          <TooltipTrigger asChild>{link}</TooltipTrigger>
                          <TooltipContent side="right">
                            {locked ? `${item.label} - Upgrade required` : item.label}
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        link
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-sidebar-border p-1.5">
          {collapsed ? (
            <div className="flex flex-col items-center gap-1.5">
              <span className="flex size-7 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold">
                {initials(user.name)}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 rounded-md bg-surface-muted px-1.5 py-1">
              <span className="flex size-6.5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                {initials(user.name)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold leading-tight text-slate-800">{user.name}</p>
                <p className="truncate text-[10px] text-muted-foreground leading-tight">{user.company}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
