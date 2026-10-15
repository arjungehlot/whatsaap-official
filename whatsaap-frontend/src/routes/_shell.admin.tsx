import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowUp,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Copy,
  CreditCard,
  Layers3,
  Loader2,
  Pencil,
  Plus,
  Power,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/common/PageHeader";
import { SectionCard } from "@/components/common/SectionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { adminService } from "@/services";
import { useRequestFence } from "@/hooks/use-request-fence";
import type {
  AdminFeature,
  AdminHistoryPage,
  AdminPayment,
  AdminPlan,
  AdminSubscription,
  AdminUser,
} from "@/types";

export const Route = createFileRoute("/_shell/admin")({ component: AdminPage });
const defaultFeatureKeys = new Set([
  "send-message",
  "campaign-message",
  "template",
  "scheduler",
  "inbox",
]);
type FeatureAssignment = {
  featureId: string;
  valueType: AdminFeature["valueType"];
  booleanValue?: boolean;
  numberValue?: number;
  textValue?: string;
};
type MessageCreditDraft = {
  messageCreditsUnlimited: boolean;
  monthlyMessageCredits: string;
  dailyMessageCredits: string;
  isTrial?: boolean;
  trialDays?: string;
};
type PlanDraft = MessageCreditDraft & {
  name: string;
  monthlyPrice: string;
  yearlyPrice: string;
  isTrial: boolean;
  trialDays: string;
};
type CreatePlanDraft = PlanDraft & { slug: string };

const emptyCreateDraft = (): CreatePlanDraft => ({
  name: "",
  slug: "",
  monthlyPrice: "",
  yearlyPrice: "",
  isTrial: false,
  trialDays: "3",
  messageCreditsUnlimited: true,
  monthlyMessageCredits: "",
  dailyMessageCredits: "",
});
const emptyEditDraft = (): PlanDraft => ({
  name: "",
  monthlyPrice: "",
  yearlyPrice: "",
  isTrial: false,
  trialDays: "3",
  messageCreditsUnlimited: true,
  monthlyMessageCredits: "",
  dailyMessageCredits: "",
});

function makeAssignments(
  features: AdminFeature[],
  selectedIds: string[],
  values: Record<string, string>,
): FeatureAssignment[] {
  return features
    .filter((feature) => selectedIds.includes(feature.id))
    .map((feature) => {
      const assignment: FeatureAssignment = {
        featureId: feature.id,
        valueType: feature.valueType,
      };
      if (feature.valueType === "boolean") {
        assignment.booleanValue = values[feature.id] !== "false";
      } else if (feature.valueType === "number") {
        assignment.numberValue = Number(values[feature.id] || 0);
      } else if (feature.valueType === "text") {
        assignment.textValue = values[feature.id] || "";
      }
      return assignment;
    });
}

function CapabilityChecklist({
  features,
  selectedIds,
  values,
  onToggle,
  onValue,
}: {
  features: AdminFeature[];
  selectedIds: string[];
  values: Record<string, string>;
  onToggle: (id: string, checked: boolean) => void;
  onValue: (id: string, value: string) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {features.map((feature) => {
        const enabled = selectedIds.includes(feature.id);
        return (
          <label
            key={feature.id}
            className="flex cursor-pointer gap-3 rounded-md border p-3 text-sm transition-colors hover:bg-muted/40"
          >
            <input
              className="mt-1 size-4"
              type="checkbox"
              checked={enabled}
              onChange={(event) => onToggle(feature.id, event.target.checked)}
            />
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{feature.name}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {feature.description || feature.key}
              </span>
              {enabled && feature.valueType === "number" && (
                <span className="mt-3 block">
                  <span className="mb-1 block text-xs font-medium text-foreground">
                    Usage limit
                  </span>
                  <Input
                    type="number"
                    min="0"
                    value={values[feature.id] || "0"}
                    onChange={(event) => onValue(feature.id, event.target.value)}
                    placeholder="For example, 100"
                  />
                </span>
              )}
              {enabled && feature.valueType === "text" && (
                <span className="mt-3 block">
                  <span className="mb-1 block text-xs font-medium text-foreground">
                    Access value
                  </span>
                  <Input
                    value={values[feature.id] || ""}
                    onChange={(event) => onValue(feature.id, event.target.value)}
                    placeholder="Enter the value"
                  />
                </span>
              )}
            </span>
          </label>
        );
      })}
    </div>
  );
}

