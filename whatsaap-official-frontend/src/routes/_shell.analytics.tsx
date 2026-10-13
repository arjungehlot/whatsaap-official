import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { dashboardService } from "@/services";
import { StatCard } from "@/components/common/StatCard";
import { SectionCard } from "@/components/common/SectionCard";
import {
  Send,
  CheckCheck,
  Eye,
  AlertTriangle,
  Loader2,
  Calendar,
  BarChart3,
  TrendingUp,
} from "lucide-react";
import { num, pct } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_shell/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — WAFlow" },
    ],
  }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const [dateRange, setDateRange] = useState("Last 7 Days");

  const overviewQuery = useQuery({
    queryKey: ["dashboard-overview"],
    queryFn: dashboardService.overview,
    staleTime: 15_000,
  });

  const overview = overviewQuery.data ?? null;
  const loading = overviewQuery.isLoading;

  useEffect(() => {
    if (overviewQuery.error) {
      toast.error("Unable to load analytics data");
    }
  }, [overviewQuery.error]);

  if (loading || !overview) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 text-center">
        <Loader2 className="size-7 animate-spin text-primary" />
        <p className="text-sm font-medium">Loading analytics data...</p>
      </div>
    );
  }

  const { analytics, recentCampaigns } = overview;
  const series = analytics.series;

  // Formatting tooltips for Recharts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-lg">
          <p className="mb-2 text-sm font-semibold">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={`item-${index}`} className="flex items-center gap-2 text-xs">
              <div
                className="size-2 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="font-medium">{entry.name}:</span>
              <span>{entry.value.toLocaleString()}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const funnelData = [
    { name: "Sent", value: analytics.totals.sent, fill: "#3b82f6" },
    { name: "Delivered", value: analytics.totals.delivered, fill: "#10b981" },
    { name: "Read", value: analytics.totals.read, fill: "#8b5cf6" },
  ];

  return (
    <div className="space-y-2.5 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg sm:text-xl font-bold tracking-tight">Analytics Overview</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Deep dive into your WhatsApp message performance and engagement.
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" className="gap-1.5 rounded-full h-8 text-xs px-3">
            <Calendar className="size-3.5 text-muted-foreground" />
            {dateRange}
          </Button>
          <Button size="sm" className="rounded-full gap-1.5 h-8 text-xs px-3">
            <BarChart3 className="size-3.5" />
            Export Report
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Total Sent"
          value={num(analytics.totals.sent)}
          icon={Send}
          iconColor="text-white"
          iconBg="bg-blue-500 bg-gradient-to-br from-blue-400 to-blue-600"
          spark={series.map((s) => s.sent)}
          sparkColor="text-blue-500"
        />
        <StatCard
          label="Delivered Rate"
          value={pct(analytics.totals.deliveryRate)}
          icon={CheckCheck}
          iconColor="text-white"
          iconBg="bg-emerald-500 bg-gradient-to-br from-emerald-400 to-emerald-600"
          spark={series.map((s) => s.delivered)}
          sparkColor="text-emerald-500"
        />
        <StatCard
          label="Read Rate"
          value={pct(analytics.totals.readRate)}
          icon={Eye}
          iconColor="text-white"
          iconBg="bg-violet-500 bg-gradient-to-br from-violet-400 to-violet-600"
          spark={series.map((s) => Math.floor(s.delivered * 0.8))} // mock read metric for sparkline
          sparkColor="text-violet-500"
        />
        <StatCard
          label="Failed Rate"
          value={pct(analytics.totals.failedRate)}
          icon={AlertTriangle}
          iconColor="text-white"
          iconBg="bg-rose-500 bg-gradient-to-br from-rose-400 to-rose-600"
          spark={series.map((s) => s.sent - s.delivered)}
          sparkColor="text-rose-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart Area */}
        <SectionCard className="lg:col-span-2 flex flex-col">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">Message Volume & Engagement</h2>
              <p className="text-sm text-muted-foreground mt-1">Delivery trends over the last 7 days</p>
            </div>
            <div className="flex items-center gap-3 text-sm">
               <div className="flex items-center gap-1.5"><div className="size-2.5 rounded-full bg-blue-500" /> Sent</div>
               <div className="flex items-center gap-1.5"><div className="size-2.5 rounded-full bg-emerald-500" /> Delivered</div>
            </div>
          </div>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorDelivered" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="label" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} 
                  dy={10} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} 
                />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'hsl(var(--border))', strokeWidth: 1, strokeDasharray: "4 4" }} />
                <Area
                  type="monotone"
                  dataKey="sent"
                  name="Sent"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorSent)"
                  activeDot={{ r: 6, strokeWidth: 0, fill: "#3b82f6" }}
                />
                <Area
                  type="monotone"
                  dataKey="delivered"
                  name="Delivered"
                  stroke="#10b981"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorDelivered)"
                  activeDot={{ r: 6, strokeWidth: 0, fill: "#10b981" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        {/* Funnel Chart */}
        <SectionCard className="flex flex-col">
           <div className="mb-6">
              <h2 className="text-base font-semibold">Delivery Funnel</h2>
              <p className="text-sm text-muted-foreground mt-1">Conversion from send to read</p>
           </div>
           <div className="flex-1 min-h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnelData} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="hsl(var(--border))" />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false} 
                  width={75}
                  tick={{ fontSize: 13, fontWeight: 500, fill: "hsl(var(--foreground))" }} 
                />
                <Tooltip 
                  cursor={{ fill: 'hsl(var(--muted)/0.5)' }} 
                  contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => [value.toLocaleString(), "Messages"]}
                />
                <Bar 
                  dataKey="value" 
                  radius={[0, 4, 4, 0]} 
                  barSize={32}
                >
                  {funnelData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
           </div>
           
           <div className="mt-4 rounded-xl bg-slate-50 p-4 border border-slate-100 flex items-center justify-between dark:bg-muted/30 dark:border-border">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Overall Read Rate</p>
                <p className="text-2xl font-bold mt-1 text-slate-900 dark:text-foreground">{pct(analytics.totals.readRate)}</p>
              </div>
              <div className="size-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center dark:bg-emerald-900/30 dark:text-emerald-400">
                <TrendingUp className="size-6" />
              </div>
           </div>
        </SectionCard>
      </div>
      
      {/* Campaign Performance Table */}
      <SectionCard className="p-0 overflow-hidden">
        <div className="p-5 border-b border-border">
          <h2 className="text-base font-semibold">Recent Campaign Performance</h2>
          <p className="text-sm text-muted-foreground mt-1">Delivery and read rates for active campaigns</p>
        </div>
        <div className="w-full overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-border dark:bg-muted/30">
              <tr>
                <th className="px-5 py-3 font-medium">Campaign Name</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium text-right">Sent</th>
                <th className="px-5 py-3 font-medium text-right">Delivered</th>
                <th className="px-5 py-3 font-medium">Read Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {recentCampaigns.slice(0, 5).map((campaign) => {
                const readRate = Math.min(100, Math.round((campaign.delivered / Math.max(campaign.sent, 1)) * 100) * 0.85); // Mock read rate
                return (
                  <tr key={campaign.id} className="hover:bg-slate-50/50 dark:hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-foreground">{campaign.name}</td>
                    <td className="px-5 py-3.5">
                      <span className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
                        campaign.status === "running" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                        campaign.status === "completed" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                        "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      )}>
                        {campaign.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right font-medium">{num(campaign.sent)}</td>
                    <td className="px-5 py-3.5 text-right font-medium">{num(campaign.delivered)}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <Progress value={readRate} className="h-2 w-24" />
                        <span className="text-xs font-medium text-muted-foreground w-8">{readRate}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {recentCampaigns.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">
                    No recent campaigns found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
