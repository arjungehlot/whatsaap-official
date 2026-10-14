/**
 * Frontend service layer.
 *
 * Auth, WhatsApp sessions, inbox, contacts, campaigns and templates call the Node API.
 */
import {
  analyticsFor,
  automations,
  billingUsage,
  currentUser,
  notifications,
  plans,
  teamMembers,
} from "@/mock/data";
import type {
  Analytics,
  ApiKey,
  Automation,
  Campaign,
  ConnectionEvent,
  Contact,
  Conversation,
  DateRange,
  DashboardOverview,
  InboxGroupDetails,
  Message,
  Template,
  User,
  WhatsAppAccount,
  WhatsAppConnectionState,
  WhatsAppSendSettings,
  WebhookDelivery,
  WebhookEndpoint,
  WebhookEventDefinition,
  MessageJob,
  MessageJobRecipient,
  SchedulerAutomation,
  SchedulerAutomationDetails,
  SenderReplacementPreview,
  TemplateAttachment,
} from "@/types";

type CampaignRecipient = {
  contactId: string;
  name: string;
  phone: string;
  status: string;
  body?: string;
  sentAt?: string | null;
  deliveredAt?: string | null;
  readAt?: string | null;
  error?: string | null;
};

const AUTH_KEY = "waflow.session";
const USER_KEY = "waflow.user";
const API_BASE_URL = import.meta.env["VITE_API_BASE_URL"] || "http://localhost:5000/api";

let workspaceRequest: { token: string; promise: Promise<WorkspaceSnapshot> } | null = null;
let workspaceCache: { token: string; data: WorkspaceSnapshot } | null = null;
let sessionRevision = 0;

type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  message?: string;
};

type AuthPayload = {
  user: User;
  token: string;
};

export type WorkspaceSnapshot = {
  user: User;
  subscription: {
    status: string;
    isTrial?: boolean;
    expiryDate?: string;
    planId?: { name?: string; slug?: string };
  } | null;
  features: Record<string, boolean>;
};

type WhatsAppSummary = {
  accounts: WhatsAppAccount[];
  limit: number;
  used: number;
  available: number;
};

type ContactStats = {
  total: number;
  active: number;
  inactive: number;
  blocked: number;
  newThisMonth: number;
};

type ContactList = {
  contacts: Contact[];
  total: number;
  page: number;
  limit: number;
  pages: number;
  tags: string[];
  stats: ContactStats;
};

type ContactPayload = Pick<Contact, "name" | "phone"> &
  Partial<
    Pick<Contact, "email" | "dateOfBirth" | "tags" | "source" | "status" | "notes" | "customFields">
  >;

type TemplatePayload = Pick<Template, "name" | "category" | "language" | "status" | "body"> & {
  attachment?: Template["attachment"] | null;
  attachments?: Template["attachments"] | null;
};

type CampaignPayload = {
  name: string;
  description?: string | undefined;
  accountId?: string | undefined;
  templateId: string;
  audienceType: "all" | "tag" | "contacts";
  audienceTag?: string | undefined;
  contactIds?: string[] | undefined;
  scheduledAt?: string | undefined;
  timezone?: string | undefined;
  sendNow: boolean;
  ratePerMinute: number;
};

type CampaignUpdatePayload = {
  [K in keyof Omit<CampaignPayload, "sendNow" | "scheduledAt">]?: CampaignPayload[K] | undefined;
} & {
  scheduledAt?: string | null | undefined;
  timezone?: string | undefined;
};

type CampaignStreamEvent = {
  type: "connected" | "changed" | "deleted";
  campaignId?: string;
  at: string;
};

function getToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(AUTH_KEY);
}

function setSession(payload: AuthPayload) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AUTH_KEY, payload.token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(payload.user));
  workspaceRequest = null;
  workspaceCache = null;
  sessionRevision += 1;
}

function invalidateWorkspaceSnapshot() {
  workspaceRequest = null;
  workspaceCache = null;
  sessionRevision += 1;
}

