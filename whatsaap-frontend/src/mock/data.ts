import type {
  Analytics,
  Automation,
  Campaign,
  ConnectionEvent,
  Contact,
  Conversation,
  Message,
  MessageLog,
  Notification,
  Plan,
  Template,
  TeamMember,
  User,
  WhatsAppAccount,
} from "@/types";

export const currentUser: User = {
  id: "usr_1",
  name: "Kashif Ahmad",
  email: "kashif@brightretail.in",
  company: "Bright Retail Pvt Ltd",
  role: "owner",
  timezone: "Asia/Kolkata",
  plan: "professional",
};

export const WHATSAPP_SESSION_LIMIT = 5;

export const whatsappAccounts: WhatsAppAccount[] = [
  {
    id: "wa_1",
    state: "CONNECTED",
    phone: "+91 98765 43210",
    displayName: "Bright Retail Support",
    accountType: "business",
    lastConnectedAt: "2026-08-16T09:12:00+05:30",
    lastSyncedAt: "2026-08-18T11:18:00+05:30",
    uptime: "2d 4h 12m",
    messagesSentToday: 482,
    device: { platform: "Android 14", appVersion: "2.24.18.79", battery: 78 },
    sessionStatus: "active",
  },
  {
    id: "wa_2",
    state: "CONNECTED",
    phone: "+91 98111 24567",
    displayName: "Bright Retail Orders",
    accountType: "business",
    lastConnectedAt: "2026-08-15T14:40:00+05:30",
    lastSyncedAt: "2026-08-18T11:12:00+05:30",
    uptime: "3d 1h 09m",
    messagesSentToday: 316,
    device: { platform: "iPhone 15", appVersion: "24.17.78", battery: 64 },
    sessionStatus: "active",
  },
  {
    id: "wa_3",
    state: "DISCONNECTED",
    phone: "+91 98989 11223",
    displayName: "Bright Retail Returns",
    accountType: "business",
    lastConnectedAt: "2026-08-12T10:10:00+05:30",
    lastSyncedAt: "2026-08-17T16:32:00+05:30",
    uptime: "0m",
    messagesSentToday: 0,
    device: { platform: "Android 13", appVersion: "2.24.17.81", battery: 19 },
    sessionStatus: "stale",
  },
];

export const whatsappAccount = whatsappAccounts[0]!;

export const connectionEvents: ConnectionEvent[] = [
  {
    id: "ce_1",
    accountId: "wa_1",
    at: "2026-08-18T11:18:00+05:30",
    type: "sync",
    label: "Session synced",
    detail: "482 messages queued for delivery",
  },
  {
    id: "ce_2",
    accountId: "wa_1",
    at: "2026-08-17T21:04:00+05:30",
    type: "connected",
    label: "Connection restored",
    detail: "Reconnected automatically after network change",
  },
  {
    id: "ce_3",
    accountId: "wa_1",
    at: "2026-08-17T20:58:00+05:30",
    type: "error",
    label: "Connection interrupted",
    detail: "Phone lost internet connectivity",
  },
  {
    id: "ce_4",
    accountId: "wa_1",
    at: "2026-08-16T09:12:00+05:30",
    type: "qr",
    label: "Device linked via QR",
    detail: "Linked from Chrome on macOS",
  },
  {
    id: "ce_5",
    accountId: "wa_2",
    at: "2026-08-18T11:12:00+05:30",
    type: "sync",
    label: "Session synced",
    detail: "316 outbound messages delivered across catalog flows",
  },
  {
    id: "ce_6",
    accountId: "wa_2",
    at: "2026-08-18T09:45:00+05:30",
    type: "connected",
    label: "Device healthy",
    detail: "Heartbeat refreshed after background reconnect",
  },
  {
    id: "ce_7",
    accountId: "wa_3",
    at: "2026-08-18T08:30:00+05:30",
    type: "disconnected",
    label: "Session offline",
    detail: "This number needs to be linked again before sends resume",
  },
  {
    id: "ce_8",
    accountId: "wa_3",
    at: "2026-08-12T10:10:00+05:30",
    type: "qr",
    label: "Device linked via QR",
    detail: "Linked from Edge on Windows",
  },
];

const tagPool = [
  "VIP",
  "Lead",
  "Customer",
  "Wholesale",
  "Newsletter",
  "Support",
  "Abandoned Cart",
  "Festival 2026",
];

