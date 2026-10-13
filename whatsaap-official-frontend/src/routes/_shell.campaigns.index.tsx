import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { AlertCircle, Calendar, CheckCheck, Eye, FileText, Loader2, Megaphone, MoreHorizontal, Pause, Pencil, Play, Plus, Repeat2, Search, Send, Users } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { SectionCard } from "@/components/common/SectionCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { CampaignEditDialog } from "@/components/campaigns/CampaignEditDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { campaignService } from "@/services";
import { dateTime, num, pct } from "@/lib/format";
import type { Campaign, CampaignStatus } from "@/types";

export const Route = createFileRoute("/_shell/campaigns/")({
  head: () => ({ meta: [{ title: "Campaigns — WAFlow" }] }),
  component: CampaignsPage,
});

const tabs: { value: "all" | CampaignStatus; label: string }[] = [
  { value: "all", label: "All" },
  { value: "running", label: "Running" },
  { value: "scheduled", label: "Scheduled" },
  { value: "completed", label: "Completed" },
  { value: "draft", label: "Drafts" },
  { value: "paused", label: "Paused" },
];

function CampaignsPage() {
  const [tab, setTab] = useState<"all" | CampaignStatus>("all");
  const [query, setQuery] = useState("");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const requestVersion = useRef(0);
  const refreshTimer = useRef<number | null>(null);

  const load = useCallback(
    async (options: { silent?: boolean } = {}) => {
      const version = ++requestVersion.current;
      if (!options.silent) setLoading(true);
      try {
        const rows = await campaignService.list({ search: query, status: tab });
        if (version === requestVersion.current) setCampaigns(rows);
      } catch (error) {
        if (!options.silent && version === requestVersion.current)
          toast.error(error instanceof Error ? error.message : "Unable to load campaigns");
      } finally {
        if (!options.silent && version === requestVersion.current) setLoading(false);
      }
    },
    [query, tab],
  );

  useEffect(() => {
    void load();
    return () => {
      requestVersion.current += 1;
    };
  }, [load]);

  const filtered = useMemo(() => campaigns, [campaigns]);
  const totals = campaigns.reduce(
    (a, c) => ({
      sent: a.sent + c.sent,
      delivered: a.delivered + c.delivered,
      read: a.read + c.read,
    }),
    { sent: 0, delivered: 0, read: 0 },
  );

  const queueSilentRefresh = useCallback(() => {
    if (document.visibilityState !== "visible" || refreshTimer.current) return;
    refreshTimer.current = window.setTimeout(() => {
      refreshTimer.current = null;
      load({ silent: true });
    }, 2000);
  }, [load]);

  useEffect(() => {
    const unsubscribe = campaignService.subscribe((event) => {
      if (event.type !== "connected") queueSilentRefresh();
    });
    document.addEventListener("visibilitychange", queueSilentRefresh);

    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", queueSilentRefresh);
      if (refreshTimer.current) {
        window.clearTimeout(refreshTimer.current);
        refreshTimer.current = null;
      }
    };
  }, [queueSilentRefresh]);

  async function setStatus(id: string, status: "running" | "paused") {
    try {
      await campaignService.updateStatus(id, status);
      toast.success(status === "paused" ? "Campaign paused" : "Campaign started");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update campaign");
    }
  }

  async function rerun(id: string) {
    try {
      await campaignService.rerun(id);
      toast.success("Campaign queued to rerun");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to rerun campaign");
    }
  }

  return (
    <div className="space-y-2">
      {/* Consolidated Top Command Header Row */}
      <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between pb-0.5">
        {/* Left: Title + Unified Compact Metrics Strip */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5">
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 leading-none">Campaigns</h1>
            <span className="inline-flex items-center justify-center rounded-md bg-primary/10 text-primary px-1.5 py-0.5 text-[11px] font-bold leading-none">
              {campaigns.length}
            </span>
          </div>

          <div className="hidden sm:inline-flex items-center divide-x divide-slate-200 rounded-md border border-slate-200/80 bg-slate-50/80 text-[11px] text-muted-foreground font-medium shadow-2xs">
            <span className="inline-flex items-center gap-1 px-2 py-0.5">
              <Send className="size-3 text-emerald-600" />
              <strong className="text-slate-800 font-semibold">{num(totals.sent)}</strong> sent
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5">
              <CheckCheck className="size-3 text-blue-600" />
              <strong className="text-slate-800 font-semibold">{pct(totals.sent ? (totals.delivered / totals.sent) * 100 : 0)}</strong> delivered
            </span>
            <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5">
              <Eye className="size-3 text-amber-600" />
              <strong className="text-slate-800 font-semibold">{pct(totals.delivered ? (totals.read / totals.delivered) * 100 : 0)}</strong> read
            </span>
          </div>
        </div>

        {/* Center & Right: Filter Tabs + Search + Action in the SAME row */}
        <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
          {/* Status Tabs */}
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="w-auto overflow-hidden">
            <TabsList className="h-8 p-0.5 rounded-md bg-slate-100 flex-nowrap no-scrollbar text-xs">
              {tabs.map((t) => (
                <TabsTrigger key={t.value} value={t.value} className="whitespace-nowrap h-7 text-xs px-2 sm:px-2.5 rounded-sm">
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {/* Search Input */}
          <div className="relative flex-1 sm:w-44 md:w-52">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search campaigns..."
              className="pl-8 h-8 text-xs bg-white rounded-md border-slate-200/90 shadow-2xs"
            />
          </div>

          <div className="h-4 w-px bg-slate-200 hidden sm:block mx-0.5" />

          {/* New Campaign Button */}
          <Button asChild size="sm" className="h-8 text-xs px-2.5 sm:px-3 rounded-md bg-primary text-primary-foreground shadow-2xs shrink-0 gap-1">
            <Link to="/campaigns/create">
              <Plus className="size-3.5" /> <span className="hidden sm:inline">New campaign</span><span className="sm:hidden">New</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Main Table Card (Starts immediately with reduced border radius) */}
      <SectionCard bodyClassName="p-0" className="rounded-lg border-slate-200/90 shadow-xs">
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading campaigns...
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title="No campaigns here yet"
            description="Create your first campaign to reach a segment of contacts with one message."
            actions={
              <Button asChild>
                <Link to="/campaigns/create">
                  <Plus className="size-4" /> New campaign
                </Link>
              </Button>
            }
            className="border-0 shadow-none"
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Audience</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Scheduled</TableHead>
                <TableHead className="w-[260px]">Progress</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => {
                const progress = c.recipients ? Math.round((c.sent / c.recipients) * 100) : 0;
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Link
                          to="/campaigns/$id"
                          params={{ id: c.id }}
                          className="text-xs font-semibold tracking-tight text-foreground hover:text-primary transition-colors truncate max-w-[200px]"
                        >
                          {c.name}
                        </Link>
                        <StatusBadge status={c.status} className="shrink-0" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium whitespace-nowrap"><Users className="size-3.5" /> {c.audience}</span>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium whitespace-nowrap"><FileText className="size-3.5" /> {c.templateName}</span>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium whitespace-nowrap"><Calendar className="size-3.5" /> {c.scheduledAt ? dateTime(c.scheduledAt) : "Not scheduled"}</span>
                    </TableCell>
                    <TableCell>
                      <div className="w-full max-w-[240px] rounded-md bg-surface-muted/70 p-2 border border-border/40">
                        <div className="flex items-center justify-between text-xs font-medium text-slate-700 mb-1">
                          <span>
                            <strong className="text-foreground font-semibold">{num(c.sent)}</strong> / {num(c.recipients)} sent
                          </span>
                          <span className="text-primary font-bold">{progress}%</span>
                        </div>
                        <Progress value={progress} className="h-1 bg-border/50" />
                        <div className="mt-1 flex items-center justify-between text-[10px] font-medium text-muted-foreground/80">
                          <span className="flex items-center gap-1 text-emerald-600"><CheckCheck className="size-3" /> {num(c.delivered)}</span>
                          <span className="flex items-center gap-1 text-blue-600"><Eye className="size-3" /> {num(c.read)}</span>
                          <span className={`flex items-center gap-1 ${c.failed ? "text-destructive font-semibold" : ""}`}><AlertCircle className="size-3" /> {num(c.failed)}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Open menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {c.status === "running" ? (
                            <DropdownMenuItem onClick={() => setStatus(c.id, "paused")}>
                              <Pause className="mr-2 h-4 w-4" /> Pause
                            </DropdownMenuItem>
                          ) : c.status === "paused" || c.status === "draft" ? (
                            <DropdownMenuItem onClick={() => setStatus(c.id, "running")}>
                              <Play className="mr-2 h-4 w-4" /> Start
                            </DropdownMenuItem>
                          ) : null}
                          {["completed", "failed"].includes(c.status) ? (
                            <DropdownMenuItem onClick={() => rerun(c.id)}>
                              <Repeat2 className="mr-2 h-4 w-4" /> Rerun
                            </DropdownMenuItem>
                          ) : null}
                          <CampaignEditDialog
                            campaign={c}
                            onSaved={() => {
                              void load();
                            }}
                            trigger={
                              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                <Pencil className="mr-2 h-4 w-4" /> Edit
                              </DropdownMenuItem>
                            }
                          />
                          <DropdownMenuItem asChild>
                            <Link to="/campaigns/$id" params={{ id: c.id }}>
                              <div className="flex items-center w-full">
                                <Eye className="mr-2 h-4 w-4" /> Details
                              </div>
                            </Link>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </SectionCard>
    </div>
  );
}
