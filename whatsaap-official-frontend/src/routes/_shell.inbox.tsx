import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  Check,
  CheckCheck,
  Copy,
  Download,
  FileText,
  ImageIcon,
  Inbox as InboxIcon,
  Loader2,
  LockKeyhole,
  MessageSquare,
  MoreVertical,
  Paperclip,
  Search,
  Send,
  Smile,
  Star,
  UsersRound,
  UserCircle2,
  Video,
  RefreshCw,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { templates } from "@/mock/data";
import { messageService } from "@/services";
import { useRefreshMessageCredits, useWorkspaceSnapshot } from "@/hooks/use-workspace-snapshot";
import { calendarDayKey, chatDateLabel, initials, relative, timeOnly } from "@/lib/format";
import type { Conversation, InboxGroupDetails, Message } from "@/types";

export const Route = createFileRoute("/_shell/inbox")({
  head: () => ({
    meta: [
      { title: "Team Inbox - WAFlow" },
      {
        name: "description",
        content:
          "A shared WhatsApp inbox: reply to customers, assign conversations to teammates and keep full message history in one place.",
      },
      { property: "og:title", content: "Team Inbox - WAFlow" },
      {
        property: "og:description",
        content: "Shared WhatsApp inbox with assignment, labels and quick template replies.",
      },
    ],
  }),
  component: InboxPage,
});

type Filter = "all" | "unread" | "assigned" | "starred";
type InboxView = "personal" | "groups";

const COMPOSER_EMOJIS = ["😀", "😊", "😂", "😍", "👍", "🙏", "🎉", "❤️", "✅", "📎", "🔥", "👏"];
const MAX_ATTACHMENT_COUNT = 10;
const MAX_ATTACHMENT_SIZE_BYTES = 25 * 1024 * 1024;
const MAX_ATTACHMENT_TOTAL_BYTES = 50 * 1024 * 1024;

