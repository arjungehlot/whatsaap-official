import { useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, FileText, Image, Loader2, Play, Plus, Save, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { SectionCard } from "@/components/common/SectionCard";
import { WhatsAppPreview } from "@/components/common/WhatsAppPreview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { templateService } from "@/services";
import type { TemplateAttachment, TemplateCategory, TemplateStatus } from "@/types";

export const Route = createFileRoute("/_shell/templates/create")({ component: CreateTemplatePage });

const categories: TemplateCategory[] = ["Marketing", "Transactional", "Reminder", "Welcome", "Follow-up", "Other"];
const statuses: TemplateStatus[] = ["draft", "active", "inactive"];
const maxAttachments = 10;

function fileSize(size: number) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function CreateTemplatePage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<TemplateCategory>("Marketing");
  const [language, setLanguage] = useState("English");
  const [status, setStatus] = useState<TemplateStatus>("active");
  const [body, setBody] = useState("Hi {{name}}, thanks for your interest. How can we help you today?");
  const [attachments, setAttachments] = useState<TemplateAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function uploadAttachments(files: FileList | null) {
    const selected = Array.from(files ?? []).slice(0, Math.max(0, maxAttachments - attachments.length));
    if (selected.length === 0) return;

    setUploading(true);
    try {
      const uploaded: TemplateAttachment[] = [];
      for (const file of selected) uploaded.push(await templateService.uploadAttachment(file));
      setAttachments((current) => [...current, ...uploaded]);
      toast.success(`${uploaded.length} attachment${uploaded.length === 1 ? "" : "s"} uploaded`);
      if ((files?.length ?? 0) > selected.length) toast.info(`A template can have up to ${maxAttachments} attachments`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to upload attachment");
    } finally {
      setUploading(false);
    }
  }

  function insertVariable(variableKey: string) {
    setBody((prev) => `${prev} {{${variableKey}}}`);
  }

  async function save() {
    setSaving(true);
    try {
      await templateService.create({ name, category, language, status, body, attachments });
      toast.success("Template created");
      navigate({ to: "/templates" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create template");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-0.5">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground -ml-1 gap-1" asChild>
            <Link to="/templates">
              <ArrowLeft className="size-3.5" /> Back to templates
            </Link>
          </Button>
          <div className="h-3.5 w-px bg-slate-200" />
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold tracking-tight text-slate-900 leading-none">Create template</h1>
            <span className="hidden sm:inline-flex items-center rounded-md bg-slate-100 text-slate-600 px-1.5 py-0.5 text-[10px] font-medium leading-none">
              Live Preview
            </span>
          </div>
        </div>

        <Button
          onClick={save}
          disabled={saving || uploading || name.trim().length < 2 || !body.trim()}
          size="sm"
          className="h-8 text-xs px-3 rounded-md bg-primary text-primary-foreground shadow-2xs gap-1.5"
        >
          {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
          <span>Save template</span>
        </Button>
      </div>

      {/* 2-Column Responsive Studio Layout */}
      <div className="grid gap-2.5 lg:grid-cols-12 items-start">
        {/* Left Column: Template Details Form */}
        <div className="lg:col-span-7 xl:col-span-7">
          <SectionCard
            title="Template Configuration"
            actions={<span className="text-[11px] text-muted-foreground font-medium">Standard Meta template specs</span>}
            className="rounded-lg border-slate-200/90 shadow-2xs overflow-hidden"
            bodyClassName="p-3 space-y-3"
          >
            {/* Metadata Fields 4-Grid */}
            <div className="grid gap-2 sm:grid-cols-4">
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="tpl-name" className="text-xs font-semibold">
                  Template Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="tpl-name"
                  className="h-8 text-xs rounded-md border-slate-200/90 shadow-2xs"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Welcome Message"
                  autoFocus
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Category</Label>
                <Select value={category} onValueChange={(v) => setCategory(v as TemplateCategory)}>
                  <SelectTrigger className="h-8 text-xs rounded-md border-slate-200/90 bg-white shadow-2xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((item) => (
                      <SelectItem key={item} value={item} className="text-xs">
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="tpl-language" className="text-xs font-semibold">
                  Language
                </Label>
                <Input
                  id="tpl-language"
                  className="h-8 text-xs rounded-md border-slate-200/90 shadow-2xs"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                />
              </div>
            </div>

            {/* Message Body Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="tpl-body" className="text-xs font-semibold">
                  Message Body <span className="text-destructive">*</span>
                </Label>
                {/* Quick Variable Inserts */}
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-muted-foreground hidden sm:inline mr-1">Insert variable:</span>
                  {["name", "company", "order_id"].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => insertVariable(v)}
                      className="rounded bg-slate-100 hover:bg-primary/10 hover:text-primary text-slate-700 border border-slate-200/60 px-1.5 py-0.5 text-[10px] font-mono font-medium transition-colors"
                    >
                      +{v}
                    </button>
                  ))}
                </div>
              </div>
              <Textarea
                id="tpl-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
                className="text-xs min-h-[110px] py-2 rounded-md border-slate-200/90 shadow-2xs font-sans leading-relaxed resize-none"
                placeholder="Write your template message here..."
              />
            </div>

            {/* Media Attachment Upload Section */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Media Attachment (optional)</Label>
                <span className="text-[10px] text-muted-foreground">{attachments.length} / {maxAttachments} files</span>
              </div>

              {/* Uploaded Files Chips */}
              {attachments.length > 0 && (
                <div className="space-y-1.5 mb-1.5">
                  {attachments.map((attachment, index) => {
                    const isImage = attachment.kind === "image";
                    const isVideo = attachment.kind === "video";
                    const Icon = isImage ? Image : isVideo ? Play : FileText;
                    return (
                      <div
                        key={`${attachment.name}-${index}`}
                        className="flex items-center justify-between gap-2 rounded-md border border-slate-200/80 bg-slate-50/70 p-1.5 text-xs shadow-2xs"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="flex size-7 shrink-0 items-center justify-center rounded bg-primary/10 text-primary">
                            <Icon className="size-3.5" />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-xs font-medium text-slate-900">{attachment.name}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">
                              {attachment.kind.toUpperCase()} · {fileSize(attachment.size)}
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-6 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                          aria-label="Remove attachment"
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Compact Dropzone */}
              <label
                className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed border-slate-300 bg-slate-50/50 px-3 py-3 text-center transition-colors hover:bg-slate-100/60 ${
                  uploading ? "pointer-events-none opacity-70" : ""
                }`}
              >
                {uploading ? (
                  <Loader2 className="size-4 animate-spin text-primary" />
                ) : (
                  <Upload className="size-4 text-slate-500" />
                )}
                <span className="text-xs font-semibold text-slate-800">
                  {uploading ? "Uploading media..." : "Click to upload image, video, or document"}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  Supports JPG, PNG, MP4, PDF up to 16MB. The first file acts as message header.
                </span>
                <input
                  type="file"
                  multiple
                  className="hidden"
                  accept="image/*,video/*,.pdf,.xls,.xlsx,.csv,.doc,.docx,.ppt,.pptx,.txt"
                  disabled={uploading || attachments.length >= maxAttachments}
                  onChange={(event) => {
                    uploadAttachments(event.target.files);
                    event.target.value = "";
                  }}
                />
              </label>
            </div>
          </SectionCard>
        </div>

        {/* Right Column: Live WhatsApp Chat Preview */}
        <div className="lg:col-span-5 xl:col-span-5">
          <SectionCard
            title="Live WhatsApp Preview"
            actions={<span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200/60 rounded px-1.5 py-0.5 font-medium">Real-time mock</span>}
            className="rounded-lg border-slate-200/90 shadow-2xs overflow-hidden"
            bodyClassName="p-2.5 bg-slate-50/40"
          >
            <WhatsAppPreview
              body={body}
              attachments={attachments}
              showReply={false}
              chatClassName="max-h-[380px]"
              variables={{ name: "Ananya", company: "Bright Retail", order_id: "BR-48123", amount: "Rs 1,299" }}
            />
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
