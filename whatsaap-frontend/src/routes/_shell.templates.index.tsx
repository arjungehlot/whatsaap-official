import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Copy, FileText, Loader2, MessageSquareText, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { SectionCard } from "@/components/common/SectionCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { WhatsAppPreview } from "@/components/common/WhatsAppPreview";
import { TemplateEditDialog } from "@/components/templates/TemplateEditDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { templateService } from "@/services";
import type { Template } from "@/types";
import { num, relative } from "@/lib/format";

export const Route = createFileRoute("/_shell/templates/")({
  head: () => ({ meta: [{ title: "Message Templates — Whatsaap" }] }),
  component: TemplatesPage,
});

function templateFiles(template: Template) {
  return template.attachments?.length
    ? template.attachments
    : template.attachment
      ? [template.attachment]
      : [];
}

function TemplatesPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const requestVersion = useRef(0);

  const load = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true);
    try {
      const rows = await templateService.list({ search: query, category });
      if (version !== requestVersion.current) return;
      setTemplates(rows);
      setActiveId((current) =>
        current && rows.some((t) => t.id === current) ? current : (rows[0]?.id ?? null),
      );
    } catch (error) {
      if (version !== requestVersion.current) return;
      toast.error(error instanceof Error ? error.message : "Unable to load templates");
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [category, query]);

  useEffect(() => {
    void load();
    return () => {
      requestVersion.current += 1;
    };
  }, [load]);

  const filtered = useMemo(() => templates, [templates]);
  const active = templates.find((t) => t.id === activeId) ?? templates[0];

  async function duplicate(id: string) {
    try {
      await templateService.duplicate(id);
      toast.success("Template duplicated");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to duplicate template");
    }
  }

  async function remove(id: string) {
    try {
      await templateService.delete(id);
      toast.success("Template deleted");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete template");
    }
  }

  return (
    <div className="space-y-2">
      {/* Consolidated Top Command Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pb-0.5">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 leading-none">Message Templates</h1>
            <span className="inline-flex items-center justify-center rounded-md bg-primary/10 text-primary px-1.5 py-0.5 text-[11px] font-bold leading-none">
              {templates.length}
            </span>
          </div>
          <span className="text-xs text-muted-foreground hidden md:inline">Write once, reuse across campaigns and automations.</span>
        </div>

        {/* Search, Filter, Action in the SAME row */}
        <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
          <div className="relative flex-1 sm:w-48 md:w-56">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search templates..."
              className="pl-8 h-8 text-xs bg-white rounded-md border-slate-200/90 shadow-2xs"
            />
          </div>

          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-32 sm:w-36 h-8 text-xs bg-white rounded-md border-slate-200/90 shadow-2xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All categories</SelectItem>
              {["Marketing", "Transactional", "Reminder", "Welcome", "Follow-up", "Other"].map((c) => (
                <SelectItem key={c} value={c} className="text-xs">
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button asChild size="sm" className="h-8 text-xs px-2.5 sm:px-3 rounded-md bg-primary text-primary-foreground shadow-2xs shrink-0 gap-1">
            <Link to="/templates/create">
              <Plus className="size-3.5" /> <span className="hidden sm:inline">New template</span><span className="sm:hidden">New</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Main 2-Column Responsive Studio Layout */}
      <div className="grid gap-2.5 lg:grid-cols-12 items-start">
        {/* Left Column: Template Cards Grid */}
        <div className="lg:col-span-7 xl:col-span-8">
          <SectionCard bodyClassName="p-2" className="rounded-lg border-slate-200/90 shadow-2xs">
            {loading ? (
              <div className="flex items-center justify-center gap-2 p-12 text-xs text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Loading templates...
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={MessageSquareText}
                title="No templates found"
                description="Create a template to reuse your best-performing message."
                actions={
                  <Button asChild size="sm" className="h-8 text-xs">
                    <Link to="/templates/create">
                      <Plus className="size-3.5" /> New template
                    </Link>
                  </Button>
                }
                className="border-0 shadow-none py-8"
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {filtered.map((t) => {
                  const files = templateFiles(t);
                  const isActive = t.id === active?.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setActiveId(t.id)}
                      className={`flex flex-col text-left transition-all rounded-lg border p-2 text-xs shadow-2xs ${
                        isActive
                          ? "bg-emerald-100/70 border-emerald-500 ring-1.5 ring-emerald-500/40 shadow-xs"
                          : "bg-white border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/50"
                      }`}
                    >
                      <div className="flex w-full items-start justify-between gap-1 mb-1">
                        <span className={`font-bold truncate text-xs ${isActive ? "text-emerald-950 font-bold" : "text-slate-900"}`} title={t.name}>
                          {t.name}
                        </span>
                        <StatusBadge status={t.status} className="shrink-0 scale-75 origin-top-right -my-0.5" />
                      </div>
                      <p className="line-clamp-2 text-[11px] leading-tight text-slate-600 mb-2 flex-1">
                        {t.body}
                      </p>
                      <div className={`mt-auto w-full border-t pt-1.5 ${isActive ? "border-emerald-200/80" : "border-slate-100"}`}>
                        <div className="flex items-center justify-between gap-1 text-[10px]">
                          <span className={`font-semibold uppercase tracking-wider text-[9px] ${isActive ? "text-emerald-800" : "text-slate-500"}`}>
                            {t.category} · {t.language}
                          </span>
                          {files.length > 0 && (
                            <span className="inline-flex items-center gap-1 rounded bg-white/90 border border-slate-200/60 px-1 py-0.2 font-semibold text-slate-700 text-[9px]">
                              <FileText className="size-2.5 text-emerald-600" /> {files.length}
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 flex items-center justify-between text-[9px] text-muted-foreground font-medium">
                          <span>Used {num(t.usageCount)}x</span>
                          <span>Updated {relative(t.updatedAt)}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </div>

        {/* Right Column: Template Studio Preview Pane */}
        {active ? (
          <div className="lg:col-span-5 xl:col-span-4 space-y-2">
            <SectionCard
              title={active.name}
              actions={
                <div className="flex items-center gap-1">
                  <TemplateEditDialog
                    key={active.id}
                    template={active}
                    onSaved={load}
                    trigger={
                      <Button variant="outline" size="sm" className="h-7 text-xs px-2 gap-1 rounded-md">
                        <Pencil className="size-3" /> Edit
                      </Button>
                    }
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs px-2 gap-1 rounded-md"
                    onClick={() => duplicate(active.id)}
                  >
                    <Copy className="size-3" /> Duplicate
                  </Button>
                  <ConfirmDialog
                    trigger={
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-md text-destructive hover:bg-destructive/10">
                        <Trash2 className="size-3.5" />
                      </Button>
                    }
                    title={`Delete "${active.name}"?`}
                    description="Campaigns already sent keep their message copy."
                    confirmLabel="Delete"
                    onConfirm={() => remove(active.id)}
                  />
                </div>
              }
              className="rounded-lg border-slate-200/90 shadow-2xs overflow-hidden"
              bodyClassName="p-2.5 space-y-2 bg-slate-50/40"
            >
              {/* Specs & Variables Ticker Bar */}
              <div className="flex flex-wrap items-center justify-between gap-1.5 rounded-md bg-white border border-slate-200/80 p-2 text-xs shadow-2xs">
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="font-semibold text-slate-800">{active.category}</span>
                  <span className="h-3 w-px bg-slate-200" />
                  <span>{active.language}</span>
                  <span className="h-3 w-px bg-slate-200" />
                  <span>Used {num(active.usageCount)}x</span>
                </div>

                {/* Variables pills */}
                <div className="flex items-center gap-1 flex-wrap">
                  {Array.from(new Set(active.body.match(/\{\{(\w+)\}\}/g) ?? [])).map((v) => (
                    <span
                      key={v}
                      className="rounded bg-primary/10 text-primary border border-primary/20 px-1 py-0.2 font-mono text-[9px] font-semibold"
                    >
                      {v}
                    </span>
                  ))}
                </div>
              </div>

              {/* Attachments Chip List (if any) */}
              {templateFiles(active).length > 0 && (
                <div className="flex flex-wrap gap-1.5 p-1.5 rounded-md bg-white border border-slate-200/80 shadow-2xs">
                  {templateFiles(active).map((file, idx) => (
                    <div key={`${file.name}-${idx}`} className="flex items-center gap-1.5 rounded bg-slate-50 px-2 py-1 border border-slate-200/60 text-[11px]">
                      <FileText className="size-3 text-primary" />
                      <span className="font-medium text-slate-800 truncate max-w-[140px]">{file.name}</span>
                      <span className="text-[9px] text-muted-foreground font-mono uppercase">({file.kind})</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Live WhatsApp Mockup */}
              <WhatsAppPreview
                body={active.body}
                attachments={templateFiles(active)}
                showReply={false}
                chatClassName="max-h-[350px]"
                variables={{
                  name: "Ananya",
                  company: "Bright Retail",
                  order_id: "BR-48123",
                  amount: "Rs 1,299",
                }}
              />
            </SectionCard>
          </div>
        ) : null}
      </div>
    </div>
  );
}
