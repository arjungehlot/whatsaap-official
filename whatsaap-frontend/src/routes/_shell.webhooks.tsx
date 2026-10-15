import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Copy,
  FileText,
  Globe,
  Pause,
  Play,
  Plus,
  RefreshCcw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  Webhook,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { SectionCard } from "@/components/common/SectionCard";
import { StatCard } from "@/components/common/StatCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { dateTime, num, pct, relative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useRequestFence } from "@/hooks/use-request-fence";
import { webhookService } from "@/services";
import type { WebhookDelivery, WebhookEndpoint, WebhookEventDefinition } from "@/types";

export const Route = createFileRoute("/_shell/webhooks")({
  head: () => ({
    meta: [
      { title: "Webhooks — Whatsaap Developers" },
      {
        name: "description",
        content:
          "Create webhook endpoints, subscribe to WhatsApp message and campaign events, inspect deliveries and replay failed attempts.",
      },
      { property: "og:title", content: "Webhooks — Whatsaap Developers" },
      {
        property: "og:description",
        content: "Manage event subscriptions and inspect webhook delivery logs in Whatsaap.",
      },
    ],
  }),
  component: WebhooksPage,
});

function copy(value: string, label: string) {
  void navigator.clipboard?.writeText(value);
  toast.success(`${label} copied`);
}