function authHeaders(): HeadersInit {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);

  if (!headers.has("Content-Type") && options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  Object.entries(authHeaders()).forEach(([key, value]) => headers.set(key, value));

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    // Workspace data changes frequently; never reuse an HTTP cache entry for it.
    cache: options.cache ?? "no-store",
    headers,
  });

  if (response.status === 401 && typeof window !== "undefined") {
    const isAuthRequest = path === "/auth/login" || path === "/auth/register";
    const isLoginPage = window.location.pathname === "/login";
    if (!isAuthRequest && !isLoginPage) {
      window.localStorage.removeItem(AUTH_KEY);
      window.localStorage.removeItem(USER_KEY);
      window.location.assign("/login?reason=session_expired");
      throw new Error("Your session has expired. Please log in again.");
    }
  }

  if (response.status === 204) return undefined as T;

  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;

  if (!response.ok || !payload?.success) {
    throw new Error(payload?.message || "Request failed");
  }

  return payload.data;
}

export const authService = {
  isAuthenticated(): boolean {
    if (typeof window === "undefined") return false;
    return Boolean(window.localStorage.getItem(AUTH_KEY));
  },
  async login(email: string, password: string): Promise<User> {
    const data = await apiRequest<AuthPayload>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setSession(data);
    return data.user;
  },
  async register(name: string, email: string, password: string): Promise<User> {
    const data = await apiRequest<AuthPayload>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    });
    setSession(data);
    return data.user;
  },
  startGoogleLogin() {
    if (typeof window === "undefined") return;
    window.location.assign(`${API_BASE_URL}/auth/google`);
  },
  async completeGoogleLogin(token: string): Promise<User> {
    if (typeof window === "undefined")
      throw new Error("Google sign-in is only available in a browser");
    window.localStorage.setItem(AUTH_KEY, token);
    invalidateWorkspaceSnapshot();
    try {
      return (await this.workspace()).user;
    } catch (error) {
      window.localStorage.removeItem(AUTH_KEY);
      invalidateWorkspaceSnapshot();
      throw error;
    }
  },
  async me(): Promise<User> {
    return (await this.workspace()).user;
  },
  async workspace(): Promise<WorkspaceSnapshot> {
    const token = getToken();
    if (!token) throw new Error("Authentication required");

    if (workspaceCache?.token === token) {
      return workspaceCache.data;
    }
    if (workspaceRequest?.token === token) return workspaceRequest.promise;

    const promise = apiRequest<WorkspaceSnapshot>("/auth/me")
      .then((data) => {
        if (getToken() === token) {
          window.localStorage.setItem(USER_KEY, JSON.stringify(data.user));
          workspaceCache = { token, data };
        }
        return data;
      })
      .finally(() => {
        if (workspaceRequest?.token === token) workspaceRequest = null;
      });

    workspaceRequest = { token, promise };
    return promise;
  },
  workspaceQueryKey(): number {
    return sessionRevision;
  },
  async requestPasswordReset(_email: string): Promise<void> {
    await delay(700);
  },
  logout() {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(AUTH_KEY);
    window.localStorage.removeItem(USER_KEY);
    invalidateWorkspaceSnapshot();
  },
  currentUser(): User {
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem(USER_KEY);
      if (stored) return JSON.parse(stored) as User;
    }
    return currentUser;
  },
};

