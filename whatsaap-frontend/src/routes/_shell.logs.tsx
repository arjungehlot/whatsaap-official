import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, RefreshCw, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { SectionCard } from "@/components/common/SectionCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { messageLogService } from "@/services";
import type { MessageLog } from "@/types";
import { useRefreshMessageCredits } from "@/hooks/use-workspace-snapshot";

export const Route = createFileRoute("/_shell/logs")({
  component: LogsPage,
});

function LogsPage() {
  const [logs, setLogs] = useState<MessageLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [source, setSource] = useState<"campaign" | "send-message" | "api" | "inbox" | "all">(
    "all",
  );
  const [status, setStatus] = useState<
    "pending" | "sent" | "delivered" | "read" | "failed" | "all"
  >("all");
  const [loading, setLoading] = useState(true);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [cancelling, setCancelling] = useState(false);
  const requestVersion = useRef(0);
  const hasLoadedLogs = useRef(false);
  const refreshMessageCredits = useRefreshMessageCredits();

  const load = useCallback(
    async (nextPage = 1, options: { background?: boolean } = {}) => {
      const version = ++requestVersion.current;
      if (!options.background) setLoading(true);
      try {
        const data = await messageLogService.list({
          page: nextPage,
          limit: 100,
          search: submittedSearch,
          source,
          status,
        });
        if (version !== requestVersion.current) return;
        setLogs(data.logs);
        setTotal(data.total);
        setPage(data.page);
        setPages(data.pages);
        setSelectedIds((current) =>
          current.filter((id) => data.logs.some((log) => log.id === id && log.canCancel)),
        );
        hasLoadedLogs.current = true;
      } catch (error) {
        if (version !== requestVersion.current) return;
        if (!options.background) {
          toast.error("Could not load message logs", {
            description: error instanceof Error ? error.message : "Please try again.",
          });
        }
      } finally {
        if (version === requestVersion.current && !options.background) setLoading(false);
      }
    },
    [source, status, submittedSearch],
  );

  useEffect(() => {
    void load(1);
    return () => {
      requestVersion.current += 1;
    };
  }, [load]);

  useEffect(() => {
    if (!hasLoadedLogs.current) return undefined;
    const interval = window.setInterval(() => {
      void load(page, { background: true });
    }, 15_000);
    return () => window.clearInterval(interval);
  }, [load, page]);

  async function retry(log: MessageLog) {
    setRetryingId(log.id);
    try {
      await messageLogService.retry(log.id);
      void refreshMessageCredits();
      toast.success("Message sent again", {
        description:
          "Only one credit is used for the recipient delivery, even when it includes several files.",
      });
      await load(page);
    } catch (error) {
      toast.error("Could not retry message", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setRetryingId(null);
    }
  }

  async function cancelSelected() {
    if (!selectedIds.length) return;
    setCancelling(true);
    try {
      const result = await messageLogService.cancelPending(selectedIds);
      setSelectedIds([]);
      if (result.cancelled) {
        toast.success(
          `${result.cancelled} queued ${result.cancelled === 1 ? "delivery" : "deliveries"} cancelled`,
        );
      }
      if (result.skipped) {
        toast.info(
          `${result.skipped} ${result.skipped === 1 ? "selection was" : "selections were"} already being sent and left unchanged.`,
        );
      }
      await load(page);
    } catch (error) {
      toast.error("Could not cancel queued messages", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setCancelling(false);
    }
  }

  const selectableLogs = logs.filter((log) => log.canCancel);
  const allSelectableSelected =
    selectableLogs.length > 0 && selectableLogs.every((log) => selectedIds.includes(log.id));

  return (
    <div className="space-y-2">
      <PageHeader
        title="Message logs"
        description="History of all outbound messages."
        actions={
          <>
            <form
              className="flex flex-wrap items-center gap-1.5"
              onSubmit={(event) => {
                event.preventDefault();
                setSubmittedSearch(search);
              }}
            >
              <div className="relative w-full sm:w-48 lg:w-60 xl:w-72">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="pl-7.5 h-7.5 text-xs"
                  placeholder="Search name, phone, group ID, or message"
                />
              </div>
              <div className="flex w-full sm:w-auto items-center gap-1.5">
                <select
                  value={source}
                  onChange={(event) => setSource(event.target.value as typeof source)}
                  className="h-7.5 flex-1 min-w-0 sm:flex-none rounded-md border border-input bg-background px-2 text-xs"
                >
                  <option value="all">All sources</option>
                  <option value="campaign">Campaign</option>
                  <option value="send-message">Send message</option>
                  <option value="api">API</option>
                  <option value="inbox">Inbox</option>
                </select>
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value as typeof status)}
                  className="h-7.5 flex-1 min-w-0 sm:flex-none rounded-md border border-input bg-background px-2 text-xs"
                >
                  <option value="all">All statuses</option>
                  <option value="pending">Under processing</option>
                  <option value="sent">Sent</option>
                  <option value="delivered">Delivered</option>
                  <option value="read">Read</option>
                  <option value="failed">Failed</option>
                </select>
                <Button type="submit" size="sm" className="h-7.5 text-xs px-2.5 shrink-0">
                  Search
                </Button>
              </div>
            </form>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="absolute right-0 top-0 sm:static h-7.5 w-7.5 shrink-0"
              onClick={() => load(page)}
              title="Refresh"
            >
              <RefreshCw className={loading ? "size-3 animate-spin" : "size-3"} />
            </Button>
          </>
        }
      />
      <SectionCard
        className="rounded-lg"
        bodyClassName="p-0 border-none shadow-none bg-transparent"
      >
        {selectedIds.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border border-b-0 border-border bg-primary-soft/60 px-2.5 py-1.5">
            <p className="text-xs font-medium">
              {selectedIds.length} queued {selectedIds.length === 1 ? "delivery" : "deliveries"}{" "}
              selected
            </p>
            <ConfirmDialog
              trigger={
                <Button variant="destructive" size="sm" className="h-7 text-xs px-2" disabled={cancelling}>
                  {cancelling ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="size-3.5" />
                  )}
                  Cancel selected
                </Button>
              }
              title={`Cancel ${selectedIds.length} queued ${selectedIds.length === 1 ? "delivery" : "deliveries"}?`}
              description="These messages will not be sent. Any delivery already claimed by WhatsApp is left unchanged."
              confirmLabel="Cancel deliveries"
              onConfirm={cancelSelected}
            />
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs px-2"
              disabled={cancelling}
              onClick={() => setSelectedIds([])}
            >
              Clear
            </Button>
          </div>
        )}
        <div
          className="overflow-auto rounded-md border border-border max-h-[calc(100vh-165px)]"
          style={{ scrollbarWidth: "thin" }}
        >
          <table className="w-full min-w-full table-fixed text-xs">
            <thead className="sticky top-0 z-10 bg-surface-muted shadow-[0_1px_0_0_hsl(var(--border))] text-left text-[10px] uppercase tracking-wide text-muted-foreground whitespace-nowrap">
              <tr>
                <th className="w-9 px-2 py-1.5">
                  <Checkbox
                    checked={allSelectableSelected}
                    disabled={selectableLogs.length === 0 || cancelling}
                    onCheckedChange={(checked) =>
                      setSelectedIds((current) =>
                        checked
                          ? Array.from(
                              new Set([...current, ...selectableLogs.map((log) => log.id)]),
                            )
                          : current.filter((id) => !selectableLogs.some((log) => log.id === id)),
                      )
                    }
                    aria-label="Select all queued deliveries on this page"
                  />
                </th>
                <th className="w-12 px-2 py-1.5">Sr no.</th>
                <th className="w-38 px-2 py-1.5">Sent at</th>
                <th className="w-36 px-2 py-1.5">Name</th>
                <th className="w-30 px-2 py-1.5">Phone number</th>
                <th className="w-64 px-2 py-1.5">Message</th>
                <th className="w-22 px-2 py-1.5">Sent via</th>
                <th className="w-22 px-2 py-1.5">Credit down</th>
                <th className="w-26 px-2 py-1.5">Status</th>
                <th className="w-12 px-2 py-1.5 text-right">Retry</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-2 py-6 text-center">
                    <Loader2 className="mx-auto size-4 animate-spin text-primary" />
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-2 py-6 text-center text-muted-foreground">
                    No outbound messages match these filters.
                  </td>
                </tr>
              ) : (
                logs.map((log, index) => (
                  <tr
                    key={log.id}
                    className="align-top hover:bg-surface-muted/50 transition-colors"
                  >
                    <td className="px-2 py-1.5">
                      <Checkbox
                        checked={selectedIds.includes(log.id)}
                        disabled={!log.canCancel || cancelling}
                        onCheckedChange={(checked) =>
                          setSelectedIds((current) =>
                            checked ? [...current, log.id] : current.filter((id) => id !== log.id),
                          )
                        }
                        aria-label={
                          log.canCancel
                            ? `Select queued delivery to ${log.phone}`
                            : `Delivery to ${log.phone} can no longer be cancelled`
                        }
                      />
                    </td>
                    <td className="px-2 py-1.5 text-muted-foreground">
                      {(page - 1) * 100 + index + 1}
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap text-muted-foreground">
                      {new Date(log.sentAt).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })}{" "}
                      {new Date(log.sentAt).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                        second: "2-digit",
                        hour12: true,
                      })}
                    </td>
                    <td
                      className="px-2 py-1.5 text-muted-foreground truncate"
                      title={log.contactName || "Unknown contact"}
                    >
                      {log.contactName || "Unknown contact"}
                    </td>
                    <td className="px-2 py-1.5 text-muted-foreground whitespace-nowrap">
                      {log.phone}
                    </td>
                    <td className="px-2 py-1.5">
                      <ExpandableMessage text={log.body} />
                      {log.error && (
                        <p className="mt-0.5 truncate text-[10px] text-destructive" title={log.error}>
                          {log.error}
                        </p>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-muted-foreground">
                      <span>{sourceLabel(log.source)}</span>
                      {log.retryCount > 0 && (
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          Retried {log.retryCount} time{log.retryCount === 1 ? "" : "s"}
                        </p>
                      )}
                    </td>
                    <td className="px-2 py-1.5">
                      <span className={log.creditDown ? "text-primary font-medium" : "text-muted-foreground"}>
                        {log.creditDown ? `${log.creditDown} credit` : "No charge"}
                      </span>
                    </td>
                    <td className="px-2 py-1.5">
                      <StatusBadge
                        status={log.status === "pending" ? "Under processing" : log.status}
                        {...(log.status === "pending" ? { tone: "warning" } : {})}
                      />
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      {log.status === "failed" ? (
                        <Button
                          size="icon"
                          variant="outline"
                          title="Retry failed message"
                          aria-label={`Retry message to ${log.phone}`}
                          disabled={retryingId !== null}
                          onClick={() => void retry(log)}
                          className="size-6"
                        >
                          {retryingId === log.id ? (
                            <Loader2 className="size-2.5 animate-spin" />
                          ) : (
                            <RefreshCw className="size-2.5" />
                          )}
                        </Button>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div className="mt-2.5 flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Page {page} of {pages}
            </p>
            <div className="flex gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs px-2.5"
                disabled={loading || page === 1}
                onClick={() => void load(page - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs px-2.5"
                disabled={loading || page === pages}
                onClick={() => void load(page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function sourceLabel(source: MessageLog["source"]) {
  return { campaign: "Campaign", "send-message": "Send message", api: "API", inbox: "Inbox" }[
    source
  ];
}

function ExpandableMessage({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const maxLength = 35;
  const isLong = text.length > maxLength;

  if (!isLong) return <div className="text-muted-foreground break-words">{text}</div>;

  return (
    <div className="text-muted-foreground break-words">
      <span>{expanded ? text : `${text.slice(0, maxLength).trim()}...`}</span>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="ml-2 shrink-0 text-primary hover:underline font-medium whitespace-nowrap"
      >
        {expanded ? "less" : "more"}
      </button>
    </div>
  );
}