function WebhooksPage() {
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [events, setEvents] = useState<WebhookEventDefinition[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingDeliveries, setLoadingDeliveries] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeDelivery, setActiveDelivery] = useState<WebhookDelivery | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const startEndpointsRequest = useRequestFence();
  const startDeliveriesRequest = useRequestFence();

  const selected = endpoints.find((e) => e.id === selectedId) ?? endpoints[0];

  useEffect(() => {
    const isCurrent = startEndpointsRequest();
    void webhookService.list().then((data) => {
      if (!isCurrent()) return;
      setEndpoints(data.endpoints);
      setEvents(data.events);
      setSelectedId((current) => current || data.endpoints[0]?.id || "");
    }).catch((error) => {
      if (isCurrent()) toast.error("Could not load webhooks", { description: error instanceof Error ? error.message : "Please try again." });
    }).finally(() => {
      if (isCurrent()) setLoading(false);
    });
  }, [startEndpointsRequest]);

  useEffect(() => {
    if (!selected) {
      setDeliveries([]);
      return;
    }
    const isCurrent = startDeliveriesRequest();
    setLoadingDeliveries(true);
    void webhookService.deliveries(selected.id).then((data) => {
      if (isCurrent()) setDeliveries(data.deliveries);
    }).catch((error) => {
      if (isCurrent()) toast.error("Could not load deliveries", { description: error instanceof Error ? error.message : "Please try again." });
    }).finally(() => {
      if (isCurrent()) setLoadingDeliveries(false);
    });
  }, [selected?.id, startDeliveriesRequest]);

  const filtered = useMemo(
    () =>
      endpoints.filter((e) => {
        const matchesQuery =
          !query.trim() ||
          `${e.name} ${e.url}`.toLowerCase().includes(query.trim().toLowerCase());
        const matchesStatus = statusFilter === "all" || e.status === statusFilter;
        return matchesQuery && matchesStatus;
      }),
    [endpoints, query, statusFilter],
  );

  const endpointDeliveries = useMemo(
    () => deliveries.filter((d) => !selected || d.endpointId === selected.id),
    [deliveries, selected],
  );

  const totals = useMemo(() => {
    const active = endpoints.filter((e) => e.status === "active").length;
    const delivered = endpoints.reduce((sum, e) => sum + e.deliveries24h, 0);
    const failures = endpoints.reduce((sum, e) => sum + e.failures24h, 0);
    const rate = delivered ? ((delivered - failures) / delivered) * 100 : 100;
    return { active, delivered, failures, rate };
  }, [endpoints]);

  async function toggleStatus(id: string) {
    const endpoint = endpoints.find((item) => item.id === id);
    if (!endpoint) return;
    try {
      const updated = await webhookService.update(id, { status: endpoint.status === "paused" ? "active" : "paused" });
      setEndpoints((current) => current.map((item) => item.id === id ? updated : item));
      toast.success(updated.status === "paused" ? "Endpoint paused" : "Endpoint resumed");
    } catch (error) {
      toast.error("Could not update endpoint", { description: error instanceof Error ? error.message : "Please try again." });
    }
  }

  async function remove(id: string) {
    try {
      await webhookService.remove(id);
      const remaining = endpoints.filter((item) => item.id !== id);
      setEndpoints(remaining);
      setDeliveries((current) => current.filter((delivery) => delivery.endpointId !== id));
      if (selectedId === id) setSelectedId(remaining[0]?.id ?? "");
      toast.success("Endpoint deleted");
    } catch (error) {
      toast.error("Could not delete endpoint", { description: error instanceof Error ? error.message : "Please try again." });
    }
  }

  async function sendTest(endpoint: WebhookEndpoint) {
    try {
      const delivery = await webhookService.test(endpoint.id);
      setDeliveries((current) => [delivery, ...current]);
      toast.success("Test event sent", { description: delivery.event + " → " + (delivery.responseCode ?? "failed") });
    } catch (error) {
      toast.error("Test event failed", { description: error instanceof Error ? error.message : "Please try again." });
    }
  }

  async function replay(delivery: WebhookDelivery) {
    try {
      const next = await webhookService.replay(delivery.id);
      setDeliveries((current) => [next, ...current]);
      toast.success("Delivery replayed");
    } catch (error) {
      toast.error("Could not replay delivery", { description: error instanceof Error ? error.message : "Please try again." });
    }
  }

  async function createEndpoint(event: FormEvent<HTMLFormElement>, selectedEvents: string[]) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const url = String(form.get("url") || "");
    if (!/^https:\/\/.+/.test(url)) {
      toast.error("Endpoint URL must start with https://");
      return;
    }
    if (events.length === 0) {
      toast.error("Select at least one event");
      return;
    }
    if (selectedEvents.length === 0) {
      toast.error("Select at least one event");
      return;
    }
    try {
      const desc = String(form.get("description") || "").trim();
      const endpoint = await webhookService.create({
        name: String(form.get("name") || "New endpoint"),
        url,
        events: selectedEvents,
        retries: true,
        ...(desc ? { description: desc } : {}),
      });
      setEndpoints((current) => [endpoint, ...current]);
      setSelectedId(endpoint.id);
      setCreateOpen(false);
      toast.success("Webhook endpoint created", { description: endpoint.url });
    } catch (error) {
      toast.error("Could not create endpoint", { description: error instanceof Error ? error.message : "Please try again." });
    }
  }

  return (
    <div className="space-y-2.5">
      <PageHeader
        title="Webhooks"
        description="Receive real-time WhatsApp events on your own servers. Signed payloads, automatic retries and full delivery logs."
        actions={
          <CreateEndpointDialog
            open={createOpen}
            onOpenChange={setCreateOpen}
            onSubmit={createEndpoint}
            events={events}
          />
        }
      />

      <div className="grid grid-cols-2 gap-2 sm:gap-2.5 xl:grid-cols-4">
        <StatCard 
          label="Active endpoints" 
          value={`${totals.active}/${endpoints.length}`} 
          icon={Webhook} 
          iconColor="text-white"
          iconBg="bg-purple-500"
        />
        <StatCard 
          label="Deliveries (24h)" 
          value={num(totals.delivered)} 
          icon={Activity} 
          iconColor="text-white"
          iconBg="bg-blue-500"
        />
        <StatCard 
          label="Success rate" 
          value={pct(totals.rate)} 
          icon={CheckCircle2} 
          iconColor="text-white"
          iconBg="bg-emerald-500"
        />
        <StatCard 
          label="Failures (24h)" 
          value={num(totals.failures)} 
          icon={AlertTriangle} 
          iconColor="text-white"
          iconBg="bg-orange-500"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1.35fr]">
        <SectionCard title="Endpoints" description={`${filtered.length} configured`} bodyClassName="p-0">
          <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name or URL"
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="failing">Failing</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">Loading webhook endpoints...</p>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Webhook}
              iconClassName="bg-purple-50 text-purple-600 ring-purple-500/20"
              title="No endpoints match"
              description="Adjust your filters, or add a new HTTPS endpoint to start receiving events."
              className="border-0 shadow-none"
            />
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((endpoint) => (
                <li key={endpoint.id}>
                  <button
                    onClick={() => {
                      setSelectedId(endpoint.id);
                    }}
                    className={cn(
                      "w-full px-5 py-4 text-left transition-colors hover:bg-surface-muted",
                      selected?.id === endpoint.id && "bg-primary-soft/60",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{endpoint.name}</p>
                        <p className="truncate font-mono text-xs text-muted-foreground">{endpoint.url}</p>
                      </div>
                      <StatusBadge status={endpoint.status} />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>{endpoint.events.length} events</span>
                      <span>{pct(endpoint.successRate)} success</span>
                      <span>
                        {endpoint.lastDeliveryAt
                          ? `Last ${relative(endpoint.lastDeliveryAt)}`
                          : "No deliveries yet"}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        {selected ? (
          <div className="space-y-4">
            <SectionCard
              title={selected.name}
              description={selected.description ?? "Event delivery over HTTPS."}
              actions={
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => sendTest(selected)}>
                    <Send className="size-4" /> Send test
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => toggleStatus(selected.id)}>
                    {selected.status === "paused" ? (
                      <>
                        <Play className="size-4" /> Resume
                      </>
                    ) : (
                      <>
                        <Pause className="size-4" /> Pause
                      </>
                    )}
                  </Button>
                  <ConfirmDialog
                    title="Delete this endpoint?"
                    description="Whatsaap will stop sending events to this URL. Delivery history will be removed."
                    confirmLabel="Delete endpoint"
                    onConfirm={() => remove(selected.id)}
                    trigger={
                      <Button variant="ghost" size="sm" className="text-destructive">
                        <Trash2 className="size-4" /> Delete
                      </Button>
                    }
                  />
                </div>
              }
            >
              <dl className="grid gap-4 sm:grid-cols-2">
                <div className="min-w-0">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Endpoint URL
                  </dt>
                  <dd className="mt-1 flex items-center gap-2">
                    <code className="truncate rounded-md bg-surface-muted px-2 py-1 font-mono text-xs">
                      {selected.url}
                    </code>
                    <Button variant="ghost" size="icon" onClick={() => copy(selected.url, "URL")}>
                      <Copy className="size-3.5" />
                    </Button>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    API version
                  </dt>
                  <dd className="mt-1 text-sm">{selected.version}</dd>
                </div>
                <div className="sm:col-span-2 flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium">Automatic retries</p>
                    <p className="text-xs text-muted-foreground">
                      Up to 5 attempts with exponential backoff (1m → 8m → 1h → 6h).
                    </p>
                  </div>
                  <Switch
                    checked={selected.retries}
                    onCheckedChange={async (checked) => {
                      try {
                        const updated = await webhookService.update(selected.id, { retries: checked });
                        setEndpoints((current) => current.map((e) => (e.id === selected.id ? updated : e)));
                        toast.success(checked ? "Automatic retries enabled" : "Automatic retries disabled");
                      } catch (error) {
                        toast.error("Could not update retry settings", {
                          description: error instanceof Error ? error.message : "Please try again.",
                        });
                      }
                    }}
                  />
                </div>
              </dl>

              <div className="mt-5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Subscribed events
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {selected.events.map((id) => (
                    <Badge key={id} variant="secondary" className="font-mono text-[11px]">
                      {id}
                    </Badge>
                  ))}
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Recent deliveries"
              description="Every attempt with request and response payloads."
              bodyClassName="p-0"
            >
              <Tabs defaultValue="all">
                <div className="border-b border-border px-4 pt-3">
                  <TabsList>
                    <TabsTrigger value="all">All</TabsTrigger>
                    <TabsTrigger value="failed">Failed</TabsTrigger>
                    <TabsTrigger value="pending">Pending</TabsTrigger>
                  </TabsList>
                </div>
                {(["all", "failed", "pending"] as const).map((tab) => {
                  const rows =
                    tab === "all"
                      ? endpointDeliveries
                      : endpointDeliveries.filter((d) => d.status === tab);
                  return (
                    <TabsContent key={tab} value={tab} className="m-0">
                      {loadingDeliveries ? (
                        <p className="px-5 py-10 text-center text-sm text-muted-foreground">Loading deliveries...</p>
                      ) : rows.length === 0 ? (
                        <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                          No {tab === "all" ? "" : tab} deliveries for this endpoint.
                        </p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-2xl text-sm">
                            <thead className="bg-surface-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
                              <tr>
                                <th className="px-5 py-3 font-medium">Event</th>
                                <th className="px-5 py-3 font-medium">Status</th>
                                <th className="px-5 py-3 font-medium">Attempt</th>
                                <th className="px-5 py-3 font-medium">Duration</th>
                                <th className="px-5 py-3 font-medium">When</th>
                                <th className="px-5 py-3" />
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {rows.map((d) => (
                                <tr key={d.id} className="hover:bg-surface-muted/60">
                                  <td className="px-5 py-3">
                                    <span className="font-mono text-xs">{d.event}</span>
                                    <p className="text-xs text-muted-foreground">{d.id}</p>
                                  </td>
                                  <td className="px-5 py-3">
                                    <StatusBadge
                                      status={d.status === "succeeded" ? "delivered" : d.status}
                                    />
                                    <p className="mt-1 text-xs text-muted-foreground">
                                      {d.responseCode ?? "—"}
                                    </p>
                                  </td>
                                  <td className="px-5 py-3 text-muted-foreground">{d.attempt}</td>
                                  <td className="px-5 py-3 text-muted-foreground">
                                    {d.durationMs ? `${d.durationMs} ms` : "—"}
                                  </td>
                                  <td className="px-5 py-3 text-muted-foreground">{relative(d.at)}</td>
                                  <td className="px-5 py-3 text-right">
                                    <div className="flex justify-end gap-1">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setActiveDelivery(d)}
                                      >
                                        Inspect
                                      </Button>
                                      {d.status !== "succeeded" && (
                                        <Button variant="outline" size="sm" onClick={() => replay(d)}>
                                          <RefreshCcw className="size-3.5" /> Replay
                                        </Button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </TabsContent>
                  );
                })}
              </Tabs>
            </SectionCard>
          </div>
        ) : (
          <EmptyState
            icon={Webhook}
            iconClassName="bg-purple-50 text-purple-600 ring-purple-500/20"
            title="No webhook endpoints"
            description="Add an HTTPS endpoint to start receiving message, contact and campaign events in real time."
            actions={
              <Button
                size="sm"
                onClick={() => setCreateOpen(true)}
                className="h-8 text-xs px-3 rounded-lg bg-purple-600 hover:bg-purple-700 text-white shadow-xs font-semibold gap-1.5"
              >
                <Plus className="size-3.5" /> <span>Add endpoint</span>
              </Button>
            }
          />
        )}
      </div>

      <Dialog open={Boolean(activeDelivery)} onOpenChange={(open) => !open && setActiveDelivery(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-mono text-base">{activeDelivery?.event}</DialogTitle>
            <DialogDescription>
              {activeDelivery ? `${activeDelivery.id} · ${dateTime(activeDelivery.at)}` : null}
            </DialogDescription>
          </DialogHeader>
          {activeDelivery && (
            <div className="space-y-4">
              {activeDelivery.error && (
                <p className="rounded-lg border border-destructive/25 bg-destructive-soft px-3 py-2 text-sm text-destructive">
                  {activeDelivery.error}
                </p>
              )}
              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Request payload
                </p>
                <pre className="max-h-64 overflow-auto rounded-lg bg-surface-muted p-3 font-mono text-xs leading-relaxed">
                  {JSON.stringify(activeDelivery.requestBody, null, 2)}
                </pre>
              </div>
              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Response {activeDelivery.responseCode ? `· ${activeDelivery.responseCode}` : ""}
                </p>
                <pre className="overflow-auto rounded-lg bg-surface-muted p-3 font-mono text-xs">
                  {activeDelivery.responseBody || "— no response body —"}
                </pre>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                activeDelivery &&
                copy(JSON.stringify(activeDelivery.requestBody, null, 2), "Payload")
              }
            >
              <Copy className="size-4" /> Copy payload
            </Button>
            {activeDelivery && activeDelivery.status !== "succeeded" && (
              <Button
                onClick={() => {
                  replay(activeDelivery);
                  setActiveDelivery(null);
                }}
              >
                <RefreshCcw className="size-4" /> Replay delivery
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CreateEndpointDialog({
  open,
  onOpenChange,
  onSubmit,
  events,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>, events: string[]) => void;
  events: WebhookEventDefinition[];
}) {
  const [selectedEvents, setSelectedEvents] = useState<string[]>([
    "message.delivered",
    "message.failed",
  ]);
  const eventGroups = Array.from(new Set(events.map((event) => event.group)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-8 text-xs px-3 rounded-lg bg-purple-600 hover:bg-purple-700 text-white shadow-xs font-semibold gap-1.5 shrink-0">
          <Plus className="size-3.5" /> <span>Add endpoint</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[800px] p-5 rounded-2xl border-slate-200/90 shadow-2xl gap-0 overflow-hidden">
        {/* Header with attractive squircle badge */}
        <div className="flex items-center gap-3 pb-3 mb-3 border-b border-slate-100">
          <div className="flex size-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600 border border-purple-100/90 shadow-2xs shrink-0">
            <Webhook className="size-5 text-purple-600" />
          </div>
          <div>
            <DialogTitle className="text-[15px] font-bold text-slate-900 tracking-tight leading-snug">
              Add webhook endpoint
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              We&apos;ll POST signed JSON payloads to this URL whenever a selected event occurs.
            </DialogDescription>
          </div>
        </div>

        <form className="grid gap-3.5 md:grid-cols-12" onSubmit={(event) => onSubmit(event, selectedEvents)}>
          {/* Left Column: Details */}
          <div className="md:col-span-5 space-y-2.5">
            {/* Endpoint Name */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label htmlFor="wh-name" className="text-xs font-semibold text-slate-800">
                  Endpoint name
                </Label>
                <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200/60 leading-none">
                  Required
                </span>
              </div>
              <div className="relative flex items-center rounded-xl border border-slate-200/90 bg-white p-1 shadow-2xs hover:border-slate-300 focus-within:border-purple-500 focus-within:ring-2 focus-within:ring-purple-500/10 transition-all">
                <div className="flex size-6.5 items-center justify-center rounded-lg bg-purple-50 text-purple-600 shrink-0">
                  <Sparkles className="size-3.5" />
                </div>
                <input
                  id="wh-name"
                  name="name"
                  placeholder="e.g. CRM Sync Feed"
                  className="flex-1 h-7 bg-transparent px-2 text-xs !text-xs md:!text-xs text-slate-900 placeholder:text-slate-400 placeholder:text-[11px] focus:outline-hidden"
                  required
                />
              </div>
            </div>

            {/* Endpoint URL */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label htmlFor="wh-url" className="text-xs font-semibold text-slate-800">
                  Endpoint URL
                </Label>
                <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200/60 leading-none">
                  Required
                </span>
              </div>
              <div className="relative flex items-center rounded-xl border border-slate-200/90 bg-white p-1 shadow-2xs hover:border-slate-300 focus-within:border-purple-500 focus-within:ring-2 focus-within:ring-purple-500/10 transition-all">
                <div className="flex size-6.5 items-center justify-center rounded-lg bg-blue-50 text-blue-600 shrink-0">
                  <Globe className="size-3.5" />
                </div>
                <input
                  id="wh-url"
                  name="url"
                  placeholder="https://api.example.com/hooks/whatsaap"
                  className="flex-1 h-7 bg-transparent px-2 text-xs !text-xs md:!text-xs text-slate-900 placeholder:text-slate-400 placeholder:text-[11px] focus:outline-hidden font-mono"
                  required
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1">
              <Label htmlFor="wh-desc" className="text-xs font-semibold text-slate-700">
                Description (optional)
              </Label>
              <div className="relative flex items-center rounded-xl border border-slate-200/90 bg-white p-1 shadow-2xs hover:border-slate-300 focus-within:border-purple-500 focus-within:ring-2 focus-within:ring-purple-500/10 transition-all">
                <div className="flex size-6.5 items-center justify-center rounded-lg bg-slate-100 text-slate-600 shrink-0">
                  <FileText className="size-3.5" />
                </div>
                <input
                  id="wh-desc"
                  name="description"
                  placeholder="What consumes this feed?"
                  className="flex-1 h-7 bg-transparent px-2 text-xs !text-xs md:!text-xs text-slate-900 placeholder:text-slate-400 placeholder:text-[11px] focus:outline-hidden"
                />
              </div>
            </div>

            {/* Security Signatures Note */}
            <div className="flex items-center gap-2 rounded-xl border border-purple-200/70 bg-purple-50/60 p-2 text-purple-950 shadow-2xs">
              <ShieldCheck className="size-4 shrink-0 text-purple-600" />
              <div className="text-[10px] leading-snug">
                <strong className="font-semibold text-purple-900">Signed Payloads:</strong> Each delivery includes an HMAC-SHA256 signature in headers for tamper-proof verification.
              </div>
            </div>
          </div>

          {/* Right Column: Events */}
          <div className="md:col-span-7 flex flex-col space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-slate-800">Events to send</Label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setSelectedEvents(
                      selectedEvents.length === events.length ? [] : events.map((e) => e.id)
                    )
                  }
                  className="text-[10px] font-semibold text-purple-600 hover:text-purple-700 underline"
                >
                  {selectedEvents.length === events.length ? "Deselect all" : "Select all"}
                </button>
                <span className="rounded-full bg-purple-50 border border-purple-200/70 px-2 py-0.5 text-[10px] font-semibold text-purple-700">
                  {selectedEvents.length} selected
                </span>
              </div>
            </div>
            <div className="h-[214px] max-h-[214px] space-y-2 rounded-xl border border-slate-200/90 bg-slate-50/50 p-2.5 overflow-y-auto">
              {eventGroups.map((group) => (
                <div key={group} className="space-y-1">
                  <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-500">
                    <span className="size-1 rounded-full bg-purple-600" /> {group}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {events
                      .filter((e) => e.group === group)
                      .map((event) => (
                        <label
                          key={event.id}
                          className={cn(
                            "group flex cursor-pointer items-center gap-2 rounded-xl border p-2 transition-all text-xs",
                            selectedEvents.includes(event.id)
                              ? "border-purple-500/70 bg-purple-50/80 text-purple-950 shadow-2xs font-medium"
                              : "border-slate-200/80 bg-white hover:bg-slate-50 text-slate-700"
                          )}
                        >
                          <Checkbox
                            checked={selectedEvents.includes(event.id)}
                            onCheckedChange={(checked) =>
                              setSelectedEvents((current) =>
                                checked
                                  ? [...current, event.id]
                                  : current.filter((id) => id !== event.id),
                              )
                            }
                            className="size-3.5 shrink-0 data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600"
                          />
                          <span className="min-w-0 flex-1 leading-tight">
                            <span className="block text-[11px] font-semibold truncate leading-tight">
                              {event.label}
                            </span>
                            <span className="block truncate font-mono text-[9px] text-muted-foreground leading-tight">
                              {event.id}
                            </span>
                          </span>
                        </label>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="md:col-span-12 border-t border-slate-100 pt-3 mt-1 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-8 px-4 rounded-xl border-slate-200 font-semibold text-xs text-slate-700 hover:bg-slate-50 transition-all"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="h-8 px-4.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs gap-1.5 shadow-xs transition-all"
            >
              <Plus className="size-4" /> Create endpoint
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