function fileSize(size?: number) {
  if (!size) return "File";
  if (size < 1024 * 1024) return `${Math.ceil(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function InboxPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [view, setView] = useState<InboxView>("personal");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [inboxRefresh, setInboxRefresh] = useState(0);
  const [activeId, setActiveId] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationCursor, setConversationCursor] = useState<string | null>(null);
  const [thread, setThread] = useState<Message[]>([]);
  const [messageCursor, setMessageCursor] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [attachmentDrafts, setAttachmentDrafts] = useState<Record<string, File[]>>({});
  const [attachmentUrls, setAttachmentUrls] = useState<Record<string, string>>({});
  const [previewMessage, setPreviewMessage] = useState<Message | null>(null);
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMoreList, setLoadingMoreList] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [groupDetails, setGroupDetails] = useState<InboxGroupDetails | null>(null);
  const [loadingGroupDetails, setLoadingGroupDetails] = useState(false);
  const [groupDetailsError, setGroupDetailsError] = useState("");
  const [groupDetailsRefresh, setGroupDetailsRefresh] = useState(0);
  const [sending, setSending] = useState(false);
  const hasLoadedInbox = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const attachmentUrlsRef = useRef<Record<string, string>>({});
  const workspace = useWorkspaceSnapshot();
  const refreshMessageCredits = useRefreshMessageCredits();
  const canAccessGroups = Boolean(workspace.data?.features["inbox-groups"]);

  function copyIdentifier(value: string, label: string) {
    void navigator.clipboard?.writeText(value);
    toast.success(`${label} copied`);
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    const refresh = () => setInboxRefresh((value) => value + 1);
    const interval = window.setInterval(refresh, 15_000);
    window.addEventListener("focus", refresh);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  useEffect(() => {
    let ignore = false;
    const initialLoad = !hasLoadedInbox.current;

    async function load() {
      if (initialLoad) setLoadingList(true);
      try {
        const data = await messageService.conversations({
          view,
          filter,
          search: debouncedQuery,
          limit: 30,
        });

        if (ignore) return;
        hasLoadedInbox.current = true;
        setConversations(data.conversations);
        setConversationCursor(data.nextCursor);
        setActiveId((current) => {
          if (data.conversations.some((conversation) => conversation.id === current))
            return current;
          return data.conversations[0]?.id ?? "";
        });
      } catch (error) {
        if (!ignore) {
          toast.error("Could not load inbox", {
            description: error instanceof Error ? error.message : "Please try again.",
          });
        }
      } finally {
        if (!ignore && initialLoad) setLoadingList(false);
        if (!ignore) setIsRefreshing(false);
      }
    }

    load();
    return () => {
      ignore = true;
    };
  }, [debouncedQuery, filter, inboxRefresh, view]);

  const active = useMemo(
    () => conversations.find((conversation) => conversation.id === activeId),
    [activeId, conversations],
  );

  useEffect(() => {
    let ignore = false;

    async function loadThread() {
      if (!activeId) {
        setThread([]);
        setMessageCursor(null);
        return;
      }

      setLoadingThread(true);
      try {
        const data = await messageService.messages(activeId, { limit: 50 });
        if (ignore) return;

        setThread(data.messages);
        setMessageCursor(data.nextCursor);
        setConversations((items) =>
          items.map((item) => (item.id === activeId ? { ...item, unreadCount: 0 } : item)),
        );
      } catch (error) {
        if (!ignore) {
          setThread([]);
          toast.error("Could not open conversation", {
            description:
              error instanceof Error ? error.message : "This WhatsApp number may be disconnected.",
          });
        }
      } finally {
        if (!ignore) setLoadingThread(false);
      }
    }

    loadThread();
    return () => {
      ignore = true;
    };
  }, [activeId, inboxRefresh]);

  useEffect(() => {
    let ignore = false;

    async function loadGroupDetails() {
      if (!active?.isGroup) {
        setGroupDetails(null);
        setGroupDetailsError("");
        setLoadingGroupDetails(false);
        return;
      }

      setLoadingGroupDetails(true);
      setGroupDetails(null);
      setGroupDetailsError("");
      try {
        const data = await messageService.groupDetails(active.id);
        if (!ignore) setGroupDetails(data);
      } catch (error) {
        if (!ignore) {
          setGroupDetailsError(
            error instanceof Error
              ? error.message
              : "Could not load group members. Please try again.",
          );
        }
      } finally {
        if (!ignore) setLoadingGroupDetails(false);
      }
    }

    void loadGroupDetails();
    return () => {
      ignore = true;
    };
  }, [active?.id, active?.isGroup, groupDetailsRefresh]);

  const draft = activeId ? (drafts[activeId] ?? "") : "";
  const selectedFiles = activeId ? (attachmentDrafts[activeId] ?? []) : [];
  const imageAttachmentKey = useMemo(
    () =>
      thread
        .filter((message) => message.attachment?.kind === "image")
        .map((message) => message.id)
        .join("|"),
    [thread],
  );

  // Auto-resize the textarea based on content
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "0px";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [draft]);

  useEffect(() => {
    let cancelled = false;
    const imageMessages = thread.filter((message) => message.attachment?.kind === "image");
    const missing = imageMessages.filter((message) => !attachmentUrlsRef.current[message.id]);
    if (!missing.length) return;

    void Promise.all(
      missing.map(async (message) => {
        try {
          const { blob } = await messageService.downloadAttachment(message.id);
          return { id: message.id, url: URL.createObjectURL(blob) };
        } catch {
          return null;
        }
      }),
    ).then((results) => {
      if (cancelled) {
        results.forEach((result) => result?.url && URL.revokeObjectURL(result.url));
        return;
      }
      const next = results.filter((result): result is { id: string; url: string } =>
        Boolean(result),
      );
      if (!next.length) return;
      next.forEach((result) => {
        attachmentUrlsRef.current[result.id] = result.url;
      });
      setAttachmentUrls({ ...attachmentUrlsRef.current });
    });

    return () => {
      cancelled = true;
    };
  }, [imageAttachmentKey, thread]);

  useEffect(
    () => () => {
      Object.values(attachmentUrlsRef.current).forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );

  useEffect(() => {
    setPreviewMessage(null);
  }, [activeId]);

  function addEmoji(emoji: string) {
    if (!activeId) return;
    const start = textareaRef.current?.selectionStart ?? draft.length;
    const end = textareaRef.current?.selectionEnd ?? draft.length;
    const next = `${draft.slice(0, start)}${emoji}${draft.slice(end)}`;
    setDrafts((items) => ({ ...items, [activeId]: next }));
    window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
      const cursor = start + emoji.length;
      textareaRef.current?.setSelectionRange(cursor, cursor);
    });
  }

  function chooseAttachments(files: FileList | null) {
    if (!activeId || !files?.length) return;
    const nextFiles = [...selectedFiles, ...Array.from(files)];
    if (nextFiles.length > MAX_ATTACHMENT_COUNT) {
      toast.error(`You can attach up to ${MAX_ATTACHMENT_COUNT} files at once.`);
      return;
    }
    if (nextFiles.some((file) => file.size > MAX_ATTACHMENT_SIZE_BYTES)) {
      toast.error("Each attachment must be 25 MB or smaller.");
      return;
    }
    if (nextFiles.reduce((total, file) => total + file.size, 0) > MAX_ATTACHMENT_TOTAL_BYTES) {
      toast.error("The selected attachments cannot exceed 50 MB in total.");
      return;
    }
    setAttachmentDrafts((items) => ({ ...items, [activeId]: nextFiles }));
    if (attachmentInputRef.current) attachmentInputRef.current.value = "";
  }

  function removeAttachment(index: number) {
    if (!activeId) return;
    setAttachmentDrafts((items) => ({
      ...items,
      [activeId]: (items[activeId] ?? []).filter((_, fileIndex) => fileIndex !== index),
    }));
  }

  async function downloadAttachment(message: Message) {
    if (!message.attachment || downloadingAttachmentId) return;
    setDownloadingAttachmentId(message.id);
    try {
      const { blob, fileName } = await messageService.downloadAttachment(message.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName || message.attachment.name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      toast.error("Could not download attachment", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setDownloadingAttachmentId("");
    }
  }

  async function loadMoreConversations() {
    if (!conversationCursor || loadingMoreList) return;

    setLoadingMoreList(true);
    try {
      const data = await messageService.conversations({
        view,
        filter,
        search: debouncedQuery,
        cursor: conversationCursor,
        limit: 30,
      });
      setConversations((items) => [...items, ...data.conversations]);
      setConversationCursor(data.nextCursor);
    } catch (error) {
      toast.error("Could not load more conversations", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setLoadingMoreList(false);
    }
  }

  async function loadOlderMessages() {
    if (!activeId || !messageCursor || loadingThread) return;

    setLoadingThread(true);
    try {
      const data = await messageService.messages(activeId, { before: messageCursor, limit: 50 });
      setThread((items) => [...data.messages, ...items]);
      setMessageCursor(data.nextCursor);
    } catch (error) {
      toast.error("Could not load older messages", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setLoadingThread(false);
    }
  }

  async function send() {
    const text = draft.trim();
    if ((!text && !selectedFiles.length) || !active || sending) return;

    setSending(true);
    try {
      const attachments = selectedFiles.length
        ? await messageService.uploadInboxAttachments(selectedFiles)
        : [];
      const messages = await messageService.send(active.id, text, attachments);
      const latestMessage = messages[messages.length - 1];
      if (!latestMessage) throw new Error("The message was queued without a response");
      void refreshMessageCredits();
      setThread((items) => [...items, ...messages]);
      setDrafts((items) => ({ ...items, [active.id]: "" }));
      setAttachmentDrafts((items) => ({ ...items, [active.id]: [] }));
      setConversations((items) =>
        items
          .map((item) =>
            item.id === active.id
              ? {
                  ...item,
                  lastMessage: latestMessage.body,
                  lastMessageAt: latestMessage.at,
                  unreadCount: 0,
                }
              : item,
          )
          .sort(
            (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime(),
          ),
      );
      toast.success("Message queued", { description: active.contactName });
    } catch (error) {
      toast.error("Message not sent", {
        description:
          error instanceof Error ? error.message : "Reconnect this WhatsApp number and try again.",
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-2">
      <PageHeader
        title="Team Inbox"
        description={
          view === "groups"
            ? "Review group conversations and the members in each WhatsApp group."
            : "Only personal conversations from currently connected WhatsApp numbers are shown here."
        }
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setIsRefreshing(true);
              setInboxRefresh((value) => value + 1);
            }}
            disabled={loadingList || isRefreshing}
            className="h-8 shadow-xs bg-white hover:bg-slate-50 text-xs px-2.5"
          >
            <RefreshCw className={`mr-1.5 size-3.5 ${loadingList || isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      <div className="card-surface bg-white rounded-lg border border-slate-200/90 shadow-xs grid h-[calc(100vh-5.5rem)] min-h-[500px] overflow-hidden lg:grid-cols-[18rem_1fr] xl:grid-cols-[19.5rem_1fr_19.5rem]">
        <aside className="flex min-h-0 flex-col border-b border-border lg:border-b-0 lg:border-r bg-slate-50/20">
          <div className="space-y-1.5 border-b border-border p-2 bg-white">
            <Tabs
              value={view}
              onValueChange={(value) => {
                setView(value as InboxView);
                setActiveId("");
                setThread([]);
              }}
            >
              <TabsList className="grid w-full grid-cols-2 h-7.5 p-0.5 rounded-md bg-slate-100">
                <TabsTrigger value="personal" className="text-xs h-6.5 rounded-sm">Personal</TabsTrigger>
                <TabsTrigger
                  value="groups"
                  disabled={!canAccessGroups}
                  title={canAccessGroups ? "" : "Upgrade your plan to unlock group inbox"}
                  className="text-xs h-6.5 rounded-sm"
                >
                  <UsersRound className="mr-1 size-3.5" />
                  Groups {!canAccessGroups && <LockKeyhole className="ml-1 size-3" />}
                </TabsTrigger>
              </TabsList>
            </Tabs>
            {!canAccessGroups && (
              <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface-muted px-2.5 py-1.5 text-[11px] text-muted-foreground">
                <span>Group inbox is locked.</span>
                <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 rounded" asChild>
                  <Link to="/pricing">Upgrade</Link>
                </Button>
              </div>
            )}
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search connected inbox..."
                className="pl-8 h-8 text-xs bg-white rounded-md border-slate-200/90 shadow-2xs"
              />
            </div>
            <Tabs value={filter} onValueChange={(value) => setFilter(value as Filter)}>
              <TabsList className="w-full h-7 p-0.5 rounded-md bg-slate-100">
                <TabsTrigger value="all" className="flex-1 text-[11px] h-6 rounded-sm">
                  All
                </TabsTrigger>
                <TabsTrigger value="unread" className="flex-1 text-[11px] h-6 rounded-sm">
                  Unread
                </TabsTrigger>
                <TabsTrigger value="assigned" className="flex-1 text-[11px] h-6 rounded-sm">
                  Mine
                </TabsTrigger>
                <TabsTrigger value="starred" className="flex-1 text-[11px] h-6 rounded-sm">
                  Starred
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {loadingList ? (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground gap-2">
                <Loader2 className="size-3.5 animate-spin text-primary" />
                Loading conversations...
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-3">
                <div className="flex flex-col items-center justify-center p-5 text-center bg-white rounded-lg border border-dashed border-slate-200/90 shadow-2xs">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 ring-1 ring-emerald-500/20 mb-2">
                    <InboxIcon className="size-4.5" />
                  </span>
                  <h4 className="text-xs font-semibold text-slate-900">
                    {view === "groups" ? "No group chats" : "No connected messages"}
                  </h4>
                  <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
                    {view === "groups"
                      ? "Group messages from connected WhatsApp numbers will appear here."
                      : "Connect a WhatsApp number to receive and send messages in real-time."}
                  </p>
                  <Button size="sm" variant="outline" className="mt-3 h-7 text-[11px] gap-1 rounded-md bg-white hover:bg-slate-50" asChild>
                    <Link to="/whatsapp">WhatsApp Sessions</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <ul className="space-y-0.5 p-1">
                  {conversations.map((conversation) => (
                    <li key={conversation.id}>
                      <button
                        type="button"
                        onClick={() => setActiveId(conversation.id)}
                        className={`group flex w-full items-start gap-2 rounded-lg p-1.5 text-left transition-all duration-300 border ${
                          conversation.id === activeId
                            ? "bg-primary/5 border-primary/20 shadow-sm ring-1 ring-inset ring-primary/10"
                            : "bg-transparent border-transparent hover:bg-surface-muted/50 hover:border-border hover:shadow-md hover:-translate-y-[1px]"
                        }`}
                      >
                        <span
                          className={`relative flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
                            conversation.id === activeId
                              ? "bg-primary text-primary-foreground shadow-md"
                              : "bg-secondary text-foreground"
                          }`}
                        >
                          {conversation.isGroup ? (
                            <UsersRound className="size-3" />
                          ) : (
                            initials(conversation.contactName)
                          )}
                          {conversation.online && (
                            <span className="absolute -bottom-0.5 -right-0.5 size-2 rounded-full border-2 border-card bg-success" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-1">
                            <span className="truncate text-xs font-bold text-foreground">
                              {conversation.isGroup
                                ? conversation.groupSubject || conversation.contactName
                                : conversation.contactName}
                            </span>
                            <span className="shrink-0 text-[10px] font-medium text-muted-foreground">
                              {relative(conversation.lastMessageAt)}
                            </span>
                          </span>
                          <span className="mt-0 flex items-center gap-1.5">
                            <span className="truncate text-[10.5px] font-medium text-muted-foreground">
                              {conversation.lastMessage}
                            </span>
                            {conversation.unreadCount > 0 && (
                              <span className="ml-auto flex size-4 shrink-0 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground shadow-sm">
                                {conversation.unreadCount}
                              </span>
                            )}
                            {conversation.isGroup && (
                              <span className="text-[9px] font-medium text-muted-foreground">
                                {conversation.groupMemberCount ?? 0} members
                              </span>
                            )}
                            {conversation.starred && (
                              <Star className="size-3 shrink-0 fill-amber-400 text-amber-400" />
                            )}
                          </span>
                          <span className="mt-0.5 block truncate text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
                            via {conversation.accountName ?? "WhatsApp"}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                {conversationCursor && (
                  <div className="p-3">
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={loadMoreConversations}
                      disabled={loadingMoreList}
                    >
                      {loadingMoreList && <Loader2 className="mr-2 size-4 animate-spin" />}
                      Load more
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </aside>

        {active ? (
          <section className="flex min-h-0 flex-col">
            <header className="flex items-center gap-2 border-b border-border px-2.5 py-1.5 bg-surface-muted/30">
              <span className="flex size-7 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground shadow-sm">
                {active.isGroup ? <UsersRound className="size-3" /> : initials(active.contactName)}
              </span>
              <div className="min-w-0 flex-1 max-w-[220px]">
                <p className="truncate text-sm font-bold text-foreground">
                  {active.isGroup ? active.groupSubject || active.contactName : active.contactName}
                </p>
                <p className="truncate text-[11px] font-medium text-muted-foreground">
                  {active.isGroup
                    ? `${groupDetails?.memberCount ?? active.groupMemberCount ?? 0} members · via ${active.accountName ?? "WhatsApp"}`
                    : `${active.phone} · via ${active.accountName ?? "WhatsApp"}`}
                </p>
              </div>
              {active.assignedTo && (
                <span className="hidden items-center gap-1.5 rounded-full bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground shadow-sm border border-border/50 sm:flex">
                  <UserCircle2 className="size-3.5" /> {active.assignedTo}
                </span>
              )}
            </header>

            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto bg-surface-muted/50 p-2 pb-1">
              {messageCursor && (
                <div className="flex justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadOlderMessages}
                    disabled={loadingThread}
                  >
                    {loadingThread && <Loader2 className="mr-2 size-4 animate-spin" />}
                    Load older messages
                  </Button>
                </div>
              )}

              {loadingThread && thread.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Opening conversation...
                </div>
              ) : thread.length === 0 ? (
                <EmptyState
                  icon={InboxIcon}
                  title="No messages yet"
                  description="Messages for this connected WhatsApp number will appear here."
                  className="border-0"
                />
              ) : (
                thread.map((message, index) => {
                  const previousMessage = thread[index - 1];
                  const showsDateSeparator =
                    !previousMessage ||
                    calendarDayKey(previousMessage.at) !== calendarDayKey(message.at);

                  return (
                    <Fragment key={message.id}>
                      {showsDateSeparator && (
                        <div className="flex justify-center py-1.5">
                          <span className="rounded-md border border-slate-200 bg-white/90 px-2.5 py-1 text-[10px] font-semibold text-slate-600 shadow-sm">
                            {chatDateLabel(message.at)}
                          </span>
                        </div>
                      )}
                      <div
                        className={`flex ${message.direction === "outbound" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[78%] rounded-xl px-2.5 py-1.5 shadow-sm ${
                            message.direction === "outbound"
                              ? "rounded-br-sm border border-[#c6ead2] bg-[#E1F6E9] text-slate-900"
                              : "rounded-bl-sm bg-white border border-slate-200"
                          }`}
                        >
                          {active.isGroup && message.direction === "inbound" && (
                            <p className="mb-0.5 text-[10px] font-bold text-primary">
                              {message.senderName || message.senderPhone || "Group member"}
                            </p>
                          )}
                          <p
                            className={`whitespace-pre-wrap text-[12px] leading-relaxed ${message.direction === "outbound" ? "text-slate-800" : "text-slate-700"}`}
                          >
                            {message.body}
                          </p>
                          {message.attachment &&
                            (message.attachment.kind === "image" && attachmentUrls[message.id] ? (
                              <button
                                type="button"
                                className="mt-2 block overflow-hidden rounded-md border border-black/10 text-left"
                                onClick={() => setPreviewMessage(message)}
                                title="Open full image"
                              >
                                <img
                                  src={attachmentUrls[message.id]}
                                  alt={message.attachment.name}
                                  className="h-36 w-52 object-cover"
                                />
                              </button>
                            ) : (
                              <div
                                className={`mt-2 flex min-w-52 items-center gap-2 rounded-md border px-2 py-1.5 ${message.direction === "outbound" ? "border-[#b8e7c8] bg-white/65" : "border-slate-200 bg-slate-50"}`}
                              >
                                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-background/70 text-muted-foreground">
                                  {message.attachment.kind === "image" ? (
                                    <ImageIcon className="size-4" />
                                  ) : message.attachment.kind === "video" ? (
                                    <Video className="size-4" />
                                  ) : (
                                    <FileText className="size-4" />
                                  )}
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span
                                    className={`block truncate text-[11px] font-medium ${message.direction === "outbound" ? "text-slate-800" : "text-slate-700"}`}
                                  >
                                    {message.attachment.name}
                                  </span>
                                  <span
                                    className={`block text-[10px] ${message.direction === "outbound" ? "text-slate-600" : "text-muted-foreground"}`}
                                  >
                                    {fileSize(message.attachment.size)}
                                  </span>
                                </span>
                                {message.attachment.kind !== "image" && (
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className={`size-7 shrink-0 ${message.direction === "outbound" ? "text-emerald-800 hover:bg-emerald-900/10 hover:text-emerald-900" : ""}`}
                                    title="Download attachment"
                                    aria-label={`Download ${message.attachment.name}`}
                                    onClick={() => void downloadAttachment(message)}
                                    disabled={Boolean(downloadingAttachmentId)}
                                  >
                                    {downloadingAttachmentId === message.id ? (
                                      <Loader2 className="size-3.5 animate-spin" />
                                    ) : (
                                      <Download className="size-3.5" />
                                    )}
                                  </Button>
                                )}
                              </div>
                            ))}
                          <div
                            className={`mt-0.5 flex items-center justify-end gap-1 text-[9px] font-medium ${message.direction === "outbound" ? "text-emerald-900/70" : "text-muted-foreground"}`}
                          >
                            {timeOnly(message.at)}
                            {message.direction === "outbound" &&
                              (message.status === "read" ? (
                                <CheckCheck className="size-3.5 text-emerald-700" />
                              ) : message.status === "delivered" ? (
                                <CheckCheck className="size-3.5 text-emerald-700" />
                              ) : (
                                <Check className="size-3.5 text-emerald-700" />
                              ))}
                          </div>
                        </div>
                      </div>
                    </Fragment>
                  );
                })
              )}
            </div>

            <footer className="border-t border-border p-2">
              {selectedFiles.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {selectedFiles.map((file, index) => (
                    <span
                      key={`${file.name}-${file.lastModified}-${index}`}
                      className="flex max-w-full items-center gap-1 rounded-md border border-border bg-surface-muted px-2 py-1 text-xs"
                    >
                      <Paperclip className="size-3 shrink-0 text-muted-foreground" />
                      <span className="max-w-48 truncate">{file.name}</span>
                      <span className="shrink-0 text-muted-foreground">
                        {Math.ceil(file.size / 1024)} KB
                      </span>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="size-5 shrink-0"
                        title={`Remove ${file.name}`}
                        aria-label={`Remove ${file.name}`}
                        onClick={() => removeAttachment(index)}
                        disabled={sending}
                      >
                        <X className="size-3" />
                      </Button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <input
                  ref={attachmentInputRef}
                  type="file"
                  multiple
                  accept="image/*,video/*,.pdf,.xls,.xlsx,.csv,.doc,.docx,.ppt,.pptx,.txt"
                  className="sr-only"
                  onChange={(event) => chooseAttachments(event.target.files)}
                  disabled={sending}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-8 shrink-0"
                  title="Attach files"
                  aria-label="Attach files"
                  onClick={() => attachmentInputRef.current?.click()}
                  disabled={sending}
                >
                  <Paperclip className="size-4" />
                </Button>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-8 shrink-0"
                      title="Add emoji"
                      aria-label="Add emoji"
                      disabled={sending}
                    >
                      <Smile className="size-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-56 p-2">
                    <div className="grid grid-cols-6 gap-1">
                      {COMPOSER_EMOJIS.map((emoji) => (
                        <Button
                          key={emoji}
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="size-8 text-base"
                          onClick={() => addEmoji(emoji)}
                          aria-label={`Add ${emoji}`}
                        >
                          {emoji}
                        </Button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
                <Textarea
                  ref={textareaRef}
                  value={draft}
                  onChange={(event) =>
                    setDrafts((items) => ({ ...items, [activeId]: event.target.value }))
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      send();
                    }
                  }}
                  rows={1}
                  placeholder="Type a message... (Enter to send)"
                  className="max-h-32 min-h-[32px] flex-1 resize-none py-1.5 text-xs"
                  disabled={sending}
                />
                <Button
                  size="sm"
                  onClick={send}
                  disabled={(!draft.trim() && !selectedFiles.length) || sending}
                  aria-label="Send message"
                  className="shrink-0 h-[32px] px-2.5"
                >
                  {sending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Send className="size-3.5" />
                  )}
                </Button>
              </div>
            </footer>
          </section>
        ) : (
          <div className="flex h-full items-center justify-center p-6 bg-slate-50/40">
            <div className="max-w-md w-full text-center flex flex-col items-center p-6 sm:p-8 bg-white rounded-lg border border-slate-200/90 shadow-xs">
              <div className="relative mb-3.5">
                <div className="size-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center ring-4 ring-emerald-500/10">
                  <MessageSquare className="size-6 text-emerald-600" />
                </div>
              </div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">Team WhatsApp Inbox</h3>
              <p className="mt-1 text-xs text-muted-foreground max-w-xs leading-relaxed">
                Select a conversation from the sidebar to view chat history and reply to incoming messages in real-time.
              </p>
              <div className="mt-5 grid grid-cols-2 gap-2 w-full text-left">
                <div className="flex items-center gap-2 p-2 rounded-md bg-slate-50 border border-slate-200/60 text-[11px] text-slate-700">
                  <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <span className="truncate">Live two-way chat</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-md bg-slate-50 border border-slate-200/60 text-[11px] text-slate-700">
                  <span className="size-1.5 rounded-full bg-blue-500 shrink-0" />
                  <span className="truncate">Media & documents</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-md bg-slate-50 border border-slate-200/60 text-[11px] text-slate-700">
                  <span className="size-1.5 rounded-full bg-purple-500 shrink-0" />
                  <span className="truncate">Team assignment</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-md bg-slate-50 border border-slate-200/60 text-[11px] text-slate-700">
                  <span className="size-1.5 rounded-full bg-amber-500 shrink-0" />
                  <span className="truncate">Quick templates</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {active && (
          <aside className="hidden min-h-0 flex-col overflow-y-auto border-l border-border p-2 xl:flex">
            <p className="text-sm font-semibold">
              {active.isGroup ? "Group details" : "Contact details"}
            </p>
            {active.isGroup ? (
              <>
                <p className="mt-2 text-xs text-muted-foreground">
                  {groupDetails?.description || "WhatsApp group conversation"}
                </p>
                <div className="mt-2 rounded-md border border-border bg-surface-muted p-2.5">
                  <p className="text-[11px] font-medium uppercase text-muted-foreground">
                    Group ID
                  </p>
                  <div className="mt-1 flex min-w-0 items-center gap-1">
                    <code
                      title={groupDetails?.groupId ?? active.contactId}
                      className="min-w-0 flex-1 truncate text-xs text-foreground"
                    >
                      {groupDetails?.groupId ?? active.contactId}
                    </code>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-7 shrink-0"
                      title="Copy group ID"
                      aria-label="Copy group ID"
                      onClick={() =>
                        copyIdentifier(groupDetails?.groupId ?? active.contactId, "Group ID")
                      }
                    >
                      <Copy className="size-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <p className="text-sm font-semibold">Members</p>
                  <span className="text-xs text-muted-foreground">
                    {groupDetails?.memberCount ?? active.groupMemberCount ?? 0}
                  </span>
                </div>
                {loadingGroupDetails ? (
                  <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" /> Loading group members...
                  </div>
                ) : groupDetails ? (
                  <div className="mt-2 space-y-1">
                    {groupDetails.metadataWarning && (
                      <p className="rounded-md border border-warning/30 bg-warning/10 p-2 text-xs text-muted-foreground">
                        {groupDetails.metadataWarning}
                      </p>
                    )}
                    {groupDetails.members.map((member) => (
                      <div
                        key={member.jid}
                        className="flex items-start gap-2 rounded-lg border border-border p-2"
                      >
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
                          {initials(member.name || member.phone)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium">
                            {member.name || "WhatsApp user"}
                          </p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {member.phone}
                          </p>
                          <div className="mt-1 flex min-w-0 items-center gap-1">
                            <code
                              title={member.jid}
                              className="min-w-0 flex-1 truncate text-[10px] text-muted-foreground"
                            >
                              {member.jid}
                            </code>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="size-6 shrink-0"
                              title="Copy member JID"
                              aria-label="Copy member JID"
                              onClick={() => copyIdentifier(member.jid, "Member JID")}
                            >
                              <Copy className="size-3" />
                            </Button>
                          </div>
                        </div>
                        {member.role !== "member" && (
                          <span className="ml-auto text-[10px] capitalize text-muted-foreground">
                            {member.role}
                          </span>
                        )}
                      </div>
                    ))}
                    {groupDetails.members.length === 0 && (
                      <p className="py-2 text-xs text-muted-foreground">
                        No member details are available yet.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="mt-2 rounded-md border border-border bg-surface-muted p-2.5 text-xs text-muted-foreground">
                    <p>{groupDetailsError || "Group member details are unavailable."}</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="mt-3"
                      onClick={() => setGroupDetailsRefresh((value) => value + 1)}
                    >
                      Retry
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <dl className="mt-2 grid grid-cols-2 gap-2 rounded-xl border border-border bg-surface-muted/30 p-2 shadow-sm">
                <div className="space-y-1">
                  <dt className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Phone
                  </dt>
                  <dd className="text-xs font-semibold text-foreground truncate">{active.phone}</dd>
                </div>
                <div className="space-y-1">
                  <dt className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Connected number
                  </dt>
                  <dd className="text-xs font-semibold text-foreground truncate">
                    {active.accountName ?? "WhatsApp"}
                  </dd>
                </div>
                <div className="space-y-1">
                  <dt className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Assigned to
                  </dt>
                  <dd className="text-xs font-semibold text-foreground truncate">
                    {active.assignedTo ?? "Unassigned"}
                  </dd>
                </div>
                <div className="space-y-1">
                  <dt className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Type
                  </dt>
                  <dd className="mt-0.5">
                    <StatusBadge status={active.isGroup ? "group" : "active"} />
                  </dd>
                </div>
              </dl>
            )}

            {!active.isGroup && <p className="mt-4 text-sm font-semibold">Labels</p>}
            {!active.isGroup && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {active.labels.map((label) => (
                  <span
                    key={label}
                    className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground"
                  >
                    {label}
                  </span>
                ))}
              </div>
            )}

            <p className="mt-4 text-sm font-semibold">Quick replies</p>
            <div className="mt-1.5 space-y-1.5">
              {templates.slice(0, 4).map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => setDrafts((items) => ({ ...items, [activeId]: template.body }))}
                  className="w-full rounded-lg border border-border px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-surface-muted"
                >
                  <span className="block font-medium">{template.name}</span>
                  <span className="mt-0.5 line-clamp-2 block text-muted-foreground">
                    {template.body}
                  </span>
                </button>
              ))}
            </div>
          </aside>
        )}
      </div>
      <Dialog
        open={Boolean(previewMessage)}
        onOpenChange={(open) => {
          if (!open) setPreviewMessage(null);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-hidden p-3">
          <DialogHeader className="sr-only">
            <DialogTitle>{previewMessage?.attachment?.name || "Image preview"}</DialogTitle>
            <DialogDescription>Full-size attachment preview</DialogDescription>
          </DialogHeader>
          {previewMessage?.attachment && attachmentUrls[previewMessage.id] && (
            <div className="flex max-h-[82vh] flex-col gap-2">
              <img
                src={attachmentUrls[previewMessage.id]}
                alt={previewMessage.attachment.name}
                className="min-h-0 w-full flex-1 rounded-md object-contain"
              />
              <div className="flex items-center justify-between gap-3 px-1">
                <p className="min-w-0 truncate text-sm font-medium">
                  {previewMessage.attachment.name}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void downloadAttachment(previewMessage)}
                  disabled={Boolean(downloadingAttachmentId)}
                >
                  {downloadingAttachmentId === previewMessage.id ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Download className="size-3.5" />
                  )}
                  Download
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
