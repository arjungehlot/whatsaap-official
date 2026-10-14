// Domain types for WAFlow. Mock data + future REST/WebSocket responses share these shapes.

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatarUrl?: string | undefined;
  company: string;
  role: "owner" | "admin" | "agent" | "viewer" | "super_admin";
  accountStatus?: "active" | "suspended" | "deactivated";
  timezone: string;
  plan: PlanId;
}

export type PlanId = "free" | "starter" | "professional" | "business";

export type AdminFeature = {
  id: string;
  key: string;
  name: string;
  description?: string;
  valueType: "boolean" | "number" | "unlimited" | "text";
  active?: boolean;
  displayOrder?: number;
  value?: boolean | number | string;
};
export type AdminPlan = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  monthlyPrice: number;
  yearlyPrice: number;
  currency: string;
  status: "active" | "inactive";
  visibility: "public" | "private";
  popular: boolean;
  isTrial?: boolean;
  trialDays?: number;
  messageCreditsUnlimited?: boolean;
  monthlyMessageCredits?: number;
  dailyMessageCredits?: number;
  trialMessageCredits?: number | null;
  displayOrder: number;
  features: AdminFeature[];
};
export type MessageCreditSummary = {
  unlimited: boolean;
  remaining: number | null;
  timezone: string;
  monthly: { limit: number | null; used: number; remaining: number | null; period: string };
  daily: { limit: number | null; used: number; remaining: number | null; period: string };
  trial: { limit: number | null; used: number; remaining: number | null; period: string | null };
};
export type AdminUser = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: User["role"];
  authProvider?: "local" | "google";
  accountStatus: "active" | "suspended" | "deactivated";
  plan: string;
  planSlug?: string;
  subscriptionStatus: string;
  billingCycle?: "monthly" | "yearly";
  registeredAt?: string;
  planStartDate?: string;
  planExpiryDate?: string;
};
export type AdminHistoryUser = { _id?: string; id?: string; name?: string; email?: string };
export type AdminHistoryPlan = { _id?: string; id?: string; name?: string; slug?: string };
export type AdminSubscription = {
  _id: string;
  userId?: AdminHistoryUser;
  planId?: AdminHistoryPlan;
  planNameSnapshot?: string;
  billingCycle: "monthly" | "yearly";
  status: string;
  startDate?: string;
  expiryDate?: string;
  autoRenew?: boolean;
  isTrial?: boolean;
  amountSnapshot?: number;
  currencySnapshot?: string;
  createdAt?: string;
};
export type AdminPayment = {
  _id: string;
  userId?: AdminHistoryUser;
  planId?: AdminHistoryPlan;
  billingCycle: "monthly" | "yearly";
  status: string;
  amount: number;
  currency: string;
  gateway?: string;
  gatewayTransactionId?: string;
  paymentMethod?: string;
  completedAt?: string;
  createdAt?: string;
  failureReason?: string;
};
export type AdminHistoryPage<T> = { total: number; page: number; limit: number; pages: number };

export type WhatsAppConnectionState =
  | "DISCONNECTED"
  | "CONNECTING"
  | "QR_REQUIRED"
  | "CONNECTED"
  | "DISCONNECTING"
  | "SESSION_EXPIRED"
  | "ERROR";

export interface WhatsAppAccount {
  id: string;
  channelId: string;
  state: WhatsAppConnectionState;
  phone: string;
  connectionError?: string | undefined;
  displayName: string;
  avatarUrl?: string | undefined;
  accountType: "business" | "personal";
  lastConnectedAt: string;
  lastSyncedAt: string;
  uptime: string;
  messagesSentToday: number;
  device: { platform: string; appVersion: string; battery: number };
  sessionStatus: "active" | "stale" | "expired";
  sendSettings?: WhatsAppSendSettings | undefined;
  sendUsage?: WhatsAppSendUsage | undefined;
}

export interface SenderReplacementPreview {
  account: {
    id: string;
    replacementPhone: string;
    replacementIdentity: string;
  };
  apiKeys: Array<{
    id: string;
    label: string;
    previousPhone: string;
    pendingRecipients: number;
  }>;
  campaigns: Array<{
    id: string;
    name: string;
    previousPhone: string;
    pendingRecipients: number;
  }>;
}

export interface ApiKey {
  id: string;
  label: string;
  prefix: string;
  key?: string | undefined;
  defaultAccountId?: string | undefined;
  defaultChannelId?: string | undefined;
  defaultAccountName?: string | undefined;
  defaultAccountPhone?: string | undefined;
  scopes: string[];
  environment: "test" | "live";
  createdAt: string;
  lastUsedAt?: string | undefined;
  revokedAt?: string | undefined;
  requests30d: number;
}

