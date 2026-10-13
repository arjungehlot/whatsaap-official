import { useEffect, useState } from "react"; 
import type { FormEvent, ReactNode } from "react";
import { 
  Calendar, 
  FileText, 
  Gauge, 
  Globe, 
  LayoutTemplate, 
  Loader2, 
  Megaphone, 
  MessageSquare, 
  Pencil, 
  Save, 
  Sparkles, 
  Tag, 
  Users 
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { campaignService, contactService, templateService, whatsappService } from "@/services";
import type { Campaign, Template, WhatsAppAccount } from "@/types";

const TIMEZONES = ["Asia/Kolkata", "UTC", "Asia/Dubai", "Asia/Singapore", "Europe/London", "America/New_York", "America/Los_Angeles"];

type CampaignEditDialogProps = {
  campaign: Campaign;
  onSaved: (campaign: Campaign) => void;
  trigger?: ReactNode;
};

function toLocalInput(value?: string, timezone = "Asia/Kolkata") {
  if (!value) return "";
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${values["year"]}-${values["month"]}-${values["day"]}T${values["hour"]}:${values["minute"]}`;
}

function templateFiles(template: Template) {
  return template.attachments?.length ? template.attachments : template.attachment ? [template.attachment] : [];
}

export function CampaignEditDialog({ campaign, onSaved, trigger }: CampaignEditDialogProps) {
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [accounts, setAccounts] = useState<WhatsAppAccount[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [templateId, setTemplateId] = useState(campaign.templateId ?? "");
  const [accountId, setAccountId] = useState(campaign.accountId ?? "");
  const [audienceType, setAudienceType] = useState<"all" | "tag">((campaign.audienceType === "tag" ? "tag" : "all"));
  const [audienceTag, setAudienceTag] = useState(campaign.audienceTag ?? "");
  const [rate, setRate] = useState([campaign.ratePerMinute ?? 120]);
  const [timezone, setTimezone] = useState(campaign.timezone ?? "Asia/Kolkata");

  useEffect(() => {
    if (!open) return;
    async function loadOptions() {
      setLoading(true);
      try {
        const [templateRows, accountRows, contactRows] = await Promise.all([
          templateService.list(),
          whatsappService.getAccounts(),
          contactService.list({ limit: 1 }),
        ]);
        setTemplates(templateRows);
        setAccounts(accountRows.filter((account) => account.state === "CONNECTED" || account.id === campaign.accountId));
        setTags(contactRows.tags);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to load campaign options");
      } finally {
        setLoading(false);
      }
    }
    loadOptions();
  }, [open, campaign.accountId]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    try {
      const when = String(form.get("scheduledAt") || "");
      const updated = await campaignService.update(campaign.id, {
        name: String(form.get("name") || ""),
        description: String(form.get("description") || "") || undefined,
        accountId: accountId || undefined,
        templateId: templateId || undefined,
        audienceType,
        audienceTag: audienceType === "tag" ? audienceTag : undefined,
        scheduledAt: when || null,
        timezone,
        ratePerMinute: rate[0] ?? 120,
      });
      toast.success("Campaign updated");
      setOpen(false);
      onSaved(updated);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update campaign");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="h-7.5 px-2.5 text-xs gap-1 rounded-lg">
            <Pencil className="size-3.5" /> Edit
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] sm:max-w-[620px] overflow-y-auto p-5.5 rounded-2xl border-slate-200/90 shadow-2xl">
        {/* Header with attractive icon badge */}
        <div className="flex items-center gap-3 pb-2.5 border-b border-slate-100">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100/90 shadow-2xs shrink-0">
            <Megaphone className="size-5.5 text-emerald-600" />
          </div>
          <div>
            <DialogTitle className="text-base font-bold text-slate-900 tracking-tight leading-snug">
              Edit campaign
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              Pause a running campaign before editing active delivery settings.
            </DialogDescription>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 p-8 text-xs text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-emerald-600" /> Loading campaign options...
          </div>
        ) : (
          <form className="space-y-3 pt-2" onSubmit={save}>
            {/* Campaign Name */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label htmlFor={`campaign-name-${campaign.id}`} className="text-xs font-semibold text-slate-800">
                  Campaign name
                </Label>
                <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200/60 leading-none">
                  Required
                </span>
              </div>
              <div className="relative flex items-center rounded-xl border border-slate-200/90 bg-white p-1 shadow-2xs hover:border-slate-300 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/10 transition-all">
                <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 shrink-0">
                  <Sparkles className="size-3.5" />
                </div>
                <input
                  id={`campaign-name-${campaign.id}`}
                  name="name"
                  required
                  defaultValue={campaign.name}
                  placeholder="e.g. Diwali Mega Sale 2024"
                  className="flex-1 h-7.5 bg-transparent px-2.5 text-xs !text-xs md:!text-xs text-slate-900 placeholder:text-slate-400 placeholder:text-[11px] focus:outline-hidden"
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1">
              <Label htmlFor={`campaign-description-${campaign.id}`} className="text-xs font-semibold text-slate-800">
                Description (optional)
              </Label>
              <div className="relative flex items-start rounded-xl border border-slate-200/90 bg-white p-1 shadow-2xs hover:border-slate-300 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/10 transition-all">
                <div className="flex size-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600 shrink-0 mt-0.5">
                  <FileText className="size-3.5" />
                </div>
                <textarea
                  id={`campaign-description-${campaign.id}`}
                  name="description"
                  rows={2}
                  defaultValue={campaign.description ?? ""}
                  placeholder="Internal notes about goal, segment criteria, or promo codes..."
                  className="flex-1 bg-transparent px-2.5 py-1 text-xs !text-xs md:!text-xs text-slate-900 placeholder:text-slate-400 placeholder:text-[11px] focus:outline-hidden resize-none min-h-[46px]"
                />
              </div>
            </div>

            {/* WhatsApp Number & Template (2 Columns) */}
            <div className="grid gap-2.5 sm:grid-cols-2">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-slate-800">WhatsApp number</Label>
                  <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200/60 leading-none">
                    Required
                  </span>
                </div>
                <div className="relative flex items-center rounded-xl border border-slate-200/90 bg-white p-1 shadow-2xs hover:border-slate-300 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/10 transition-all">
                  <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-50 text-[#00c980] shrink-0">
                    <MessageSquare className="size-3.5" />
                  </div>
                  <Select value={accountId} onValueChange={setAccountId}>
                    <SelectTrigger className="h-7.5 border-0 bg-transparent px-2 text-xs !text-xs md:!text-xs font-medium shadow-none focus:ring-0 w-full truncate">
                      <SelectValue placeholder="Choose number" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((account) => (
                        <SelectItem key={account.id} value={account.id} className="text-xs">
                          {account.displayName} - {account.phone}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-slate-800">Template</Label>
                  <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200/60 leading-none">
                    Required
                  </span>
                </div>
                <div className="relative flex items-center rounded-xl border border-slate-200/90 bg-white p-1 shadow-2xs hover:border-slate-300 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/10 transition-all">
                  <div className="flex size-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600 shrink-0">
                    <LayoutTemplate className="size-3.5" />
                  </div>
                  <Select value={templateId} onValueChange={setTemplateId}>
                    <SelectTrigger className="h-7.5 border-0 bg-transparent px-2 text-xs !text-xs md:!text-xs font-medium shadow-none focus:ring-0 w-full truncate">
                      <SelectValue placeholder="Choose template" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((template) => {
                        const files = templateFiles(template);
                        return (
                          <SelectItem key={template.id} value={template.id} className="text-xs">
                            {template.name} - {template.language}{files.length > 0 ? ` - ${files.length} file(s)` : ""}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Audience, Scheduled Time, and Timezone */}
            <div className={`grid gap-2.5 ${audienceType === "tag" ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3"}`}>
              {/* Audience */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-800">Audience</Label>
                <div className="relative flex items-center rounded-xl border border-slate-200/90 bg-white p-1 shadow-2xs hover:border-slate-300 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/10 transition-all">
                  <div className="flex size-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 shrink-0">
                    <Users className="size-3.5" />
                  </div>
                  <Select value={audienceType} onValueChange={(value) => setAudienceType(value as "all" | "tag")}>
                    <SelectTrigger className="h-7.5 border-0 bg-transparent px-2 text-xs !text-xs md:!text-xs font-medium shadow-none focus:ring-0 w-full truncate">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-xs">All active contacts</SelectItem>
                      <SelectItem value="tag" className="text-xs">By tag</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Tag selector if audience is tag */}
              {audienceType === "tag" ? (
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-800">Tag</Label>
                  <div className="relative flex items-center rounded-xl border border-slate-200/90 bg-white p-1 shadow-2xs hover:border-slate-300 focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-500/10 transition-all">
                    <div className="flex size-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600 shrink-0">
                      <Tag className="size-3.5" />
                    </div>
                    <Select value={audienceTag} onValueChange={setAudienceTag}>
                      <SelectTrigger className="h-7.5 border-0 bg-transparent px-2 text-xs !text-xs md:!text-xs font-medium shadow-none focus:ring-0 w-full truncate">
                        <SelectValue placeholder="Choose tag" />
                      </SelectTrigger>
                      <SelectContent>
                        {tags.map((tag) => (
                          <SelectItem key={tag} value={tag} className="text-xs">
                            {tag}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : null}

              {/* Scheduled Time */}
              <div className="space-y-1">
                <Label htmlFor={`campaign-scheduled-${campaign.id}`} className="text-xs font-semibold text-slate-800">
                  Scheduled time
                </Label>
                <div className="relative flex items-center rounded-xl border border-slate-200/90 bg-white p-1 shadow-2xs hover:border-slate-300 focus-within:border-purple-500 focus-within:ring-2 focus-within:ring-purple-500/10 transition-all">
                  <div className="flex size-7 items-center justify-center rounded-lg bg-purple-50 text-purple-600 shrink-0">
                    <Calendar className="size-3.5" />
                  </div>
                  <input
                    id={`campaign-scheduled-${campaign.id}`}
                    name="scheduledAt"
                    type="datetime-local"
                    defaultValue={toLocalInput(campaign.scheduledAt, timezone)}
                    className="flex-1 h-7.5 bg-transparent px-2 text-xs !text-xs md:!text-xs text-slate-900 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Timezone */}
              <div className="space-y-1">
                <Label htmlFor={`campaign-timezone-${campaign.id}`} className="text-xs font-semibold text-slate-800">
                  Timezone
                </Label>
                <div className="relative flex items-center rounded-xl border border-slate-200/90 bg-white p-1 shadow-2xs hover:border-slate-300 focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-500/10 transition-all">
                  <div className="flex size-7 items-center justify-center rounded-lg bg-teal-50 text-teal-600 shrink-0">
                    <Globe className="size-3.5" />
                  </div>
                  <Select value={timezone} onValueChange={setTimezone}>
                    <SelectTrigger className="h-7.5 border-0 bg-transparent px-2 text-xs !text-xs md:!text-xs font-medium shadow-none focus:ring-0 w-full truncate">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map((value) => (
                        <SelectItem key={value} value={value} className="text-xs">
                          {value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Delivery Rate */}
            <div className="rounded-xl border border-slate-200/90 bg-white p-2.5 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="flex size-6 items-center justify-center rounded-md bg-emerald-50 text-emerald-600">
                    <Gauge className="size-3.5" />
                  </div>
                  <Label className="text-xs font-semibold text-slate-800">Delivery rate</Label>
                </div>
                <span className="text-[11px] font-bold tabular-nums text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2.5 py-0.5 rounded-full">
                  {rate[0]} msgs/hr
                </span>
              </div>
              <Slider value={rate} onValueChange={setRate} min={1} max={250} step={5} />
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={saving}
                className="h-8.5 px-4 rounded-xl border-slate-200 font-semibold text-xs text-slate-700 hover:bg-slate-50 transition-all"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="h-8.5 px-4.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs gap-1.5 shadow-xs transition-all"
              >
                {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-4" />}
                Save changes
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
