import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Bell,
  CircleHelp,
  LogOut,
  Menu,
  Search,
  Settings as SettingsIcon,
  CreditCard,
  User as UserIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { notifications } from "@/mock/data";
import { authService } from "@/services";
import { useMessageCredits, useWorkspaceSnapshot } from "@/hooks/use-workspace-snapshot";
import { initials, relative } from "@/lib/format";
import { cn } from "@/lib/utils";

const kindDot: Record<string, string> = {
  success: "bg-success",
  warning: "bg-warning",
  info: "bg-info",
  error: "bg-destructive",
};

function labelFor(segment: string) {
  return segment
    .replace(/-/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase())
    .replace(/\bId\b/, "Details");
}

export function Header({ onOpenMobileNav }: { onOpenMobileNav: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const workspace = useWorkspaceSnapshot();
  const creditSummary = useMessageCredits();
  const user = workspace.data?.user ?? authService.currentUser();
  const subscription = workspace.data?.subscription ?? null;
  const credits = creditSummary.data ?? null;
  const segments = pathname.split("/").filter(Boolean);
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <header className="sticky top-0 z-30 flex h-12 items-center gap-2.5 border-b border-border bg-surface/85 px-3 backdrop-blur-md lg:px-4">
      <button
        onClick={onOpenMobileNav}
        aria-label="Open navigation"
        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary lg:hidden"
      >
        <Menu className="size-4.5" />
      </button>

      <Breadcrumb className="hidden min-w-0 md:block text-xs">
        <BreadcrumbList className="gap-1 sm:gap-1.5 text-xs">
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/dashboard" className="text-xs">Whatsaap</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          {segments.map((seg, i) => (
            <span key={`${seg}-${i}`} className="flex items-center gap-1 sm:gap-1.5">
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {i === segments.length - 1 ? (
                  <BreadcrumbPage className="max-w-[14rem] truncate text-xs font-medium">
                    {labelFor(seg)}
                  </BreadcrumbPage>
                ) : (
                  <span className="text-muted-foreground text-xs">{labelFor(seg)}</span>
                )}
              </BreadcrumbItem>
            </span>
          ))}
        </BreadcrumbList>
      </Breadcrumb>

      <div className="ml-auto flex items-center gap-2 sm:gap-2.5">
        <div className="relative hidden w-56 xl:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search contacts, campaigns…"
            className="h-7.5 rounded-full bg-slate-50 border-slate-200 pl-8 text-xs shadow-none transition-all hover:bg-slate-100/50 focus-visible:ring-emerald-500/20"
          />
        </div>

        {subscription?.expiryDate && (
          <Link 
            to="/pricing" 
            className="hidden items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50/50 px-2.5 py-1 text-xs sm:flex shadow-none hover:bg-emerald-50 transition-colors" 
            title="View subscription details"
          >
            <span className="font-semibold text-slate-700">{subscription.planId?.name || "Plan"}</span>
            <span className={subscription.status === "active" ? "font-bold text-emerald-600" : "font-bold text-rose-500"}>
              {subscription.status === "active" ? `${Math.max(0, Math.ceil((new Date(subscription.expiryDate).getTime() - Date.now()) / 86400000))}d left` : "Expired"}
            </span>
          </Link>
        )}
        
        {credits && (
          <Link 
            to="/pricing" 
            className="hidden items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50/50 px-2.5 py-1 text-xs sm:flex shadow-none hover:bg-blue-50 transition-colors" 
            title="View message credit details"
          >
            <span className="font-semibold text-slate-700">Credits</span>
            <span className={credits.unlimited ? "font-bold text-blue-600" : (credits.remaining || 0) > 0 ? "font-bold text-blue-600" : "font-bold text-rose-500"}>
              {credits.unlimited ? "Unlimited" : `${credits.remaining || 0} left`}
            </span>
          </Link>
        )}

        <Popover>
          {/* <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
              <Bell className="size-4.5" />
              {unread > 0 && (
                <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-destructive ring-2 ring-surface" />
              )}
            </Button>
          </PopoverTrigger> */}
          <PopoverContent align="end" className="w-88 p-0">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="text-sm font-semibold">Notifications</p>
              <span className="text-xs text-muted-foreground">{unread} unread</span>
            </div>
            <ul className="max-h-80 divide-y divide-border overflow-y-auto">
              {notifications.map((n) => (
                <li
                  key={n.id}
                  className={cn(
                    "flex gap-3 px-4 py-3 transition-colors hover:bg-surface-muted",
                    !n.read && "bg-primary-soft/40",
                  )}
                >
                  <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", kindDot[n.kind])} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-snug">{n.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{n.detail}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{relative(n.at)}</p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="border-t border-border px-4 py-2.5">
              <Link to="/logs" className="text-xs font-medium text-primary hover:underline">
                View all activity
              </Link>
            </div>
          </PopoverContent>
        </Popover>

        {/* <Button variant="ghost" size="icon" aria-label="Help" asChild>
          <Link to="/settings/profile">
            <CircleHelp className="size-4.5" />
          </Link>
        </Button> */}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white pl-1 pr-2.5 py-0.5 shadow-none transition-colors hover:bg-slate-50">
              <span className="flex size-6 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                {initials(user.name)}
              </span>
              <span className="hidden text-xs font-medium sm:block">
                {user.name.split(" ")[0]}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <p className="text-sm font-medium">{user.name}</p>
              <p className="text-xs font-normal text-muted-foreground">{user.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {/* <DropdownMenuItem asChild>
              <Link to="/settings/profile">
                <UserIcon className="size-4" /> Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/settings">
                <SettingsIcon className="size-4" /> Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/billing">
                <CreditCard className="size-4" /> Billing
              </Link>
            </DropdownMenuItem> */}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="mt-1 cursor-pointer gap-2 rounded-md bg-destructive/10 text-destructive focus:bg-destructive focus:text-destructive-foreground font-medium transition-all"
              onClick={() => {
                authService.logout();
                void navigate({ to: "/login" });
              }}
            >
              <LogOut className="size-4" /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