export interface WhatsAppSendSettings {
  hourlyCap: number;
  dailyCap: number;
  warmupHourlyCap: number;
  warmupDailyCap: number;
  minDelayMs: number;
  maxDelayMs: number;
  warmupMinDelayMs: number;
  warmupMaxDelayMs: number;
}

export interface WhatsAppSendUsage {
  lastHour: number;
  last24h: number;
  warmup: boolean;
  hourlyCap: number;
  dailyCap: number;
  hourlyRemaining: number;
  dailyRemaining: number;
  maxHourlyCap: number;
  maxDailyCap: number;
}

export interface ConnectionEvent {
  id: string;
  accountId: string;
  at: string;
  type: "connected" | "disconnected" | "qr" | "error" | "sync";
  label: string;
  detail?: string | undefined;
}

export type ContactStatus = "active" | "inactive" | "blocked";

export interface Contact {
  id: string;
  name: string;
  phone: string;
  email?: string | undefined;
  dateOfBirth?: string | undefined;
  avatarUrl?: string | undefined;
  tags: string[];
  source: "Manual" | "CSV Import" | "Website Form" | "API" | "WhatsApp";
  status: ContactStatus;
  lastContactedAt?: string | undefined;
  createdAt: string;
  notes?: string | undefined;
  customFields?: Record<string, string> | undefined;
}

export type MessageDirection = "inbound" | "outbound";
export type MessageStatus = "pending" | "sent" | "delivered" | "read" | "failed";

export interface Message {
  id: string;
  conversationId: string;
  body: string;
  direction: MessageDirection;
  status: MessageStatus;
  at: string;
  senderJid?: string | undefined;
  senderName?: string | undefined;
  senderPhone?: string | undefined;
  attachment?:
    | { kind: "image" | "video" | "document"; name: string; mimeType?: string; size?: number }
    | undefined;
}

export interface GroupMember {
  jid: string;
  phone: string;
  name: string;
  role: string;
}

export type WebhookStatus = "active" | "paused" | "failing";
export type WebhookDeliveryStatus = "succeeded" | "failed" | "pending";

export interface WebhookEventDefinition {
  id: string;
  label: string;
  group: string;
}

export interface WebhookEndpoint {
  id: string;
  name: string;
  url: string;
  status: WebhookStatus;
  events: string[];
  version: string;
  createdAt: string;
  lastDeliveryAt?: string | undefined;
  successRate: number;
  deliveries24h: number;
  failures24h: number;
  retries: boolean;
  description?: string | undefined;
}

export interface WebhookDelivery {
  id: string;
  endpointId: string;
  event: string;
  status: WebhookDeliveryStatus;
  responseCode: number | null;
  durationMs: number;
  attempt: number;
  at: string;
  requestBody: Record<string, unknown>;
  responseBody: string;
  error?: string | undefined;
}

export interface Conversation {
  id: string;
  accountId?: string | undefined;
  channelId?: string | undefined;
  accountName?: string | undefined;
  contactId: string;
  contactName: string;
  phone: string;
  avatarUrl?: string | undefined;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  online: boolean;
  starred: boolean;
  assignedTo?: string | undefined;
  isGroup: boolean;
  groupSubject?: string | undefined;
  groupMemberCount?: number | undefined;
  labels: string[];
}

export interface InboxGroupDetails {
  conversationId: string;
  groupId: string;
  subject: string;
  description: string;
  memberCount: number;
  members: GroupMember[];
  metadataWarning?: string | undefined;
}

export type CampaignStatus = "draft" | "scheduled" | "running" | "paused" | "completed" | "failed";

export interface Campaign {
  id: string;
  name: string;
  description?: string | undefined;
  status: CampaignStatus;
  accountId?: string | undefined;
  channelId?: string | undefined;
  templateId?: string | undefined;
  audience: string;
  audienceType?: "all" | "tag" | "contacts" | undefined;
  audienceTag?: string | undefined;
  templateName: string;
  templateBody?: string | undefined;
  templateAttachment?: TemplateAttachment | undefined;
  templateAttachments?: TemplateAttachment[] | undefined;
  recipients: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  scheduledAt?: string | undefined;
  timezone?: string | undefined;
  ratePerMinute?: number | undefined;
  lastError?: string | undefined;
  createdAt: string;
}

export type TemplateStatus = "draft" | "active" | "inactive";
export type TemplateAttachmentKind = "image" | "video" | "document";
export interface TemplateAttachment {
  kind: TemplateAttachmentKind;
  name: string;
  mimeType: string;
  size: number;
  bucket?: string | undefined;
  key?: string | undefined;
}

