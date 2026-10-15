import { useCallback, useEffect, useRef, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  Calendar,
  Download,
  FileSpreadsheet,
  Loader2,
  Mail,
  Phone,
  Plus,
  Search,
  Tag,
  Trash2,
  Upload,
  User,
  UserCheck,
  UserPlus,
  Users,
  UserX,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { SectionCard } from "@/components/common/SectionCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { ContactEditDialog } from "@/components/contacts/ContactEditDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { contactService } from "@/services";
import type { Contact } from "@/types";
import { initials, num, relative } from "@/lib/format";
import { buildPhoneNumber, countryCodes, defaultCountryCode } from "@/lib/phone";

export const Route = createFileRoute("/_shell/contacts/")({
  head: () => ({
    meta: [
      { title: "Contacts — Whatsaap" },
      {
        name: "description",
        content:
          "Manage WhatsApp contacts with tags, segments, custom fields, CSV import and per-contact conversation history.",
      },
      { property: "og:title", content: "Contacts — Whatsaap" },
      {
        property: "og:description",
        content: "Search, tag and segment every WhatsApp contact in your workspace.",
      },
    ],
  }),
  component: ContactsPage,
});

const PAGE_SIZE = 10;
const emptyStats = { total: 0, active: 0, inactive: 0, blocked: 0, newThisMonth: 0 };

function ContactsPage() {
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [rows, setRows] = useState<Contact[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [stats, setStats] = useState(emptyStats);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const requestVersion = useRef(0);

  const visible = rows;
  const allVisibleSelected = visible.length > 0 && visible.every((c) => selected.includes(c.id));

  const load = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true);
    try {
      const data = await contactService.list({
        search: query,
        tag,
        status,
        page,
        limit: PAGE_SIZE,
      });
      if (version !== requestVersion.current) return;
      setRows(data.contacts);
      setTags(data.tags);
      setStats(data.stats);
      setPages(data.pages);
      setTotal(data.total);
      setSelected((items) =>
        items.filter((id) => data.contacts.some((contact) => contact.id === id)),
      );
    } catch (error) {
      if (version !== requestVersion.current) return;
      toast.error(error instanceof Error ? error.message : "Unable to load contacts");
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [page, query, status, tag]);

  useEffect(() => {
    void load();
    return () => {
      requestVersion.current += 1;
    };
  }, [load]);

  const current = Math.min(page, pages);

  async function deleteSelected() {
    try {
      const result = await contactService.bulkDelete(selected);
      toast.success(`${result.deleted} contact${result.deleted > 1 ? "s" : ""} deleted`);
      setSelected([]);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete contacts");
    }
  }

  return (
    <div className="space-y-2">
      {/* Consolidated Top Command Header Row */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pb-0.5">
        {/* Left: Title + Inline Stats */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 leading-none">Contacts</h1>
            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 font-semibold text-slate-700 border border-slate-200/70 text-[11px] leading-none">
              <Users className="size-3 text-slate-500" />
              <span>{num(stats.total)}</span>
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700 border border-emerald-200/60 text-[11px] leading-none">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>{num(stats.active)} active</span>
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-0.5 font-semibold text-purple-700 border border-purple-200/60 text-[11px] leading-none">
              <span className="size-1.5 rounded-full bg-purple-500" />
              <span>{num(stats.newThisMonth)} new</span>
            </span>
            {stats.blocked > 0 && (
              <span className="hidden md:inline-flex items-center gap-1 rounded-md bg-orange-50 px-2 py-0.5 font-semibold text-orange-700 border border-orange-200/60 text-[11px] leading-none">
                <span className="size-1.5 rounded-full bg-orange-500" />
                <span>{num(stats.blocked)}</span>
              </span>
            )}
          </div>
        </div>

        {/* Center & Right: Search + Filters + Actions in the SAME row */}
        <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
          {/* Search Bar */}
          <div className="relative flex-1 sm:w-48 md:w-56 lg:w-64">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search by name, phone or email..."
              className="pl-8 h-8 text-xs bg-white rounded-md border-slate-200/90 shadow-2xs focus-visible:ring-1"
            />
          </div>

          {/* Tag Filter */}
          <Select
            value={tag}
            onValueChange={(v) => {
              setTag(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-8 w-24 sm:w-28 text-xs bg-white rounded-md border-slate-200/90 shadow-2xs">
              <SelectValue placeholder="All tags" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All tags</SelectItem>
              {tags.map((t) => (
                <SelectItem key={t} value={t} className="text-xs">
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status Filter */}
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-8 w-24 sm:w-28 text-xs bg-white rounded-md border-slate-200/90 shadow-2xs">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All statuses</SelectItem>
              <SelectItem value="active" className="text-xs">Active</SelectItem>
              <SelectItem value="inactive" className="text-xs">Inactive</SelectItem>
              <SelectItem value="blocked" className="text-xs">Blocked</SelectItem>
            </SelectContent>
          </Select>

          <div className="h-4 w-px bg-slate-200 hidden sm:block mx-0.5" />

          {/* Actions */}
          <Button
            variant="outline"
            size="sm"
            className="px-2 text-[11px] h-8 gap-1 rounded-md border-slate-200/90 bg-white shadow-2xs hover:bg-slate-50"
            onClick={() => toast.success("Export will be added after CSV import")}
          >
            <Download className="size-3" />
            <span className="hidden sm:inline">Export</span>
          </Button>
          <ImportDialog onImported={load} />
          <AddContactDialog onSaved={load} />
        </div>
      </div>

      {/* Main Table Card (Starts immediately with reduced border radius) */}
      <SectionCard bodyClassName="p-0" className="rounded-lg border-slate-200/90">
        {selected.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 border-b border-border bg-emerald-50/70 px-3 py-1.5">
            <p className="text-xs font-semibold text-emerald-900">{selected.length} selected</p>
            <ConfirmDialog
              trigger={
                <Button variant="destructive" size="sm" className="h-7 text-xs px-2 gap-1 rounded-md">
                  <Trash2 className="size-3.5" /> Delete
                </Button>
              }
              title={`Delete ${selected.length} contact${selected.length > 1 ? "s" : ""}?`}
              description="This removes the selected contacts from your workspace."
              confirmLabel="Delete"
              onConfirm={deleteSelected}
            />
            <Button variant="ghost" size="sm" onClick={() => setSelected([])} className="h-7 text-xs px-2 rounded-md">
              Clear
            </Button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading contacts...
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No contacts found"
            description="Try a different search, or add a contact to bring your audience into Whatsaap."
            actions={<AddContactDialog onSaved={load} />}
            className="border-0 shadow-none"
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-4xl text-xs">
                <thead className="bg-slate-50/80 text-left text-[10px] uppercase tracking-wider text-slate-500 border-b border-border">
                  <tr>
                    <th className="w-9 px-2.5 py-2">
                      <Checkbox
                        checked={allVisibleSelected}
                        onCheckedChange={(v) =>
                          setSelected(
                            v
                              ? Array.from(new Set([...selected, ...visible.map((c) => c.id)]))
                              : selected.filter((id) => !visible.some((c) => c.id === id)),
                          )
                        }
                        aria-label="Select all on page"
                        className="rounded"
                      />
                    </th>
                    <th className="px-2.5 py-2 font-semibold">Name</th>
                    <th className="px-2.5 py-2 font-semibold">Phone number</th>
                    <th className="px-2.5 py-2 font-semibold">Date of birth</th>
                    <th className="px-2.5 py-2 font-semibold">Tags</th>
                    <th className="px-2.5 py-2 font-semibold">Source</th>
                    <th className="px-2.5 py-2 font-semibold">Status</th>
                    <th className="px-2.5 py-2 font-semibold">Last contacted</th>
                    <th className="w-12 px-2.5 py-2 font-semibold">Edit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {visible.map((c) => (
                    <tr key={c.id} className="transition-colors hover:bg-slate-50/70 group">
                      <td className="px-2.5 py-1.5">
                        <Checkbox
                          checked={selected.includes(c.id)}
                          onCheckedChange={(v) =>
                            setSelected((s) => (v ? [...s, c.id] : s.filter((id) => id !== c.id)))
                          }
                          aria-label={`Select ${c.name}`}
                          className="rounded"
                        />
                      </td>
                      <td className="px-2.5 py-1.5">
                        <Link
                          to="/contacts/$id"
                          params={{ id: c.id }}
                          className="flex items-center gap-2 group-hover:text-primary transition-colors"
                        >
                          <span className="flex size-6.5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold ring-1 ring-emerald-600/20">
                            {initials(c.name)}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-semibold text-slate-800 group-hover:text-primary">
                              {c.name}
                            </span>
                          </span>
                        </Link>
                      </td>
                      <td className="px-2.5 py-1.5 text-slate-600 font-mono text-[11px]">{c.phone}</td>
                      <td className="px-2.5 py-1.5 text-slate-500">{c.dateOfBirth || "-"}</td>
                      <td className="px-2.5 py-1.5">
                        <div className="flex flex-wrap gap-1">
                          {c.tags.length > 0 ? (
                            c.tags.map((t) => (
                              <span
                                key={t}
                                className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 border border-slate-200/60"
                              >
                                {t}
                              </span>
                            ))
                          ) : (
                            <span className="text-muted-foreground text-[11px]">-</span>
                          )}
                        </div>
                      </td>
                      <td className="px-2.5 py-1.5 text-slate-500">{c.source}</td>
                      <td className="px-2.5 py-1.5">
                        <StatusBadge status={c.status} />
                      </td>
                      <td className="px-2.5 py-1.5 text-slate-500">
                        {c.lastContactedAt ? relative(c.lastContactedAt) : "-"}
                      </td>
                      <td className="px-2.5 py-1.5">
                        <ContactEditDialog contact={c} onSaved={load} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-3 py-1.5 bg-slate-50/50">
              <p className="text-xs text-muted-foreground">
                Showing <span className="font-medium text-foreground">{(current - 1) * PAGE_SIZE + 1}-{Math.min(current * PAGE_SIZE, total)}</span> of{" "}
                <span className="font-medium text-foreground">{total}</span>
              </p>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2.5 text-xs rounded-md"
                  disabled={current === 1}
                  onClick={() => setPage(current - 1)}
                >
                  Previous
                </Button>
                <span className="text-xs text-muted-foreground px-1">
                  Page {current} of {pages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2.5 text-xs rounded-md"
                  disabled={current === pages}
                  onClick={() => setPage(current + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </SectionCard>
    </div>
  );
}

function ImportDialog({ onImported }: { onImported: () => void }) {
  const [open, setOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  async function downloadFormat() {
    try {
      const blob = await contactService.downloadImportTemplate();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "whatsaap-contact-import-format.xlsx";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to download the contact template",
      );
    }
  }

  async function importFile(file: File | undefined) {
    if (!file) return;

    setImporting(true);
    try {
      const result = await contactService.importFile(file);
      toast.success("Contacts imported", {
        description: `${result.created} created, ${result.updated} updated, ${result.skipped} skipped`,
      });

      if (result.errors.length > 0) {
        toast.warning("Some rows were skipped", {
          description: result.errors
            .slice(0, 3)
            .map((error) => `Row ${error.row}: ${error.message}`)
            .join(" · "),
        });
      }

      setOpen(false);
      onImported();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to import contacts");
    } finally {
      setImporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="px-2 text-[11px] h-8 gap-1">
          <Upload className="size-3" /> Import
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import contacts</DialogTitle>
          <DialogDescription>
            Download the Excel format, fill your contacts, then upload the Excel or CSV file.
          </DialogDescription>
        </DialogHeader>
        <div className="min-w-0 rounded-lg border border-border bg-surface-muted p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <FileSpreadsheet className="size-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-sm font-medium">Excel upload format</p>
                <p className="text-xs text-muted-foreground">
                  Required columns: name, phone. Optional date_of_birth uses YYYY-MM-DD. Phone can
                  be a 10-digit India number without +91.
                </p>
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={downloadFormat}>
              <Download className="size-4" /> Download format
            </Button>
          </div>
          <div className="mt-3 max-w-full overflow-x-auto rounded-md border border-border bg-surface">
            <table className="w-max min-w-full text-xs">
              <thead className="bg-surface-muted text-left text-muted-foreground">
                <tr>
                  {[
                    "name",
                    "phone",
                    "email",
                    "date_of_birth",
                    "tags",
                    "source",
                    "status",
                    "notes",
                    "company",
                    "city",
                  ].map((column) => (
                    <th key={column} className="px-3 py-2 font-medium">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {[
                    "Ananya Sharma",
                    "9876543210",
                    "ananya@example.com",
                    "1994-05-18",
                    "Lead, VIP",
                    "CSV Import",
                    "active",
                    "Interested in pricing",
                    "Bright Retail",
                    "Mumbai",
                  ].map((value) => (
                    <td key={value} className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                      {value}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <label
          className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-surface-muted px-6 py-10 text-center ${importing ? "pointer-events-none opacity-70" : ""}`}
        >
          {importing ? (
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          ) : (
            <Upload className="size-6 text-muted-foreground" />
          )}
          <span className="text-sm font-medium">
            {importing ? "Importing contacts..." : "Choose an Excel or CSV file"}
          </span>
          <span className="text-xs text-muted-foreground">Accepted formats: .xlsx, .xls, .csv</span>
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            disabled={importing}
            onChange={(event) => {
              importFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </label>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={importing}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.888 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.456 5.711 1.457h.005c6.554 0 11.89-5.335 11.893-11.893a11.82 11.82 0 00-3.488-8.416" />
    </svg>
  );
}

function AddContactDialog({ onSaved }: { onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [countryCode, setCountryCode] = useState(defaultCountryCode);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="px-2.5 text-[11px] h-8 gap-1.5 rounded-lg font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs">
          <Plus className="size-3.5" /> Add contact
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] p-5.5 rounded-2xl border-slate-200/90 shadow-2xl">
        {/* Header matching reference */}
        <div className="flex items-center gap-3 pb-2 border-b border-slate-100">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-emerald-50 text-[#25D366] border border-emerald-100/90 shadow-2xs shrink-0">
            <WhatsAppIcon className="size-6" />
          </div>
          <div>
            <DialogTitle className="text-base font-bold text-slate-900 tracking-tight leading-snug">
              Add Contact
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              Create a new contact manually.
            </DialogDescription>
          </div>
        </div>

        <form
          className="space-y-3 pt-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            setSaving(true);
            try {
              await contactService.create({
                name: String(form.get("name") || ""),
                phone: buildPhoneNumber(countryCode, String(form.get("phone") || "")),
                email: String(form.get("email") || "") || undefined,
                dateOfBirth: String(form.get("dateOfBirth") || "") || undefined,
                tags: String(form.get("tags") || "")
                  .split(",")
                  .map((tag) => tag.trim())
                  .filter(Boolean),
              });
              toast.success("Contact added");
              setOpen(false);
              onSaved();
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Unable to save contact");
            } finally {
              setSaving(false);
            }
          }}
        >
          {/* Full Name */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label htmlFor="c-name" className="text-xs font-semibold text-slate-800">
                Full name
              </Label>
              <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200/60 leading-none">
                Required
              </span>
            </div>
            <div className="relative flex items-center rounded-xl border border-slate-200/90 bg-white p-1 shadow-2xs hover:border-slate-300 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/10 transition-all">
              <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 shrink-0">
                <User className="size-3.5" />
              </div>
              <input
                id="c-name"
                name="name"
                required
                placeholder="Ananya Sharma"
                className="flex-1 h-7.5 bg-transparent px-2.5 text-xs !text-xs md:!text-xs text-slate-900 placeholder:text-slate-400 placeholder:text-[11px] focus:outline-hidden"
              />
            </div>
          </div>

          {/* WhatsApp Number */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label htmlFor="c-phone" className="text-xs font-semibold text-slate-800">
                WhatsApp number
              </Label>
              <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200/60 leading-none">
                Required
              </span>
            </div>
            <div className="relative flex items-center rounded-xl border border-slate-200/90 bg-white p-1 shadow-2xs hover:border-slate-300 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/10 transition-all">
              <Select value={countryCode} onValueChange={setCountryCode}>
                <SelectTrigger className="h-7.5 border-0 bg-transparent px-2 shadow-none focus:ring-0 text-xs font-semibold gap-1 shrink-0 w-auto">
                  <SelectValue>
                    {(() => {
                      const sel = countryCodes.find((c) => c.code === countryCode);
                      return sel ? `${sel.flag} ${sel.code}` : undefined;
                    })()}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {countryCodes.map((country) => (
                    <SelectItem key={country.code} value={country.code} className="text-xs">
                      {country.flag} {country.label} ({country.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="h-4.5 w-px bg-slate-200 mx-1 shrink-0" />
              <div className="flex size-7 items-center justify-center text-slate-400 shrink-0">
                <Phone className="size-3.5" />
              </div>
              <input
                id="c-phone"
                name="phone"
                required
                inputMode="numeric"
                placeholder="9876543210"
                className="flex-1 h-7.5 bg-transparent px-2 text-xs !text-xs md:!text-xs font-medium text-slate-900 placeholder:text-slate-400 placeholder:text-[11px] focus:outline-hidden"
              />
            </div>
          </div>

          {/* Email & Date of birth side by side */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <Label htmlFor="c-email" className="text-xs font-semibold text-slate-800">
                Email (optional)
              </Label>
              <div className="relative flex items-center rounded-xl border border-slate-200/90 bg-white p-1 shadow-2xs hover:border-slate-300 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/10 transition-all">
                <div className="flex size-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600 shrink-0">
                  <Mail className="size-3.5" />
                </div>
                <input
                  id="c-email"
                  name="email"
                  type="email"
                  placeholder="ananya@example.com"
                  className="flex-1 h-7.5 bg-transparent px-2 text-xs !text-xs md:!text-xs text-slate-900 placeholder:text-slate-400 placeholder:text-[11px] focus:outline-hidden"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="c-dob" className="text-xs font-semibold text-slate-800">
                Date of birth (optional)
              </Label>
              <div className="relative flex items-center rounded-xl border border-slate-200/90 bg-white p-1 shadow-2xs hover:border-slate-300 focus-within:border-purple-500 focus-within:ring-2 focus-within:ring-purple-500/10 transition-all">
                <div className="flex size-7 items-center justify-center rounded-lg bg-purple-50 text-purple-600 shrink-0">
                  <Calendar className="size-3.5" />
                </div>
                <input
                  id="c-dob"
                  name="dateOfBirth"
                  type="date"
                  className="flex-1 h-7.5 bg-transparent px-2 text-xs !text-xs md:!text-xs text-slate-900 placeholder:text-slate-400 placeholder:text-[11px] focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-1">
            <Label htmlFor="c-tags" className="text-xs font-semibold text-slate-800">
              Tags (comma separated)
            </Label>
            <div className="relative flex items-center rounded-xl border border-slate-200/90 bg-white p-1 shadow-2xs hover:border-slate-300 focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-500/10 transition-all">
              <div className="flex size-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600 shrink-0">
                <Tag className="size-3.5" />
              </div>
              <input
                id="c-tags"
                name="tags"
                placeholder="Lead, VIP, Student"
                className="flex-1 h-7.5 bg-transparent px-2.5 text-xs !text-xs md:!text-xs text-slate-900 placeholder:text-slate-400 placeholder:text-[11px] focus:outline-hidden"
              />
            </div>
          </div>

          {/* Footer buttons matching reference */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="h-8.5 px-4 rounded-xl border-slate-200 font-semibold text-xs text-slate-700 hover:bg-slate-50 transition-all"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="h-8.5 px-4.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs gap-1.5 shadow-xs transition-all"
            >
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : <UserPlus className="size-4" />}
              Save contact
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
