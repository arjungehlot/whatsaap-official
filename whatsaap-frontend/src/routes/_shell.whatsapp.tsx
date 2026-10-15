import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { QRCodeSVG } from "qrcode.react";
import {
  Activity,
  AlertCircle,
  BatteryMedium,
  Bookmark,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Clock,
  Copy,
  Layers,
  LayoutGrid,
  Link2,
  Loader2,
  LogOut,
  MessageSquare,
  Pencil,
  Play,
  Plus,
  QrCode,
  RefreshCw,
  Save,
  Send,
  Shield,
  Smartphone,
  Wifi,
  Settings,
  Laptop,
  ScanLine,
  MoreVertical,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { SectionCard } from "@/components/common/SectionCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiKeyService, whatsappService } from "@/services";
import { dateTime, num, relative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useRequestFence } from "@/hooks/use-request-fence";
import type { ConnectionEvent, SenderReplacementPreview, WhatsAppAccount, WhatsAppSendSettings } from "@/types";

export const Route = createFileRoute("/_shell/whatsapp")({
  head: () => ({
    meta: [
      { title: "WhatsApp Sessions - Whatsaap" },
      {
        name: "description",
        content:
          "Manage up to three WhatsApp numbers with QR pairing, live session health, device details and reconnect controls.",
      },
      { property: "og:title", content: "WhatsApp Sessions - Whatsaap" },
      {
        property: "og:description",
        content: "A multi-number WhatsApp session manager with QR pairing and connection history.",
      },
    ],
  }),
  component: WhatsAppPage,
});

const DEFAULT_QR_SECONDS = 45;

type SessionCard = {
  id: string;
  kind: "account" | "new" | "comingSoon";
  slotNumber: number;
  account?: WhatsAppAccount;
};

const FRONTEND_SLOT_COUNT = 3;

function WhatsAppPage() {
  const [accounts, setAccounts] = useState<WhatsAppAccount[]>([]);
  const [events, setEvents] = useState<ConnectionEvent[]>([]);
  const [eventPage, setEventPage] = useState(1);
  const [eventPages, setEventPages] = useState(1);
  const [eventTotal, setEventTotal] = useState(0);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [limit, setLimit] = useState(3);
  const [selectedId, setSelectedId] = useState("new-slot");
  const [seconds, setSeconds] = useState(DEFAULT_QR_SECONDS);
  const [qrPayload, setQrPayload] = useState<string | null>(null);
  const [pairingError, setPairingError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [senderReplacement, setSenderReplacement] = useState<SenderReplacementPreview | null>(null);
  const [replacementActionId, setReplacementActionId] = useState<string | null>(null);
  const startSummaryRequest = useRequestFence();
  const startEventsRequest = useRequestFence();
  const startPairingRequest = useRequestFence();
  const missingQrRecoveryAccountRef = useRef<string | null>(null);

  const cards = useMemo<SessionCard[]>(() => {
    return Array.from({ length: FRONTEND_SLOT_COUNT }, (_, index) => {
      const slotNumber = index + 1;
      if (slotNumber === 1 && accounts[0]) {
        return { id: accounts[0].id, kind: "account", slotNumber, account: accounts[0] };
      }
      if (slotNumber === 1) {
        return { id: "new-slot", kind: "new", slotNumber };
      }
      return { id: `coming-soon-${slotNumber}`, kind: "comingSoon", slotNumber };
    });
  }, [accounts]);

  const selectedCard = cards.find((card) => card.id === selectedId) ?? cards[0];
  const selectedAccount = selectedCard?.account;
  const selectedState = selectedAccount?.state ?? null;
  const primaryAccount = accounts[0];
  const connectedCount = primaryAccount?.state === "CONNECTED" ? 1 : 0;
  const usedSlots = primaryAccount ? 1 : 0;
  const availableSlots = FRONTEND_SLOT_COUNT - usedSlots;

  useEffect(() => {
    void loadSummary();
    const interval = window.setInterval(() => {
      void loadSummary({ background: true });
    }, 15_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!selectedAccount) {
      setEvents([]);
      setEventPage(1);
      setEventPages(1);
      setEventTotal(0);
      return;
    }

    void loadEvents(selectedAccount.id, 1);
  }, [selectedAccount?.id]);

  useEffect(() => {
    if (!selectedAccount || selectedState !== "CONNECTED") {
      setSenderReplacement(null);
      return;
    }

    let active = true;
    void whatsappService.getSenderReplacement(selectedAccount.id)
      .then((preview) => {
        if (active) setSenderReplacement(preview);
      })
      .catch(() => {
        if (active) setSenderReplacement(null);
      });
    return () => {
      active = false;
    };
  }, [selectedAccount?.id, selectedAccount?.phone, selectedState]);

  useEffect(() => {
    if (selectedState !== "QR_REQUIRED") return;
    setSeconds(DEFAULT_QR_SECONDS);
    const t = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          clearInterval(t);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [selectedState, qrPayload, selectedId]);

  useEffect(() => {
    if (!selectedAccount || (selectedState !== "QR_REQUIRED" && selectedState !== "CONNECTING")) return;

    let active = true;
    const t = setInterval(async () => {
      const isCurrent = startSummaryRequest();
      try {
        const summary = await whatsappService.getSummary();
        if (!active || !isCurrent()) return;
        setAccounts(summary.accounts);
        setLimit(summary.limit);

        const latest = summary.accounts.find((account) => account.id === selectedAccount.id);
        if (latest?.state === "CONNECTED") {
          setQrPayload(null);
          await loadEvents(selectedAccount.id);
          toast.success("WhatsApp connected", { description: latest.phone });
        }
        if (latest?.state === "ERROR") {
          const message = latest.connectionError || "This WhatsApp number could not be linked.";
          setQrPayload(null);
          setPairingError(message);
          await loadEvents(selectedAccount.id);
          toast.error(message);
        }
      } catch (_error) {
        // Keep polling quiet; visible actions already surface API errors.
      }
    }, 3000);

    return () => {
      active = false;
      clearInterval(t);
    };
  }, [selectedAccount?.id, selectedState, startSummaryRequest]);

  useEffect(() => {
    if (selectedState !== "QR_REQUIRED" || !selectedAccount) {
      missingQrRecoveryAccountRef.current = null;
      return;
    }

    if (qrPayload) {
      missingQrRecoveryAccountRef.current = null;
      return;
    }

    if (actionId === selectedAccount.id || missingQrRecoveryAccountRef.current === selectedAccount.id) return;

    // QR payloads are deliberately never persisted. On a refresh, request one fresh
    // code so the screen never remains in QR_REQUIRED with nothing to scan.
    missingQrRecoveryAccountRef.current = selectedAccount.id;
    void startPairing(selectedAccount.id);
  }, [actionId, qrPayload, selectedAccount?.id, selectedState]);

  async function loadSummary(options: { background?: boolean } = {}) {
    const isCurrent = startSummaryRequest();
    try {
      if (!options.background) setLoading(true);
      const summary = await whatsappService.getSummary();
      if (!isCurrent()) return;
      setAccounts(summary.accounts);
      setLimit(summary.limit);
      setSelectedId((current) => {
        if (summary.accounts[0]?.id === current) return current;
        return summary.accounts[0]?.id ?? "new-slot";
      });
    } catch (error) {
      if (!isCurrent()) return;
      if (!options.background) {
        toast.error(error instanceof Error ? error.message : "Unable to load WhatsApp sessions");
      }
    } finally {
      if (isCurrent() && !options.background) setLoading(false);
    }
  }

  async function loadEvents(accountId: string, page = 1) {
    const isCurrent = startEventsRequest();
    try {
      setEventsLoading(true);
      const result = await whatsappService.getEvents(accountId, { page, limit: 10 });
      if (!isCurrent()) return;
      setEvents(result.events);
      setEventPage(result.page);
      setEventPages(result.pages);
      setEventTotal(result.total);
    } catch (error) {
      if (!isCurrent()) return;
      toast.error(error instanceof Error ? error.message : "Unable to load connection history");
    } finally {
      if (isCurrent()) setEventsLoading(false);
    }
  }

  function replaceAccount(nextAccount: WhatsAppAccount) {
    setAccounts((current) =>
      current.map((account) => (account.id === nextAccount.id ? nextAccount : account)),
    );
  }

  function setTemporaryState(accountId: string, state: WhatsAppAccount["state"]) {
    setAccounts((current) =>
      current.map((account) => (account.id === accountId ? { ...account, state } : account)),
    );
  }

  async function startPairing(accountId: string) {
    const isCurrent = startPairingRequest();
    try {
      setActionId(accountId);
      setPairingError(null);
      setTemporaryState(accountId, "CONNECTING");
      const result = await whatsappService.startPairing(accountId);
      if (!isCurrent()) return;
      replaceAccount(result.account);
      setSeconds(result.expiresIn);
      setQrPayload(result.qrPayload);
      await loadEvents(accountId);
    } catch (error) {
      if (!isCurrent()) return;
      const message = error instanceof Error ? error.message : "Unable to generate QR code";
      setPairingError(message);
      toast.error(message);
      await loadSummary();
    } finally {
      if (isCurrent()) setActionId(null);
    }
  }

  async function restartPairing(accountId: string) {
    const isCurrent = startPairingRequest();
    try {
      setActionId(accountId);
      setPairingError(null);
      setQrPayload(null);
      setTemporaryState(accountId, "CONNECTING");
      const result = await whatsappService.restartPairing(accountId);
      if (!isCurrent()) return;
      replaceAccount(result.account);
      setSeconds(result.expiresIn);
      setQrPayload(result.qrPayload);
      await loadEvents(accountId);
      toast.success("Fresh QR code ready");
    } catch (error) {
      if (!isCurrent()) return;
      const message = error instanceof Error ? error.message : "Unable to restart WhatsApp pairing";
      setPairingError(message);
      toast.error(message);
      await loadSummary();
    } finally {
      if (isCurrent()) setActionId(null);
    }
  }

  async function disconnect(accountId: string) {
    try {
      setActionId(accountId);
      setTemporaryState(accountId, "DISCONNECTING");
      const account = await whatsappService.disconnect(accountId);
      replaceAccount(account);
      await loadEvents(accountId);
      toast.success("Device unlinked");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to disconnect device");
      await loadSummary();
    } finally {
      setActionId(null);
    }
  }

  async function refresh(accountId: string) {
    try {
      setActionId(accountId);
      const account = await whatsappService.refresh(accountId);
      replaceAccount(account);
      await loadEvents(accountId);
      toast.success("Session refreshed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to refresh session");
    } finally {
      setActionId(null);
    }
  }

  async function addAccountSlot(displayName: string) {
    try {
      setActionId("new-slot");
      const result = await whatsappService.createAccount({ displayName });
      setLimit(result.limit);
      setAccounts((current) => [...current, result.account]);
      setSelectedId(result.account.id);
      setAddDialogOpen(false);
      toast.success("New WhatsApp slot created", {
        description: `Slot ${Math.min(accounts.length + 1, result.limit)} is ready to pair`,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `You can connect up to ${limit} WhatsApp numbers`);
    } finally {
      setActionId(null);
    }
  }

  async function renameAccount(displayName: string) {
    if (!selectedAccount) return;

    try {
      setActionId(`rename-${selectedAccount.id}`);
      const account = await whatsappService.updateAccount(selectedAccount.id, { displayName });
      replaceAccount(account);
      setRenameDialogOpen(false);
      await loadEvents(selectedAccount.id);
      toast.success("Display name updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to rename WhatsApp number");
    } finally {
      setActionId(null);
    }
  }

  async function updateSendSettings(accountId: string, sendSettings: Partial<WhatsAppSendSettings>) {
    try {
      setActionId(`limits-${accountId}`);
      const account = await whatsappService.updateAccount(accountId, { sendSettings });
      replaceAccount(account);
      toast.success("Send limits updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update send limits");
    } finally {
      setActionId(null);
    }
  }

  async function resumeApiKeyWithReplacement(keyId: string) {
    if (!selectedAccount) return;
    try {
      setReplacementActionId(keyId);
      const result = await apiKeyService.resumeReplacement(keyId);
      const preview = await whatsappService.getSenderReplacement(selectedAccount.id);
      setSenderReplacement(preview);
      toast.success("API key rebound and queue resumed", {
        description: `${result.resumedRecipients} unsent recipient${result.resumedRecipients === 1 ? "" : "s"} resumed.`,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to resume this API key");
    } finally {
      setReplacementActionId(null);
    }
  }



  return (
    <div className="space-y-2">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-0">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#00c980] text-white shadow-xs ring-1 ring-black/5">
            <WhatsAppIcon className="size-5" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 leading-tight">WhatsApp Sessions</h1>
            <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">Connect and manage your primary WhatsApp number from one workspace.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <CompactStat 
            label="CONNECTED" 
            value={`${connectedCount}/1`} 
            icon={Link2}
            color="emerald"
          />
          <CompactStat 
            label="USED SLOTS" 
            value={`${usedSlots}`} 
            icon={Layers}
            color="blue"
          />
          <CompactStat 
            label="LATER SLOTS" 
            value={`${availableSlots}`} 
            icon={Clock}
            color="amber"
          />
        </div>
      </div>

      <AccountNameDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        title="Connect WhatsApp number"
        description="Give your primary connection a display name before pairing it."
        defaultValue={`WhatsApp Line ${accounts.length + 1}`}
        submitLabel="Create connection"
        loading={actionId === "new-slot"}
        onSubmit={addAccountSlot}
      />

      {selectedAccount ? (
        <AccountNameDialog
          open={renameDialogOpen}
          onOpenChange={setRenameDialogOpen}
          title="Rename WhatsApp number"
          description="This only changes the label shown inside Whatsaap. It will not rename the WhatsApp account on your phone."
          defaultValue={selectedAccount.displayName}
          submitLabel="Save name"
          loading={actionId === `rename-${selectedAccount.id}`}
          onSubmit={renameAccount}
        />
      ) : null}

      <div className="grid gap-2 xl:grid-cols-[255px_1fr]">
        <SectionCard
          title="Session slots"
          description="Primary number available. Extra slots coming soon."
          footer={
            <div className="flex items-center justify-between text-[11px] text-muted-foreground font-medium">
              <span>Slots limit: 1 / 3</span>
              <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" /> Slot 1 Active
              </span>
            </div>
          }
          bodyClassName="p-2"
        >
          <div className="space-y-1.5">
            {cards.map((card) =>
              card.kind === "account" && card.account ? (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => setSelectedId(card.id)}
                  className={cn(
                    "w-full rounded-xl border p-2.5 text-left transition-all duration-200",
                    selectedId === card.id
                      ? "border-emerald-500 bg-emerald-50/20 shadow-xs ring-1 ring-emerald-500/30"
                      : "border-slate-200/90 bg-white hover:border-slate-300 hover:shadow-2xs",
                  )}
                >
                  {/* Top row: Slot badge on the left, Status badge on the right */}
                  <div className="flex items-center justify-between gap-1.5 mb-1.5">
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 tracking-wide uppercase">
                      <span className="size-1.5 rounded-full bg-emerald-500" />
                      Slot {card.slotNumber}
                    </span>
                    <span className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase",
                      card.account.state === "CONNECTED"
                        ? "bg-emerald-100 text-emerald-800"
                        : card.account.state === "QR_REQUIRED"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-slate-100 text-slate-700"
                    )}>
                      <span className={cn(
                        "size-1.5 rounded-full",
                        card.account.state === "CONNECTED" ? "bg-emerald-500" : card.account.state === "QR_REQUIRED" ? "bg-amber-500" : "bg-slate-400"
                      )} />
                      {card.account.state === "QR_REQUIRED" ? "QR REQUIRED" : card.account.state}
                    </span>
                  </div>

                  {/* Display Name */}
                  <div className="min-w-0">
                    <h4 className="text-xs sm:text-[13px] font-bold text-slate-900 leading-snug">
                      {card.account.displayName}
                    </h4>
                    <p className="mt-1 text-[11px] font-mono text-slate-700 flex items-center gap-1.5">
                      <WhatsAppIcon className="size-3 text-[#00c980] shrink-0" />
                      <span>{card.account.phone}</span>
                    </p>
                  </div>

                  {/* Bottom stats row */}
                  <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-1.5 text-[10px] font-medium">
                    <span className="inline-flex items-center rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 capitalize">
                      {card.account.accountType}
                    </span>
                    <span className="text-slate-800 font-semibold text-[11px]">
                      {num(card.account.messagesSentToday)} sent today
                    </span>
                  </div>
                </button>
              ) : card.kind === "new" ? (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => setAddDialogOpen(true)}
                  disabled={actionId === "new-slot"}
                  className={cn(
                    "w-full rounded-lg border border-dashed p-2.5 text-left transition-all duration-200 hover:border-emerald-500/50 hover:bg-emerald-50/20 disabled:cursor-not-allowed disabled:opacity-60",
                    selectedId === card.id ? "border-emerald-500 bg-emerald-50/30 ring-1 ring-emerald-500/20" : "border-slate-200 bg-white",
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-600 ring-1 ring-emerald-500/20">
                      {actionId === "new-slot" ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-900">Connect number</p>
                      <p className="text-[10px] text-muted-foreground">Configure slot 1</p>
                    </div>
                  </div>
                </button>
              ) : (
                <div
                  key={card.id}
                  aria-disabled="true"
                  className="w-full rounded-lg border border-dashed border-slate-200/80 bg-slate-50/50 p-2 opacity-75"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded bg-slate-100 text-slate-400">
                        <Smartphone className="size-3" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-slate-600">
                          Slot {card.slotNumber}
                        </p>
                        <p className="text-[9px] text-muted-foreground">Multi-device planned</p>
                      </div>
                    </div>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium text-slate-500 shrink-0">
                      Soon
                    </span>
                  </div>
                </div>
              ),
            )}
          </div>
        </SectionCard>

        {selectedAccount && selectedState ? (
          <div className="space-y-2.5">
            <SectionCard
              title={selectedState === "CONNECTED" ? "Connected line" : "Pair WhatsApp number"}
              description={`${selectedAccount.displayName} · Slot ${selectedCard?.slotNumber ?? 1}`}
              actions={
                <div className="flex items-center gap-1.5">
                  {selectedState === "CONNECTED" && (
                    <>
                      <MiniStat icon={Smartphone} label="Device" value={selectedAccount.device.platform} color="emerald" />
                      <MiniStat icon={Wifi} label="Session" value={selectedAccount.sessionStatus} color="blue" />
                      <div className="mx-0.5 h-6 w-px bg-border/60" />
                    </>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs px-2.5 gap-1"
                    onClick={() => setRenameDialogOpen(true)}
                    disabled={actionId === `rename-${selectedAccount.id}`}
                  >
                    {actionId === `rename-${selectedAccount.id}` ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <Pencil className="size-3" />
                    )}
                    Rename
                  </Button>
                  {selectedState === "CONNECTED" ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs px-2.5 gap-1"
                        onClick={() => refresh(selectedAccount.id)}
                        disabled={actionId === selectedAccount.id}
                      >
                        {actionId === selectedAccount.id ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
                        Refresh
                      </Button>
                      <ConfirmDialog
                        trigger={
                          <Button variant="destructive" size="sm" className="h-7 text-xs px-2.5 gap-1" disabled={actionId === selectedAccount.id}>
                            <LogOut className="size-3" /> Disconnect
                          </Button>
                        }
                        title="Disconnect this device?"
                        description="Queued campaign messages on this number will pause until you link it again."
                        confirmLabel="Disconnect"
                        onConfirm={() => disconnect(selectedAccount.id)}
                      />
                    </>
                  ) : null}
                </div>
              }
            >
              {selectedState === "CONNECTED" ? (
                <ConnectedPanel
                  account={selectedAccount}
                  savingLimits={actionId === `limits-${selectedAccount.id}`}
                  onSaveLimits={(settings) => updateSendSettings(selectedAccount.id, settings)}
                />
              ) : null}

              {selectedState === "CONNECTED" && senderReplacement && (senderReplacement.apiKeys.length > 0 || senderReplacement.campaigns.length > 0) ? (
                <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50/70 p-3 text-xs text-amber-950">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-700" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-xs">Sender replacement confirmation needed</p>
                      <p className="mt-0.5 text-amber-900/80 text-[11px]">
                        {senderReplacement.account.replacementPhone} replaced the prior WhatsApp number in this slot.
                      </p>
                      {senderReplacement.apiKeys.length > 0 ? (
                        <div className="mt-2 space-y-1.5">
                          {senderReplacement.apiKeys.map((key) => (
                            <div key={key.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-amber-300/60 pt-2">
                              <p className="min-w-0 text-[11px] text-amber-950/85">
                                <span className="font-semibold">{key.label}</span> · {key.pendingRecipients} unsent recipient{key.pendingRecipients === 1 ? "" : "s"}.
                              </p>
                              <ConfirmDialog
                                title="Rebind API key and resume queued messages?"
                                description={`${key.previousPhone} was replaced by ${senderReplacement.account.replacementPhone}.`}
                                confirmLabel="Rebind and resume"
                                destructive={false}
                                onConfirm={() => resumeApiKeyWithReplacement(key.id)}
                                trigger={
                                  <Button size="sm" className="h-6 text-[11px] px-2" disabled={replacementActionId === key.id}>
                                    {replacementActionId === key.id ? <Loader2 className="size-3 animate-spin" /> : <Send className="size-3" />}
                                    Rebind
                                  </Button>
                                }
                              />
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}
              {selectedState === "QR_REQUIRED" ? (
                <div className="flex flex-col lg:flex-row gap-2 items-stretch w-full">
                  {/* Left Side: Compact QR Station */}
                  <div className="flex flex-col items-center justify-between rounded-xl border border-slate-200/90 bg-white p-2 text-center w-full lg:w-[195px] shrink-0 shadow-2xs h-[192px]">
                    <div className="w-full flex flex-col items-center">
                      <div className="relative">
                        {qrPayload ? (
                          <QrCanvas payload={qrPayload} expired={seconds === 0} />
                        ) : (
                          <div className="flex size-28 flex-col items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white p-2 text-center">
                            <Loader2 className="size-4 animate-spin text-emerald-600" />
                            <p className="text-[10px] font-medium text-muted-foreground">Requesting QR...</p>
                          </div>
                        )}
                      </div>

                      <div className="mt-1 w-full max-w-[160px]">
                        {seconds > 0 ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-700">
                              <Clock className="size-3 text-emerald-600 animate-pulse" />
                              <span>Code expires in <span className="font-mono text-emerald-600 font-bold">{seconds}s</span></span>
                            </div>
                            <Progress value={(seconds / DEFAULT_QR_SECONDS) * 100} className="h-1 bg-slate-100" />
                          </div>
                        ) : (
                          <p className="text-[10px] font-semibold text-destructive">QR expired. Tap new code.</p>
                        )}
                      </div>

                      {pairingError ? (
                        <div className="mt-1 w-full rounded-md border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[10px] text-destructive">
                          {pairingError}
                        </div>
                      ) : null}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-1.5 h-7 w-full rounded-lg border-slate-200 bg-white font-semibold text-[11px] text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-2xs gap-1.5 transition-all"
                      onClick={() => startPairing(selectedAccount.id)}
                      disabled={actionId === selectedAccount.id}
                    >
                      {actionId === selectedAccount.id ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <RefreshCw className="size-3 text-slate-500" />
                      )}
                      <span>New code</span>
                    </Button>
                  </div>

                  {/* Middle: Step-by-Step Instructions */}
                  <div className="flex flex-col justify-between rounded-xl border border-slate-200/90 bg-white/70 p-2 w-full lg:w-[230px] shrink-0 shadow-2xs h-[192px]">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5 mb-1">
                        <Bookmark className="size-3 fill-emerald-600 text-emerald-600" /> HOW TO CONNECT
                      </p>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 rounded-lg border border-slate-200/80 bg-white px-2 py-1 shadow-2xs">
                          <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                            1
                          </span>
                          <div className="min-w-0">
                            <p className="text-[11px] font-bold text-slate-900 leading-tight">Open WhatsApp</p>
                            <p className="text-[9px] text-muted-foreground leading-tight">On your mobile device</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 rounded-lg border border-slate-200/80 bg-white px-2 py-1 shadow-2xs">
                          <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                            2
                          </span>
                          <div className="min-w-0">
                            <p className="text-[11px] font-bold text-slate-900 leading-tight">Linked devices</p>
                            <p className="text-[9px] text-muted-foreground leading-tight">Tap Menu (⋮) or Settings</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 rounded-lg border border-slate-200/80 bg-white px-2 py-1 shadow-2xs">
                          <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                            3
                          </span>
                          <div className="min-w-0">
                            <p className="text-[11px] font-bold text-slate-900 leading-tight">Scan this QR</p>
                            <p className="text-[9px] text-muted-foreground leading-tight">Point camera at screen</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Bottom hint banner */}
                    <div className="mt-1 flex items-center gap-1.5 rounded-lg border border-emerald-200/70 bg-emerald-50/90 px-2 py-0.5 text-[10px] font-medium text-emerald-800 shadow-2xs">
                      <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
                      <span>Auto-pairs in seconds once scanned</span>
                    </div>
                  </div>

                  {/* Right Side: Visual Guide (Matching equal height h-[192px]) */}
                  <div className="relative rounded-xl border border-slate-200 overflow-hidden bg-slate-900 shadow-2xs w-full lg:flex-1 min-w-[180px] h-[192px] flex items-center justify-center">
                    <video 
                      src="/Guidevideo.mp4" 
                      autoPlay 
                      loop 
                      muted 
                      playsInline 
                      className="w-full h-full object-cover" 
                    />
                    <div className="absolute top-1.5 left-1.5 rounded-full bg-black/60 backdrop-blur-xs px-2 py-0.5 text-[9px] font-semibold text-white flex items-center gap-1 shadow-sm">
                      <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Visual guide
                    </div>
                  </div>
                </div>
              ) : null}

              {selectedState === "CONNECTING" || selectedState === "DISCONNECTING" ? (
                <div className="flex flex-col items-center gap-2.5 py-8 text-center">
                  <Loader2 className="size-6 animate-spin text-primary" />
                  <p className="text-xs font-semibold text-foreground">
                    {selectedState === "CONNECTING" ? "Establishing WhatsApp session..." : "Unlinking device..."}
                  </p>
                  <p className="text-[11px] text-muted-foreground">This usually takes a few seconds.</p>
                  {selectedState === "CONNECTING" ? (
                    <ConfirmDialog
                      trigger={
                        <Button variant="outline" size="sm" className="h-7 text-xs px-2.5" disabled={actionId === selectedAccount.id}>
                          {actionId === selectedAccount.id ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
                          Cancel &amp; new QR
                        </Button>
                      }
                      title="Cancel this connection attempt?"
                      description="This clears the incomplete session and stops reconnect attempts."
                      confirmLabel="Cancel and get new QR"
                      onConfirm={() => restartPairing(selectedAccount.id)}
                    />
                  ) : null}
                </div>
              ) : null}

              {selectedState === "DISCONNECTED" || selectedState === "SESSION_EXPIRED" || selectedState === "ERROR" ? (
                <div className="flex flex-col items-center gap-1.5 py-3 text-center">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                    <Wifi className="size-4" />
                  </span>
                  <div>
                    <p className="text-xs font-bold text-foreground">
                      {selectedState === "ERROR" ? "Pairing needs attention" : "No device linked"}
                    </p>
                    <p className="mt-0.5 max-w-sm text-[11px] text-muted-foreground">
                      {selectedState === "ERROR"
                        ? selectedAccount.connectionError || "Last QR attempt failed. Generate a fresh code and scan."
                        : "Number stays paused until reconnected with WhatsApp."}
                    </p>
                  </div>
                  {pairingError ? (
                    <div className="w-full max-w-md rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-1 text-xs text-destructive">
                      {pairingError}
                    </div>
                  ) : null}
                  <Button
                    size="sm"
                    className="h-7.5 text-xs px-3 gap-1.5 bg-[#00c980] hover:bg-[#00b070] text-white shadow-xs rounded-lg font-semibold"
                    onClick={() => startPairing(selectedAccount.id)}
                    disabled={actionId === selectedAccount.id}
                  >
                    {actionId === selectedAccount.id ? <Loader2 className="size-3.5 animate-spin" /> : <QrCode className="size-3.5" />}
                    Generate QR code
                  </Button>
                </div>
              ) : null}
            </SectionCard>

            <div className="grid gap-2 lg:grid-cols-[310px_1fr]">
              <SectionCard title="Session controls" description="Set up all to make sure WhatsApp runs smoothly." bodyClassName="p-2">
                <div className="grid gap-1.5">
                  <div className="flex items-center justify-between gap-2.5 rounded-lg border border-slate-200/80 bg-white p-2 hover:bg-slate-50/80 transition-colors shadow-2xs group cursor-pointer">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                        <Shield className="size-3.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 leading-tight">Slot Limit &amp; Governance</p>
                        <p className="text-[10px] text-muted-foreground leading-tight mt-0.5 truncate">Device limits enforced by backend configuration.</p>
                      </div>
                    </div>
                    <ChevronRight className="size-3.5 text-slate-400 shrink-0 transition-transform group-hover:translate-x-0.5" />
                  </div>

                  <div className="flex items-center justify-between gap-2.5 rounded-lg border border-slate-200/80 bg-white p-2 hover:bg-slate-50/80 transition-colors shadow-2xs group cursor-pointer">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                        <Activity className="size-3.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 leading-tight">Live Telemetry &amp; State</p>
                        <p className="text-[10px] text-muted-foreground leading-tight mt-0.5 truncate">Live scan status, battery, and platform sync.</p>
                      </div>
                    </div>
                    <ChevronRight className="size-3.5 text-slate-400 shrink-0 transition-transform group-hover:translate-x-0.5" />
                  </div>

                  <div className="flex items-center justify-between gap-2.5 rounded-lg border border-slate-200/80 bg-white p-2 hover:bg-slate-50/80 transition-colors shadow-2xs group cursor-pointer">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
                        <LogOut className="size-3.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 leading-tight">Queue Safe Disconnect</p>
                        <p className="text-[10px] text-muted-foreground leading-tight mt-0.5 truncate">Pending queue messages safely hold until reconnect.</p>
                      </div>
                    </div>
                    <ChevronRight className="size-3.5 text-slate-400 shrink-0 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="Connection history" description="Recent session activities." bodyClassName="p-0">
                <div className="max-h-[12.5rem] overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
                  <Table>
                    <TableHeader className="bg-slate-50/90 sticky top-0 z-10">
                      <TableRow className="border-b border-slate-200/80 hover:bg-slate-50/90">
                        <TableHead className="h-6.5 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 w-[140px]">
                          Event
                        </TableHead>
                        <TableHead className="h-6.5 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          Details
                        </TableHead>
                        <TableHead className="h-6.5 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 text-right w-[85px]">
                          Time
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {events.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="h-16 text-center text-xs text-muted-foreground">
                            No connection history yet.
                          </TableCell>
                        </TableRow>
                      ) : (
                        events.map((event) => (
                          <TableRow key={event.id} className="border-b border-slate-100 hover:bg-slate-50/70 transition-colors">
                            <TableCell className="px-3 py-1.5 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <span
                                  className={cn(
                                    "size-2 shrink-0 rounded-full",
                                    event.type === "error"
                                      ? "bg-rose-500 ring-2 ring-rose-200"
                                      : event.type === "connected"
                                        ? "bg-emerald-500 ring-2 ring-emerald-200"
                                        : event.type === "qr"
                                          ? "bg-emerald-500 ring-2 ring-emerald-200"
                                          : event.type === "disconnected"
                                            ? "bg-rose-500 ring-2 ring-rose-200"
                                            : "bg-slate-400",
                                  )}
                                />
                                <span className="text-xs font-semibold text-slate-900">{event.label}</span>
                              </div>
                            </TableCell>
                            <TableCell className="px-3 py-1.5 text-[11px] text-muted-foreground truncate">
                              {event.detail}
                            </TableCell>
                            <TableCell className="px-3 py-1.5 text-[10px] text-muted-foreground text-right whitespace-nowrap font-medium">
                              {relative(event.at)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                {eventTotal > 0 ? (
                  <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-3 py-1 bg-slate-50/30">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 text-[11px] px-2 rounded-md border-slate-200 gap-1 bg-white hover:bg-slate-50"
                      disabled={eventsLoading || eventPage <= 1}
                      onClick={() => selectedAccount && void loadEvents(selectedAccount.id, eventPage - 1)}
                    >
                      <ChevronLeft className="size-3" /> Previous
                    </Button>
                    <span className="text-[10px] text-muted-foreground font-medium">
                      {eventPage} / {eventPages} ({eventTotal} events)
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 text-[11px] px-2 rounded-md border-slate-200 gap-1 bg-white hover:bg-slate-50"
                      disabled={eventsLoading || eventPage >= eventPages}
                      onClick={() => selectedAccount && void loadEvents(selectedAccount.id, eventPage + 1)}
                    >
                      Next <ChevronRight className="size-3" />
                    </Button>
                  </div>
                ) : null}
              </SectionCard>
            </div>
          </div>
        ) : (
          <SectionCard
            title="Connect your primary WhatsApp number"
            description="Create the first connection and pair it with QR."
          >
            <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 text-primary shadow-sm ring-1 ring-primary/20">
                <QrCode className="size-6" />
              </span>
              <div>
                <p className="text-base font-bold text-foreground">Slot 1 is ready to connect</p>
                <p className="mt-1.5 max-w-[280px] text-sm text-muted-foreground mx-auto">
                  Click the primary slot on the left to create the connection and pair it with QR.
                </p>
              </div>
            </div>
          </SectionCard>
        )}
      </div>
    </div>
  );
}

function CompactStat({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  color: "emerald" | "blue" | "amber" | "violet" | "rose";
}) {
  const iconStyle = {
    emerald: "bg-[#00c980] text-white",
    blue: "bg-[#2563eb] text-white",
    amber: "bg-[#f59e0b] text-white",
    violet: "bg-[#8b5cf6] text-white",
    rose: "bg-[#f43f5e] text-white",
  }[color];

  return (
    <div className="flex items-center gap-2 rounded-lg border border-slate-200/90 bg-white px-2.5 py-1.5 shadow-2xs min-w-[110px]">
      <div className={cn("flex size-7 shrink-0 items-center justify-center rounded-md shadow-xs", iconStyle)}>
        <Icon className="size-3.5" />
      </div>
      <div className="min-w-0">
        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 leading-none">{label}</p>
        <p className="mt-0.5 text-xs sm:text-sm font-bold text-slate-900 leading-none">{value}</p>
      </div>
    </div>
  );
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.888 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.456 5.711 1.457h.005c6.554 0 11.89-5.335 11.893-11.893a11.82 11.82 0 00-3.488-8.416" />
    </svg>
  );
}

function QrCanvas({ payload, expired }: { payload: string; expired: boolean }) {
  return (
    <div className={cn("relative rounded-lg border border-slate-200/90 bg-white p-1.5 shadow-2xs", expired && "opacity-30")}>
      <QRCodeSVG value={payload} size={106} level="M" includeMargin={false} />
      <span className="absolute inset-0 m-auto flex size-6 items-center justify-center rounded-full bg-[#25D366] text-white shadow-sm ring-1.5 ring-white">
        <WhatsAppIcon className="size-3.5" />
      </span>
    </div>
  );
}

function AccountNameDialog({
  open,
  onOpenChange,
  title,
  description,
  defaultValue,
  submitLabel,
  loading,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  defaultValue: string;
  submitLabel: string;
  loading: boolean;
  onSubmit: (displayName: string) => Promise<void>;
}) {
  const [displayName, setDisplayName] = useState(defaultValue);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDisplayName(defaultValue);
    setError(null);
  }, [defaultValue, open]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextName = displayName.trim();
    if (nextName.length < 2) {
      setError("Display name must be at least 2 characters.");
      return;
    }

    await onSubmit(nextName);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="whatsapp-display-name">Display name</Label>
            <Input
              id="whatsapp-display-name"
              value={displayName}
              onChange={(event) => {
                setDisplayName(event.target.value);
                setError(null);
              }}
              placeholder="Sales support"
              maxLength={60}
              autoFocus
            />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : null}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const defaultSendSettings: WhatsAppSendSettings = {
  hourlyCap: 120,
  dailyCap: 1000,
  warmupHourlyCap: 60,
  warmupDailyCap: 500,
  minDelayMs: 3000,
  maxDelayMs: 12000,
  warmupMinDelayMs: 8000,
  warmupMaxDelayMs: 25000,
};

function ConnectedPanel({
  account,
  savingLimits,
  onSaveLimits,
}: {
  account: WhatsAppAccount;
  savingLimits: boolean;
  onSaveLimits: (settings: WhatsAppSendSettings) => Promise<void>;
}) {
  const [settings, setSettings] = useState<WhatsAppSendSettings>({
    ...defaultSendSettings,
    ...account.sendSettings,
  });
  const [showLimits, setShowLimits] = useState(false);

  useEffect(() => {
    setSettings({ ...defaultSendSettings, ...account.sendSettings });
  }, [account.id, account.sendSettings]);

  const rows: [string, string][] = [
    ["Phone number", account.phone],
    ["Display name", account.displayName],
    ["Account type", account.accountType === "business" ? "WhatsApp Business" : "Personal"],
    ["Session uptime", account.uptime],
    ["Messages sent today", num(account.messagesSentToday)],
    ["Last synced", dateTime(account.lastSyncedAt)],
    ["Connected since", dateTime(account.lastConnectedAt)],
  ];

  return (
    <div className="space-y-4">

      <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-muted/30 px-3 py-2 shadow-sm">
        <div className="min-w-0 flex items-center gap-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground shrink-0">Channel ID</span>
          <code className="truncate font-mono text-[13px] font-medium text-foreground">{account.id}</code>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-7 px-2.5 text-xs bg-background shrink-0"
          title="Copy channel ID"
          onClick={() => {
            void navigator.clipboard.writeText(account.id).then(() => toast.success("Channel ID copied"));
          }}
        >
          <Copy className="size-3 mr-1.5" /> Copy
        </Button>
      </div>

      <dl className="grid grid-cols-2 gap-4 rounded-xl border border-border bg-surface-muted/10 p-4 sm:grid-cols-3 lg:grid-cols-4 shadow-sm">
        {rows.map(([key, value]) => (
          <div key={key} className="space-y-1">
            <dt className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{key}</dt>
            <dd className="text-[13px] font-semibold text-foreground truncate">{value}</dd>
          </div>
        ))}
      </dl>

      <form
        className="space-y-4 rounded-xl border border-border bg-background p-4"
        onSubmit={(event) => {
          event.preventDefault();
          void onSaveLimits(settings);
        }}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Sending limits</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Current usage: {num(account.sendUsage?.lastHour ?? 0)}/{num(account.sendUsage?.hourlyCap ?? settings.hourlyCap)} this hour,{" "}
              {num(account.sendUsage?.last24h ?? 0)}/{num(account.sendUsage?.dailyCap ?? settings.dailyCap)} in 24h.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
              {account.sendUsage?.warmup ? "Warmup active" : "Normal limits"}
            </span>
            <Button 
              type="button" 
              variant="outline" 
              size="sm" 
              className="h-7 text-xs px-2 gap-1.5" 
              onClick={() => setShowLimits((prev) => !prev)}
            >
              {showLimits ? "Collapse" : "Expand"}
              <ChevronDown className={`size-3 transition-transform ${showLimits ? "rotate-180" : ""}`} />
            </Button>
          </div>
        </div>

        {showLimits && (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 border-t border-border/50 pt-4 mt-2">
              <LimitInput label="Hourly cap" value={settings.hourlyCap} min={1} max={250} onChange={(value) => setSettings((current) => ({ ...current, hourlyCap: value }))} suffix="/hr" />
              <LimitInput label="Daily cap" value={settings.dailyCap} min={1} max={5000} onChange={(value) => setSettings((current) => ({ ...current, dailyCap: value }))} suffix="/day" />
              <LimitInput label="Warmup hourly cap" value={settings.warmupHourlyCap} min={1} max={250} onChange={(value) => setSettings((current) => ({ ...current, warmupHourlyCap: value }))} suffix="/hr" />
              <LimitInput label="Warmup daily cap" value={settings.warmupDailyCap} min={1} max={5000} onChange={(value) => setSettings((current) => ({ ...current, warmupDailyCap: value }))} suffix="/day" />
              <LimitInput label="Delay min" value={settings.minDelayMs} min={3000} max={600000} onChange={(value) => setSettings((current) => ({ ...current, minDelayMs: value }))} suffix="ms" />
              <LimitInput label="Delay max" value={settings.maxDelayMs} min={3000} max={600000} onChange={(value) => setSettings((current) => ({ ...current, maxDelayMs: value }))} suffix="ms" />
              <LimitInput label="Warmup delay min" value={settings.warmupMinDelayMs} min={3000} max={600000} onChange={(value) => setSettings((current) => ({ ...current, warmupMinDelayMs: value }))} suffix="ms" />
              <LimitInput label="Warmup delay max" value={settings.warmupMaxDelayMs} min={3000} max={600000} onChange={(value) => setSettings((current) => ({ ...current, warmupMaxDelayMs: value }))} suffix="ms" />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
              <p className="text-xs text-muted-foreground">Backend-enforced maximum: 250 messages per hour and 5,000 messages per rolling 24 hours.</p>
              <Button type="submit" size="sm" disabled={savingLimits}>
                {savingLimits ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Save limits
              </Button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}

function LimitInput({
  label,
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="flex items-center gap-2">
        <Input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(event) => {
            const next = Number(event.target.value);
            if (Number.isFinite(next)) onChange(Math.min(Math.max(next, min), max));
          }}
        />
        <span className="w-10 text-xs text-muted-foreground">{suffix}</span>
      </span>
    </label>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof MessageSquare;
  label: string;
  value: string;
  color: "violet" | "blue" | "emerald";
}) {
  const colorMap = {
    violet: "from-violet-400 to-violet-600 shadow-violet-500/30",
    blue: "from-blue-400 to-blue-600 shadow-blue-500/30",
    emerald: "from-emerald-400 to-emerald-600 shadow-emerald-500/30",
  };

  const style = colorMap[color];

  return (
    <div className="group flex h-9 items-center gap-2 rounded-md border border-input bg-background px-2.5 shadow-sm transition-all hover:bg-accent hover:shadow-md">
      <div 
        className={`flex size-6 shrink-0 items-center justify-center rounded-md bg-gradient-to-br text-white shadow-md ring-1 ring-white/20 transition-transform duration-300 group-hover:scale-105 group-hover:-rotate-3 group-hover:shadow-lg ${style}`}
        style={{ transformStyle: "preserve-3d" }}
      >
        <Icon className="size-3 drop-shadow-md" />
      </div>
      <div className="min-w-0 flex flex-col justify-center">
        <span className="mb-0.5 text-[9px] font-bold uppercase leading-none tracking-wider text-muted-foreground">{label}</span>
        <p className={cn(
          "truncate text-xs font-bold capitalize leading-none",
          value.toLowerCase() === "active" ? "text-success" : "text-foreground"
        )}>
          {value}
        </p>
      </div>
    </div>
  );
}