export type TemplateCategory =
  "Marketing" | "Transactional" | "Reminder" | "Welcome" | "Follow-up" | "Other";

export interface Template {
  id: string;
  name: string;
  category: TemplateCategory;
  language: string;
  status: TemplateStatus;
  body: string;
  attachment?: TemplateAttachment | undefined;
  attachments?: TemplateAttachment[] | undefined;
  usageCount: number;
  updatedAt: string;
}

export type MessageJobStatus =
  "scheduled" | "running" | "completed" | "paused" | "cancelled" | "failed";
export interface MessageJob {
  id: string;
  name: string;
  accountId: string;
  channelId?: string | undefined;
  mode: "direct" | "template";
  templateId?: string | undefined;
  templateName?: string | undefined;
  body?: string | undefined;
  recipients: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  status: MessageJobStatus;
  timezone: string;
  scheduledAt?: string | undefined;
  startedAt?: string | undefined;
  completedAt?: string | undefined;
  createdAt?: string | undefined;
  lastError?: string | undefined;
}

export interface MessageJobRecipient {
  id: string;
  contactId: string;
  name: string;
  phone: string;
  body: string;
  status: "pending" | "under_processing" | "sent" | "delivered" | "read" | "failed" | "skipped";
  sentAt?: string | undefined;
  deliveredAt?: string | undefined;
  readAt?: string | undefined;
  error?: string | undefined;
}

export type SchedulerAutomationStatus = "active" | "paused" | "completed" | "failed";
export interface SchedulerAutomation {
  id: string;
  name: string;
  triggerType: "birthday" | "event";
  dateField?: string | undefined;
  eventDate?: string | undefined;
  time: string;
  timezone: string;
  accountId: string;
  channelId?: string | undefined;
  mode: "direct" | "template";
  message?: string | undefined;
  templateId?: string | undefined;
  audienceType: "all" | "tag" | "contacts";
  audienceTag?: string | undefined;
  contactIds?: string[] | undefined;
  status: SchedulerAutomationStatus;
  lastRunAt?: string | undefined;
  lastError?: string | undefined;
}

export interface SchedulerAutomationDetails {
  scheduler: SchedulerAutomation;
  recipients: { id: string; name: string; phone: string; dateOfBirth?: string | undefined }[];
  birthdayReady: { id: string; name: string; phone: string; dateOfBirth?: string | undefined }[];
  missingDateOfBirth: number;
}

export type AutomationStatus = "active" | "paused" | "draft";

export interface Automation {
  id: string;
  name: string;
  description: string;
  trigger: string;
  actions: string[];
  status: AutomationStatus;
  runs: number;
  lastRunAt?: string | undefined;
  successRate: number;
}

export interface MessageLog {
  id: string;
  sentAt: string;
  contactName?: string | undefined;
  phone: string;
  body: string;
  source: "campaign" | "send-message" | "api" | "inbox";
  status: MessageStatus;
  creditDown: number;
  error?: string | undefined;
  deliveredAt?: string | undefined;
  readAt?: string | undefined;
  retryCount: number;
  canCancel?: boolean | undefined;
}

export interface Notification {
  id: string;
  title: string;
  detail: string;
  at: string;
  kind: "success" | "warning" | "info" | "error";
  read: boolean;
}

export interface SeriesPoint {
  label: string;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
}

export interface Analytics {
  range: DateRange;
  totals: {
    sent: number;
    delivered: number;
    read: number;
    failed: number;
    replyRate: number;
    deliveryRate: number;
    readRate: number;
  };
  series: SeriesPoint[];
  responseRate: { label: string; rate: number }[];
  topCampaigns: { name: string; sent: number; delivered: number; readRate: number }[];
  topContacts: { name: string; phone: string; messages: number; lastAt: string }[];
}

export interface DashboardOverview {
  analytics: {
    range: "7d";
    series: { key: string; label: string; sent: number; delivered: number }[];
    totals: {
      sent: number;
      delivered: number;
      read: number;
      failed: number;
      replied: number;
      deliveryRate: number;
      readRate: number;
      replyRate: number;
      failedRate: number;
    };
  };
  activeCampaigns: number;
  totalContacts: number;
  recentCampaigns: Campaign[];
  recentConversations: Conversation[];
}

export type DateRange = "today" | "7d" | "30d" | "90d" | "custom";

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: "Owner" | "Admin" | "Agent" | "Viewer";
  status: "active" | "invited" | "suspended";
  lastActiveAt: string;
}

export interface Plan {
  id: PlanId;
  name: string;
  price: number;
  tagline: string;
  features: string[];
  limits: { contacts: number; messages: number; campaigns: number; automations: number };
}