export const apiKeyService = {
  async list(): Promise<ApiKey[]> {
    const data = await apiRequest<{ keys: ApiKey[] }>("/api-keys");
    return data.keys;
  },
  async create(payload: {
    label: string;
    environment?: "test" | "live";
    defaultAccountId?: string;
    defaultChannelId?: string;
    scopes?: string[];
  }): Promise<ApiKey> {
    const data = await apiRequest<{ key: ApiKey }>("/api-keys", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return data.key;
  },
  async update(
    id: string,
    payload: { label?: string; defaultAccountId?: string },
  ): Promise<ApiKey> {
    const data = await apiRequest<{ key: ApiKey }>(`/api-keys/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    return data.key;
  },
  async resumeReplacement(id: string): Promise<{ key: ApiKey; resumedRecipients: number }> {
    return apiRequest<{ key: ApiKey; resumedRecipients: number }>(
      `/api-keys/${id}/replacement/resume`,
      {
        method: "POST",
        body: JSON.stringify({ confirm: true }),
      },
    );
  },
  async revoke(id: string): Promise<void> {
    await apiRequest<never>(`/api-keys/${id}`, { method: "DELETE" });
  },
};

export const whatsappService = {
  async getSenderReplacement(accountId: string): Promise<SenderReplacementPreview> {
    return apiRequest<SenderReplacementPreview>(
      `/whatsapp/accounts/${accountId}/sender-replacement`,
    );
  },
  async getAccount(): Promise<WhatsAppAccount> {
    const accounts = await this.getAccounts();
    if (!accounts[0]) throw new Error("No WhatsApp account found");
    return accounts[0];
  },
  async getAccounts(): Promise<WhatsAppAccount[]> {
    const data = await apiRequest<{ accounts: WhatsAppAccount[]; limit: number }>(
      "/whatsapp/accounts",
    );
    return data.accounts;
  },
  async getSummary(): Promise<WhatsAppSummary> {
    return apiRequest<WhatsAppSummary>("/whatsapp/summary");
  },
  async createAccount(
    payload: { displayName?: string } = {},
  ): Promise<{ account: WhatsAppAccount; limit: number }> {
    return apiRequest<{ account: WhatsAppAccount; limit: number }>("/whatsapp/accounts", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  async updateAccount(
    accountId: string,
    payload: { displayName?: string; sendSettings?: Partial<WhatsAppSendSettings> },
  ): Promise<WhatsAppAccount> {
    const data = await apiRequest<{ account: WhatsAppAccount }>(`/whatsapp/accounts/${accountId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    return data.account;
  },
  async getEvents(
    accountId?: string,
    options: { page?: number; limit?: number } = {},
  ): Promise<{
    events: ConnectionEvent[];
    total: number;
    page: number;
    limit: number;
    pages: number;
  }> {
    if (!accountId) {
      const accounts = await this.getAccounts();
      const eventPages = await Promise.all(
        accounts.map((account) => this.getEvents(account.id, options)),
      );
      const events = eventPages.flatMap((result) => result.events);
      return {
        events,
        total: events.length,
        page: options.page ?? 1,
        limit: options.limit ?? 10,
        pages: 1,
      };
    }

    const params = new URLSearchParams({
      page: String(options.page ?? 1),
      limit: String(options.limit ?? 10),
    });
    return apiRequest<{
      events: ConnectionEvent[];
      total: number;
      page: number;
      limit: number;
      pages: number;
    }>(`/whatsapp/accounts/${accountId}/events?${params.toString()}`);
  },
  async startPairing(
    accountId: string,
  ): Promise<{ account: WhatsAppAccount; qrPayload: string; expiresIn: number }> {
    return apiRequest<{ account: WhatsAppAccount; qrPayload: string; expiresIn: number }>(
      `/whatsapp/accounts/${accountId}/pair`,
      { method: "POST" },
    );
  },
  async restartPairing(
    accountId: string,
  ): Promise<{ account: WhatsAppAccount; qrPayload: string; expiresIn: number }> {
    return apiRequest<{ account: WhatsAppAccount; qrPayload: string; expiresIn: number }>(
      `/whatsapp/accounts/${accountId}/restart-pairing`,
      { method: "POST" },
    );
  },
  async disconnect(accountId: string): Promise<WhatsAppAccount> {
    const data = await apiRequest<{ account: WhatsAppAccount }>(
      `/whatsapp/accounts/${accountId}/disconnect`,
      {
        method: "POST",
        body: JSON.stringify({ confirm: true }),
      },
    );
    return data.account;
  },
  async refresh(accountId: string): Promise<WhatsAppAccount> {
    const data = await apiRequest<{ account: WhatsAppAccount }>(
      `/whatsapp/accounts/${accountId}/refresh`,
      {
        method: "POST",
      },
    );
    return data.account;
  },
  async transition(to: WhatsAppConnectionState): Promise<WhatsAppConnectionState> {
    await delay(500);
    return to;
  },
};

export const contactService = {
  async list(
    filters: { search?: string; tag?: string; status?: string; page?: number; limit?: number } = {},
  ): Promise<ContactList> {
    const params = new URLSearchParams();
    if (filters.search?.trim()) params.set("search", filters.search.trim());
    if (filters.tag && filters.tag !== "all") params.set("tag", filters.tag);
    if (filters.status && filters.status !== "all") params.set("status", filters.status);
    if (filters.page) params.set("page", String(filters.page));
    if (filters.limit) params.set("limit", String(filters.limit));
    const qs = params.toString();
    return apiRequest<ContactList>(`/contacts${qs ? `?${qs}` : ""}`);
  },
  async get(id: string): Promise<Contact> {
    const data = await apiRequest<{ contact: Contact }>(`/contacts/${id}`);
    return data.contact;
  },
  async create(payload: ContactPayload): Promise<Contact> {
    const data = await apiRequest<{ contact: Contact }>("/contacts", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return data.contact;
  },
  async update(id: string, payload: Partial<ContactPayload>): Promise<Contact> {
    const data = await apiRequest<{ contact: Contact }>(`/contacts/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    return data.contact;
  },
  async delete(id: string): Promise<void> {
    await apiRequest<never>(`/contacts/${id}`, { method: "DELETE" });
  },
  async bulkDelete(ids: string[]): Promise<{ deleted: number }> {
    return apiRequest<{ deleted: number }>("/contacts", {
      method: "DELETE",
      body: JSON.stringify({ ids }),
    });
  },
  async importFile(file: File): Promise<{
    total: number;
    created: number;
    updated: number;
    skipped: number;
    errors: { row: number; message: string }[];
  }> {
    const formData = new FormData();
    formData.append("file", file);
    return apiRequest("/contacts/import", {
      method: "POST",
      body: formData,
    });
  },
  async downloadImportTemplate(): Promise<Blob> {
    const response = await fetch(`${API_BASE_URL}/contacts/import-template`, {
      headers: authHeaders(),
    });
    if (!response.ok) throw new Error("Unable to download the contact template");
    return response.blob();
  },
  async stats(): Promise<ContactStats> {
    const data = await this.list({ limit: 1 });
    return data.stats;
  },
};

export const webhookService = {
  async list(): Promise<{ endpoints: WebhookEndpoint[]; events: WebhookEventDefinition[] }> {
    return apiRequest<{ endpoints: WebhookEndpoint[]; events: WebhookEventDefinition[] }>(
      "/webhooks",
    );
  },
  async deliveries(endpointId: string): Promise<{ deliveries: WebhookDelivery[] }> {
    return apiRequest<{ deliveries: WebhookDelivery[] }>(`/webhooks/${endpointId}/deliveries`);
  },
  async create(payload: {
    name: string;
    url: string;
    description?: string;
    events: string[];
    retries: boolean;
  }): Promise<WebhookEndpoint> {
    const data = await apiRequest<{ endpoint: WebhookEndpoint }>("/webhooks", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return data.endpoint;
  },
  async update(
    id: string,
    payload: Partial<{
      name: string;
      url: string;
      description: string;
      events: string[];
      retries: boolean;
      status: "active" | "paused";
    }>,
  ): Promise<WebhookEndpoint> {
    const data = await apiRequest<{ endpoint: WebhookEndpoint }>(`/webhooks/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    return data.endpoint;
  },
  async remove(id: string): Promise<void> {
    await apiRequest<void>(`/webhooks/${id}`, { method: "DELETE" });
  },
  async test(id: string): Promise<WebhookDelivery> {
    const data = await apiRequest<{ delivery: WebhookDelivery }>(`/webhooks/${id}/test`, {
      method: "POST",
    });
    return data.delivery;
  },
  async replay(deliveryId: string): Promise<WebhookDelivery> {
    const data = await apiRequest<{ delivery: WebhookDelivery }>(
      `/webhooks/deliveries/${deliveryId}/replay`,
      { method: "POST" },
    );
    return data.delivery;
  },
};

export const messageService = {
  async conversations(
    filters: {
      filter?: "all" | "unread" | "assigned" | "starred";
      view?: "personal" | "groups";
      search?: string;
      cursor?: string | null;
      limit?: number;
    } = {},
  ): Promise<{ conversations: Conversation[]; nextCursor: string | null }> {
    const params = new URLSearchParams();
    if (filters.filter && filters.filter !== "all") params.set("filter", filters.filter);
    if (filters.view && filters.view !== "personal") params.set("view", filters.view);
    if (filters.search?.trim()) params.set("search", filters.search.trim());
    if (filters.cursor) params.set("cursor", filters.cursor);
    if (filters.limit) params.set("limit", String(filters.limit));

    const qs = params.toString();
    return apiRequest<{ conversations: Conversation[]; nextCursor: string | null }>(
      `/inbox/conversations${qs ? `?${qs}` : ""}`,
    );
  },
  async messages(
    conversationId: string,
    filters: { before?: string | null; limit?: number } = {},
  ): Promise<{ messages: Message[]; nextCursor: string | null }> {
    const params = new URLSearchParams();
    if (filters.before) params.set("before", filters.before);
    if (filters.limit) params.set("limit", String(filters.limit));

    const qs = params.toString();
    return apiRequest<{ messages: Message[]; nextCursor: string | null }>(
      `/inbox/conversations/${conversationId}/messages${qs ? `?${qs}` : ""}`,
    );
  },
  async groupDetails(conversationId: string): Promise<InboxGroupDetails> {
    const data = await apiRequest<{ group: InboxGroupDetails }>(
      `/inbox/conversations/${conversationId}/group-details`,
    );
    return data.group;
  },
  async downloadAttachment(messageId: string): Promise<{ blob: Blob; fileName: string }> {
    const response = await fetch(`${API_BASE_URL}/inbox/messages/${messageId}/attachment`, {
      cache: "no-store",
      headers: authHeaders(),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as ApiEnvelope<unknown> | null;
      throw new Error(payload?.message || "Could not download this attachment");
    }
    const disposition = response.headers.get("content-disposition") || "";
    const fileName = /filename="?([^";]+)"?/i.exec(disposition)?.[1] || "attachment";
    return { blob: await response.blob(), fileName };
  },
  async uploadInboxAttachments(files: File[]): Promise<TemplateAttachment[]> {
    const form = new FormData();
    files.forEach((file) => form.append("files", file));
    const data = await apiRequest<{ attachments: TemplateAttachment[] }>("/inbox/attachments", {
      method: "POST",
      body: form,
    });
    return data.attachments;
  },
  async send(
    conversationId: string,
    body: string,
    attachments: TemplateAttachment[] = [],
  ): Promise<Message[]> {
    const data = await apiRequest<{ message: Message; messages?: Message[] }>(
      `/inbox/conversations/${conversationId}/messages`,
      {
        method: "POST",
        body: JSON.stringify({ body, ...(attachments.length ? { attachments } : {}) }),
      },
    );
    return data.messages?.length ? data.messages : [data.message];
  },
};

export const messageLogService = {
  async list(
    filters: {
      page?: number;
      limit?: number;
      search?: string;
      source?: "campaign" | "send-message" | "api" | "inbox" | "all";
      status?: "pending" | "sent" | "delivered" | "read" | "failed" | "all";
    } = {},
  ) {
    const params = new URLSearchParams();
    if (filters.page) params.set("page", String(filters.page));
    if (filters.limit) params.set("limit", String(filters.limit));
    if (filters.search?.trim()) params.set("search", filters.search.trim());
    if (filters.source && filters.source !== "all") params.set("source", filters.source);
    if (filters.status && filters.status !== "all") params.set("status", filters.status);
    const qs = params.toString();
    return apiRequest<{
      logs: import("@/types").MessageLog[];
      total: number;
      page: number;
      limit: number;
      pages: number;
    }>(`/message-logs${qs ? `?${qs}` : ""}`);
  },
  async retry(id: string) {
    return apiRequest(`/message-logs/${id}/retry`, { method: "POST" });
  },
  async cancelPending(ids: string[]): Promise<{ cancelled: number; skipped: number }> {
    return apiRequest<{ cancelled: number; skipped: number }>("/message-logs/bulk-cancel", {
      method: "POST",
      body: JSON.stringify({ ids }),
    });
  },
};

export const campaignService = {
  async list(filters: { search?: string; status?: string } = {}): Promise<Campaign[]> {
    const params = new URLSearchParams();
    if (filters.search?.trim()) params.set("search", filters.search.trim());
    if (filters.status && filters.status !== "all") params.set("status", filters.status);
    const qs = params.toString();
    const data = await apiRequest<{ campaigns: Campaign[] }>(`/campaigns${qs ? `?${qs}` : ""}`);
    return data.campaigns;
  },
  async get(id: string): Promise<Campaign> {
    const data = await apiRequest<{ campaign: Campaign }>(`/campaigns/${id}`);
    return data.campaign;
  },
  async create(payload: CampaignPayload): Promise<Campaign> {
    const data = await apiRequest<{ campaign: Campaign }>("/campaigns", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return data.campaign;
  },
  async update(id: string, payload: CampaignUpdatePayload): Promise<Campaign> {
    const data = await apiRequest<{ campaign: Campaign }>(`/campaigns/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    return data.campaign;
  },
  async rerun(id: string): Promise<Campaign> {
    const data = await apiRequest<{ campaign: Campaign }>(`/campaigns/${id}/rerun`, {
      method: "POST",
    });
    return data.campaign;
  },
  async resumeReplacement(id: string): Promise<Campaign> {
    const data = await apiRequest<{ campaign: Campaign }>(`/campaigns/${id}/replacement/resume`, {
      method: "POST",
      body: JSON.stringify({ confirm: true }),
    });
    return data.campaign;
  },
  async updateStatus(
    id: string,
    status: "running" | "paused" | "scheduled" | "draft",
    scheduledAt?: string,
  ): Promise<Campaign> {
    const data = await apiRequest<{ campaign: Campaign }>(`/campaigns/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, scheduledAt }),
    });
    return data.campaign;
  },
  async delete(id: string): Promise<void> {
    await apiRequest<never>(`/campaigns/${id}`, { method: "DELETE" });
  },
  async recipients(id: string): Promise<CampaignRecipient[]> {
    const data = await apiRequest<{ recipients: CampaignRecipient[] }>(
      `/campaigns/${id}/recipients`,
    );
    return data.recipients;
  },
  subscribe(
    onEvent: (event: CampaignStreamEvent) => void,
    onError?: (error: Error) => void,
  ): () => void {
    const controller = new AbortController();
    let cancelled = false;

    async function connect() {
      try {
        const response = await fetch(`${API_BASE_URL}/campaigns/stream`, {
          headers: authHeaders(),
          signal: controller.signal,
        });
        if (!response.ok || !response.body)
          throw new Error("Unable to open campaign update stream");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (!cancelled) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";

          for (const part of parts) {
            const dataLine = part.split("\n").find((line) => line.startsWith("data: "));
            if (!dataLine) continue;
            onEvent(JSON.parse(dataLine.slice(6)) as CampaignStreamEvent);
          }
        }
      } catch (error) {
        if (!cancelled)
          onError?.(error instanceof Error ? error : new Error("Campaign update stream failed"));
      }
    }

    connect();
    return () => {
      cancelled = true;
      controller.abort();
    };
  },
};

export const messageJobService = {
  async list(status = "all"): Promise<MessageJob[]> {
    const qs = status !== "all" ? `?status=${encodeURIComponent(status)}` : "";
    const data = await apiRequest<{ jobs: MessageJob[] }>(`/message-jobs${qs}`);
    return data.jobs;
  },
  async create(payload: Record<string, unknown>): Promise<MessageJob> {
    const data = await apiRequest<{ job: MessageJob }>("/message-jobs", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return data.job;
  },
  async recipients(id: string): Promise<MessageJobRecipient[]> {
    const data = await apiRequest<{ recipients: MessageJobRecipient[] }>(
      `/message-jobs/${id}/recipients`,
    );
    return data.recipients;
  },
  async updateStatus(id: string, status: "running" | "paused" | "cancelled"): Promise<MessageJob> {
    const data = await apiRequest<{ job: MessageJob }>(`/message-jobs/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    return data.job;
  },
  async removeRecipient(
    id: string,
    recipientId: string,
  ): Promise<{ job: MessageJob; recipient: MessageJobRecipient }> {
    const data = await apiRequest<{ job: MessageJob; recipient: MessageJobRecipient }>(
      `/message-jobs/${id}/recipients/${recipientId}`,
      { method: "DELETE" },
    );
    return data;
  },
  async remove(id: string): Promise<void> {
    await apiRequest(`/message-jobs/${id}`, { method: "DELETE" });
  },
};

export const automationService = {
  async list(): Promise<SchedulerAutomation[]> {
    const data = await apiRequest<{ automations: SchedulerAutomation[] }>("/automations");
    return data.automations;
  },
  async create(payload: Record<string, unknown>): Promise<SchedulerAutomation> {
    const data = await apiRequest<{ automation: SchedulerAutomation }>("/automations", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return data.automation;
  },
  async updateStatus(id: string, status: "active" | "paused"): Promise<SchedulerAutomation> {
    const data = await apiRequest<{ automation: SchedulerAutomation }>(
      `/automations/${id}/status`,
      { method: "PATCH", body: JSON.stringify({ status }) },
    );
    return data.automation;
  },
  async details(id: string): Promise<SchedulerAutomationDetails> {
    const data = await apiRequest<SchedulerAutomationDetails>(`/automations/${id}/details`);
    return data;
  },
};

export const templateService = {
  async list(
    filters: { search?: string; category?: string; status?: string } = {},
  ): Promise<Template[]> {
    const params = new URLSearchParams();
    if (filters.search?.trim()) params.set("search", filters.search.trim());
    if (filters.category && filters.category !== "all") params.set("category", filters.category);
    if (filters.status && filters.status !== "all") params.set("status", filters.status);
    const qs = params.toString();
    const data = await apiRequest<{ templates: Template[] }>(`/templates${qs ? `?${qs}` : ""}`);
    return data.templates;
  },
  async get(id: string): Promise<Template> {
    const data = await apiRequest<{ template: Template }>(`/templates/${id}`);
    return data.template;
  },
  async create(payload: TemplatePayload): Promise<Template> {
    const data = await apiRequest<{ template: Template }>("/templates", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return data.template;
  },
  async update(id: string, payload: Partial<TemplatePayload>): Promise<Template> {
    const data = await apiRequest<{ template: Template }>(`/templates/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    return data.template;
  },
  async duplicate(id: string, name?: string): Promise<Template> {
    const data = await apiRequest<{ template: Template }>(`/templates/${id}/duplicate`, {
      method: "POST",
      body: JSON.stringify(name ? { name } : {}),
    });
    return data.template;
  },
  async delete(id: string): Promise<void> {
    await apiRequest<never>(`/templates/${id}`, { method: "DELETE" });
  },
  async uploadAttachment(file: File): Promise<NonNullable<Template["attachment"]>> {
    const formData = new FormData();
    formData.append("file", file);
    const data = await apiRequest<{ attachment: NonNullable<Template["attachment"]> }>(
      "/templates/attachments",
      {
        method: "POST",
        body: formData,
      },
    );
    return data.attachment;
  },
};

// Kept for older consumers that still render the mock analytics view.
export const legacyAutomationService = {
  async list(): Promise<Automation[]> {
    await delay(180);
    return automations;
  },
};

export const analyticsService = {
  async get(range: DateRange): Promise<Analytics> {
    await delay(220);
    return analyticsFor(range);
  },
};

export const dashboardService = {
  async overview(): Promise<DashboardOverview> {
    return apiRequest<DashboardOverview>("/dashboard/overview");
  },
};

export const billingService = {
  async summary() {
    const data = await apiRequest<{ plans: import("@/types").AdminPlan[] }>("/billing/plans");
    const current = authService.isAuthenticated()
      ? await authService.workspace().catch(() => ({ subscription: null }))
      : { subscription: null };
    return {
      usage: billingUsage,
      plans: data.plans,
      subscription: current.subscription,
      currentPlan: current.subscription?.planId?.slug || currentUser.plan,
    };
  },
  async checkoutPreview(planId: string, billingCycle: "monthly" | "yearly") {
    return apiRequest<{
      planId: string;
      planName: string;
      billingCycle: "monthly" | "yearly";
      currency: string;
      isUpgrade: boolean;
      currentPlanName: string | null;
      baseAmount: number;
      prorationCredit: number;
      taxableAmount: number;
      gstRate: number;
      gstAmount: number;
      amountDue: number;
    }>("/billing/checkout/preview", {
      method: "POST",
      body: JSON.stringify({ planId, billingCycle }),
    });
  },
  async checkout(planId: string, billingCycle: "monthly" | "yearly", phone: string) {
    return apiRequest<{
      paymentId: string;
      completed: boolean;
      quote: { amountDue: number };
      gateway?: "razorpay" | "payu" | "manual";
      keyId?: string;
      orderId?: string;
      amount?: number;
      currency?: string;
      name?: string;
      description?: string;
      prefill?: {
        name?: string;
        email?: string;
        contact?: string;
      };
      theme?: {
        color?: string;
      };
      action?: string;
      fields?: Record<string, string>;
    }>("/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ planId, billingCycle, phone }),
    });
  },
  async verifyRazorpayPayment(payload: {
    paymentId?: string;
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) {
    return apiRequest<{ payment: unknown }>("/billing/razorpay/verify", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  async current() {
    const workspace = await authService.workspace();
    return { subscription: workspace.subscription };
  },
  async entitlements() {
    const workspace = await authService.workspace();
    return {
      subscription: workspace.subscription,
      features: workspace.features,
    };
  },
  async credits() {
    return apiRequest<import("@/types").MessageCreditSummary>("/billing/credits");
  },
};

export const adminService = {
  async users(params: { page?: number; search?: string; accountStatus?: string } = {}) {
    const query = new URLSearchParams({ page: String(params.page || 1), limit: "25" });
    if (params.search) query.set("search", params.search);
    if (params.accountStatus) query.set("accountStatus", params.accountStatus);
    return apiRequest<{
      users: import("@/types").AdminUser[];
      total: number;
      page: number;
      pages: number;
    }>(`/admin/users?${query}`);
  },
  async plans() {
    return (await apiRequest<{ plans: import("@/types").AdminPlan[] }>("/admin/plans")).plans;
  },
  async features() {
    return (await apiRequest<{ features: import("@/types").AdminFeature[] }>("/admin/features"))
      .features;
  },
  async createFeature(payload: {
    key: string;
    name: string;
    description?: string;
    valueType: import("@/types").AdminFeature["valueType"];
  }) {
    return apiRequest<import("@/types").AdminFeature>("/admin/features", {
      method: "POST",
      body: JSON.stringify({ ...payload, active: true, displayOrder: 0 }),
    });
  },
  async updateFeature(id: string, payload: Record<string, unknown>) {
    return apiRequest<import("@/types").AdminFeature>(`/admin/features/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },
  async deleteFeature(id: string) {
    return apiRequest(`/admin/features/${id}`, { method: "DELETE" });
  },
  async updatePlan(id: string, payload: Record<string, unknown>) {
    return apiRequest<import("@/types").AdminPlan>(`/admin/plans/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },
  async createPlan(payload: {
    name: string;
    slug: string;
    monthlyPrice: number;
    yearlyPrice: number;
    isTrial?: boolean;
    trialDays?: number;
    messageCreditsUnlimited: boolean;
    monthlyMessageCredits: number;
    dailyMessageCredits: number;
    features?: Array<{
      featureId: string;
      valueType: import("@/types").AdminFeature["valueType"];
      booleanValue?: boolean;
      numberValue?: number;
      textValue?: string;
    }>;
  }) {
    return apiRequest<import("@/types").AdminPlan>("/admin/plans", {
      method: "POST",
      body: JSON.stringify({
        ...payload,
        currency: "INR",
        description: "",
        status: "active",
        visibility: "public",
        popular: false,
        displayOrder: 0,
        features: payload.features || [],
      }),
    });
  },
  async updateUserStatus(id: string, accountStatus: import("@/types").AdminUser["accountStatus"]) {
    return apiRequest(`/admin/users/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ accountStatus }),
    });
  },
  async assignUserPlan(id: string, planId: string, billingCycle: "monthly" | "yearly" = "monthly") {
    return apiRequest(`/admin/users/${id}/plan`, {
      method: "PATCH",
      body: JSON.stringify({ planId, billingCycle, autoRenew: false }),
    });
  },
  async updateUserExpiry(id: string, expiryDate: string) {
    return apiRequest(`/admin/users/${id}/expiry`, {
      method: "PATCH",
      body: JSON.stringify({ expiryDate }),
    });
  },
  async deleteUser(id: string, confirmation: string) {
    return apiRequest(`/admin/users/${id}`, {
      method: "DELETE",
      body: JSON.stringify({ confirmation }),
    });
  },
  async duplicatePlan(id: string) {
    return apiRequest<import("@/types").AdminPlan>(`/admin/plans/${id}/duplicate`, {
      method: "POST",
      body: JSON.stringify({}),
    });
  },
  async reorderPlans(planIds: string[]) {
    const data = await apiRequest<{ plans: import("@/types").AdminPlan[] }>(
      "/admin/plans/reorder",
      {
        method: "POST",
        body: JSON.stringify({ planIds }),
      },
    );
    return data.plans;
  },
  async subscriptions(params: { page?: number; limit?: number; status?: string } = {}) {
    const query = new URLSearchParams({
      page: String(params.page || 1),
      limit: String(params.limit || 25),
    });
    if (params.status) query.set("status", params.status);
    return apiRequest<
      import("@/types").AdminHistoryPage<import("@/types").AdminSubscription> & {
        subscriptions: import("@/types").AdminSubscription[];
      }
    >(`/admin/subscriptions?${query}`);
  },
  async payments(params: { page?: number; limit?: number; status?: string } = {}) {
    const query = new URLSearchParams({
      page: String(params.page || 1),
      limit: String(params.limit || 25),
    });
    if (params.status) query.set("status", params.status);
    return apiRequest<
      import("@/types").AdminHistoryPage<import("@/types").AdminPayment> & {
        payments: import("@/types").AdminPayment[];
      }
    >(`/admin/payments?${query}`);
  },
};

export const settingsService = {
  async team() {
    await delay(180);
    return teamMembers;
  },
  async notifications() {
    await delay(120);
    return notifications;
  },
  maskedApiKey: "wa_live_••••••••••••••••••••••••9f2c",
};

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