const firstNames = [
  "Aarav",
  "Diya",
  "Vihaan",
  "Ananya",
  "Rohan",
  "Isha",
  "Kabir",
  "Meera",
  "Arjun",
  "Sneha",
  "Rahul",
  "Priya",
  "Aditya",
  "Nisha",
  "Farhan",
  "Kavya",
  "Manav",
  "Tanvi",
  "Yash",
  "Riya",
  "Imran",
  "Pooja",
  "Devansh",
  "Sara",
];
const lastNames = [
  "Sharma",
  "Iyer",
  "Patel",
  "Nair",
  "Verma",
  "Khan",
  "Reddy",
  "Bose",
  "Chopra",
  "Mehta",
  "Joshi",
  "Rao",
];

function phoneFor(i: number) {
  const base = 9812340000 + i * 137;
  const s = String(base);
  return `+91 ${s.slice(0, 5)} ${s.slice(5)}`;
}

function isoDaysAgo(days: number, hour = 10) {
  const d = new Date(Date.UTC(2026, 7, 18, hour, 24));
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

export const contacts: Contact[] = Array.from({ length: 48 }, (_, i) => {
  const name = `${firstNames[i % firstNames.length]} ${lastNames[i % lastNames.length]}`;
  const status = i % 17 === 0 ? "blocked" : i % 7 === 0 ? "inactive" : "active";
  return {
    id: `ct_${i + 1}`,
    name,
    phone: phoneFor(i),
    email: `${name.split(" ")[0]!.toLowerCase()}.${name.split(" ")[1]!.toLowerCase()}@example.com`,
    tags: [tagPool[i % tagPool.length]!, ...(i % 3 === 0 ? [tagPool[(i + 3) % tagPool.length]!] : [])],
    source: (["Manual", "CSV Import", "Website Form", "API", "WhatsApp"] as const)[i % 5]!,
    status: status as Contact["status"],
    lastContactedAt: isoDaysAgo(i % 21, 9),
    createdAt: isoDaysAgo(30 + (i % 90), 8),
    notes:
      i % 4 === 0
        ? "Prefers messages after 6 PM. Interested in bulk pricing for Diwali."
        : undefined,
    customFields: {
      City: ["Mumbai", "Bengaluru", "Delhi", "Pune", "Hyderabad"][i % 5]!,
      "Lifetime Value": `₹${(4200 + i * 315).toLocaleString("en-IN")}`,
    },
  };
});

export const contactStats = {
  total: 12540,
  active: 10421,
  newThisMonth: 1248,
  blocked: 82,
};

export const conversations: Conversation[] = contacts.slice(0, 14).map((c, i) => ({
  id: `cv_${i + 1}`,
  contactId: c.id,
  contactName: i === 5 ? "Wholesale Buyers (Group)" : c.name,
  phone: c.phone,
  lastMessage: [
    "Is the offer still valid today?",
    "Thanks! Order received 🙏",
    "Can you share the catalogue?",
    "I need help with my payment",
    "Please cancel my order",
    "When is the next restock?",
    "Perfect, see you tomorrow",
  ][i % 7]!,
  lastMessageAt: isoDaysAgo(i === 0 ? 0 : i % 4, 12 - (i % 6)),
  unreadCount: i < 4 ? (i % 3) + 1 : 0,
  online: i % 3 === 0,
  starred: i % 5 === 0,
  assignedTo: i % 4 === 0 ? "Kashif Ahmad" : i % 4 === 1 ? "Sneha Rao" : undefined,
  isGroup: i === 5,
  labels: [tagPool[i % tagPool.length]!],
}));

export const messagesByConversation: Record<string, Message[]> = Object.fromEntries(
  conversations.map((cv, ci) => [
    cv.id,
    [
      {
        id: `${cv.id}_m1`,
        conversationId: cv.id,
        body: "Hi! I saw your Instagram post about the monsoon sale.",
        direction: "inbound" as const,
        status: "read" as const,
        at: isoDaysAgo(1, 9),
      },
      {
        id: `${cv.id}_m2`,
        conversationId: cv.id,
        body: `Hello ${cv.contactName.split(" ")[0]}! 👋 Yes, the monsoon sale is live until Sunday. Flat 25% off on all rainwear.`,
        direction: "outbound" as const,
        status: "read" as const,
        at: isoDaysAgo(1, 10),
      },
      {
        id: `${cv.id}_m3`,
        conversationId: cv.id,
        body: "Could you share the catalogue please?",
        direction: "inbound" as const,
        status: "read" as const,
        at: isoDaysAgo(1, 11),
      },
      {
        id: `${cv.id}_m4`,
        conversationId: cv.id,
        body: "Sure — here is our latest catalogue.",
        direction: "outbound" as const,
        status: "delivered" as const,
        at: isoDaysAgo(0, 9),
        attachment: { kind: "document" as const, name: "monsoon-catalogue-2026.pdf" },
      },
      {
        id: `${cv.id}_m5`,
        conversationId: cv.id,
        body: cv.lastMessage,
        direction: ci % 2 === 0 ? ("inbound" as const) : ("outbound" as const),
        status: ci % 2 === 0 ? ("read" as const) : ("sent" as const),
        at: cv.lastMessageAt,
      },
    ],
  ]),
);

export const campaigns: Campaign[] = [
  {
    id: "cp_1",
    name: "Summer Sale Blast",
    description: "Flat 25% off across rainwear and accessories.",
    status: "running",
    audience: "All Contacts",
    templateName: "Summer Sale Promo",
    recipients: 2500,
    sent: 1840,
    delivered: 1782,
    read: 1204,
    failed: 58,
    scheduledAt: isoDaysAgo(0, 4),
    createdAt: isoDaysAgo(2, 6),
  },
  {
    id: "cp_2",
    name: "Product Launch — AeroLite",
    status: "completed",
    audience: "Segment: Repeat Buyers",
    templateName: "Launch Announcement",
    recipients: 5000,
    sent: 5000,
    delivered: 4881,
    read: 3620,
    failed: 119,
    scheduledAt: isoDaysAgo(9, 5),
    createdAt: isoDaysAgo(12, 7),
  },
  {
    id: "cp_3",
    name: "Festival Offer 2026",
    status: "scheduled",
    audience: "Tag: Festival 2026",
    templateName: "Festival Greeting",
    recipients: 1250,
    sent: 0,
    delivered: 0,
    read: 0,
    failed: 0,
    scheduledAt: isoDaysAgo(-3, 5),
    createdAt: isoDaysAgo(1, 9),
  },
  {
    id: "cp_4",
    name: "Abandoned Cart Recovery",
    status: "paused",
    audience: "Tag: Abandoned Cart",
    templateName: "Cart Reminder",
    recipients: 860,
    sent: 410,
    delivered: 396,
    read: 221,
    failed: 14,
    createdAt: isoDaysAgo(5, 11),
  },
  {
    id: "cp_5",
    name: "Wholesale Price List Q3",
    status: "draft",
    audience: "Segment: Wholesale",
    templateName: "Price List",
    recipients: 340,
    sent: 0,
    delivered: 0,
    read: 0,
    failed: 0,
    createdAt: isoDaysAgo(3, 15),
  },
  {
    id: "cp_6",
    name: "COD Verification Reminder",
    status: "failed",
    audience: "Segment: Pending COD",
    templateName: "COD Verify",
    recipients: 640,
    sent: 128,
    delivered: 44,
    read: 12,
    failed: 84,
    createdAt: isoDaysAgo(7, 13),
  },
  {
    id: "cp_7",
    name: "Loyalty Points Expiry",
    status: "completed",
    audience: "Tag: VIP",
    templateName: "Loyalty Reminder",
    recipients: 1420,
    sent: 1420,
    delivered: 1398,
    read: 1102,
    failed: 22,
    createdAt: isoDaysAgo(18, 10),
  },
  {
    id: "cp_8",
    name: "Store Reopening Notice",
    status: "running",
    audience: "Segment: Mumbai",
    templateName: "Store Update",
    recipients: 980,
    sent: 620,
    delivered: 604,
    read: 388,
    failed: 16,
    createdAt: isoDaysAgo(1, 8),
  },
];

export const campaignRecipients = contacts.slice(0, 22).map((c, i) => ({
  contactId: c.id,
  name: c.name,
  phone: c.phone,
  status: (["read", "delivered", "sent", "failed", "pending"] as const)[i % 5]!,
  sentAt: isoDaysAgo(0, 6 + (i % 5)),
  deliveredAt: i % 5 === 3 ? undefined : isoDaysAgo(0, 6 + (i % 5)),
  readAt: i % 5 === 0 ? isoDaysAgo(0, 7 + (i % 5)) : undefined,
  error: i % 5 === 3 ? "Recipient not on WhatsApp" : undefined,
  lastAttemptAt: isoDaysAgo(0, 7 + (i % 5)),
}));

export const templates: Template[] = [
  {
    id: "tp_1",
    name: "Summer Sale Promo",
    category: "Marketing",
    language: "English",
    status: "active",
    body: "Hi {{name}}, ☀️\n\nOur Summer Sale is live — flat 25% off on everything at {{company}}.\n\nShop now before it ends Sunday!",
    usageCount: 14,
    updatedAt: isoDaysAgo(2, 10),
  },
  {
    id: "tp_2",
    name: "Order Ready Notice",
    category: "Transactional",
    language: "English",
    status: "active",
    body: "Hi {{name}}, 👋\n\nYour order {{order_id}} is ready.\n\nThank you for choosing us.",
    usageCount: 212,
    updatedAt: isoDaysAgo(4, 14),
  },
  {
    id: "tp_3",
    name: "Payment Reminder",
    category: "Reminder",
    language: "English",
    status: "active",
    body: "Hello {{name}}, a friendly reminder that {{amount}} is pending for order {{order_id}}.",
    usageCount: 87,
    updatedAt: isoDaysAgo(6, 11),
  },
  {
    id: "tp_4",
    name: "Welcome Message",
    category: "Welcome",
    language: "English",
    status: "active",
    body: "Welcome to {{company}}, {{name}}! 🎉\n\nReply MENU anytime to see what we offer.",
    usageCount: 964,
    updatedAt: isoDaysAgo(11, 9),
  },
  {
    id: "tp_5",
    name: "Follow-up After Demo",
    category: "Follow-up",
    language: "English",
    status: "inactive",
    body: "Hi {{name}}, did you get a chance to review the proposal we shared?",
    usageCount: 41,
    updatedAt: isoDaysAgo(21, 16),
  },
  {
    id: "tp_6",
    name: "Diwali Greeting (Hindi)",
    category: "Marketing",
    language: "Hindi",
    status: "draft",
    body: "नमस्ते {{name}}, दीपावली की हार्दिक शुभकामनाएँ! 🪔\n\n{{company}} की ओर से विशेष छूट पाएं।",
    usageCount: 0,
    updatedAt: isoDaysAgo(1, 18),
  },
  {
    id: "tp_7",
    name: "Cart Reminder",
    category: "Marketing",
    language: "English",
    status: "active",
    body: "Hi {{name}}, you left items in your cart. Complete your order and get free shipping today.",
    usageCount: 132,
    updatedAt: isoDaysAgo(8, 12),
  },
  {
    id: "tp_8",
    name: "Support Ticket Closed",
    category: "Transactional",
    language: "English",
    status: "active",
    body: "Hi {{name}}, your support request has been resolved. Reply if you need anything else.",
    usageCount: 318,
    updatedAt: isoDaysAgo(15, 10),
  },
];

export const automations: Automation[] = [
  {
    id: "au_1",
    name: "Welcome New Contact",
    description: "Greet every new contact and share the catalogue.",
    trigger: "New contact",
    actions: ["Send Template: Welcome Message", "Add Tag: Lead", "Wait 1 day", "Send follow-up"],
    status: "active",
    runs: 1248,
    lastRunAt: isoDaysAgo(0, 7),
    successRate: 97,
  },
  {
    id: "au_2",
    name: "Order Follow-up",
    description: "Ask for feedback two days after delivery.",
    trigger: "Tag added: Delivered",
    actions: ["Wait 2 days", "Send Message", "Condition: Replied?"],
    status: "active",
    runs: 612,
    lastRunAt: isoDaysAgo(0, 9),
    successRate: 94,
  },
  {
    id: "au_3",
    name: "Inactive Customer Reminder",
    description: "Win back contacts with no reply for 7 days.",
    trigger: "No reply for 7 days",
    actions: ["Send Template: Cart Reminder", "Add Tag: Re-engage"],
    status: "paused",
    runs: 284,
    lastRunAt: isoDaysAgo(6, 12),
    successRate: 71,
  },
  {
    id: "au_4",
    name: "Keyword Auto-Reply",
    description: "Reply instantly when a message contains PRICE.",
    trigger: "Incoming message",
    actions: ["Condition: Message contains 'price'", "Send Template: Price List"],
    status: "active",
    runs: 3980,
    lastRunAt: isoDaysAgo(0, 11),
    successRate: 99,
  },
  {
    id: "au_5",
    name: "Campaign Completed Digest",
    description: "Notify the team and tag engaged readers.",
    trigger: "Campaign completed",
    actions: ["Assign Contact: Sneha Rao", "Add Tag: Engaged"],
    status: "draft",
    runs: 0,
    successRate: 0,
  },
];

export const messageLogs: MessageLog[] = Array.from({ length: 40 }, (_, i) => {
  const c = contacts[i % contacts.length]!;
  const status = (["delivered", "read", "sent", "failed", "pending"] as const)[i % 5]!;
  return {
    id: `msg_${(9384710 + i * 41).toString(16)}`,
    at: isoDaysAgo(i % 6, 14 - (i % 9)),
    contactName: c.name,
    phone: c.phone,
    campaign: i % 4 === 0 ? undefined : campaigns[i % campaigns.length]!.name,
    body:
      i % 3 === 0
        ? "Hi there, your order BR-48123 is ready for pickup at our Andheri store."
        : "Flat 25% off on all rainwear this week only. Reply STOP to opt out.",
    status,
    direction: i % 6 === 0 ? "inbound" : "outbound",
    error: status === "failed" ? "Recipient number not registered on WhatsApp" : undefined,
    timeline: [
      { label: "Queued", at: isoDaysAgo(i % 6, 14 - (i % 9)), done: true },
      { label: "Sent", at: isoDaysAgo(i % 6, 14 - (i % 9)), done: status !== "pending" },
      {
        label: "Delivered",
        at: isoDaysAgo(i % 6, 14 - (i % 9)),
        done: status === "delivered" || status === "read",
      },
      { label: "Read", at: isoDaysAgo(i % 6, 13 - (i % 9)), done: status === "read" },
    ],
  };
});

export const notifications: Notification[] = [
  {
    id: "nt_1",
    title: "Campaign “Summer Sale Blast” completed",
    detail: "2,341 of 2,500 messages delivered",
    at: isoDaysAgo(0, 6),
    kind: "success",
    read: false,
  },
  {
    id: "nt_2",
    title: "WhatsApp disconnected",
    detail: "Session reconnected automatically after 4 minutes",
    at: isoDaysAgo(0, 4),
    kind: "warning",
    read: false,
  },
  {
    id: "nt_3",
    title: "2,341 messages delivered",
    detail: "Daily delivery report is ready",
    at: isoDaysAgo(1, 20),
    kind: "info",
    read: true,
  },
  {
    id: "nt_4",
    title: "Automation error: Order Follow-up",
    detail: "Template variable {{order_id}} was missing for 3 contacts",
    at: isoDaysAgo(2, 15),
    kind: "error",
    read: true,
  },
];

const rangeSeries: Record<string, { label: string; base: number }[]> = {
  today: ["00", "04", "08", "12", "16", "20"].map((h) => ({ label: `${h}:00`, base: 120 })),
  "7d": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => ({ label: d, base: 380 })),
  "30d": Array.from({ length: 10 }, (_, i) => ({ label: `${i * 3 + 1}`, base: 620 })),
  "90d": ["Jun W1", "Jun W3", "Jul W1", "Jul W3", "Aug W1", "Aug W2", "Aug W3"].map((d) => ({
    label: d,
    base: 1450,
  })),
};