function MessageCreditFields({
  draft,
  onChange,
}: {
  draft: MessageCreditDraft;
  onChange: (draft: MessageCreditDraft) => void;
}) {
  const days = Math.max(1, Number(draft.trialDays) || 3);
  const dailyCredits = Math.max(0, Number(draft.dailyMessageCredits) || 0);
  const trialCredits = dailyCredits * days;
  return (
    <section className="space-y-4 border-y py-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">Message credits</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            One successfully sent WhatsApp message or attachment uses one credit.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label htmlFor="unlimited-credits" className="text-sm font-medium">
            Unlimited credits
          </label>
          <Switch
            id="unlimited-credits"
            checked={draft.messageCreditsUnlimited}
            onCheckedChange={(checked) => onChange({ ...draft, messageCreditsUnlimited: checked })}
          />
        </div>
      </div>
      {!draft.messageCreditsUnlimited && (
        <div className="grid gap-4 sm:grid-cols-2">
          {!draft.isTrial && (
            <label className="grid gap-1.5 text-sm font-medium">
              Monthly credit limit
              <Input
                type="number"
                min="0"
                inputMode="numeric"
                value={draft.monthlyMessageCredits}
                onChange={(event) =>
                  onChange({ ...draft, monthlyMessageCredits: event.target.value })
                }
                placeholder="For example, 1000"
              />
              <span className="text-xs font-normal text-muted-foreground">
                Enter 0 only when you want to enforce a daily limit alone.
              </span>
            </label>
          )}
          <label className="grid gap-1.5 text-sm font-medium">
            Daily credit limit
            <Input
              type="number"
              min="0"
              inputMode="numeric"
              value={draft.dailyMessageCredits}
              onChange={(event) => onChange({ ...draft, dailyMessageCredits: event.target.value })}
              placeholder="For example, 100"
            />
            <span className="text-xs font-normal text-muted-foreground">
              {draft.isTrial
                ? trialCredits
                  ? `${dailyCredits} credits per day gives ${trialCredits} total credits for this ${days}-day trial.`
                  : "Set a daily limit for this trial."
                : "Enter 0 only when you want to enforce a monthly limit alone."}
            </span>
          </label>
        </div>
      )}
    </section>
  );
}

function PlanEditorFields({
  mode,
  planCode,
  draft,
  onChange,
  features,
  selectedIds,
  values,
  onToggle,
  onValue,
}: {
  mode: "create" | "edit";
  planCode?: string | undefined;
  draft: PlanDraft | CreatePlanDraft;
  onChange: (draft: PlanDraft | CreatePlanDraft) => void;
  features: AdminFeature[];
  selectedIds: string[];
  values: Record<string, string>;
  onToggle: (id: string, checked: boolean) => void;
  onValue: (id: string, value: string) => void;
}) {
  const update = (patch: Partial<PlanDraft | CreatePlanDraft>) =>
    onChange({ ...draft, ...patch } as PlanDraft | CreatePlanDraft);
  const isCreate = mode === "create";
  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <div>
          <h3 className="font-semibold">Plan details</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Use a clear internal name and stable plan code for billing and reporting.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-medium">
            Plan name
            <Input
              value={draft.name}
              onChange={(event) => update({ name: event.target.value })}
              placeholder="For example, Growth"
            />
          </label>
          {isCreate ? (
            <label className="grid gap-1.5 text-sm font-medium">
              Plan code
              <Input
                value={(draft as CreatePlanDraft).slug}
                onChange={(event) =>
                  update({ slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-") })
                }
                placeholder="growth"
              />
              <span className="text-xs font-normal text-muted-foreground">
                Lowercase letters, numbers, and hyphens only.
              </span>
            </label>
          ) : (
            <div className="grid gap-1.5 text-sm font-medium">
              <span>Plan code</span>
              <div className="flex h-10 items-center rounded-md border bg-muted/40 px-3 font-mono text-sm text-muted-foreground">
                {planCode}
              </div>
              <span className="text-xs font-normal text-muted-foreground">
                Plan codes cannot be changed after creation.
              </span>
            </div>
          )}
        </div>
      </section>
      <section className="space-y-4 border-t pt-5">
        <div>
          <h3 className="font-semibold">Plan type and price</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Free trials are assigned automatically when a new user registers. Paid plans use INR
            pricing.
          </p>
        </div>
        <div className="flex items-center justify-between gap-4 rounded-md border p-4">
          <div>
            <label htmlFor="automatic-trial" className="font-medium">
              Automatic free trial
            </label>
            <p className="mt-1 text-sm text-muted-foreground">
              Make this the plan assigned to new accounts at registration.
            </p>
          </div>
          <Switch
            id="automatic-trial"
            checked={draft.isTrial}
            onCheckedChange={(checked) => update({ isTrial: checked })}
          />
        </div>
        {draft.isTrial ? (
          <label className="grid max-w-xs gap-1.5 text-sm font-medium">
            Trial duration (days)
            <Input
              type="number"
              min="1"
              max="365"
              value={draft.trialDays}
              onChange={(event) => update({ trialDays: event.target.value })}
            />
            <span className="text-xs font-normal text-muted-foreground">
              This plan is free and begins immediately after registration.
            </span>
          </label>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-medium">
              Monthly price (INR)
              <Input
                type="number"
                min="0"
                inputMode="decimal"
                value={draft.monthlyPrice}
                onChange={(event) => update({ monthlyPrice: event.target.value })}
                placeholder="For example, 499"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Yearly price (INR)
              <Input
                type="number"
                min="0"
                inputMode="decimal"
                value={draft.yearlyPrice}
                onChange={(event) => update({ yearlyPrice: event.target.value })}
                placeholder="For example, 4999"
              />
            </label>
          </div>
        )}
      </section>
      <MessageCreditFields draft={draft} onChange={(credits) => update(credits)} />
      <section className="space-y-4">
        <div>
          <h3 className="font-semibold">Feature access</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Select only the Whatsaap capabilities this plan should unlock for a user.
          </p>
        </div>
        <CapabilityChecklist
          features={features}
          selectedIds={selectedIds}
          values={values}
          onToggle={onToggle}
          onValue={onValue}
        />
      </section>
    </div>
  );
}

function formatDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? "-"
    : date.toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
}

