import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  CalendarClock,
  CheckCircle2,
  Clock,
  LayoutTemplate,
  Loader2,
  MessageSquare,
  Pause,
  Play,
  Send,
  Smartphone,
  Sparkles,
  Tag,
  Trash2,
  UserCheck,
  UserMinus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { SectionCard } from "@/components/common/SectionCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { WhatsAppPreview } from "@/components/common/WhatsAppPreview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useRequestFence } from "@/hooks/use-request-fence";
import { useRefreshMessageCredits } from "@/hooks/use-workspace-snapshot";
import { contactService, messageJobService, templateService, whatsappService } from "@/services";
import type { Contact, MessageJob, MessageJobRecipient, Template, WhatsAppAccount } from "@/types";

const TIMEZONES = [
  "Asia/Kolkata",
  "UTC",
  "Asia/Dubai",
  "Asia/Singapore",
  "Europe/London",
  "America/New_York",
  "America/Los_Angeles",
];

type JobTab = "processing" | "completed";

function scheduledDateTime(iso?: string, timezone?: string) {
  if (!iso) return "Not scheduled";
  try {
    return new Intl.DateTimeFormat("en-IN", {
      timeZone: timezone || "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(iso));
  } catch {
    return new Date(iso).toLocaleString();
  }
}

export const Route = createFileRoute("/_shell/send-message")({ component: SendMessagePage });

function SendMessagePage() {
  const [accounts, setAccounts] = useState<WhatsAppAccount[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [jobs, setJobs] = useState<MessageJob[]>([]);
  const [jobTab, setJobTab] = useState<JobTab>("processing");
  const [mode, setMode] = useState<"direct" | "template">("direct");
  const [audienceType, setAudienceType] = useState<"all" | "tag" | "contacts">("all");
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [accountId, setAccountId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [name, setName] = useState("New message");
  const [message, setMessage] = useState("");
  const [tag, setTag] = useState("");
  const [scheduled, setScheduled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [saving, setSaving] = useState(false);
  const [detailsJob, setDetailsJob] = useState<MessageJob | null>(null);
  const [jobRecipients, setJobRecipients] = useState<MessageJobRecipient[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [updatingJobId, setUpdatingJobId] = useState("");
  const [removingRecipientId, setRemovingRecipientId] = useState("");
  const startInitialRequest = useRequestFence();
  const startDetailsRequest = useRequestFence();
  const refreshMessageCredits = useRefreshMessageCredits();

  const activeTemplates = templates.filter((template) => template.status !== "inactive");
  const tags = useMemo(
    () => [...new Set(contacts.flatMap((contact) => contact.tags))].sort(),
    [contacts],
  );
  const selectedTemplate = activeTemplates.find((template) => template.id === templateId);
  const currentAccount = useMemo(() => accounts.find((a) => a.id === accountId), [accounts, accountId]);

  const recipientCount = useMemo(() => {
    if (audienceType === "all") return contacts.length;
    if (audienceType === "tag") return contacts.filter((c) => tag && c.tags.includes(tag)).length;
    return selectedContacts.length;
  }, [audienceType, contacts, tag, selectedContacts]);

  function insertVariable(v: string) {
    setMessage((prev) => (prev ? `${prev} {{${v}}}` : `{{${v}}}`));
  }

  const visibleJobs = useMemo(
    () =>
      jobs.filter((job) =>
        jobTab === "completed"
          ? job.status === "completed"
          : job.status !== "completed" && job.status !== "cancelled",
      ),
    [jobTab, jobs],
  );

  useEffect(() => {
    const isCurrent = startInitialRequest();
    void Promise.all([
      whatsappService.getAccounts(),
      contactService.list({ status: "active", limit: 100 }),
      templateService.list({ status: "active" }),
      messageJobService.list(),
    ])
      .then(([nextAccounts, contactPage, nextTemplates, nextJobs]) => {
        if (!isCurrent()) return;
        setAccounts(nextAccounts);
        setAccountId(
          nextAccounts.find((account) => account.state === "CONNECTED")?.id ||
            nextAccounts[0]?.id ||
            "",
        );
        setContacts(contactPage.contacts);
        setTemplates(nextTemplates);
        setJobs(nextJobs);
        if (nextTemplates[0]) setTemplateId(nextTemplates[0].id);
      })
      .catch(
        (error) =>
          isCurrent() &&
          toast.error("Could not load message sender", {
            description: error instanceof Error ? error.message : "Please try again.",
          }),
      );
  }, [startInitialRequest]);

  useEffect(() => {
    let cancelled = false;
    const refreshJobs = () => {
      void messageJobService
        .list()
        .then((nextJobs) => {
          if (!cancelled) setJobs(nextJobs);
        })
        .catch(() => undefined);
    };
    const interval = window.setInterval(refreshJobs, 15_000);
    window.addEventListener("focus", refreshJobs);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshJobs);
    };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!accountId) {
      toast.error("Connect a WhatsApp number first");
      return;
    }
    if (audienceType === "contacts" && selectedContacts.length === 0) {
      toast.error("Select at least one contact");
      return;
    }
    if (audienceType === "tag" && !tag) {
      toast.error("Select a tag");
      return;
    }
    if (scheduled && !scheduledAt) {
      toast.error("Choose a scheduled time");
      return;
    }
    setSaving(true);
    try {
      const job = await messageJobService.create({
        name,
        accountId,
        mode,
        templateId: mode === "template" ? templateId : undefined,
        message: mode === "direct" ? message : undefined,
        audienceType,
        audienceTag: audienceType === "tag" ? tag : undefined,
        contactIds: audienceType === "contacts" ? selectedContacts : undefined,
        sendNow: !scheduled,
        scheduledAt: scheduled ? scheduledAt : undefined,
        timezone,
      });
      if (!scheduled) void refreshMessageCredits();
      setJobs((current) => [job, ...current]);
      toast.success(scheduled ? "Message scheduled" : "Message sending started", {
        description: `${job.recipients} recipients`,
      });
    } catch (error) {
      toast.error("Could not send message", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setSaving(false);
    }
  }

  function toggleContact(id: string) {
    setSelectedContacts((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  async function showDetails(job: MessageJob) {
    const isCurrent = startDetailsRequest();
    setDetailsJob(job);
    setJobRecipients([]);
    setLoadingDetails(true);
    try {
      const recipients = await messageJobService.recipients(job.id);
      if (isCurrent()) setJobRecipients(recipients);
    } catch (error) {
      if (!isCurrent()) return;
      toast.error("Could not load send details", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      if (isCurrent()) setLoadingDetails(false);
    }
  }

  function applyJobUpdate(nextJob: MessageJob) {
    setJobs((current) => current.map((job) => (job.id === nextJob.id ? nextJob : job)));
    setDetailsJob((current) => (current?.id === nextJob.id ? nextJob : current));
  }

  async function updateJobStatus(job: MessageJob, status: "running" | "paused") {
    setUpdatingJobId(job.id);
    try {
      const updated = await messageJobService.updateStatus(job.id, status);
      applyJobUpdate(updated);
      toast.success(status === "paused" ? "Schedule paused" : "Schedule resumed", {
        description: updated.name,
      });
    } catch (error) {
      toast.error("Could not update schedule", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setUpdatingJobId("");
    }
  }

  async function deleteJob(job: MessageJob) {
    setUpdatingJobId(job.id);
    try {
      await messageJobService.remove(job.id);
      setJobs((current) => current.filter((item) => item.id !== job.id));
      if (detailsJob?.id === job.id) setDetailsJob(null);
      toast.success("Schedule deleted", {
        description: "Unsent recipients will not receive this message.",
      });
    } catch (error) {
      toast.error("Could not delete schedule", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setUpdatingJobId("");
    }
  }

  async function removeRecipient(recipient: MessageJobRecipient) {
    if (!detailsJob) return;
    setRemovingRecipientId(recipient.id);
    try {
      const result = await messageJobService.removeRecipient(detailsJob.id, recipient.id);
      applyJobUpdate(result.job);
      setJobRecipients((current) =>
        current.map((item) => (item.id === recipient.id ? result.recipient : item)),
      );
      toast.success("Recipient removed", {
        description: "This recipient will not receive the scheduled message.",
      });
    } catch (error) {
      toast.error("Could not remove recipient", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setRemovingRecipientId("");
    }
  }

  return (
    <div className="space-y-2">
      <PageHeader
        title="Send message"
        description="Compose single broadcasts or schedule recurring deliveries via connected WhatsApp."
        actions={
          currentAccount ? (
            <div className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50/70 px-2.5 py-1 text-xs text-emerald-800 shadow-2xs">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-semibold truncate max-w-[150px]">{currentAccount.displayName}</span>
              <span className="text-[10px] text-emerald-700 font-mono">({currentAccount.phone})</span>
            </div>
          ) : null
        }
      />
      <div className="grid gap-2.5 xl:grid-cols-[1.15fr_0.85fr] items-start">
        {/* Left Column: Message Setup Form */}
        <SectionCard
          title="Message setup"
          description="Configure the WhatsApp sender, content, and recipient audience."
          actions={
            <Badge variant="outline" className="text-[10px] font-semibold gap-1 bg-primary/5 text-primary border-primary/20 px-2 py-0.5">
              <Users className="size-3" /> {recipientCount} recipient{recipientCount === 1 ? "" : "s"}
            </Badge>
          }
          bodyClassName="p-2.5"
        >
          <form className="space-y-2.5" onSubmit={submit}>
            {/* Row 1: Name and Account */}
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="send-name" className="text-xs font-semibold text-slate-700">
                  Message name
                </Label>
                <Input
                  id="send-name"
                  className="h-8 text-xs"
                  placeholder="e.g. Diwali Offer, Welcome ping"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="send-account" className="text-xs font-semibold text-slate-700">
                  WhatsApp sender
                </Label>
                <div className="relative">
                  <select
                    id="send-account"
                    value={accountId}
                    onChange={(event) => setAccountId(event.target.value)}
                    className="h-8 w-full rounded-md border border-input bg-background pl-2 pr-7 text-xs font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    required
                  >
                    <option value="">Select WhatsApp number</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.displayName} ({account.phone}) {account.state === "CONNECTED" ? "· Connected" : "· " + account.state}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Row 2: Mode Toggle */}
            <div className="rounded-lg border border-border/80 bg-surface-muted/30 p-1">
              <div className="grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={() => setMode("direct")}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all",
                    mode === "direct"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground hover:bg-surface",
                  )}
                >
                  <MessageSquare className="size-3.5" />
                  Direct message
                </button>
                <button
                  type="button"
                  onClick={() => setMode("template")}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all",
                    mode === "template"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground hover:bg-surface",
                  )}
                >
                  <LayoutTemplate className="size-3.5" />
                  Saved template
                </button>
              </div>
            </div>

            {/* Row 3: Message Body / Template Selector */}
            {mode === "direct" ? (
              <div className="space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <Label htmlFor="send-body" className="text-xs font-semibold text-slate-700">
                    Message body
                  </Label>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-muted-foreground mr-1">Insert variable:</span>
                    <button
                      type="button"
                      onClick={() => insertVariable("name")}
                      className="rounded border border-primary/20 bg-primary/5 px-1.5 py-0.5 text-[10px] font-semibold text-primary hover:bg-primary/10 transition-colors"
                    >
                      + name
                    </button>
                    <button
                      type="button"
                      onClick={() => insertVariable("phone")}
                      className="rounded border border-primary/20 bg-primary/5 px-1.5 py-0.5 text-[10px] font-semibold text-primary hover:bg-primary/10 transition-colors"
                    >
                      + phone
                    </button>
                  </div>
                </div>
                <Textarea
                  id="send-body"
                  rows={4}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Hello {{name}}, here is your quick update from our team!"
                  className="text-xs resize-y min-h-[90px]"
                />
                <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-0.5">
                  <span>Formatting: *bold*, _italic_, ~strike~</span>
                  <span className="font-mono">{message.length} chars</span>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="send-template" className="text-xs font-semibold text-slate-700">
                  Choose approved template
                </Label>
                <select
                  id="send-template"
                  value={templateId}
                  onChange={(event) => setTemplateId(event.target.value)}
                  className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-xs font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">Select template</option>
                  {activeTemplates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name} ({template.category || "General"} · {template.language})
                    </option>
                  ))}
                </select>
                {selectedTemplate && (
                  <div className="rounded-lg border border-border bg-surface-muted/30 p-2.5 text-xs">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="font-semibold text-foreground text-xs">{selectedTemplate.name}</span>
                      <Badge variant="outline" className="text-[10px] py-0">{selectedTemplate.category}</Badge>
                    </div>
                    <p className="whitespace-pre-wrap text-[11px] text-muted-foreground leading-relaxed">
                      {selectedTemplate.body}
                    </p>
                    {selectedTemplate.attachments?.length ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {selectedTemplate.attachments.map((attachment) => (
                          <Badge key={attachment.key || attachment.name} variant="secondary" className="text-[10px] py-0 gap-1">
                            {attachment.kind}: {attachment.name}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            )}

            {/* Row 4: Audience Selector */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Audience target</Label>
              <div className="grid grid-cols-3 gap-1.5">
                {(["all", "tag", "contacts"] as const).map((value) => (
                  <button
                    type="button"
                    key={value}
                    onClick={() => setAudienceType(value)}
                    className={cn(
                      "flex items-center justify-center gap-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-all",
                      audienceType === value
                        ? "border-primary bg-primary/10 text-primary font-bold shadow-2xs"
                        : "border-border bg-surface text-muted-foreground hover:bg-surface-muted hover:text-foreground",
                    )}
                  >
                    {value === "all" ? (
                      <>
                        <Users className="size-3" /> All ({contacts.length})
                      </>
                    ) : value === "tag" ? (
                      <>
                        <Tag className="size-3" /> By tag
                      </>
                    ) : (
                      <>
                        <UserCheck className="size-3" /> Pick ({selectedContacts.length})
                      </>
                    )}
                  </button>
                ))}
              </div>

              {audienceType === "tag" && (
                <div className="pt-1">
                  <select
                    value={tag}
                    onChange={(event) => setTag(event.target.value)}
                    className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-xs font-medium"
                    required
                  >
                    <option value="">Select a tag ({tags.length} available)</option>
                    {tags.map((value) => (
                      <option key={value} value={value}>
                        {value} ({contacts.filter((c) => c.tags.includes(value)).length} contacts)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {audienceType === "contacts" && (
                <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-border p-1.5" style={{ scrollbarWidth: "thin" }}>
                  {contacts.map((contact) => (
                    <label
                      key={contact.id}
                      className="flex items-center gap-2 rounded-md px-2 py-1 text-xs hover:bg-surface-muted cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        className="rounded border-input text-primary focus:ring-primary size-3.5"
                        checked={selectedContacts.includes(contact.id)}
                        onChange={() => toggleContact(contact.id)}
                      />
                      <span className="font-medium text-foreground">{contact.name}</span>
                      <span className="ml-auto text-[10px] text-muted-foreground font-mono">{contact.phone}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Row 5: Schedule Switcher */}
            <div className="rounded-lg border border-border/80 bg-surface p-2.5 shadow-2xs">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Clock className="size-3.5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground leading-tight">Schedule delivery</p>
                    <p className="text-[10px] text-muted-foreground leading-tight">Deliver at a specific date and time</p>
                  </div>
                </div>
                <Switch
                  checked={scheduled}
                  onCheckedChange={setScheduled}
                  aria-label="Schedule delivery"
                />
              </div>

              {scheduled && (
                <div className="mt-2.5 grid gap-2 pt-2 border-t border-border/60 sm:grid-cols-2">
                  <div className="space-y-0.5">
                    <Label htmlFor="send-at" className="text-[11px] font-medium text-muted-foreground">Send at</Label>
                    <Input
                      id="send-at"
                      type="datetime-local"
                      className="h-7.5 text-xs"
                      value={scheduledAt}
                      onChange={(event) => setScheduledAt(event.target.value)}
                      required={scheduled}
                    />
                  </div>
                  <div className="space-y-0.5">
                    <Label htmlFor="send-timezone" className="text-[11px] font-medium text-muted-foreground">Timezone</Label>
                    <select
                      id="send-timezone"
                      value={timezone}
                      onChange={(event) => setTimezone(event.target.value)}
                      className="h-7.5 w-full rounded-md border border-input bg-background px-2 text-xs"
                    >
                      {TIMEZONES.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Submit Action */}
            <div className="pt-1">
              <Button type="submit" disabled={saving} className="w-full h-8 text-xs font-bold gap-2 shadow-xs">
                {saving ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Send className="size-3.5" />
                )}
                {saving ? "Processing..." : scheduled ? "Schedule WhatsApp message" : "Send WhatsApp message now"}
              </Button>
              <p className="text-center text-[10px] text-muted-foreground mt-1">
                1 message credit per recipient delivery · Real-time delivery tracking
              </p>
            </div>
          </form>
        </SectionCard>

        {/* Right Column: Live WhatsApp Mobile Preview & Schedules List */}
        <div className="space-y-2.5">
          {/* Live Realistic WhatsApp Preview */}
          <SectionCard
            title="WhatsApp Live Preview"
            description="How your message appears on recipient's phone"
            bodyClassName="p-2.5"
          >
            <div className="rounded-xl border border-border shadow-xs overflow-hidden bg-[#efeae2]/70 dark:bg-slate-900">
              {/* WhatsApp Phone Chat Header */}
              <div className="flex items-center gap-2.5 bg-[#075e54] px-3 py-2 text-white">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/20 text-[10px] font-bold text-white shadow-2xs">
                  WA
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold leading-tight">
                    {currentAccount?.displayName || "Whatsaap Business"}
                  </p>
                  <p className="text-[10px] text-white/80 leading-tight flex items-center gap-1">
                    <span className="size-1.5 rounded-full bg-emerald-400" /> online
                  </p>
                </div>
                <Smartphone className="size-4 text-white/70" />
              </div>

              {/* Chat Bubble Canvas */}
              <div className="p-3 min-h-[140px] flex flex-col justify-end">
                <div className="ml-auto max-w-[90%] rounded-xl rounded-tr-xs bg-[#d9fdd3] dark:bg-emerald-950/80 px-3 py-2 text-slate-800 dark:text-emerald-100 shadow-2xs border border-emerald-200/50">
                  {mode === "template" && selectedTemplate?.attachments?.length ? (
                    <div className="mb-1.5 rounded-md bg-white/80 dark:bg-black/30 p-1.5 text-[10px] font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5 border border-emerald-300/40">
                      <LayoutTemplate className="size-3 text-emerald-600" />
                      <span>{selectedTemplate.attachments[0]?.name || "Attachment"}</span>
                    </div>
                  ) : null}
                  <p className="whitespace-pre-wrap text-xs leading-relaxed font-sans">
                    {mode === "direct"
                      ? message
                        ? message.replace(/\{\{name\}\}/gi, "Alex").replace(/\{\{phone\}\}/gi, "+91 98765 43210")
                        : "Type your message on the left to see the live WhatsApp preview here..."
                      : selectedTemplate
                        ? selectedTemplate.body.replace(/\{\{name\}\}/gi, "Alex")
                        : "Select a saved template to preview message content..."}
                  </p>
                  <div className="mt-1 flex items-center justify-end gap-1 text-[9px] text-slate-500 dark:text-emerald-400/80 font-medium">
                    <span>10:42 AM</span>
                    <span className="text-[#53bdeb] font-bold tracking-tighter">✓✓</span>
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Schedules and History Tab */}
          <SectionCard
            title="Message schedules"
            description="Manage sends that are waiting, running, or complete."
            bodyClassName="p-2.5"
          >
            <Tabs value={jobTab} onValueChange={(value) => setJobTab(value as JobTab)}>
              <TabsList className="grid w-full grid-cols-2 h-7.5 p-0.5 text-xs">
                <TabsTrigger value="processing" className="text-xs h-6.5">
                  Processing ({jobs.filter((j) => j.status !== "completed" && j.status !== "cancelled").length})
                </TabsTrigger>
                <TabsTrigger value="completed" className="text-xs h-6.5">
                  Completed ({jobs.filter((j) => j.status === "completed").length})
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="mt-2 space-y-1.5">
              {visibleJobs.length === 0 && (
                <div className="px-1 py-5 text-center text-xs text-muted-foreground">
                  <Clock className="mx-auto size-5 text-muted-foreground/50 mb-1" />
                  <p className="font-medium">
                    {jobTab === "processing"
                      ? "No active schedules need action right now."
                      : "No completed message sends yet."}
                  </p>
                </div>
              )}
              {visibleJobs.map((job) => (
                <div key={job.id} className="rounded-lg border border-border/70 bg-surface p-2 shadow-2xs hover:border-border transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-xs text-foreground truncate">{job.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {job.mode === "template" ? job.templateName : "Direct message"} ·{" "}
                        <span className="font-medium text-foreground">{job.recipients} recipients</span>
                      </p>
                    </div>
                    <StatusBadge status={job.status} className="scale-90 origin-top-right shrink-0" />
                  </div>
                  <div className="mt-1.5 space-y-0.5 text-[10px] text-muted-foreground">
                    <p className="flex items-center gap-1">
                      <CalendarClock className="size-3 shrink-0" />
                      {job.status === "scheduled"
                        ? "Scheduled"
                        : job.startedAt
                          ? "Started"
                          : "Created"}
                      :{" "}
                      {scheduledDateTime(
                        job.status === "scheduled"
                          ? job.scheduledAt
                          : job.startedAt || job.scheduledAt || job.createdAt,
                        job.timezone,
                      )}
                    </p>
                    <p className="font-medium text-foreground/80">
                      Sent {job.sent} · Delivered {job.delivered} · Failed {job.failed}
                    </p>
                    {job.lastError && <p className="text-destructive truncate">{job.lastError}</p>}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1.5 pt-1.5 border-t border-border/40">
                    <div className="flex items-center gap-1">
                      {job.status !== "completed" && job.status !== "failed" && (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="size-6"
                          title={job.status === "paused" ? "Resume schedule" : "Pause schedule"}
                          aria-label={job.status === "paused" ? "Resume schedule" : "Pause schedule"}
                          disabled={updatingJobId === job.id}
                          onClick={() =>
                            void updateJobStatus(job, job.status === "paused" ? "running" : "paused")
                          }
                        >
                          {updatingJobId === job.id ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : job.status === "paused" ? (
                            <Play className="size-3" />
                          ) : (
                            <Pause className="size-3" />
                          )}
                        </Button>
                      )}
                      {job.status !== "completed" && (
                        <ConfirmDialog
                          trigger={
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="size-6 text-destructive hover:text-destructive"
                              title="Delete schedule"
                              aria-label="Delete schedule"
                              disabled={updatingJobId === job.id}
                            >
                              <Trash2 className="size-3" />
                            </Button>
                          }
                          title="Delete this schedule?"
                          description="Any recipients who have not been sent a message will be skipped. Messages already sent stay in the delivery history."
                          confirmLabel="Delete schedule"
                          onConfirm={() => deleteJob(job)}
                        />
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-6 text-[11px] px-2"
                      onClick={() => void showDetails(job)}
                    >
                      Details
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
      <Dialog
        open={Boolean(detailsJob)}
        onOpenChange={(open) => {
          if (!open) setDetailsJob(null);
        }}
      >
        <DialogContent className="max-h-[85vh] w-[calc(100vw-2rem)] max-w-6xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detailsJob?.name} details</DialogTitle>
            <DialogDescription>
              {detailsJob?.status === "completed"
                ? "Completed delivery details."
                : "Pause or remove unsent recipients before they are delivered."}
            </DialogDescription>
          </DialogHeader>
          {detailsJob && (
            <div className="grid gap-2 rounded-lg border border-border bg-surface-muted/40 p-3 text-xs sm:grid-cols-2">
              <div>
                <span className="text-muted-foreground">Status</span>
                <p className="mt-1">
                  <StatusBadge status={detailsJob.status} />
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Scheduled for</span>
                <p className="mt-1 font-medium">
                  {scheduledDateTime(detailsJob.scheduledAt, detailsJob.timezone)} (
                  {detailsJob.timezone})
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Started</span>
                <p className="mt-1 font-medium">
                  {detailsJob.startedAt
                    ? scheduledDateTime(detailsJob.startedAt, detailsJob.timezone)
                    : "Not started"}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Completed</span>
                <p className="mt-1 font-medium">
                  {detailsJob.completedAt
                    ? scheduledDateTime(detailsJob.completedAt, detailsJob.timezone)
                    : "Not completed"}
                </p>
              </div>
            </div>
          )}
          {loadingDetails ? (
            <div className="flex justify-center py-10">
              <Loader2 className="size-5 animate-spin text-primary" />
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-surface-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Contact</th>
                    <th className="px-3 py-2">Phone</th>
                    <th className="px-3 py-2">Message sent</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Sent at</th>
                    <th className="px-3 py-2">Error</th>
                    <th className="px-3 py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {jobRecipients.length === 0 ? (
                    <tr>
                      <td className="px-4 py-8 text-center text-muted-foreground" colSpan={7}>
                        Recipient detail is unavailable for older sends created before delivery
                        tracking was enabled.
                      </td>
                    </tr>
                  ) : (
                    jobRecipients.map((recipient) => (
                      <RecipientRow
                        key={recipient.id}
                        recipient={recipient}
                        canRemove={
                          detailsJob?.status !== "completed" &&
                          ["pending", "under_processing"].includes(recipient.status)
                        }
                        removing={removingRecipientId === recipient.id}
                        onRemove={() => void removeRecipient(recipient)}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RecipientRow({
  recipient,
  canRemove,
  removing,
  onRemove,
}: {
  recipient: MessageJobRecipient;
  canRemove: boolean;
  removing: boolean;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isLong = recipient.body && recipient.body.length > 50;

  return (
    <tr>
      <td className="whitespace-nowrap px-3 py-2 font-medium">{recipient.name}</td>
      <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{recipient.phone}</td>
      <td className="max-w-md px-3 py-2 text-muted-foreground">
        {expanded || !isLong ? (
          <div className="whitespace-pre-wrap">{recipient.body || "-"}</div>
        ) : (
          <div className="truncate">{recipient.body}</div>
        )}
        {isLong && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-1 text-xs font-medium text-primary hover:underline"
          >
            {expanded ? "Show less" : "...more"}
          </button>
        )}
      </td>
      <td className="whitespace-nowrap px-3 py-2">
        <StatusBadge status={recipient.status} />
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
        {recipient.sentAt ? new Date(recipient.sentAt).toLocaleString() : "-"}
      </td>
      <td className="px-3 py-2 text-destructive">{recipient.error || ""}</td>
      <td className="px-3 py-2 text-right">
        {canRemove && (
          <ConfirmDialog
            trigger={
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-7 text-destructive hover:text-destructive"
                title="Remove recipient from schedule"
                aria-label={`Remove ${recipient.name} from schedule`}
                disabled={removing}
              >
                {removing ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <UserMinus className="size-3.5" />
                )}
              </Button>
            }
            title={`Remove ${recipient.name}?`}
            description="This recipient will be skipped and will not receive this scheduled message. A recipient whose message was already sent cannot be removed."
            confirmLabel="Remove recipient"
            onConfirm={onRemove}
          />
        )}
      </td>
    </tr>
  );
}