export function analyticsFor(range: Analytics["range"]): Analytics {
  const spec = rangeSeries[range === "custom" ? "30d" : range]!;
  const series = spec.map((p, i) => {
    const sent = Math.round(p.base * (0.78 + ((i * 13) % 40) / 100));
    const delivered = Math.round(sent * 0.955);
    return {
      label: p.label,
      sent,
      delivered,
      read: Math.round(delivered * 0.72),
      failed: sent - delivered,
    };
  });
  const sum = (k: keyof (typeof series)[number]) =>
    series.reduce((a, b) => a + (b[k] as number), 0);
  const sent = sum("sent");
  const delivered = sum("delivered");
  const read = sum("read");
  const failed = sum("failed");
  return {
    range,
    totals: {
      sent,
      delivered,
      read,
      failed,
      replyRate: 24.6,
      deliveryRate: Math.round((delivered / sent) * 1000) / 10,
      readRate: Math.round((read / delivered) * 1000) / 10,
    },
    series,
    responseRate: series.map((s, i) => ({ label: s.label, rate: 18 + ((i * 7) % 14) })),
    topCampaigns: campaigns.slice(0, 5).map((c) => ({
      name: c.name,
      sent: c.sent,
      delivered: c.delivered,
      readRate: c.delivered ? Math.round((c.read / c.delivered) * 1000) / 10 : 0,
    })),
    topContacts: contacts.slice(0, 6).map((c, i) => ({
      name: c.name,
      phone: c.phone,
      messages: 148 - i * 17,
      lastAt: isoDaysAgo(i, 12),
    })),
  };
}

