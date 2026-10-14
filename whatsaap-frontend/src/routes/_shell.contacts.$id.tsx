import { useState } from "react";
import { Link, createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Ban, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { SectionCard } from "@/components/common/SectionCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { ContactEditDialog } from "@/components/contacts/ContactEditDialog";
import { Button } from "@/components/ui/button";
import { contactService } from "@/services";
import { dateOnly, initials, relative } from "@/lib/format";

export const Route = createFileRoute("/_shell/contacts/$id")({
  loader: async ({ params }) => {
    try {
      return { contact: await contactService.get(params.id) };
    } catch (_error) {
      throw notFound();
    }
  },
  component: ContactDetailRoute,
});

function ContactDetailRoute() {
  const { contact } = Route.useLoaderData();
  return <ContactDetailPage key={contact.id} loadedContact={contact} />;
}

function ContactDetailPage({ loadedContact }: { loadedContact: Awaited<ReturnType<typeof contactService.get>> }) {
  const navigate = useNavigate();
  const [contact, setContact] = useState(loadedContact);
  const [status, setStatus] = useState(contact.status);

  async function block() {
    try {
      const updated = await contactService.update(contact.id, { status: "blocked" });
      setContact(updated);
      setStatus(updated.status);
      toast.success("Contact blocked");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to block contact");
    }
  }

  async function remove() {
    try {
      await contactService.delete(contact.id);
      toast.success("Contact deleted");
      navigate({ to: "/contacts" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete contact");
    }
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" className="-ml-2 w-fit" asChild>
        <Link to="/contacts"><ArrowLeft className="size-4" /> Back to contacts</Link>
      </Button>
      <PageHeader
        title={contact.name}
        description={`${contact.phone} - added ${dateOnly(contact.createdAt)}`}
        actions={
          <>
            <ContactEditDialog
              contact={contact}
              onSaved={(updated) => {
                setContact(updated);
                setStatus(updated.status);
              }}
              trigger={<Button variant="outline"><Pencil className="size-4" /> Edit</Button>}
            />
            <Button variant="outline" onClick={block}><Ban className="size-4" /> Block</Button>
            <ConfirmDialog
              trigger={<Button variant="destructive"><Trash2 className="size-4" /> Delete</Button>}
              title="Delete this contact?"
              description="This permanently removes the contact from your workspace."
              confirmLabel="Delete"
              onConfirm={remove}
            />
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <SectionCard title="Profile">
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <span className="flex size-14 items-center justify-center rounded-full bg-secondary text-base font-semibold">{initials(contact.name)}</span>
              <div>
                <p className="font-semibold">{contact.name}</p>
                <p className="text-sm text-muted-foreground">{contact.email ?? "No email"}</p>
                <StatusBadge status={status} className="mt-2" />
              </div>
            </div>
            <dl className="divide-y divide-border">
              {[
                ["Phone", contact.phone],
                ["Source", contact.source],
                ["Added", dateOnly(contact.createdAt)],
                ["Last contacted", contact.lastContactedAt ? relative(contact.lastContactedAt) : "Never"],
              ].map(([key, value]) => (
                <div key={key} className="flex justify-between gap-4 py-2.5">
                  <dt className="text-sm text-muted-foreground">{key}</dt>
                  <dd className="text-right text-sm font-medium">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="flex flex-wrap gap-2">
              {contact.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground">{tag}</span>
              ))}
            </div>
          </div>
        </SectionCard>
        <SectionCard title="Notes">
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{contact.notes ?? "No notes yet. Notes are visible to your whole team."}</p>
        </SectionCard>
      </div>
    </div>
  );
}
