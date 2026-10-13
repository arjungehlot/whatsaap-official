import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Cake, Calendar, CheckCircle2, Clock, Globe, MessageSquare, Pause, Play, Plus, Sparkles, Tag, Users } from "lucide-react";
import { toast } from "sonner";
import { SectionCard } from "@/components/common/SectionCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { automationService, contactService, templateService, whatsappService } from "@/services";
import { useRequestFence } from "@/hooks/use-request-fence";
import type { Contact, SchedulerAutomation, SchedulerAutomationDetails, Template, WhatsAppAccount } from "@/types";

const TIMEZONES = ["Asia/Kolkata", "UTC", "Asia/Dubai", "Asia/Singapore", "Europe/London", "America/New_York", "America/Los_Angeles"];

export const Route = createFileRoute("/_shell/automations/")({ component: AutomationsPage });

function AutomationsPage() {
  const [items, setItems] = useState<SchedulerAutomation[]>([]);
  const [accounts, setAccounts] = useState<WhatsAppAccount[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [triggerType, setTriggerType] = useState<"birthday" | "event">("birthday");
  const [mode, setMode] = useState<"direct" | "template">("direct");
  const [audienceType, setAudienceType] = useState<"all" | "tag" | "contacts">("all");
  const [saving, setSaving] = useState(false);
  const [details, setDetails] = useState<SchedulerAutomationDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const startInitialRequest = useRequestFence();
  const startDetailsRequest = useRequestFence();

  useEffect(() => {
    const isCurrent = startInitialRequest();
    void Promise.all([
      automationService.list(),
      whatsappService.getAccounts(),
      templateService.list({ status: "active" }),
      contactService.list({ status: "active", limit: 100 }),
    ])
      .then(([nextItems, nextAccounts, nextTemplates, contactPage]) => {
        if (!isCurrent()) return;
        setItems(nextItems);
        setAccounts(nextAccounts);
        setTemplates(nextTemplates);
        setContacts(contactPage.contacts);
      })
      .catch((error) => {
        if (isCurrent()) toast.error("Could not load schedulers", { description: error instanceof Error ? error.message : "Please try again." });
      });
  }, [startInitialRequest]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    try {
      const automation = await automationService.create({
        name: String(form.get("name")),
        triggerType,
        dateField: "dateOfBirth",
        eventDate: triggerType === "event" ? String(form.get("eventDate")) : undefined,
        timezone: String(form.get("timezone") || "Asia/Kolkata"),
        time: String(form.get("time") || "09:00"),
        accountId: String(form.get("accountId")),
        mode,
        message: mode === "direct" ? String(form.get("message") || "") : undefined,
        templateId: mode === "template" ? String(form.get("templateId")) : undefined,
        audienceType,
        audienceTag: audienceType === "tag" ? String(form.get("audienceTag")) : undefined,
        contactIds: audienceType === "contacts" ? Array.from(form.getAll("contactIds")).map(String) : undefined,
      });
      setItems((current) => [automation, ...current]);
      event.currentTarget.reset();
      toast.success("Scheduler created");
    } catch (error) {
      toast.error("Could not create scheduler", { description: error instanceof Error ? error.message : "Please try again." });
    } finally {
      setSaving(false);
    }
  }

  async function toggle(item: SchedulerAutomation) {
    const status = item.status === "active" ? "paused" : "active";
    try {
      const updated = await automationService.updateStatus(item.id, status);
      setItems((current) => current.map((row) => (row.id === item.id ? updated : row)));
    } catch (error) {
      toast.error("Could not update scheduler", { description: error instanceof Error ? error.message : "Please try again." });
    }
  }

  async function showDetails(item: SchedulerAutomation) {
    const isCurrent = startDetailsRequest();
    setLoadingDetails(true);
    try {
      const nextDetails = await automationService.details(item.id);
      if (isCurrent()) setDetails(nextDetails);
    } catch (error) {
      if (isCurrent()) toast.error("Could not load scheduler details", { description: error instanceof Error ? error.message : "Please try again." });
    } finally {
      if (isCurrent()) setLoadingDetails(false);
    }
  }

  const tags = [...new Set(contacts.flatMap((contact) => contact.tags))].sort();

  return (
    <div className="space-y-2">
      {/* Top Command Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between pb-0.5">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 leading-none">
              Birthday & Event Schedulers
            </h1>
            <span className="inline-flex items-center justify-center rounded-md bg-primary/10 text-primary px-1.5 py-0.5 text-[11px] font-bold leading-none">
              {items.length}
            </span>
          </div>
          <span className="text-xs text-muted-foreground hidden md:inline">
            Automatically dispatch personalized wishes or reminders when due.
          </span>
        </div>
      </div>

      {/* 2-Column Responsive Studio Layout */}
      <div className="grid gap-2.5 lg:grid-cols-12 items-start">
        {/* Left Column: Create Scheduler Form */}
        <div className="lg:col-span-7 xl:col-span-7">
          <SectionCard
            title="Create Scheduler"
            actions={<span className="text-[11px] text-muted-foreground font-medium">Automatic background checks</span>}
            className="rounded-lg border-slate-200/90 shadow-2xs overflow-hidden"
            bodyClassName="p-3"
          >
            <form className="space-y-3" onSubmit={create}>
              {/* Basic Fields */}
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-800">
                    Scheduler Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    className="h-8 text-xs rounded-md border-slate-200/90 shadow-2xs"
                    name="name"
                    placeholder="e.g. Birthday wishes"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-800">
                    WhatsApp Number <span className="text-destructive">*</span>
                  </Label>
                  <select
                    name="accountId"
                    required
                    className="h-8 w-full rounded-md border border-slate-200/90 bg-white px-2 text-xs shadow-2xs"
                  >
                    <option value="">Select connected number</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.displayName} · {account.phone}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Trigger Type & Timing */}
              <div className="rounded-lg border border-slate-200/80 bg-slate-50/50 p-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-slate-800">Trigger Type</Label>
                  <div className="inline-flex rounded-md border border-slate-200 bg-white p-0.5 shadow-2xs">
                    <button
                      type="button"
                      onClick={() => setTriggerType("birthday")}
                      className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium transition-all ${
                        triggerType === "birthday"
                          ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                          : "text-muted-foreground hover:text-slate-800"
                      }`}
                    >
                      <Cake className="size-3" /> Birthday
                    </button>
                    <button
                      type="button"
                      onClick={() => setTriggerType("event")}
                      className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium transition-all ${
                        triggerType === "event"
                          ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                          : "text-muted-foreground hover:text-slate-800"
                      }`}
                    >
                      <Calendar className="size-3" /> One-time event
                    </button>
                  </div>
                </div>

                {triggerType === "birthday" ? (
                  <div className="flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 p-2 text-xs text-primary">
                    <Sparkles className="size-3.5 shrink-0" />
                    <p className="text-[11px] leading-tight">
                      Checks each contact's Date of Birth field daily and dispatches at the specified send time.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-slate-800">Event Date & Time</Label>
                    <Input className="h-8 text-xs rounded-md bg-white border-slate-200/90 shadow-2xs" name="eventDate" type="datetime-local" required />
                  </div>
                )}

                <div className="grid gap-2 sm:grid-cols-2 pt-0.5">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-slate-600 flex items-center gap-1">
                      <Clock className="size-3" /> Send Time
                    </Label>
                    <Input
                      className="h-8 text-xs rounded-md bg-white border-slate-200/90 shadow-2xs"
                      name="time"
                      type="time"
                      defaultValue="09:00"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-slate-600 flex items-center gap-1">
                      <Globe className="size-3" /> Timezone
                    </Label>
                    <select
                      name="timezone"
                      defaultValue="Asia/Kolkata"
                      className="h-8 w-full rounded-md border border-slate-200/90 bg-white px-2 text-xs shadow-2xs"
                    >
                      {TIMEZONES.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Message Content Mode */}
              <div className="rounded-lg border border-slate-200/80 bg-slate-50/50 p-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-slate-800">Content Mode</Label>
                  <div className="inline-flex rounded-md border border-slate-200 bg-white p-0.5 shadow-2xs">
                    <button
                      type="button"
                      onClick={() => setMode("direct")}
                      className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium transition-all ${
                        mode === "direct"
                          ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                          : "text-muted-foreground hover:text-slate-800"
                      }`}
                    >
                      <MessageSquare className="size-3" /> Direct message
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode("template")}
                      className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium transition-all ${
                        mode === "template"
                          ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                          : "text-muted-foreground hover:text-slate-800"
                      }`}
                    >
                      <Sparkles className="size-3" /> Template
                    </button>
                  </div>
                </div>

                {mode === "direct" ? (
                  <div className="space-y-1">
                    <Textarea
                      rows={2}
                      className="min-h-[56px] text-xs py-1.5 rounded-md bg-white border-slate-200/90 shadow-2xs resize-none"
                      name="message"
                      defaultValue="Happy birthday {{name}}! Wishing you wonderful health and prosperity! 🎂🎉"
                      required
                    />
                  </div>
                ) : (
                  <div className="space-y-1">
                    <select
                      name="templateId"
                      required
                      className="h-8 w-full rounded-md border border-slate-200/90 bg-white px-2 text-xs shadow-2xs"
                    >
                      <option value="">Select approved template</option>
                      {templates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name} ({template.category})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Target Audience & Submission */}
              <div className="space-y-2 pt-1 border-t border-slate-100">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Label className="text-xs font-semibold text-slate-800">Audience:</Label>
                    <div className="inline-flex rounded-md border border-slate-200 bg-white p-0.5 shadow-2xs">
                      {(["all", "tag", "contacts"] as const).map((value) => (
                        <button
                          type="button"
                          key={value}
                          onClick={() => setAudienceType(value)}
                          className={`rounded px-2 py-0.5 text-xs font-medium transition-all ${
                            audienceType === value
                              ? "bg-primary/10 text-primary font-semibold ring-1 ring-primary/20"
                              : "text-muted-foreground hover:text-slate-800"
                          }`}
                        >
                          {value === "all" ? "All active" : value === "tag" ? "By tag" : "Selected"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <Button
                    type="submit"
                    size="sm"
                    className="h-8 text-xs px-3 rounded-md bg-primary text-primary-foreground shadow-2xs gap-1"
                    disabled={saving}
                  >
                    <Plus className="size-3.5" />
                    <span>{saving ? "Creating..." : "Create scheduler"}</span>
                  </Button>
                </div>

                {audienceType === "tag" && (
                  <select
                    name="audienceTag"
                    required
                    className="h-8 w-full rounded-md border border-slate-200/90 bg-white px-2 text-xs shadow-2xs"
                  >
                    <option value="">Select tag to filter</option>
                    {tags.map((tag) => (
                      <option key={tag} value={tag}>
                        {tag}
                      </option>
                    ))}
                  </select>
                )}

                {audienceType === "contacts" && (
                  <div className="max-h-28 space-y-0.5 overflow-y-auto rounded-md border border-slate-200/90 bg-white p-1.5">
                    {contacts.map((contact) => (
                      <label key={contact.id} className="flex items-center gap-2 py-1 px-1.5 text-xs hover:bg-slate-50 rounded">
                        <input type="checkbox" name="contactIds" value={contact.id} className="size-3.5" />
                        <span className="font-medium text-slate-800">{contact.name}</span>
                        <span className="ml-auto text-[10px] text-muted-foreground font-mono">{contact.phone}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </form>
          </SectionCard>
        </div>

        {/* Right Column: Schedulers List Card */}
        <div className="lg:col-span-5 xl:col-span-5">
          <SectionCard
            title="Your Schedulers"
            description="The engine evaluates pending triggers every minute."
            actions={<span className="text-[11px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">{items.length} active</span>}
            className="rounded-lg border-slate-200/90 shadow-2xs"
            bodyClassName="p-2.5"
          >
            {items.length === 0 ? (
              <EmptyState
                icon={Calendar}
                title="No schedulers created yet"
                description="Configure your first birthday or event scheduler on the left to start sending automated greetings."
                className="border-0 shadow-none py-8"
              />
            ) : (
              <div className="space-y-2">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-lg border border-slate-200/80 bg-white p-2.5 shadow-2xs space-y-1.5 hover:border-slate-300 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-slate-900 truncate">{item.name}</span>
                          <span className="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.2 text-[9px] font-semibold text-slate-600">
                            {item.triggerType === "birthday" ? "Birthday" : "Event"}
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {item.mode === "direct" ? "Direct message" : "Template"} · {item.time} ({item.timezone})
                        </p>
                      </div>
                      <StatusBadge status={item.status === "active" ? "active" : item.status === "paused" ? "paused" : item.status === "completed" ? "completed" : "failed"} />
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-100 pt-1.5 text-[10px] text-muted-foreground font-medium">
                      <span>{item.lastRunAt ? `Last run ${new Date(item.lastRunAt).toLocaleDateString()}` : "Not run yet"}</span>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-[11px] px-2 rounded-md"
                          onClick={() => void showDetails(item)}
                          disabled={loadingDetails}
                        >
                          Details
                        </Button>
                        {item.status !== "completed" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-[11px] px-2 rounded-md gap-1"
                            onClick={() => void toggle(item)}
                          >
                            {item.status === "active" ? (
                              <>
                                <Pause className="size-2.5" /> Pause
                              </>
                            ) : (
                              <>
                                <Play className="size-2.5" /> Resume
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>

                    {item.lastError && (
                      <p className="text-[10px] text-destructive bg-destructive/10 rounded px-1.5 py-0.5">
                        {item.lastError}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      </div>

      {/* Details Dialog */}
      <Dialog
        open={Boolean(details)}
        onOpenChange={(open) => {
          if (!open) setDetails(null);
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto p-4 rounded-lg">
          <DialogHeader className="pb-1">
            <DialogTitle className="text-base font-bold">{details?.scheduler.name} details</DialogTitle>
            <DialogDescription className="text-xs">
              {details?.scheduler.triggerType === "birthday"
                ? `${details?.birthdayReady.length} contacts have a Date of Birth ready. ${details?.missingDateOfBirth ?? 0} missing DOB.`
                : `${details?.recipients.length ?? 0} contacts in this event audience.`}
            </DialogDescription>
          </DialogHeader>
          {details && (
            <div className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
                  <p className="text-[10px] text-muted-foreground font-medium">Audience</p>
                  <p className="font-bold text-slate-900 mt-0.5">{details.recipients.length} active contacts</p>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
                  <p className="text-[10px] text-muted-foreground font-medium">Ready to send</p>
                  <p className="font-bold text-slate-900 mt-0.5">{details.birthdayReady.length} contacts</p>
                </div>
              </div>
              <div className="max-h-72 overflow-y-auto rounded-md border border-slate-200">
                <div className="grid grid-cols-[1fr_8rem_6rem] gap-2 border-b bg-slate-50 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600">
                  <span>Contact</span>
                  <span>Phone</span>
                  <span>Date of birth</span>
                </div>
                {details.recipients.map((contact) => (
                  <div
                    key={contact.id}
                    className="grid grid-cols-[1fr_8rem_6rem] gap-2 border-b px-2.5 py-1.5 text-xs last:border-0 hover:bg-slate-50/50"
                  >
                    <span className="truncate font-medium text-slate-900">{contact.name}</span>
                    <span className="truncate text-muted-foreground font-mono text-[11px]">{contact.phone}</span>
                    <span className={`text-[11px] ${contact.dateOfBirth ? "text-slate-600" : "text-destructive font-medium"}`}>
                      {contact.dateOfBirth || "Missing"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
