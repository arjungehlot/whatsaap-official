import { useEffect } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BarChart3,
  CheckCheck,
  Loader2,
  Megaphone,
  MessageSquarePlus,
  Plus,
  QrCode,
  Send,
  Upload,
  Users,
  Workflow,
  Calendar,
  ChevronDown,
  MessageCircle,
} from "lucide-react";
import { StatCard } from "@/components/common/StatCard";
import { SectionCard } from "@/components/common/SectionCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { num, pct, relative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { authService, dashboardService, whatsappService } from "@/services";
import { useWorkspaceSnapshot } from "@/hooks/use-workspace-snapshot";
import type { DashboardOverview } from "@/types";
import dashboardTopImg from "@/Assets/DashboardTop.png";

export const Route = createFileRoute("/_shell/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Whatsaap" },
      {
        name: "description",
        content:
          "Track messages sent, delivery rates, active campaigns and recent conversations across your WhatsApp workspace.",
      },
      { property: "og:title", content: "Whatsaap Dashboard" },
      {
        property: "og:description",
        content: "Live WhatsApp messaging KPIs, campaign progress and recent conversations.",
      },
    ],
  }),
  component: DashboardPage,
});

const kpiIcons = { send: Send, check: CheckCheck, megaphone: Megaphone, users: Users };