export const dashboardKpis = [
  { key: "sent", label: "Messages Sent", value: 2481, change: 12.4, icon: "send" },
  { key: "delivered", label: "Messages Delivered", value: 2341, change: 9.1, icon: "check" },
  { key: "campaigns", label: "Active Campaigns", value: 8, change: 2, icon: "megaphone" },
  { key: "contacts", label: "Total Contacts", value: 12540, change: 4.8, icon: "users" },
] as const;

export const teamMembers: TeamMember[] = [
  {
    id: "tm_1",
    name: "Kashif Ahmad",
    email: "kashif@brightretail.in",
    role: "Owner",
    status: "active",
    lastActiveAt: isoDaysAgo(0, 11),
  },
  {
    id: "tm_2",
    name: "Sneha Rao",
    email: "sneha@brightretail.in",
    role: "Admin",
    status: "active",
    lastActiveAt: isoDaysAgo(0, 9),
  },
  {
    id: "tm_3",
    name: "Imran Khan",
    email: "imran@brightretail.in",
    role: "Agent",
    status: "active",
    lastActiveAt: isoDaysAgo(1, 17),
  },
  {
    id: "tm_4",
    name: "Priya Mehta",
    email: "priya@brightretail.in",
    role: "Viewer",
    status: "invited",
    lastActiveAt: isoDaysAgo(3, 10),
  },
];