function formatAmount(amount?: number, currency = "INR") {
  if (amount === undefined || amount === null) return "-";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatCalendarDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? "-"
    : date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function daysUntil(value?: string) {
  if (!value) return "-";
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return "-";
  const days = Math.max(0, Math.ceil((time - Date.now()) / 86_400_000));
  return `${days} day${days === 1 ? "" : "s"}`;
}

function dateInputValue(value?: string) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.valueOf())) return "";
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
}

function RecordStatus({ status }: { status: string }) {
  const variant = ["active", "successful"].includes(status)
    ? "default"
    : ["failed", "cancelled", "expired"].includes(status)
      ? "destructive"
      : "secondary";
  return <Badge variant={variant}>{status}</Badge>;
}

function HistoryPager({
  page,
  pages,
  total,
  onPageChange,
}: {
  page: number;
  pages: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  if (!total) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm text-muted-foreground">
      <span>
        {total} record{total === 1 ? "" : "s"} · Page {page} of {pages}
      </span>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="size-4" />
          Previous
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={page >= pages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function AdminPage() {
  const [tab, setTab] = useState<"users" | "plans" | "subscriptions" | "payments">("users");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [features, setFeatures] = useState<AdminFeature[]>([]);
  const [subscriptions, setSubscriptions] = useState<AdminSubscription[]>([]);
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [history, setHistory] = useState<AdminHistoryPage<never>>({
    total: 0,
    page: 1,
    limit: 25,
    pages: 1,
  });
  const [historyPage, setHistoryPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [createPlanOpen, setCreatePlanOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<string | null>(null);
  const [savingPlan, setSavingPlan] = useState(false);
  const [createDraft, setCreateDraft] = useState<CreatePlanDraft>(emptyCreateDraft);
  const [createFeatureIds, setCreateFeatureIds] = useState<string[]>([]);
  const [createValues, setCreateValues] = useState<Record<string, string>>({});
  const [editDraft, setEditDraft] = useState<PlanDraft>(emptyEditDraft);
  const [editFeatureIds, setEditFeatureIds] = useState<string[]>([]);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [selectedPlanIds, setSelectedPlanIds] = useState<Record<string, string>>({});
  const [selectedPlanCycles, setSelectedPlanCycles] = useState<
    Record<string, "monthly" | "yearly">
  >({});
  const [assigningUserId, setAssigningUserId] = useState<string | null>(null);
  const [expiryTarget, setExpiryTarget] = useState<AdminUser | null>(null);
  const [expiryDate, setExpiryDate] = useState("");
  const [savingExpiryUserId, setSavingExpiryUserId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [reorderingPlanId, setReorderingPlanId] = useState<string | null>(null);
  const startLoadRequest = useRequestFence();
  async function load() {
    const isCurrent = startLoadRequest();
    setLoading(true);
    try {
      if (tab === "users") {
        const [userPage, nextPlans] = await Promise.all([
          adminService.users({ search }),
          adminService.plans(),
        ]);
        if (isCurrent()) {
          setUsers(userPage.users);
          setPlans(nextPlans.filter((plan) => plan.status === "active" && !plan.isTrial));
        }
      }
      if (tab === "plans") {
        const [nextPlans, nextFeatures] = await Promise.all([
          adminService.plans(),
          adminService.features(),
        ]);
        if (isCurrent()) {
          setPlans(nextPlans);
          setFeatures(nextFeatures);
        }
        if (isCurrent() && !createFeatureIds.length)
          setCreateFeatureIds(
            nextFeatures
              .filter((feature) => defaultFeatureKeys.has(feature.key))
              .map((feature) => feature.id),
          );
      }
      if (tab === "subscriptions") {
        const data = await adminService.subscriptions({ page: historyPage });
        if (isCurrent()) {
          setSubscriptions(data.subscriptions);
          setHistory(data);
        }
      }
      if (tab === "payments") {
        const data = await adminService.payments({ page: historyPage });
        if (isCurrent()) {
          setPayments(data.payments);
          setHistory(data);
        }
      }
    } catch (error) {
      if (isCurrent()) toast.error(error instanceof Error ? error.message : "Unable to load admin data");
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, [tab, historyPage]);
  async function toggleUser(user: AdminUser) {
    try {
      await adminService.updateUserStatus(
        user.id,
        user.accountStatus === "active" ? "suspended" : "active",
      );
      await load();
      toast.success("Account status updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update account");
    }
  }
  async function assignPlan(user: AdminUser) {
    const planId = selectedPlanIds[user.id];
    if (!planId) {
      toast.error("Select a plan first");
      return;
    }
    setAssigningUserId(user.id);
    try {
      await adminService.assignUserPlan(user.id, planId, selectedPlanCycles[user.id] || "monthly");
      await load();
      toast.success(`Plan assigned to ${user.name}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to assign plan");
    } finally {
      setAssigningUserId(null);
    }
  }
  function openExpiryEditor(user: AdminUser) {
    setExpiryTarget(user);
    setExpiryDate(dateInputValue(user.planExpiryDate));
  }
  async function saveExpiry() {
    if (!expiryTarget || !expiryDate) return;
    setSavingExpiryUserId(expiryTarget.id);
    try {
      await adminService.updateUserExpiry(expiryTarget.id, expiryDate);
      setExpiryTarget(null);
      await load();
      toast.success(`Expiry updated for ${expiryTarget.name}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update expiry date");
    } finally {
      setSavingExpiryUserId(null);
    }
  }
  function openDeleteDialog(user: AdminUser) {
    setDeleteTarget(user);
    setDeleteConfirmation("");
  }
  async function removeUser() {
    if (!deleteTarget || deleteConfirmation.trim().toLowerCase() !== deleteTarget.email.toLowerCase()) return;
    setDeletingUserId(deleteTarget.id);
    try {
      await adminService.deleteUser(deleteTarget.id, deleteConfirmation);
      setDeleteTarget(null);
      await load();
      toast.success(`${deleteTarget.name} and their data were deleted`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete user");
    } finally {
      setDeletingUserId(null);
    }
  }
  function openCreatePlan() {
    setCreateDraft(emptyCreateDraft());
    setCreateFeatureIds(
      features
        .filter((feature) => defaultFeatureKeys.has(feature.key))
        .map((feature) => feature.id),
    );
    setCreateValues({});
    setCreatePlanOpen(true);
  }
  function openEditPlan(plan: AdminPlan) {
    setEditingPlan(plan.id);
    setEditDraft({
      name: plan.name,
      monthlyPrice: String(plan.monthlyPrice),
      yearlyPrice: String(plan.yearlyPrice),
      isTrial: Boolean(plan.isTrial),
      trialDays: String(plan.trialDays || 3),
      messageCreditsUnlimited: plan.messageCreditsUnlimited !== false,
      monthlyMessageCredits: String(plan.monthlyMessageCredits || ""),
      dailyMessageCredits: String(plan.dailyMessageCredits || ""),
    });
    setEditFeatureIds(plan.features.map((feature) => feature.id));
    setEditValues(
      Object.fromEntries(plan.features.map((feature) => [feature.id, String(feature.value ?? "")])),
    );
  }
  async function createPlan() {
    setSavingPlan(true);
    try {
      const payload: Parameters<typeof adminService.createPlan>[0] = {
        name: createDraft.name,
        slug: createDraft.slug,
        monthlyPrice: createDraft.isTrial ? 0 : Number(createDraft.monthlyPrice),
        yearlyPrice: createDraft.isTrial ? 0 : Number(createDraft.yearlyPrice),
        isTrial: createDraft.isTrial,
        messageCreditsUnlimited: createDraft.messageCreditsUnlimited,
        monthlyMessageCredits: Number(createDraft.monthlyMessageCredits || 0),
        dailyMessageCredits: Number(createDraft.dailyMessageCredits || 0),
        features: makeAssignments(features, createFeatureIds, createValues),
      };
      if (createDraft.isTrial && createDraft.trialDays) {
        payload.trialDays = Number(createDraft.trialDays);
      }
      await adminService.createPlan(payload);
      setCreatePlanOpen(false);
      setCreateDraft(emptyCreateDraft());
      await load();
      toast.success("Plan created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create plan");
    } finally {
      setSavingPlan(false);
    }
  }
  async function savePlan(planId: string) {
    setSavingPlan(true);
    try {
      const payload: Record<string, unknown> = {
        name: editDraft.name,
        monthlyPrice: editDraft.isTrial ? 0 : Number(editDraft.monthlyPrice),
        yearlyPrice: editDraft.isTrial ? 0 : Number(editDraft.yearlyPrice),
        isTrial: editDraft.isTrial,
        messageCreditsUnlimited: editDraft.messageCreditsUnlimited,
        monthlyMessageCredits: Number(editDraft.monthlyMessageCredits || 0),
        dailyMessageCredits: Number(editDraft.dailyMessageCredits || 0),
        features: makeAssignments(features, editFeatureIds, editValues),
        ...(editDraft.isTrial && editDraft.trialDays ? { trialDays: Number(editDraft.trialDays) } : {}),
      };
      await adminService.updatePlan(planId, payload);
      setEditingPlan(null);
      await load();
      toast.success("Plan updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update plan");
    } finally {
      setSavingPlan(false);
    }
  }
  async function duplicate(plan: AdminPlan) {
    try {
      await adminService.duplicatePlan(plan.id);
      await load();
      toast.success("Plan duplicated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to duplicate plan");
    }
  }
  async function movePlan(plan: AdminPlan, direction: "up" | "down") {
    const index = plans.findIndex((item) => item.id === plan.id);
    const nextIndex = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || nextIndex < 0 || nextIndex >= plans.length || plan.isTrial) return;
    if (direction === "up" && plans[nextIndex]?.isTrial) return;

    const nextPlans = [...plans];
    const current = nextPlans[index];
    const target = nextPlans[nextIndex];
    if (!current || !target) return;
    nextPlans[index] = target;
    nextPlans[nextIndex] = current;
    setPlans(nextPlans);
    setReorderingPlanId(plan.id);
    try {
      setPlans(await adminService.reorderPlans(nextPlans.map((item) => item.id)));
      toast.success("Plan order updated");
    } catch (error) {
      await load();
      toast.error(error instanceof Error ? error.message : "Unable to update plan order");
    } finally {
      setReorderingPlanId(null);
    }
  }
  const tabs = [
    ["users", "Users", UserRound],
    ["plans", "Plans", Layers3],
    ["subscriptions", "Subscriptions", CreditCard],
    ["payments", "Payments", ShieldCheck],
  ] as const;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">Super Admin</h1>
            <Badge variant="outline" className="text-[10px] uppercase font-semibold tracking-wider text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
              Admin Portal
            </Badge>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Manage users, subscription plans, active subscriptions, and payment transactions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs px-2.5"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw className={cn("mr-1.5 size-3.5", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1 rounded-lg border border-border/60 bg-muted/60 p-1">
          {tabs.map(([key, label, Icon]) => {
            const active = tab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setHistoryPage(1);
                  setTab(key);
                }}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all cursor-pointer",
                  active
                    ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:bg-background/80 hover:text-foreground"
                )}
              >
                <Icon className="size-3.5" />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {tab === "users" && (
        <SectionCard
          title="All Users"
          description="Manage account access and assign a paid active plan manually. The assigned plan replaces the user's current subscription."
          actions={
            <span className="text-xs text-muted-foreground font-medium">
              {users.length} {users.length === 1 ? "user" : "users"} registered
            </span>
          }
        >
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px] max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                className="h-8 pl-8 pr-7 text-xs"
                placeholder="Search name, email, phone..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void load();
                }}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setTimeout(() => void load(), 0);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  title="Clear search"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
            <Button size="sm" className="h-8 px-3 text-xs" onClick={() => void load()}>
              Search
            </Button>
          </div>

          {loading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border border-border/70">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/60 text-left font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="whitespace-nowrap px-3 py-2.5">Name</th>
                    <th className="whitespace-nowrap px-3 py-2.5">Email</th>
                    <th className="whitespace-nowrap px-3 py-2.5">Role</th>
                    <th className="whitespace-nowrap px-3 py-2.5">Sign-up Via</th>
                    <th className="whitespace-nowrap px-3 py-2.5">Account Created</th>
                    <th className="whitespace-nowrap px-3 py-2.5">Current Plan</th>
                    <th className="whitespace-nowrap px-3 py-2.5">Plan Status</th>
                    <th className="whitespace-nowrap px-3 py-2.5">Billing Cycle</th>
                    <th className="whitespace-nowrap px-3 py-2.5">Plan Purchased</th>
                    <th className="whitespace-nowrap px-3 py-2.5">Expires</th>
                    <th className="whitespace-nowrap px-3 py-2.5">Days Left</th>
                    <th className="whitespace-nowrap px-3 py-2.5">Account Status</th>
                    <th className="whitespace-nowrap px-3 py-2.5">Manual Plan</th>
                    <th className="whitespace-nowrap px-3 py-2.5">Assign Cycle</th>
                    <th className="whitespace-nowrap px-3 py-2.5 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                      <td className="whitespace-nowrap px-3 py-2 font-medium text-foreground">
                        {user.name}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px] text-muted-foreground">
                        {user.email}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        <Badge
                          variant={user.role === "super_admin" ? "default" : "outline"}
                          className={cn(
                            "text-[10px] uppercase font-semibold tracking-wider px-2 py-0.5",
                            user.role === "super_admin" && "bg-primary text-primary-foreground",
                            user.role === "owner" && "border-blue-500/40 text-blue-600 dark:text-blue-400 bg-blue-500/5"
                          )}
                        >
                          {user.role.replace(/_/g, " ")}
                        </Badge>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        <Badge variant="outline" className="text-[10px] font-normal px-2 py-0.5">
                          {user.authProvider === "google" ? "Google" : "Email password"}
                        </Badge>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                        {formatCalendarDate(user.registeredAt)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 font-medium">
                        {user.plan}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        <span className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium capitalize",
                          user.subscriptionStatus === "active"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                            : "bg-muted text-muted-foreground"
                        )}>
                          {user.subscriptionStatus || "active"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 capitalize text-muted-foreground">
                        {user.billingCycle || "-"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                        {formatCalendarDate(user.planStartDate)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                        {formatCalendarDate(user.planExpiryDate)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        {user.planExpiryDate ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
                            {daysUntil(user.planExpiryDate)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        <span className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider",
                          user.accountStatus === "active"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                            : "bg-destructive/10 text-destructive border border-destructive/20"
                        )}>
                          {user.accountStatus}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        <select
                          className="h-8 w-36 rounded-md border border-input bg-background px-2 text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                          value={selectedPlanIds[user.id] || ""}
                          onChange={(event) => {
                            setSelectedPlanIds({
                              ...selectedPlanIds,
                              [user.id]: event.target.value,
                            });
                            setSelectedPlanCycles({
                              ...selectedPlanCycles,
                              [user.id]: "monthly",
                            });
                          }}
                        >
                          <option value="">Select paid plan</option>
                          {plans.map((plan) => (
                            <option key={plan.id} value={plan.id}>
                              {plan.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        <select
                          aria-label={`Billing cycle for ${user.name}`}
                          className="h-8 w-24 rounded-md border border-input bg-background px-2 text-xs disabled:cursor-not-allowed disabled:opacity-50 focus:ring-1 focus:ring-primary focus:outline-none"
                          value={selectedPlanCycles[user.id] || "monthly"}
                          disabled={!selectedPlanIds[user.id]}
                          onChange={(event) =>
                            setSelectedPlanCycles({
                              ...selectedPlanCycles,
                              [user.id]: event.target.value as "monthly" | "yearly",
                            })
                          }
                        >
                          <option value="monthly">Monthly</option>
                          <option value="yearly">Yearly</option>
                        </select>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            className="h-8 px-2.5 text-xs shadow-none"
                            disabled={!selectedPlanIds[user.id] || assigningUserId === user.id}
                            onClick={() => void assignPlan(user)}
                          >
                            {assigningUserId === user.id ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              "Assign plan"
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-2 text-xs"
                            onClick={() => void toggleUser(user)}
                          >
                            <Power className="mr-1 size-3" />
                            {user.accountStatus === "active" ? "Suspend" : "Activate"}
                          </Button>
                          <Button
                            size="icon"
                            variant="outline"
                            className="size-8"
                            title="Set subscription expiry"
                            aria-label={`Set subscription expiry for ${user.name}`}
                            disabled={!user.planExpiryDate}
                            onClick={() => openExpiryEditor(user)}
                          >
                            <CalendarClock className="size-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="destructive"
                            className="size-8"
                            title={user.role === "super_admin" ? "Super-admin accounts cannot be deleted" : "Delete user permanently"}
                            aria-label={`Delete ${user.name} permanently`}
                            disabled={user.role === "super_admin"}
                            onClick={() => openDeleteDialog(user)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      )}
      <Dialog
        open={Boolean(expiryTarget)}
        onOpenChange={(open) => {
          if (!open && !savingExpiryUserId) setExpiryTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set subscription expiry</DialogTitle>
            <DialogDescription>
              Set the date through which {expiryTarget?.name || "this user"} can use their current plan.
            </DialogDescription>
          </DialogHeader>
          <Input
            aria-label="Subscription expiry date"
            type="date"
            value={expiryDate}
            onChange={(event) => setExpiryDate(event.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setExpiryTarget(null)} disabled={Boolean(savingExpiryUserId)}>
              Cancel
            </Button>
            <Button onClick={() => void saveExpiry()} disabled={!expiryDate || Boolean(savingExpiryUserId)}>
              {savingExpiryUserId ? <Loader2 className="size-4 animate-spin" /> : "Save expiry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !deletingUserId) setDeleteTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete user permanently</DialogTitle>
            <DialogDescription>
              This permanently removes {deleteTarget?.name || "this user"}, their WhatsApp sessions, conversations, messages, API keys, contacts, campaigns, billing records, and other workspace data. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="delete-user-confirmation">
              Type {deleteTarget?.email} to confirm
            </label>
            <Input
              id="delete-user-confirmation"
              autoComplete="off"
              value={deleteConfirmation}
              onChange={(event) => setDeleteConfirmation(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={Boolean(deletingUserId)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void removeUser()}
              disabled={
                !deleteTarget ||
                deleteConfirmation.trim().toLowerCase() !== deleteTarget.email.toLowerCase() ||
                Boolean(deletingUserId)
              }
            >
              {deletingUserId ? <Loader2 className="size-4 animate-spin" /> : "Delete user"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {tab === "plans" && (
        <SectionCard
          title="Subscription plans"
          description="Set the order shown on the pricing page. New paid plans are added at the end."
          actions={
            <Button onClick={openCreatePlan}>
              <Plus className="mr-2 size-4" />
              Add plan
            </Button>
          }
          bodyClassName="p-0"
        >
          <div className="divide-y divide-border">
            {loading ? (
              <div className="flex justify-center p-10">
                <Loader2 className="size-5 animate-spin" />
              </div>
            ) : plans.length ? (
              plans.map((plan, index) => (
                <div
                  key={plan.id}
                  className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{plan.name}</h3>
                      {plan.isTrial && <Badge variant="secondary">Automatic trial</Badge>}
                      <Badge variant={plan.status === "active" ? "outline" : "destructive"}>
                        {plan.status}
                      </Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span>
                        {plan.isTrial
                          ? `${plan.trialDays || 3}-day registration trial`
                          : `${formatAmount(plan.monthlyPrice, plan.currency)}/month · ${formatAmount(plan.yearlyPrice, plan.currency)}/year`}
                      </span>
                      <span>
                        {plan.messageCreditsUnlimited !== false
                          ? "Unlimited message credits"
                          : `${plan.monthlyMessageCredits || 0} monthly · ${plan.dailyMessageCredits || 0} daily credits`}
                      </span>
                      <span>{plan.features.length} enabled features</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {!plan.isTrial && (
                      <div className="flex rounded-md border border-input">
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Move plan up"
                          aria-label={`Move ${plan.name} up`}
                          disabled={
                            reorderingPlanId !== null || index === 0 || plans[index - 1]?.isTrial
                          }
                          onClick={() => void movePlan(plan, "up")}
                        >
                          <ArrowUp className="size-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Move plan down"
                          aria-label={`Move ${plan.name} down`}
                          disabled={reorderingPlanId !== null || index === plans.length - 1}
                          onClick={() => void movePlan(plan, "down")}
                        >
                          <ArrowDown className="size-4" />
                        </Button>
                      </div>
                    )}
                    <Button size="sm" variant="outline" onClick={() => openEditPlan(plan)}>
                      <Pencil className="mr-1.5 size-3.5" />
                      Edit
                    </Button>
                    {!plan.isTrial && (
                      <Button size="sm" variant="outline" onClick={() => void duplicate(plan)}>
                        <Copy className="mr-1.5 size-3.5" />
                        Duplicate
                      </Button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-10 text-center text-sm text-muted-foreground">
                No plans have been created yet.
              </div>
            )}
          </div>
        </SectionCard>
      )}
      <Dialog open={createPlanOpen} onOpenChange={setCreatePlanOpen}>
        <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create plan</DialogTitle>
            <DialogDescription>
              Set the plan's price, credit limits, and the features users can access.
            </DialogDescription>
          </DialogHeader>
          <PlanEditorFields
            mode="create"
            draft={createDraft}
            onChange={(draft) => setCreateDraft(draft as CreatePlanDraft)}
            features={features}
            selectedIds={createFeatureIds}
            values={createValues}
            onToggle={(id, checked) =>
              setCreateFeatureIds(
                checked
                  ? [...createFeatureIds, id]
                  : createFeatureIds.filter((item) => item !== id),
              )
            }
            onValue={(id, value) => setCreateValues({ ...createValues, [id]: value })}
          />
          <DialogFooter className="border-t pt-4">
            <Button
              variant="outline"
              onClick={() => setCreatePlanOpen(false)}
              disabled={savingPlan}
            >
              Cancel
            </Button>
            <Button onClick={() => void createPlan()} disabled={savingPlan}>
              {savingPlan && <Loader2 className="mr-2 size-4 animate-spin" />}Create plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(editingPlan)}
        onOpenChange={(open) => {
          if (!open) setEditingPlan(null);
        }}
      >
        <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit plan</DialogTitle>
            <DialogDescription>
              Update the access, credits, and billing details for this plan.
            </DialogDescription>
          </DialogHeader>
          {editingPlan && (
            <PlanEditorFields
              mode="edit"
              planCode={plans.find((plan) => plan.id === editingPlan)?.slug}
              draft={editDraft}
              onChange={(draft) => setEditDraft(draft as PlanDraft)}
              features={features}
              selectedIds={editFeatureIds}
              values={editValues}
              onToggle={(id, checked) =>
                setEditFeatureIds(
                  checked ? [...editFeatureIds, id] : editFeatureIds.filter((item) => item !== id),
                )
              }
              onValue={(id, value) => setEditValues({ ...editValues, [id]: value })}
            />
          )}
          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setEditingPlan(null)} disabled={savingPlan}>
              Cancel
            </Button>
            <Button
              onClick={() => editingPlan && void savePlan(editingPlan)}
              disabled={savingPlan || !editingPlan}
            >
              {savingPlan && <Loader2 className="mr-2 size-4 animate-spin" />}Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {tab === "subscriptions" && (
        <SectionCard
          title="Subscriptions"
          description="Every trial, manually assigned, and paid plan record."
        >
          <div className="overflow-x-auto rounded-md border border-border/70">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/60 text-left font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="whitespace-nowrap px-3 py-2.5">User Name</th>
                  <th className="whitespace-nowrap px-3 py-2.5">Email</th>
                  <th className="whitespace-nowrap px-3 py-2.5">Plan</th>
                  <th className="whitespace-nowrap px-3 py-2.5">Billing Cycle</th>
                  <th className="whitespace-nowrap px-3 py-2.5">Status</th>
                  <th className="whitespace-nowrap px-3 py-2.5">Starts</th>
                  <th className="whitespace-nowrap px-3 py-2.5">Ends</th>
                  <th className="whitespace-nowrap px-3 py-2.5">Amount</th>
                  <th className="whitespace-nowrap px-3 py-2.5">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {loading ? (
                  <tr>
                    <td className="px-3 py-8 text-center text-muted-foreground" colSpan={9}>
                      <Loader2 className="mx-auto size-5 animate-spin" />
                    </td>
                  </tr>
                ) : subscriptions.length ? (
                  subscriptions.map((subscription) => (
                    <tr key={subscription._id} className="hover:bg-muted/30 transition-colors">
                      <td className="whitespace-nowrap px-3 py-2 font-medium text-foreground">
                        {subscription.userId?.name || "Deleted user"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px] text-muted-foreground">
                        {subscription.userId?.email || "-"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        <div className="font-medium">
                          {subscription.planId?.name ||
                            subscription.planNameSnapshot ||
                            "Deleted plan"}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {subscription.isTrial
                            ? "Free trial"
                            : subscription.autoRenew
                              ? "Auto renew"
                              : "Manual renewal"}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 capitalize text-muted-foreground">{subscription.billingCycle}</td>
                      <td className="whitespace-nowrap px-3 py-2">
                        <RecordStatus status={subscription.status} />
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                        {formatDate(subscription.startDate)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                        {formatDate(subscription.expiryDate)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 font-medium">
                        {formatAmount(subscription.amountSnapshot, subscription.currencySnapshot)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                        {formatDate(subscription.createdAt)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-3 py-8 text-center text-muted-foreground" colSpan={9}>
                      No subscriptions found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <HistoryPager {...history} onPageChange={setHistoryPage} />
        </SectionCard>
      )}
      {tab === "payments" && (
        <SectionCard
          title="Payments"
          description="Razorpay and manual payment history, including pending and failed attempts."
        >
          <div className="overflow-x-auto rounded-md border border-border/70">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/60 text-left font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="whitespace-nowrap px-3 py-2.5">User Name</th>
                  <th className="whitespace-nowrap px-3 py-2.5">Email</th>
                  <th className="whitespace-nowrap px-3 py-2.5">Plan</th>
                  <th className="whitespace-nowrap px-3 py-2.5">Amount</th>
                  <th className="whitespace-nowrap px-3 py-2.5">Billing Cycle</th>
                  <th className="whitespace-nowrap px-3 py-2.5">Status</th>
                  <th className="whitespace-nowrap px-3 py-2.5">Gateway</th>
                  <th className="whitespace-nowrap px-3 py-2.5">Transaction ID</th>
                  <th className="whitespace-nowrap px-3 py-2.5">Completed</th>
                  <th className="whitespace-nowrap px-3 py-2.5">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {loading ? (
                  <tr>
                    <td className="px-3 py-8 text-center text-muted-foreground" colSpan={10}>
                      <Loader2 className="mx-auto size-5 animate-spin" />
                    </td>
                  </tr>
                ) : payments.length ? (
                  payments.map((payment) => (
                    <tr key={payment._id} className="hover:bg-muted/30 transition-colors">
                      <td className="whitespace-nowrap px-3 py-2 font-medium text-foreground">
                        {payment.userId?.name || "Deleted user"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px] text-muted-foreground">
                        {payment.userId?.email || "-"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 font-medium">
                        {payment.planId?.name || "Deleted plan"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 font-semibold">
                        {formatAmount(payment.amount, payment.currency)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 capitalize text-muted-foreground">{payment.billingCycle}</td>
                      <td className="whitespace-nowrap px-3 py-2">
                        <RecordStatus status={payment.status} />
                        {payment.failureReason && (
                          <div className="mt-0.5 max-w-44 text-[11px] text-destructive">
                            {payment.failureReason}
                          </div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 capitalize text-muted-foreground">
                        {payment.paymentMethod || payment.gateway || "-"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px] text-muted-foreground">
                        {payment.gatewayTransactionId || "-"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                        {formatDate(payment.completedAt)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                        {formatDate(payment.createdAt)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-3 py-8 text-center text-muted-foreground" colSpan={10}>
                      No payments found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <HistoryPager {...history} onPageChange={setHistoryPage} />
        </SectionCard>
      )}
    </div>
  );
}
