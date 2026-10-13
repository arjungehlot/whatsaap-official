import { useCallback, useEffect, useRef, useState } from "react";
import { Link, createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, AlertCircle, CheckCheck, ChevronDown, ChevronUp, Pause, Pencil, Play, Repeat2, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { SectionCard } from "@/components/common/SectionCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { CampaignEditDialog } from "@/components/campaigns/CampaignEditDialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { campaignService } from "@/services";
import { dateTime, num, pct } from "@/lib/format";
import { useRequestFence } from "@/hooks/use-request-fence";

function MessageCell({ message }: { message?: string | null | undefined }) {
  const [expanded, setExpanded] = useState(false);

  if (!message || message === "-") return <span className="text-muted-foreground">-</span>;

  return (
    <div className="max-w-[280px]">
      {!expanded ? (
        <div className="flex items-center gap-1.5">
          <span className="line-clamp-1 flex-1 text-xs text-muted-foreground">{message}</span>
          <Button variant="ghost" size="icon" className="size-5 shrink-0 rounded-md bg-surface-muted hover:bg-secondary" onClick={() => setExpanded(true)}>
            <ChevronDown className="size-3 text-muted-foreground" />
          </Button>
        </div>
      ) : (
        <div className="space-y-1.5 rounded-md border border-border bg-surface-muted/50 p-2">
          <div className="whitespace-pre-wrap text-xs text-foreground leading-relaxed max-h-36 overflow-y-auto">{message}</div>
          <Button variant="secondary" size="sm" className="h-6 w-full text-[11px] font-medium shadow-2xs" onClick={() => setExpanded(false)}>
            Collapse <ChevronUp className="size-2.5 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}

export const Route = createFileRoute("/_shell/campaigns/$id")({
  loader: async ({ params }) => {
    try {
      const [campaign, recipients] = await Promise.all([
        campaignService.get(params.id),
        campaignService.recipients(params.id),
      ]);
      return { campaign, recipients };
    } catch (error) {
      if (error instanceof Error && /not found/i.test(error.message)) {
        throw notFound();
      }
      throw error;
    }
  },
  component: CampaignDetailRoute,
});

function CampaignDetailRoute() {
  const { campaign, recipients } = Route.useLoaderData();
  return <CampaignDetailPage key={campaign.id} initialCampaign={campaign} initialRecipients={recipients} />;
}

function CampaignDetailPage({
  initialCampaign,
  initialRecipients,
}: {
  initialCampaign: Awaited<ReturnType<typeof campaignService.get>>;
  initialRecipients: Awaited<ReturnType<typeof campaignService.recipients>>;
}) {
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState(initialCampaign);
  const [recipients, setRecipients] = useState(initialRecipients);
  const refreshInFlight = useRef(false);
  const refreshTimer = useRef<number | null>(null);
  const startRefreshRequest = useRequestFence();
  const c = campaign;
  const progress = c.recipients ? Math.round((c.sent / c.recipients) * 100) : 0;
  const needsSenderReplacement = c.status === "paused" && /whatsapp number in this slot changed/i.test(c.lastError || "");

  const refresh = useCallback(async () => {
    if (refreshInFlight.current) return;
    const isCurrent = startRefreshRequest();
    refreshInFlight.current = true;
    try {
      const [nextCampaign, nextRecipients] = await Promise.all([
        campaignService.get(initialCampaign.id),
        campaignService.recipients(initialCampaign.id),
      ]);
      if (isCurrent()) {
        setCampaign(nextCampaign);
        setRecipients(nextRecipients);
      }
    } catch (_error) {
      // Keep detail view stable
    } finally {
      if (isCurrent()) refreshInFlight.current = false;
    }
  }, [initialCampaign.id, startRefreshRequest]);

  const queueRefresh = useCallback(() => {
    if (document.visibilityState !== "visible" || refreshTimer.current) return;
    refreshTimer.current = window.setTimeout(() => {
      refreshTimer.current = null;
      refresh();
    }, 2000);
  }, [refresh]);

  useEffect(() => {
    const unsubscribe = campaignService.subscribe((event) => {
      if (event.type !== "connected") return;
      if (!event.campaignId || event.campaignId === c.id) queueRefresh();
    });
    document.addEventListener("visibilitychange", queueRefresh);

    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", queueRefresh);
      if (refreshTimer.current) {
        window.clearTimeout(refreshTimer.current);
        refreshTimer.current = null;
      }
    };
  }, [c.id, queueRefresh]);

  async function setStatus(status: "running" | "paused") {
    try {
      await campaignService.updateStatus(c.id, status);
      toast.success(status === "paused" ? "Campaign paused" : "Campaign resumed");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update campaign");
    }
  }

  async function remove() {
    try {
      await campaignService.delete(c.id);
      toast.success("Campaign deleted");
      navigate({ to: "/campaigns" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete campaign");
    }
  }

  async function rerun() {
    try {
      await campaignService.rerun(c.id);
      toast.success("Campaign queued to rerun");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to rerun campaign");
    }
  }

  async function resumeWithReplacement() {
    try {
      const updated = await campaignService.resumeReplacement(c.id);
      setCampaign(updated);
      toast.success("Campaign resumed with the replacement number", {
        description: "Only recipients that have not already been sent will continue.",
      });
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to continue this campaign");
    }
  }

  return (
    <div className="space-y-2.5">
      {/* Consolidated Top Header Row */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pb-0.5">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground -ml-1 gap-1" asChild>
            <Link to="/campaigns">
              <ArrowLeft className="size-3.5" /> Back to campaigns
            </Link>
          </Button>
          <div className="h-3.5 w-px bg-slate-200" />
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 leading-none truncate">{c.name}</h1>
            <StatusBadge status={c.status} className="shrink-0" />
            <span className="hidden md:inline-flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium">
              <span>{c.audience}</span>
              <span className="text-slate-300">•</span>
              <span>created {dateTime(c.createdAt)}</span>
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
          {c.status === "running" ? (
            <Button variant="outline" size="sm" className="h-8 text-xs px-2.5 rounded-md gap-1 text-amber-700 border-amber-200 bg-amber-50 hover:bg-amber-100" onClick={() => setStatus("paused")}>
              <Pause className="size-3.5" /> Pause
            </Button>
          ) : ["paused", "draft"].includes(c.status) && !needsSenderReplacement ? (
            <Button variant="outline" size="sm" className="h-8 text-xs px-2.5 rounded-md gap-1 text-emerald-700 border-emerald-200 bg-emerald-50 hover:bg-emerald-100" onClick={() => setStatus("running")}>
              <Play className="size-3.5" /> Start
            </Button>
          ) : null}

          {needsSenderReplacement ? (
            <ConfirmDialog
              trigger={
                <Button variant="outline" size="sm" className="h-8 text-xs px-2.5 rounded-md gap-1.5 border-amber-300 bg-amber-50 text-amber-900 shadow-2xs hover:bg-amber-100">
                  <Send className="size-3.5 text-amber-600" /> Continue with replacement
                </Button>
              }
              title="Continue this campaign with the replacement number?"
              description="The prior WhatsApp number in this slot was replaced. Only recipients that have not already been sent will continue. Completed deliveries and their credits remain unchanged."
              confirmLabel="Continue campaign"
              destructive={false}
              onConfirm={resumeWithReplacement}
            />
          ) : null}

          {["completed", "failed"].includes(c.status) ? (
            <Button variant="outline" size="sm" className="h-8 text-xs px-2.5 rounded-md gap-1" onClick={rerun}>
              <Repeat2 className="size-3.5" /> Rerun
            </Button>
          ) : null}

          <CampaignEditDialog
            campaign={c}
            onSaved={(updated) => setCampaign(updated)}
            trigger={
              <Button variant="outline" size="sm" className="h-8 text-xs px-2.5 rounded-md gap-1">
                <Pencil className="size-3.5" /> Edit
              </Button>
            }
          />

          <ConfirmDialog
            trigger={
              <Button variant="destructive" size="sm" className="h-8 text-xs px-2.5 rounded-md gap-1">
                <Trash2 className="size-3.5" /> Delete
              </Button>
            }
            title="Delete this campaign?"
            description="Delivery rows for this campaign will no longer be available."
            confirmLabel="Delete"
            onConfirm={remove}
          />
        </div>
      </div>

      {/* Sender Replacement Notice (Compact Alert) */}
      {needsSenderReplacement && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-900 shadow-2xs">
          <AlertCircle className="size-4 shrink-0 text-amber-600" />
          <p className="flex-1 text-[11px] leading-snug">
            The campaign is paused because its WhatsApp sender changed. Confirm the replacement sender above to resume only the recipients that remain unsent.
          </p>
        </div>
      )}

      {/* Compact 4-Metric Row (Reduced Radius & Height) */}
      <div className="grid gap-2 grid-cols-2 md:grid-cols-4">
        {/* Progress Card */}
        <div className="rounded-lg border border-slate-200/90 bg-white p-2.5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-[11px] font-medium text-slate-500">Progress</span>
            <span className="text-sm font-bold text-primary tabular-nums leading-none">{progress}%</span>
          </div>
          <Progress value={progress} className="h-1.5 bg-slate-100" />
        </div>

        {/* Sent Card */}
        <div className="rounded-lg border border-slate-200/90 bg-white p-2.5 shadow-2xs flex items-center gap-2.5">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-600">
            <Send className="size-3.5" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-slate-500 leading-tight">Sent</p>
            <p className="text-sm font-bold text-slate-900 leading-none mt-1 tabular-nums">
              {num(c.sent)} <span className="text-[11px] font-normal text-muted-foreground">/ {num(c.recipients)}</span>
            </p>
          </div>
        </div>

        {/* Delivered Card */}
        <div className="rounded-lg border border-slate-200/90 bg-white p-2.5 shadow-2xs flex items-center gap-2.5">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-600">
            <CheckCheck className="size-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1">
              <p className="text-[11px] font-medium text-slate-500 leading-tight">Delivered</p>
              <span className="text-[10px] font-semibold text-emerald-600">
                {pct(c.sent ? (c.delivered / c.sent) * 100 : 0)}
              </span>
            </div>
            <p className="text-sm font-bold text-slate-900 leading-none mt-1 tabular-nums">
              {num(c.delivered)}
            </p>
          </div>
        </div>

        {/* Failed Card */}
        <div className="rounded-lg border border-slate-200/90 bg-white p-2.5 shadow-2xs flex items-center gap-2.5">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-rose-50 text-rose-600">
            <AlertCircle className="size-3.5" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-slate-500 leading-tight">Failed</p>
            <p className="text-sm font-bold text-slate-900 leading-none mt-1 tabular-nums">
              {num(c.failed)}
            </p>
          </div>
        </div>
      </div>

      {/* Campaign Setup & Message Snapshot Section (Balanced 2-Column Studio Grid) */}
      <SectionCard
        title="Campaign setup"
        description="The saved content and audience for this campaign."
        className="rounded-lg border-slate-200/90 shadow-2xs overflow-hidden"
        bodyClassName="p-3"
      >
        <div className="grid gap-3 lg:grid-cols-12 items-start">
          {/* Left: Metadata specs (6 cols) */}
          <div className="lg:col-span-6 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-md bg-slate-50 p-2 border border-slate-100">
              <span className="text-[10px] font-medium text-muted-foreground block">Audience</span>
              <span className="font-semibold text-slate-800 text-[11px] truncate block">{c.audience}</span>
            </div>
            <div className="rounded-md bg-slate-50 p-2 border border-slate-100">
              <span className="text-[10px] font-medium text-muted-foreground block">Template</span>
              <span className="font-semibold text-slate-800 text-[11px] truncate block">{c.templateName}</span>
            </div>
            <div className="rounded-md bg-slate-50 p-2 border border-slate-100">
              <span className="text-[10px] font-medium text-muted-foreground block">Schedule</span>
              <span className="font-semibold text-slate-800 text-[11px] truncate block">
                {c.scheduledAt ? `${dateTime(c.scheduledAt)}` : "Sent immediately"}
              </span>
            </div>
            <div className="rounded-md bg-slate-50 p-2 border border-slate-100">
              <span className="text-[10px] font-medium text-muted-foreground block">Rate Throttle</span>
              <span className="font-semibold text-slate-800 text-[11px] truncate block">
                {c.ratePerMinute ? `${c.ratePerMinute} msgs/hr` : "120 msgs/hr"}
              </span>
            </div>
            <div className="col-span-2 rounded-md bg-slate-50 p-2 border border-slate-100">
              <span className="text-[10px] font-medium text-muted-foreground block">Description / Note</span>
              <span className="font-medium text-slate-800 text-[11px] line-clamp-2">
                {c.description || "No internal description provided."}
              </span>
            </div>
          </div>

          {/* Right: Message snapshot preview (6 cols) */}
          <div className="lg:col-span-6 rounded-md border border-emerald-200/70 bg-[#EFEAE2]/60 p-2.5">
            <div className="flex items-center justify-between pb-1 mb-1.5 border-b border-emerald-900/10 text-[11px]">
              <span className="font-semibold text-emerald-950 flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-emerald-500" /> WhatsApp Message Snapshot
              </span>
              <span className="text-[10px] text-emerald-800/80 font-mono">{c.templateName}</span>
            </div>
            <div className="rounded-md bg-[#D9FDD3] p-2 text-slate-900 border border-emerald-200/60 shadow-2xs max-h-[130px] overflow-y-auto">
              <p className="whitespace-pre-wrap text-xs leading-relaxed font-sans">
                {c.templateBody || "Message snapshot is unavailable for this older campaign."}
              </p>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Recipients Table */}
      <SectionCard
        title="Recipients"
        description="Per-contact delivery status and the exact personalized message sent."
        actions={<span className="text-[11px] text-muted-foreground font-semibold bg-slate-100 px-2 py-0.5 rounded-md">{recipients.length} recipients</span>}
        className="rounded-lg border-slate-200/90 shadow-2xs"
        bodyClassName="p-0"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-xs">
            <thead className="bg-slate-50/80 text-left text-[11px] uppercase tracking-wide text-muted-foreground border-b border-border">
              <tr>
                <th className="px-3.5 py-2 font-semibold">Contact</th>
                <th className="px-3.5 py-2 font-semibold">Phone</th>
                <th className="px-3.5 py-2 font-semibold">Message sent</th>
                <th className="px-3.5 py-2 font-semibold">Status</th>
                <th className="px-3.5 py-2 font-semibold">Sent at</th>
                <th className="px-3.5 py-2 font-semibold">Error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {recipients.map((r) => (
                <tr key={r.contactId} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-3.5 py-2 font-medium text-slate-900">{r.name}</td>
                  <td className="px-3.5 py-2 text-muted-foreground font-mono">{r.phone}</td>
                  <td className="px-3.5 py-2 align-top">
                    <MessageCell message={r.body || c.templateBody} />
                  </td>
                  <td className="px-3.5 py-2">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-3.5 py-2 text-muted-foreground">
                    {r.sentAt ? dateTime(r.sentAt) : "-"}
                  </td>
                  <td className="px-3.5 py-2 text-destructive font-medium">{r.error ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