export const plans: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: 0,
    tagline: "Test the workflow with a single number.",
    features: ["1 WhatsApp number", "500 contacts", "1,000 messages/mo", "2 automations"],
    limits: { contacts: 500, messages: 1000, campaigns: 3, automations: 2 },
  },
  {
    id: "starter",
    name: "Starter",
    price: 499,
    tagline: "For small teams starting with campaigns.",
    features: ["1 WhatsApp number", "5,000 contacts", "20,000 messages/mo", "10 automations"],
    limits: { contacts: 5000, messages: 20000, campaigns: 25, automations: 10 },
  },
  {
    id: "professional",
    name: "Professional",
    price: 999,
    tagline: "Everything a growing business needs.",
    features: [
      "3 WhatsApp numbers",
      "25,000 contacts",
      "100,000 messages/mo",
      "Unlimited automations",
      "Team inbox with 5 seats",
    ],
    limits: { contacts: 25000, messages: 100000, campaigns: 200, automations: 100 },
  },
  {
    id: "business",
    name: "Business",
    price: 2499,
    tagline: "Scale with priority delivery and API access.",
    features: [
      "10 WhatsApp numbers",
      "Unlimited contacts",
      "500,000 messages/mo",
      "Priority delivery queue",
      "Dedicated success manager",
    ],
    limits: { contacts: 250000, messages: 500000, campaigns: 2000, automations: 1000 },
  },
];

export const billingUsage = {
  contacts: { used: 12540, limit: 25000 },
  messages: { used: 68420, limit: 100000 },
  campaigns: { used: 42, limit: 200 },
  automations: { used: 5, limit: 100 },
  renewsOn: "2026-09-01T00:00:00+05:30",
  invoices: [
    { id: "INV-2026-08", date: isoDaysAgo(18, 10), amount: 999, status: "Paid" },
    { id: "INV-2026-07", date: isoDaysAgo(48, 10), amount: 999, status: "Paid" },
    { id: "INV-2026-06", date: isoDaysAgo(78, 10), amount: 999, status: "Paid" },
  ],
};

export const allTags = tagPool;
