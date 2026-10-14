import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { 
  Calendar, 
  FileText, 
  Globe, 
  Loader2, 
  Mail, 
  Pencil, 
  Phone, 
  Save, 
  Tag, 
  User, 
  UserCheck 
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { contactService } from "@/services";
import type { Contact, ContactStatus } from "@/types";
import { buildPhoneNumber, countryCodes, splitPhoneNumber } from "@/lib/phone";

const sources: Contact["source"][] = ["Manual", "CSV Import", "Website Form", "API", "WhatsApp"];
const statuses: ContactStatus[] = ["active", "inactive", "blocked"];

type ContactEditDialogProps = {
  contact: Contact;
  onSaved: (contact: Contact) => void;
  trigger?: ReactNode;
};

function splitTags(value: FormDataEntryValue | null) {
  return String(value || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.888 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.456 5.711 1.457h.005c6.554 0 11.89-5.335 11.893-11.893a11.82 11.82 0 00-3.488-8.416" />
    </svg>
  );
}

export function ContactEditDialog({ contact, onSaved, trigger }: ContactEditDialogProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [source, setSource] = useState<Contact["source"]>(contact.source);
  const [status, setStatus] = useState<ContactStatus>(contact.status);
  const initialPhone = splitPhoneNumber(contact.phone);
  const [countryCode, setCountryCode] = useState(initialPhone.countryCode);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    setSaving(true);
    try {
      const updated = await contactService.update(contact.id, {
        name: String(form.get("name") || ""),
        phone: buildPhoneNumber(countryCode, String(form.get("phone") || "")),
        email: String(form.get("email") || "") || undefined,
        dateOfBirth: String(form.get("dateOfBirth") || "") || undefined,
        tags: splitTags(form.get("tags")),
        source,
        status,
        notes: String(form.get("notes") || "") || undefined,
      });
      toast.success("Contact updated");
      setOpen(false);
      onSaved(updated);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update contact");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="icon" aria-label={`Edit ${contact.name}`} className="size-7 rounded-md hover:bg-slate-100">
            <Pencil className="size-3.5 text-slate-500" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[590px] p-5.5 rounded-2xl border-slate-200/90 shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 pb-2.5 border-b border-slate-100">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-emerald-50 text-[#25D366] border border-emerald-100/90 shadow-2xs shrink-0">
            <WhatsAppIcon className="size-6" />
          </div>
          <div>
            <DialogTitle className="text-base font-bold text-slate-900 tracking-tight leading-snug">
              Edit contact
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              Update details, tags, and delivery status for {contact.name}.
            </DialogDescription>
          </div>
        </div>

        <form className="space-y-3 pt-2" onSubmit={save}>
          {/* Row 1: Name & Phone */}
          <div className="grid gap-2.5 sm:grid-cols-2">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label htmlFor={`edit-name-${contact.id}`} className="text-xs font-semibold text-slate-800">
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
                  id={`edit-name-${contact.id}`}
                  name="name"
                  required
                  defaultValue={contact.name}
                  placeholder="Ananya Sharma"
                  className="flex-1 h-7.5 bg-transparent px-2 text-xs !text-xs md:!text-xs text-slate-900 placeholder:text-slate-400 placeholder:text-[11px] focus:outline-hidden"
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label htmlFor={`edit-phone-${contact.id}`} className="text-xs font-semibold text-slate-800">
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
                  id={`edit-phone-${contact.id}`}
                  name="phone"
                  required
                  inputMode="numeric"
                  defaultValue={initialPhone.localNumber}
                  placeholder="9876543210"
                  className="flex-1 h-7.5 bg-transparent px-2 text-xs !text-xs md:!text-xs font-medium text-slate-900 placeholder:text-slate-400 placeholder:text-[11px] focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Row 2: Email & Tags */}
          <div className="grid gap-2.5 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor={`edit-email-${contact.id}`} className="text-xs font-semibold text-slate-800">Email (optional)</Label>
              <div className="relative flex items-center rounded-xl border border-slate-200/90 bg-white p-1 shadow-2xs hover:border-slate-300 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/10 transition-all">
                <div className="flex size-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600 shrink-0">
                  <Mail className="size-3.5" />
                </div>
                <input
                  id={`edit-email-${contact.id}`}
                  name="email"
                  type="email"
                  placeholder="email@example.com"
                  defaultValue={contact.email ?? ""}
                  className="flex-1 h-7.5 bg-transparent px-2 text-xs !text-xs md:!text-xs text-slate-900 placeholder:text-slate-400 placeholder:text-[11px] focus:outline-hidden"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor={`edit-tags-${contact.id}`} className="text-xs font-semibold text-slate-800">Tags (comma separated)</Label>
              <div className="relative flex items-center rounded-xl border border-slate-200/90 bg-white p-1 shadow-2xs hover:border-slate-300 focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-500/10 transition-all">
                <div className="flex size-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600 shrink-0">
                  <Tag className="size-3.5" />
                </div>
                <input
                  id={`edit-tags-${contact.id}`}
                  name="tags"
                  placeholder="Lead, VIP, Customer"
                  defaultValue={contact.tags.join(", ")}
                  className="flex-1 h-7.5 bg-transparent px-2.5 text-xs !text-xs md:!text-xs text-slate-900 placeholder:text-slate-400 placeholder:text-[11px] focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Row 3: DOB, Source, Status (3-columns) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="space-y-1">
              <Label htmlFor={`edit-dob-${contact.id}`} className="text-xs font-semibold text-slate-800">Date of birth</Label>
              <div className="relative flex items-center rounded-xl border border-slate-200/90 bg-white p-1 shadow-2xs hover:border-slate-300 focus-within:border-purple-500 focus-within:ring-2 focus-within:ring-purple-500/10 transition-all">
                <div className="flex size-7 items-center justify-center rounded-lg bg-purple-50 text-purple-600 shrink-0">
                  <Calendar className="size-3.5" />
                </div>
                <input
                  id={`edit-dob-${contact.id}`}
                  name="dateOfBirth"
                  type="date"
                  defaultValue={contact.dateOfBirth ?? ""}
                  className="flex-1 h-7.5 bg-transparent px-2 text-xs !text-xs md:!text-xs text-slate-900 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-800">Source</Label>
              <div className="relative flex items-center rounded-xl border border-slate-200/90 bg-white p-1 shadow-2xs hover:border-slate-300 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/10 transition-all">
                <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 shrink-0">
                  <Globe className="size-3.5" />
                </div>
                <Select value={source} onValueChange={(value) => setSource(value as Contact["source"])}>
                  <SelectTrigger className="h-7.5 border-0 bg-transparent px-2 text-xs !text-xs md:!text-xs font-medium shadow-none focus:ring-0 w-full truncate">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sources.map((item) => (
                      <SelectItem key={item} value={item} className="text-xs">
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-800">Status</Label>
              <div className="relative flex items-center rounded-xl border border-slate-200/90 bg-white p-1 shadow-2xs hover:border-slate-300 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/10 transition-all">
                <div className="flex size-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600 shrink-0">
                  <UserCheck className="size-3.5" />
                </div>
                <Select value={status} onValueChange={(value) => setStatus(value as ContactStatus)}>
                  <SelectTrigger className="h-7.5 border-0 bg-transparent px-2 text-xs !text-xs md:!text-xs font-medium shadow-none focus:ring-0 w-full truncate capitalize">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active" className="text-xs">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="size-1.5 rounded-full bg-emerald-500" /> Active
                      </span>
                    </SelectItem>
                    <SelectItem value="inactive" className="text-xs">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="size-1.5 rounded-full bg-slate-400" /> Inactive
                      </span>
                    </SelectItem>
                    <SelectItem value="blocked" className="text-xs">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="size-1.5 rounded-full bg-orange-500" /> Blocked
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Row 4: Notes */}
          <div className="space-y-1">
            <Label htmlFor={`edit-notes-${contact.id}`} className="text-xs font-semibold text-slate-800">Notes</Label>
            <div className="relative flex items-start rounded-xl border border-slate-200/90 bg-white p-1 shadow-2xs hover:border-slate-300 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/10 transition-all">
              <div className="flex size-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600 shrink-0 mt-0.5">
                <FileText className="size-3.5" />
              </div>
              <textarea
                id={`edit-notes-${contact.id}`}
                name="notes"
                rows={2}
                placeholder="Add contact notes or preferences..."
                defaultValue={contact.notes ?? ""}
                className="flex-1 bg-transparent px-2.5 py-1 text-xs !text-xs md:!text-xs text-slate-900 placeholder:text-slate-400 placeholder:text-[11px] focus:outline-hidden resize-none min-h-[46px]"
              />
            </div>
          </div>

          {/* Footer */}
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
      </DialogContent>
    </Dialog>
  );
}