function DashboardPage() {
  const workspace = useWorkspaceSnapshot();
  const user = workspace.data?.user ?? authService.currentUser();

  const overviewQuery = useQuery({
    queryKey: ["dashboard-overview"],
    queryFn: dashboardService.overview,
    staleTime: 15_000,
  });
  const whatsappSummaryQuery = useQuery({
    queryKey: ["whatsapp-summary"],
    queryFn: whatsappService.getSummary,
    staleTime: 15_000,
  });
  const overview = overviewQuery.data ?? null;
  const whatsappAccounts = whatsappSummaryQuery.data?.accounts ?? [];
  const whatsappLimit = whatsappSummaryQuery.data?.limit ?? 3;
  const loading = overviewQuery.isLoading || whatsappSummaryQuery.isLoading;
  const connectedAccounts = whatsappAccounts.filter((account) => account.state === "CONNECTED");
  const disconnectedAccounts = whatsappAccounts.length - connectedAccounts.length;
  const sentToday = connectedAccounts.reduce((sum, account) => sum + account.messagesSentToday, 0);
  const availableSlots = Math.max(whatsappLimit - whatsappAccounts.length, 0);

  useEffect(() => {
    const error = overviewQuery.error ?? whatsappSummaryQuery.error;
    if (error) toast.error(error instanceof Error ? error.message : "Unable to load dashboard data");
  }, [overviewQuery.error, whatsappSummaryQuery.error]);

  if (loading || !overview) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 text-center">
        <Loader2 className="size-7 animate-spin text-primary" />
        <p className="text-sm font-medium">Loading live dashboard data...</p>
      </div>
    );
  }

  const analytics = overview.analytics;
  const max = Math.max(...analytics.series.map((s) => s.sent), 1);

  const kpis = [
    {
      label: "Messages Sent",
      value: num(analytics.totals.sent),
      icon: Send,
      iconColor: "text-white",
      iconBg: "bg-emerald-500",
      spark: analytics.series.map((s) => s.sent),
      sparkColor: "text-emerald-500",
      change: 0,
    },
    // {
    //   label: "Messages Delivered",
    //   value: num(analytics.totals.delivered),
    //   icon: CheckCheck,
    //   iconColor: "text-white",
    //   iconBg: "bg-blue-500",
    //   spark: analytics.series.map((s) => s.delivered),
    //   sparkColor: "text-blue-500",
    //   change: 0,
    // },
    {
      label: "Active Campaigns",
      value: num(overview.activeCampaigns),
      icon: Megaphone,
      iconColor: "text-white",
      iconBg: "bg-purple-500",
      spark: analytics.series.map((s) => s.sent), // placeholder
      sparkColor: "text-purple-500",
      change: 0,
    },
    {
      label: "Total Contacts",
      value: num(overview.totalContacts),
      icon: Users,
      iconColor: "text-white",
      iconBg: "bg-orange-500",
      spark: analytics.series.map((s) => s.sent), // placeholder
      sparkColor: "text-orange-500",
      change: 0,
    },
  ];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-3 pb-6">
      {/* Unified Banner */}
      <div className="relative w-full rounded-lg bg-[#f0fdf4] border border-[#bbf7d0] flex flex-col md:flex-row md:items-center p-3 md:pl-5 h-auto md:h-[72px] shadow-sm mb-2 mt-1 gap-2 md:gap-0">
        {/* Background Image containing boy, plant, arrow, etc */}
        <img 
          src={dashboardTopImg} 
          alt="Dashboard Banner" 
          className="hidden md:block absolute right-4 bottom-0 h-[75px] w-auto object-contain pointer-events-none z-0" 
        />
        
        {/* Left Content (Dynamic Greeting) */}
        <div className="relative z-10 shrink-0 w-full md:max-w-[50%] pr-4 md:pr-0">
          <h1 className="text-base md:text-lg font-bold tracking-tight text-[#1e1e40] flex items-center gap-1.5 leading-tight">
            {greeting}, {user.name.split(' ')[0]}! <span className="text-base md:text-lg">👋</span>
          </h1>
          <p className="text-[#84849a] font-medium text-[11px] md:text-xs mt-0.5">
            Here's what's happening with your WhatsApp campaigns today.
          </p>
        </div>
        
        {/* Manage Connection Button */}
        <div className="relative z-10 flex-1 flex md:justify-start md:pl-4 lg:pl-6 md:mr-[300px] xl:mr-[350px]">
          <Button asChild size="sm" className="bg-[#00d084] hover:bg-[#00b875] text-white shadow-md shadow-[#00d084]/30 rounded-full h-7 px-4 font-bold shrink-0 text-[11px] w-fit">
            <Link to="/whatsapp">Manage connection <ArrowRight className="ml-1.5 size-3" /></Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-1.5 md:gap-2 grid-cols-3 lg:grid-cols-3">
        {kpis.map((k) => (
          <StatCard key={k.label} {...k} />
        ))}
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <SectionCard
          className="xl:col-span-2 rounded-xl border border-slate-200 shadow-sm"
          title="Messages overview"
          description="Sent vs delivered over the last 7 days"
          actions={
            <Button variant="ghost" size="sm" asChild className="text-slate-500 hover:text-slate-900">
              <Link to="/analytics">
                <BarChart3 className="size-4 mr-2" /> Full analytics <ArrowRight className="ml-1 size-3.5" />
              </Link>
            </Button>
          }
        >
          <div className="flex h-36 gap-2 mt-2">
            {analytics.series.map((s) => (
              <div key={s.label} className="flex h-full flex-1 flex-col items-center gap-1">
                <div className="flex w-full flex-1 items-end justify-center gap-0.5">
                  <div
                    className="group relative w-1/3 rounded-t-sm bg-emerald-500 hover:bg-emerald-400 transition-colors"
                    style={{ height: `${(s.sent / max) * 100}%` }}
                  >
                    <div className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-slate-800 px-1.5 py-0.5 text-[9px] font-semibold text-white opacity-0 transition-all group-hover:-translate-y-1 group-hover:opacity-100 z-10 shadow-sm">
                      Sent {num(s.sent)}
                    </div>
                  </div>
                  <div
                    className="group relative w-1/3 rounded-t-sm bg-blue-500 hover:bg-blue-400 transition-colors"
                    style={{ height: `${(s.delivered / max) * 100}%` }}
                  >
                    <div className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-slate-800 px-1.5 py-0.5 text-[9px] font-semibold text-white opacity-0 transition-all group-hover:-translate-y-1 group-hover:opacity-100 z-10 shadow-sm">
                      Delivered {num(s.delivered)}
                    </div>
                  </div>
                </div>
                <span className="text-[9px] font-medium text-slate-400">{s.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-4 border-t border-slate-100 pt-2 text-[10px] text-slate-500 font-medium">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-emerald-500" /> Sent
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-blue-500" /> Delivered
            </span>
            <span className="ml-auto flex items-center gap-2">
              <span>Delivery rate <span className="text-slate-900">{pct(analytics.totals.deliveryRate)}</span></span>
              <span className="text-slate-300">•</span>
              <span>Read rate <span className="text-slate-900">{pct(analytics.totals.readRate)}</span></span>
            </span>
          </div>
        </SectionCard>

        <SectionCard className="rounded-xl border border-slate-200 shadow-sm" title="Delivery quality" description="Last 7 days">
          <div className="space-y-4 mt-2">
            {[
              { label: "Sent", value: analytics.totals.deliveryRate, tone: "bg-emerald-500" },
              { label: "Read", value: analytics.totals.readRate, tone: "bg-blue-500" },
              { label: "Replied", value: analytics.totals.replyRate, tone: "bg-purple-500" },
              {
                label: "Failed",
                value: analytics.totals.failedRate,
                tone: "bg-rose-500",
              },
            ].map((m) => (
              <div key={m.label}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-600 font-medium">{m.label}</span>
                  <span className="font-bold text-slate-900 tabular-nums">{pct(m.value)}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full rounded-full ${m.tone}`} style={{ width: `${m.value}%` }} />
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-2 xl:grid-cols-3">
        <div className="xl:col-span-2 grid gap-2 sm:grid-cols-2">
           <SectionCard
             className="rounded-xl border border-slate-200 shadow-sm flex flex-col h-full"
             title="Recent campaigns"
             description="Your latest campaigns"
             actions={
               <Button variant="ghost" size="sm" asChild className="text-slate-500">
                 <Link to="/campaigns">
                   View all <ArrowRight className="ml-1 size-3.5" />
                 </Link>
               </Button>
             }
             bodyClassName="p-0 flex-1 flex flex-col"
           >
             {overview.recentCampaigns.length === 0 ? (
               <div className="flex flex-1 flex-col items-center justify-center p-8 text-center border-t border-slate-100">
                  <div className="flex size-12 items-center justify-center rounded-xl bg-slate-50 mb-3">
                     <Megaphone className="size-6 text-slate-300" />
                  </div>
                  <p className="text-sm font-semibold text-slate-900">No campaigns yet</p>
                  <p className="text-xs text-slate-500 mt-1">Create your first campaign to get started.</p>
               </div>
             ) : (
               <div className="flex flex-col gap-3 p-4 border-t border-slate-100 bg-slate-50/50">
                 {overview.recentCampaigns.map((c) => {
                   const progress = c.recipients ? Math.round((c.sent / c.recipients) * 100) : 0;
                   return (
                     <Link
                       key={c.id}
                       to="/campaigns/$id"
                       params={{ id: c.id }}
                       className="block p-4 rounded-xl border border-slate-200 bg-white shadow-sm hover:shadow-md hover:-translate-y-[2px] hover:border-emerald-200 transition-all"
                     >
                       <div className="flex flex-wrap items-center justify-between gap-2">
                         <p className="text-sm font-semibold text-slate-800">{c.name}</p>
                         <StatusBadge status={c.status} />
                       </div>
                       <div className="mt-3 flex items-center gap-3">
                         <Progress value={progress} className="h-1.5 flex-1 bg-slate-100 [&>div]:bg-emerald-500" />
                         <span className="w-24 shrink-0 text-right text-xs font-medium tabular-nums text-slate-500">
                           {num(c.sent)} / {num(c.recipients)}
                         </span>
                       </div>
                     </Link>
                   );
                 })}
               </div>
             )}
           </SectionCard>

           <SectionCard
             className="rounded-xl border border-slate-200 shadow-sm flex flex-col h-full"
             title="Recent conversations"
             description="Latest messages from contacts"
             actions={
               <Button variant="ghost" size="sm" asChild className="text-slate-500">
                 <Link to="/inbox">Open inbox <ArrowRight className="ml-1 size-3.5" /></Link>
               </Button>
             }
             bodyClassName="p-0 flex-1 flex flex-col"
           >
             {overview.recentConversations.length === 0 ? (
               <div className="flex flex-1 flex-col items-center justify-center p-4 text-center border-t border-slate-100">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-slate-50 mb-2">
                     <MessageCircle className="size-5 text-slate-300" />
                  </div>
                  <p className="text-xs font-semibold text-slate-900">No conversations yet</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Messages will appear here once you start chatting.</p>
               </div>
             ) : (
               <div className="flex flex-col gap-2 p-3 border-t border-slate-100 bg-slate-50/50">
                 {overview.recentConversations.map((cv) => (
                   <Link
                     key={cv.id}
                     to="/inbox"
                     className="flex items-start gap-2.5 p-2.5 rounded-lg border border-slate-200 bg-white shadow-sm hover:shadow-md hover:-translate-y-[1px] hover:border-blue-200 transition-all"
                   >
                     <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[10px] font-bold text-blue-600 border border-blue-100">
                       {cv.contactName.slice(0, 2).toUpperCase()}
                     </span>
                     <div className="min-w-0 flex-1">
                       <div className="flex items-center justify-between gap-1">
                         <p className="truncate text-xs font-semibold text-slate-800">{cv.contactName}</p>
                         <span className="shrink-0 text-[10px] font-medium text-slate-400">
                           {relative(cv.lastMessageAt)}
                         </span>
                       </div>
                       <p className="truncate text-[11px] text-slate-500 mt-0.5">{cv.lastMessage}</p>
                     </div>
                     {cv.unreadCount > 0 && (
                       <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[9px] font-bold text-white shadow-sm shadow-blue-500/30">
                         {cv.unreadCount}
                       </span>
                     )}
                   </Link>
                 ))}
               </div>
             )}
           </SectionCard>
        </div>

        <SectionCard className="rounded-xl border border-slate-200 shadow-sm flex flex-col h-full" title="Quick actions" description="Common tasks" bodyClassName="p-0 flex-1 flex flex-col">
          <div className="grid grid-cols-2 gap-2 p-3 border-t border-slate-100 bg-slate-50/50 flex-1">
            {[
              { label: "Create campaign", to: "/campaigns/create", icon: Send, color: "text-white", bg: "bg-emerald-500" },
              { label: "Import contacts", to: "/contacts", icon: Users, color: "text-white", bg: "bg-blue-500" },
              { label: "Build automation", to: "/automations/create", icon: Workflow, color: "text-white", bg: "bg-purple-500" },
              { label: "New template", to: "/templates/create", icon: MessageSquarePlus, color: "text-white", bg: "bg-orange-500" },
            ].map((a) => (
              <Link key={a.label} to={a.to} className="flex flex-col items-center justify-center text-center p-3 rounded-lg border border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm transition-all gap-2 group">
                <span className={cn("flex size-8 items-center justify-center rounded-lg shadow-sm transition-transform group-hover:scale-105", a.bg)}>
                  <a.icon className={cn("size-4 drop-shadow-sm", a.color)} />
                </span>
                <span className="text-[10px] font-semibold text-slate-700">{a.label}</span>
              </Link>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
