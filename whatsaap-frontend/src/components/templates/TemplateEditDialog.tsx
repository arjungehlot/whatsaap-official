import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { 
  Activity,
  FileText, 
  FolderOpen, 
  Languages, 
  LayoutTemplate, 
  Loader2, 
  Paperclip, 
  Pencil, 
  Save, 
  Sparkles, 
  Trash2, 
  Upload 
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { templateService } from "@/services";
import type { Template, TemplateAttachment, TemplateCategory, TemplateStatus } from "@/types";

const categories: TemplateCategory[] = ["Marketing", "Transactional", "Reminder", "Welcome", "Follow-up", "Other"];
const statuses: TemplateStatus[] = ["draft", "active", "inactive"];
const maxAttachments = 10;

type TemplateEditDialogProps = {
  template: Template;
  onSaved: (template: Template) => void;
  trigger?: ReactNode;
};

function fileSize(size: number) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export function TemplateEditDialog({ template, onSaved, trigger }: TemplateEditDialogProps) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<TemplateCategory>(template.category);
  const [status, setStatus] = useState<TemplateStatus>(template.status);
  const [body, setBody] = useState(template.body);
  const initialAttachments = template.attachments?.length ? template.attachments : template.attachment ? [template.attachment] : [];
  const [attachments, setAttachments] = useState<TemplateAttachment[]>(initialAttachments);
  const [attachmentChanged, setAttachmentChanged] = useState(false);
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
      setAttachmentChanged(true);
      toast.success(`${uploaded.length} attachment${uploaded.length === 1 ? "" : "s"} uploaded`);
      if ((files?.length ?? 0) > selected.length) toast.info(`A template can have up to ${maxAttachments} attachments`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to upload attachment");
    } finally {
      setUploading(false);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    try {
      const updated = await templateService.update(template.id, {
        name: String(form.get("name") || ""),
        category,
        language: String(form.get("language") || ""),
        status,
        body,
        attachments: attachmentChanged ? attachments : undefined,
        attachment: attachmentChanged ? attachments[0] ?? null : undefined,
      });
      toast.success("Template updated");
      setOpen(false);
      onSaved(updated);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update template");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="h-7.5 px-2.5 text-xs gap-1 rounded-lg">
            <Pencil className="size-3.5" /> <span className="hidden sm:inline">Edit</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] sm:max-w-[620px] overflow-y-auto p-5.5 rounded-2xl border-slate-200/90 shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 pb-2.5 border-b border-slate-100">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 border border-blue-100/90 shadow-2xs shrink-0">
            <LayoutTemplate className="size-5.5 text-blue-600" />
          </div>
          <div>
            <DialogTitle className="text-base font-bold text-slate-900 tracking-tight leading-snug">
              Edit template
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              Changes apply to future campaigns; sent campaigns keep their snapshot.
            </DialogDescription>
          </div>
        </div>

        <form className="space-y-3 pt-2" onSubmit={save}>
          {/* Template Name */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label htmlFor={`tpl-edit-name-${template.id}`} className="text-xs font-semibold text-slate-800">
                Template name
              </Label>
              <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200/60 leading-none">
                Required
              </span>
            </div>
            <div className="relative flex items-center rounded-xl border border-slate-200/90 bg-white p-1 shadow-2xs hover:border-slate-300 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/10 transition-all">
              <div className="flex size-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600 shrink-0">
                <Sparkles className="size-3.5" />
              </div>
              <input
                id={`tpl-edit-name-${template.id}`}
                name="name"
                required
                defaultValue={template.name}
                placeholder="e.g. Festival Offer Broadcast"
                className="flex-1 h-7.5 bg-transparent px-2.5 text-xs !text-xs md:!text-xs text-slate-900 placeholder:text-slate-400 placeholder:text-[11px] focus:outline-hidden"
              />
            </div>
          </div>

          {/* 3-Column Grid: Category, Language, Status */}
          <div className="grid gap-2.5 sm:grid-cols-3">
            {/* Category */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-slate-800">Category</Label>
                <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200/60 leading-none">
                  Required
                </span>
              </div>
              <div className="relative flex items-center rounded-xl border border-slate-200/90 bg-white p-1 shadow-2xs hover:border-slate-300 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/10 transition-all">
                <div className="flex size-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 shrink-0">
                  <FolderOpen className="size-3.5" />
                </div>
                <Select value={category} onValueChange={(value) => setCategory(value as TemplateCategory)}>
                  <SelectTrigger className="h-7.5 border-0 bg-transparent px-2 text-xs !text-xs md:!text-xs font-medium shadow-none focus:ring-0 w-full truncate">
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
            </div>

            {/* Language */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label htmlFor={`tpl-edit-language-${template.id}`} className="text-xs font-semibold text-slate-800">
                  Language
                </Label>
                <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200/60 leading-none">
                  Required
                </span>
              </div>
              <div className="relative flex items-center rounded-xl border border-slate-200/90 bg-white p-1 shadow-2xs hover:border-slate-300 focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-500/10 transition-all">
                <div className="flex size-7 items-center justify-center rounded-lg bg-teal-50 text-teal-600 shrink-0">
                  <Languages className="size-3.5" />
                </div>
                <input
                  id={`tpl-edit-language-${template.id}`}
                  name="language"
                  required
                  defaultValue={template.language}
                  placeholder="en / hi"
                  className="flex-1 h-7.5 bg-transparent px-2 text-xs !text-xs md:!text-xs text-slate-900 placeholder:text-slate-400 placeholder:text-[11px] focus:outline-hidden"
                />
              </div>
            </div>

            {/* Status */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-800">Status</Label>
              <div className="relative flex items-center rounded-xl border border-slate-200/90 bg-white p-1 shadow-2xs hover:border-slate-300 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/10 transition-all">
                <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 shrink-0">
                  <Activity className="size-3.5" />
                </div>
                <Select value={status} onValueChange={(value) => setStatus(value as TemplateStatus)}>
                  <SelectTrigger className="h-7.5 border-0 bg-transparent px-2 text-xs !text-xs md:!text-xs font-medium shadow-none focus:ring-0 w-full truncate capitalize">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statuses.map((item) => (
                      <SelectItem key={item} value={item} className="text-xs capitalize">
                        <span className="inline-flex items-center gap-1.5">
                          <span className={`size-1.5 rounded-full ${item === "active" ? "bg-emerald-500" : item === "draft" ? "bg-amber-500" : "bg-slate-400"}`} />
                          {item}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Message Body */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label htmlFor={`tpl-edit-body-${template.id}`} className="text-xs font-semibold text-slate-800">
                Message body
              </Label>
              <span className="text-[10px] font-mono text-muted-foreground">{body.length} characters</span>
            </div>
            <div className="relative flex items-start rounded-xl border border-slate-200/90 bg-white p-1 shadow-2xs hover:border-slate-300 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/10 transition-all">
              <div className="flex size-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600 shrink-0 mt-0.5">
                <FileText className="size-3.5" />
              </div>
              <textarea
                id={`tpl-edit-body-${template.id}`}
                value={body}
                onChange={(event) => setBody(event.target.value)}
                rows={4}
                placeholder="Type your WhatsApp template message with {{variables}}..."
                className="flex-1 bg-transparent px-2.5 py-1 text-xs !text-xs md:!text-xs text-slate-900 placeholder:text-slate-400 placeholder:text-[11px] focus:outline-hidden resize-none min-h-[90px] leading-relaxed font-sans"
              />
            </div>
          </div>

          {/* Attachments Section */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-slate-800">
                Attachments ({attachments.length}/{maxAttachments})
              </Label>
              <span className="text-[10px] text-muted-foreground">Images, Videos, PDFs</span>
            </div>

            {attachments.length > 0 && (
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-0.5">
                {attachments.map((attachment, index) => (
                  <div key={`${attachment.name}-${index}`} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200/90 bg-white p-1.5 shadow-2xs">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                        <Paperclip className="size-3.5" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-slate-800">{attachment.name}</p>
                        <p className="text-[10px] text-muted-foreground">{attachment.kind} · {fileSize(attachment.size)}</p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index));
                        setAttachmentChanged(true);
                      }}
                      className="size-7 rounded-lg hover:bg-rose-50 hover:text-rose-600 text-slate-400 transition-colors"
                      aria-label="Remove attachment"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <label className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200/90 bg-slate-50/60 p-2.5 text-center hover:bg-white hover:border-blue-400 transition-all ${uploading ? "pointer-events-none opacity-70" : ""}`}>
              {uploading ? (
                <Loader2 className="size-4 animate-spin text-blue-600" />
              ) : (
                <Upload className="size-4 text-blue-600" />
              )}
              <span className="text-xs font-medium text-slate-700">
                {uploading ? "Uploading attachments..." : "Upload image, video or document (up to 10)"}
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
              disabled={saving || uploading || !body.trim()}
              className="h-8.5 px-4.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs gap-1.5 shadow-xs transition-all"
            >
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-4" />}
              Save changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
