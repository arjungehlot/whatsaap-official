import { useEffect, useMemo, useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Bell, Check, CheckCircle2, FileText, Flame, Loader2, Megaphone, Rocket, ShieldCheck, Sparkles, Tag, Users } from "lucide-react";
import { toast } from "sonner";
import { SectionCard } from "@/components/common/SectionCard";
import { WhatsAppPreview } from "@/components/common/WhatsAppPreview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { campaignService, contactService, templateService, whatsappService } from "@/services";
import type { Template, WhatsAppAccount } from "@/types";
import { num } from "@/lib/format";
import { useRequestFence } from "@/hooks/use-request-fence";
import { useRefreshMessageCredits } from "@/hooks/use-workspace-snapshot";

export const Route = createFileRoute("/_shell/campaigns/create")({
  head: () => ({ meta: [{ title: "Create Campaign — WAFlow" }] }),
  component: CreateCampaignPage,
});

const steps = ["Details", "Audience", "Message", "Schedule"];
const TIMEZONES = ["Asia/Kolkata", "UTC", "Asia/Dubai", "Asia/Singapore", "Europe/London", "America/New_York", "America/Los_Angeles"];

function templateFiles(template: Template | undefined) {
  return template?.attachments?.length ? template.attachments : template?.attachment ? [template.attachment] : [];
}

function CreateCampaignPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [audience, setAudience] = useState<"all" | "tag">("all");
  const [tag, setTag] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [rate, setRate] = useState([120]);
  const [sendNow, setSendNow] = useState(true);
  const [when, setWhen] = useState("");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [accounts, setAccounts] = useState<WhatsAppAccount[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [contactStats, setContactStats] = useState({ active: 0 });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const startInitialRequest = useRequestFence();
  const refreshMessageCredits = useRefreshMessageCredits();

  useEffect(() => {
    async function load() {
      const isCurrent = startInitialRequest();
      setLoading(true);
      try {
        const [templateRows, accountRows, contactData] = await Promise.all([
          templateService.list(),
          whatsappService.getAccounts(),
          contactService.list({ limit: 1 }),
        ]);
        if (!isCurrent()) return;
        setTemplates(templateRows);
        setAccounts(accountRows.filter((account) => account.state === "CONNECTED"));
        setTags(contactData.tags);
        setContactStats({ active: contactData.stats.active });
        setTemplateId(templateRows[0]?.id ?? "");
        setAccountId(accountRows.find((account) => account.state === "CONNECTED")?.id ?? "");
        setTag(contactData.tags[0] ?? "");
      } catch (error) {
        if (isCurrent()) toast.error(error instanceof Error ? error.message : "Unable to prepare campaign");
      } finally {
        if (isCurrent()) setLoading(false);
      }
    }
    void load();
  }, [startInitialRequest]);

  const template = useMemo(() => templates.find((t) => t.id === templateId), [templates, templateId]);
  const attachments = templateFiles(template);
  const canContinue = step === 0 ? name.trim().length > 2 : step === 1 ? audience === "all" || Boolean(tag) : step === 2 ? Boolean(templateId) : true;

  async function launch() {
    setSaving(true);
    try {
      const scheduledAt = !sendNow && when ? when : undefined;
      const campaign = await campaignService.create({
        name,
        description: description || undefined,
        accountId: accountId || undefined,
        templateId,
        audienceType: audience,
        audienceTag: audience === "tag" ? tag : undefined,
        sendNow,
        scheduledAt,
        timezone,
        ratePerMinute: rate[0] ?? 120,
      });
      if (sendNow) void refreshMessageCredits();
      toast.success(sendNow ? "Campaign launched" : campaign.scheduledAt ? "Campaign scheduled" : "Campaign saved as draft", { description: `${campaign.name} · ${num(campaign.recipients)} recipients` });
      navigate({ to: "/campaigns" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create campaign");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Preparing campaign...</div>;

  const currentAccount = accounts.find((a) => a.id === accountId);

  return (
    <div className="space-y-2 max-w-7xl mx-auto">
      {/* Top Header & Compact Step Navigation */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pb-0.5">
        {/* Left: Back Link & Title */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground -ml-1 gap-1" asChild>
            <Link to="/campaigns">
              <ArrowLeft className="size-3.5" /> Back
            </Link>
          </Button>
          <div className="h-3.5 w-px bg-slate-200" />
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold tracking-tight text-slate-900 leading-none">Create campaign</h1>
            <span className="hidden sm:inline-flex items-center gap-1 rounded-md bg-slate-100 text-slate-600 px-1.5 py-0.5 text-[10px] font-semibold leading-none">
              Step {step + 1} of {steps.length}
            </span>
          </div>
        </div>

        {/* Right: Modern Step Navigator Pill Bar */}
        <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200/90 bg-white p-0.5 shadow-2xs">
          {steps.map((s, i) => {
            const isCompleted = i < step;
            const isCurrent = i === step;
            return (
              <button
                key={s}
                type="button"
                onClick={() => {
                  if (i < step || (i === step + 1 && canContinue)) setStep(i);
                }}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-all ${
                  isCurrent
                    ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                    : isCompleted
                      ? "text-emerald-700 hover:bg-emerald-50 font-medium"
                      : "text-muted-foreground hover:bg-slate-50 font-normal opacity-80"
                }`}
              >
                <span
                  className={`flex size-4 items-center justify-center rounded-full text-[10px] font-bold ${
                    isCurrent
                      ? "bg-white/20 text-white"
                      : isCompleted
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {isCompleted ? <Check className="size-2.5" /> : i + 1}
                </span>
                <span className="text-[11px]">{s}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2-Column Balanced Height Studio Layout */}
      <div className="grid gap-3 lg:grid-cols-12 items-start">
        {/* Left Column: Interactive Wizard Card */}
        <div className="lg:col-span-7 xl:col-span-7">
          <SectionCard
            title={`Step ${step + 1}: ${steps[step]}`}
            actions={
              <span className="text-[11px] text-muted-foreground font-medium">
                {step === 0 && "Name & WhatsApp Account"}
                {step === 1 && "Choose target recipients"}
                {step === 2 && "Pick WhatsApp template"}
                {step === 3 && "Timing & delivery rate"}
              </span>
            }
            className="rounded-lg border-slate-200/90 shadow-2xs overflow-hidden"
            bodyClassName="p-3 space-y-2.5"
          >
            {/* Step 0: Details (Redesigned to be Rich, Attractive, and Perfectly Balanced) */}
            {step === 0 && (
              <div className="space-y-2.5">
                {/* Campaign Quick Preset Chips */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-slate-800">Quick Campaign Type</Label>
                    <span className="text-[10px] text-muted-foreground">Click to quick-fill name</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {[
                      { icon: Sparkles, label: "Festival Sale", defaultName: "Diwali Festival Mega Sale" },
                      { icon: Flame, label: "Flash Offer", defaultName: "24-Hour Flash Discount" },
                      { icon: Megaphone, label: "Broadcast", defaultName: "Exclusive VIP Announcement" },
                      { icon: Bell, label: "Reminder", defaultName: "Special Order Reminder" },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => setName(preset.defaultName)}
                        className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-all text-left ${
                          name === preset.defaultName
                            ? "border-primary bg-primary/10 text-primary font-semibold shadow-2xs"
                            : "border-slate-200 bg-slate-50/70 text-slate-700 hover:bg-white hover:border-slate-300"
                        }`}
                      >
                        <preset.icon className="size-3 text-primary shrink-0" />
                        <span className="truncate text-[10.5px] font-medium">{preset.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Campaign Name Input */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="cp-name" className="text-xs font-semibold text-slate-800">
                      Campaign name <span className="text-destructive">*</span>
                    </Label>
                    <span className="text-[10px] text-muted-foreground">{name.length} / 60</span>
                  </div>
                  <Input
                    id="cp-name"
                    className="h-7.5 !text-xs md:!text-xs text-xs rounded-md border-slate-200/90 shadow-2xs placeholder:text-[11px]"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Diwali Mega Sale 2024"
                    maxLength={60}
                    autoFocus
                  />
                </div>

                {/* WhatsApp Sender Account Selector */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-slate-800">
                      WhatsApp sender number <span className="text-destructive">*</span>
                    </Label>
                    {accounts.length > 0 && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
                        <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" /> Channel Ready
                      </span>
                    )}
                  </div>
                  <Select value={accountId} onValueChange={setAccountId}>
                    <SelectTrigger className="h-7.5 !text-xs md:!text-xs text-xs rounded-md border-slate-200/90 bg-white shadow-2xs">
                      <SelectValue placeholder="Choose connected sender number" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.length === 0 ? (
                        <SelectItem value="none" disabled className="text-xs">
                          No connected WhatsApp accounts found
                        </SelectItem>
                      ) : (
                        accounts.map((account) => (
                          <SelectItem key={account.id} value={account.id} className="text-xs">
                            <span className="flex items-center gap-2">
                              <span className="size-2 rounded-full bg-emerald-500 inline-block" />
                              <span className="font-semibold text-slate-800">{account.displayName}</span>
                              <span className="text-muted-foreground font-mono">({account.phone})</span>
                            </span>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Internal Note / Objective */}
                <div className="space-y-1">
                  <Label htmlFor="cp-desc" className="text-xs font-semibold text-slate-700">
                    Campaign objective / note (optional)
                  </Label>
                  <Textarea
                    id="cp-desc"
                    className="!text-xs md:!text-xs text-xs min-h-[46px] py-1.5 rounded-md border-slate-200/90 shadow-2xs resize-none placeholder:text-[11px]"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Internal notes about goal, segment criteria, or promo codes..."
                    rows={2}
                  />
                </div>

                {/* Verified Anti-Spam Safeguard Banner */}
                <div className="flex items-center gap-2 rounded-md border border-emerald-200/80 bg-emerald-50/70 px-2 py-1 text-emerald-950 shadow-2xs">
                  <ShieldCheck className="size-3.5 shrink-0 text-emerald-600" />
                  <div className="text-[10.5px] leading-snug">
                    <strong className="font-semibold text-emerald-800">Verified WhatsApp Channel:</strong> Deliveries are regulated automatically through Meta Official API to preserve phone number reputation.
                  </div>
                </div>
              </div>
            )}

            {/* Step 1: Audience */}
            {step === 1 && (
              <div className="space-y-3">
                <Label className="text-xs font-semibold">Target Audience</Label>
                <RadioGroup value={audience} onValueChange={(v) => setAudience(v as "all" | "tag")} className="grid gap-2 sm:grid-cols-2">
                  <label
                    className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 transition-all ${
                      audience === "all"
                        ? "border-primary/60 bg-primary/5 ring-1 ring-primary/20"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <RadioGroupItem value="all" className="mt-0.5 size-3.5" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Users className="size-3.5 text-primary" />
                        <span className="text-xs font-semibold">All active contacts</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {num(contactStats.active)} reachable active contacts
                      </p>
                    </div>
                  </label>

                  <label
                    className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 transition-all ${
                      audience === "tag"
                        ? "border-primary/60 bg-primary/5 ring-1 ring-primary/20"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <RadioGroupItem value="tag" className="mt-0.5 size-3.5" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Tag className="size-3.5 text-primary" />
                        <span className="text-xs font-semibold">Filter by tag</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Send only to contacts with a specific tag
                      </p>
                    </div>
                  </label>
                </RadioGroup>

                {audience === "tag" && (
                  <div className="space-y-1 rounded-md border border-slate-200/90 bg-slate-50/60 p-2.5">
                    <Label className="text-xs font-semibold">Select contact tag</Label>
                    <Select value={tag} onValueChange={setTag}>
                      <SelectTrigger className="h-8 text-xs bg-white rounded-md">
                        <SelectValue placeholder="Choose tag" />
                      </SelectTrigger>
                      <SelectContent>
                        {tags.map((t) => (
                          <SelectItem key={t} value={t} className="text-xs">
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="flex items-center gap-2 rounded-md bg-emerald-50 border border-emerald-200/60 p-2 text-xs text-emerald-800">
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                  <span className="text-[11px]">
                    Estimated audience size: <strong className="font-semibold">{audience === "all" ? num(contactStats.active) : "Segmented by tag"}</strong>
                  </span>
                </div>
              </div>
            )}

            {/* Step 2: Message Template */}
            {step === 2 && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Approved WhatsApp Template</Label>
                  <Select value={templateId} onValueChange={setTemplateId}>
                    <SelectTrigger className="h-8 text-xs rounded-md">
                      <SelectValue placeholder="Choose template" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((t) => {
                        const files = templateFiles(t);
                        return (
                          <SelectItem key={t.id} value={t.id} className="text-xs">
                            {t.name} · {t.language}
                            {files.length > 0 ? ` · ${files.length} attachment${files.length === 1 ? "" : "s"}` : ""}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                {attachments.length > 0 && (
                  <div className="space-y-1 rounded-md border border-slate-200/90 bg-slate-50/60 p-2">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                      Attachments ({attachments.length})
                    </span>
                    <div className="space-y-1.5">
                      {attachments.map((attachment, index) => (
                        <div key={`${attachment.name}-${index}`} className="flex items-center gap-2 bg-white rounded-md p-1.5 border border-slate-200/70">
                          <span className="flex size-6 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-primary">
                            <FileText className="size-3" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium">{attachment.name}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {attachment.kind} · {index === 0 ? "Uses message body as caption" : "Sent as secondary file"}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-slate-800">Template content</Label>
                    <span className="text-[10px] text-muted-foreground font-mono">Read-only preview</span>
                  </div>
                  <Textarea
                    value={template?.body ?? ""}
                    readOnly
                    rows={7}
                    className="bg-slate-50/70 text-xs min-h-[160px] py-2 rounded-md font-mono resize-none leading-relaxed"
                  />
                </div>
              </div>
            )}

            {/* Step 3: Schedule & Throttle */}
            {step === 3 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200/90 p-2.5 bg-slate-50/50">
                  <div>
                    <p className="text-xs font-semibold text-slate-900">Send immediately</p>
                    <p className="text-[10px] text-muted-foreground">Turn off to schedule delivery for a future date/time.</p>
                  </div>
                  <Switch checked={sendNow} onCheckedChange={setSendNow} className="scale-75" />
                </div>

                {!sendNow && (
                  <div className="grid gap-2.5 sm:grid-cols-2 rounded-lg border border-slate-200/90 bg-slate-50/50 p-2.5">
                    <div className="space-y-1">
                      <Label htmlFor="cp-when" className="text-xs font-semibold">
                        Send at
                      </Label>
                      <Input
                        id="cp-when"
                        type="datetime-local"
                        value={when}
                        onChange={(e) => setWhen(e.target.value)}
                        className="h-8 text-xs bg-white rounded-md"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="cp-timezone" className="text-xs font-semibold">
                        Timezone
                      </Label>
                      <select
                        id="cp-timezone"
                        value={timezone}
                        onChange={(e) => setTimezone(e.target.value)}
                        className="h-8 w-full rounded-md border border-input bg-white px-2 text-xs"
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

                <div className="space-y-2 rounded-lg border border-slate-200/90 p-2.5 bg-slate-50/50">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">Delivery speed throttle</Label>
                    <span className="text-[11px] font-bold text-primary tabular-nums bg-primary/10 px-1.5 py-0.5 rounded-sm">
                      {rate[0]} msgs / hr
                    </span>
                  </div>
                  <Slider value={rate} onValueChange={setRate} min={1} max={250} step={5} />
                  <p className="text-[10px] text-muted-foreground">
                    Recommended pace: 80 - 150 msgs/hr to maintain optimal WhatsApp number health.
                  </p>
                </div>
              </div>
            )}

            {/* Bottom Actions Navigation Bar */}
            <div className="flex items-center justify-between border-t border-slate-100 pt-2.5">
              <Button
                variant="outline"
                size="sm"
                className="h-7.5 text-xs px-3 rounded-md"
                disabled={step === 0}
                onClick={() => setStep((s) => s - 1)}
              >
                <ArrowLeft className="size-3 mr-1" /> Back
              </Button>

              <div className="text-[11px] text-muted-foreground font-medium hidden sm:block">
                Step {step + 1} of {steps.length}
              </div>

              {step < steps.length - 1 ? (
                <Button
                  size="sm"
                  className="h-7.5 text-xs px-3.5 rounded-md"
                  disabled={!canContinue}
                  onClick={() => setStep((s) => s + 1)}
                >
                  Continue <ArrowRight className="size-3 ml-1" />
                </Button>
              ) : (
                <Button
                  size="sm"
                  className="h-7.5 text-xs px-3.5 rounded-md bg-primary text-primary-foreground shadow-2xs gap-1.5"
                  onClick={launch}
                  disabled={saving || !templateId || !accountId || (!sendNow && !when)}
                >
                  {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Rocket className="size-3.5" />}
                  {sendNow ? "Launch campaign" : "Schedule campaign"}
                </Button>
              )}
            </div>
          </SectionCard>
        </div>

        {/* Right Column: Unified Full-Height WhatsApp Studio Preview (No Overstacking, Completely Visible!) */}
        <div className="lg:col-span-5 xl:col-span-5">
          <SectionCard
            title="Live WhatsApp Preview"
            actions={
              <span className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200/60 rounded px-1.5 py-0.5 font-medium">
                {currentAccount?.displayName || "Smart ItBox"}
              </span>
            }
            className="rounded-lg border-slate-200/90 shadow-2xs overflow-hidden"
            bodyClassName="p-2.5 space-y-2 bg-slate-50/40"
          >
            {/* Compact Specs Pill Bar (Integrated cleanly, takes only 28px height!) */}
            <div className="flex items-center justify-between gap-1 rounded-md bg-white border border-slate-200/80 px-2 py-1 text-[11px] shadow-2xs">
              <span className="truncate text-slate-600">
                <strong className="text-slate-800 font-semibold">Audience:</strong> {audience === "all" ? "All active" : tag || "Tag"}
              </span>
              <span className="h-3 w-px bg-slate-200 shrink-0" />
              <span className="truncate text-slate-600">
                <strong className="text-slate-800 font-semibold">Send:</strong> {sendNow ? "Immediate" : "Scheduled"}
              </span>
              <span className="h-3 w-px bg-slate-200 shrink-0" />
              <span className="truncate text-slate-600">
                <strong className="text-slate-800 font-semibold">Pace:</strong> {rate[0]}/hr
              </span>
            </div>

            {/* Complete Realistic WhatsApp Mockup (Scrollable message bubble, Never cuts off!) */}
            <WhatsAppPreview
              contactName={currentAccount?.displayName || "Smart ItBox"}
              body={template?.body ?? ""}
              attachments={attachments}
              showReply={false}
              showInputBar={true}
              chatClassName="min-h-[380px] max-h-[440px]"
              variables={{ name: "Ananya", company: "Bright Retail", order_id: "BR-48123", amount: "Rs 1,299" }}
            />
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
