// Mock data for the Developers area: webhooks + API reference.

function iso(minutesAgo: number) {
  return new Date(Date.now() - minutesAgo * 60_000).toISOString();
}

export const webhookEvents = [
  { id: "message.sent", label: "Message sent", group: "Messages" },
  { id: "message.delivered", label: "Message delivered", group: "Messages" },
  { id: "message.read", label: "Message read", group: "Messages" },
  { id: "message.failed", label: "Message failed", group: "Messages" },
  { id: "message.received", label: "Message received", group: "Messages" },
  { id: "contact.created", label: "Contact created", group: "Contacts" },
  { id: "contact.updated", label: "Contact updated", group: "Contacts" },
  { id: "campaign.started", label: "Campaign started", group: "Campaigns" },
  { id: "campaign.completed", label: "Campaign completed", group: "Campaigns" },
  { id: "session.connected", label: "Session connected", group: "Connection" },
  { id: "session.disconnected", label: "Session disconnected", group: "Connection" },
] as const;

export type WebhookStatus = "active" | "paused" | "failing";

export interface WebhookEndpoint {
  id: string;
  name: string;
  url: string;
  status: WebhookStatus;
  events: string[];
  secret: string;
  version: "2026-06-01" | "2025-11-01";
  createdAt: string;
  lastDeliveryAt?: string | undefined;
  successRate: number;
  deliveries24h: number;
  failures24h: number;
  retries: boolean;
  description?: string | undefined;
}

export const webhookEndpoints: WebhookEndpoint[] = [
  {
    id: "wh_01hq9",
    name: "CRM sync",
    url: "https://api.acme-crm.com/hooks/waflow",
    status: "active",
    events: ["message.received", "message.delivered", "contact.created", "contact.updated"],
    secret: "whsec_9f21ab7c4d5e6f8091a2b3c4d5e6f708",
    version: "2026-06-01",
    createdAt: iso(60 * 24 * 42),
    lastDeliveryAt: iso(4),
    successRate: 99.4,
    deliveries24h: 4820,
    failures24h: 29,
    retries: true,
    description: "Pushes inbound messages and contact changes into the CRM pipeline.",
  },
  {
    id: "wh_02kt4",
    name: "Campaign analytics warehouse",
    url: "https://ingest.warehouse.internal/v2/waflow-events",
    status: "active",
    events: ["campaign.started", "campaign.completed", "message.sent", "message.read"],
    secret: "whsec_1c0d2e3f4a5b6c7d8e9f0a1b2c3d4e5f",
    version: "2026-06-01",
    createdAt: iso(60 * 24 * 96),
    lastDeliveryAt: iso(17),
    successRate: 97.8,
    deliveries24h: 1290,
    failures24h: 28,
    retries: true,
  },
  {
    id: "wh_03mz8",
    name: "Ops alerting (Slack relay)",
    url: "https://hooks.opsrelay.io/waflow/session-alerts",
    status: "failing",
    events: ["session.disconnected", "message.failed"],
    secret: "whsec_ab12cd34ef56ab78cd90ef12ab34cd56",
    version: "2025-11-01",
    createdAt: iso(60 * 24 * 12),
    lastDeliveryAt: iso(52),
    successRate: 62.5,
    deliveries24h: 48,
    failures24h: 18,
    retries: true,
    description: "Notifies the on-call channel when a WhatsApp session drops.",
  },
  {
    id: "wh_04pq1",
    name: "Staging sandbox",
    url: "https://staging.acme-crm.com/hooks/waflow",
    status: "paused",
    events: ["message.sent"],
    secret: "whsec_77aa88bb99cc00dd11ee22ff33445566",
    version: "2026-06-01",
    createdAt: iso(60 * 24 * 5),
    successRate: 100,
    deliveries24h: 0,
    failures24h: 0,
    retries: false,
  },
];

export type DeliveryStatus = "succeeded" | "failed" | "pending";

export interface WebhookDelivery {
  id: string;
  endpointId: string;
  event: string;
  status: DeliveryStatus;
  responseCode: number | null;
  durationMs: number;
  attempt: number;
  at: string;
  requestBody: Record<string, unknown>;
  responseBody: string;
  error?: string | undefined;
}

function payload(event: string, extra: Record<string, unknown>) {
  return {
    id: `evt_${Math.random().toString(36).slice(2, 12)}`,
    type: event,
    api_version: "2026-06-01",
    created_at: new Date().toISOString(),
    data: extra,
  };
}

export const webhookDeliveries: WebhookDelivery[] = [
  {
    id: "dlv_9812",
    endpointId: "wh_01hq9",
    event: "message.received",
    status: "succeeded",
    responseCode: 200,
    durationMs: 142,
    attempt: 1,
    at: iso(4),
    requestBody: payload("message.received", {
      message_id: "msg_7f81c2",
      conversation_id: "cnv_2841",
      from: "+91 98200 41288",
      body: "Hi, is the offer still valid?",
      received_at: iso(4),
    }),
    responseBody: '{"received":true}',
  },
  {
    id: "dlv_9811",
    endpointId: "wh_01hq9",
    event: "contact.created",
    status: "succeeded",
    responseCode: 201,
    durationMs: 233,
    attempt: 1,
    at: iso(9),
    requestBody: payload("contact.created", {
      contact_id: "cnt_54kd1",
      name: "Ritika Malhotra",
      phone: "+91 90045 78120",
      tags: ["website-form", "lead"],
    }),
    responseBody: '{"id":"crm_88213"}',
  },
  {
    id: "dlv_9810",
    endpointId: "wh_02kt4",
    event: "campaign.completed",
    status: "succeeded",
    responseCode: 200,
    durationMs: 411,
    attempt: 1,
    at: iso(17),
    requestBody: payload("campaign.completed", {
      campaign_id: "cmp_2109",
      name: "Monsoon sale reminder",
      recipients: 4210,
      delivered: 4108,
      failed: 42,
    }),
    responseBody: '{"ok":true}',
  },
  {
    id: "dlv_9809",
    endpointId: "wh_03mz8",
    event: "session.disconnected",
    status: "failed",
    responseCode: 503,
    durationMs: 10_004,
    attempt: 3,
    at: iso(52),
    requestBody: payload("session.disconnected", {
      account_id: "acc_main",
      phone: "+91 89765 11220",
      reason: "device_logout",
    }),
    responseBody: '{"error":"upstream unavailable"}',
    error: "Endpoint returned 503 after 3 attempts. Next retry in 8m.",
  },
  {
    id: "dlv_9808",
    endpointId: "wh_03mz8",
    event: "message.failed",
    status: "pending",
    responseCode: null,
    durationMs: 0,
    attempt: 2,
    at: iso(58),
    requestBody: payload("message.failed", {
      message_id: "msg_1188ac",
      to: "+91 70123 99871",
      error_code: "rate_limited",
    }),
    responseBody: "",
    error: "Queued for retry (attempt 2 of 5).",
  },
  {
    id: "dlv_9807",
    endpointId: "wh_02kt4",
    event: "message.read",
    status: "succeeded",
    responseCode: 200,
    durationMs: 96,
    attempt: 1,
    at: iso(74),
    requestBody: payload("message.read", {
      message_id: "msg_71ba09",
      read_at: iso(74),
    }),
    responseBody: '{"ok":true}',
  },
  {
    id: "dlv_9806",
    endpointId: "wh_01hq9",
    event: "message.delivered",
    status: "succeeded",
    responseCode: 200,
    durationMs: 118,
    attempt: 1,
    at: iso(96),
    requestBody: payload("message.delivered", {
      message_id: "msg_66ce41",
      delivered_at: iso(96),
    }),
    responseBody: '{"ok":true}',
  },
  {
    id: "dlv_9805",
    endpointId: "wh_02kt4",
    event: "message.sent",
    status: "failed",
    responseCode: 422,
    durationMs: 287,
    attempt: 1,
    at: iso(140),
    requestBody: payload("message.sent", {
      message_id: "msg_5510ff",
      campaign_id: "cmp_2109",
    }),
    responseBody: '{"error":"unknown field campaign_id"}',
    error: "Endpoint rejected payload schema (422).",
  },
];

/* ------------------------------- API keys -------------------------------- */

export interface ApiKey {
  id: string;
  label: string;
  prefix: string;
  scopes: string[];
  environment: "live" | "test";
  createdAt: string;
  lastUsedAt?: string | undefined;
  requests30d: number;
}

export const apiKeys: ApiKey[] = [
  {
    id: "key_live_1",
    label: "Production server",
    prefix: "wf_live_8Qc2",
    scopes: ["messages:write", "contacts:read", "contacts:write", "campaigns:write"],
    environment: "live",
    createdAt: iso(60 * 24 * 120),
    lastUsedAt: iso(2),
    requests30d: 184_920,
  },
  {
    id: "key_live_2",
    label: "Zapier connector",
    prefix: "wf_live_3Tn9",
    scopes: ["messages:write", "contacts:read"],
    environment: "live",
    createdAt: iso(60 * 24 * 38),
    lastUsedAt: iso(310),
    requests30d: 12_480,
  },
  {
    id: "key_test_1",
    label: "Local development",
    prefix: "wf_test_Kd41",
    scopes: ["messages:write", "contacts:read", "contacts:write", "webhooks:write"],
    environment: "test",
    createdAt: iso(60 * 24 * 9),
    lastUsedAt: iso(1440),
    requests30d: 2_140,
  },
];

export const apiUsage = {
  requests30d: 199_540,
  errorRate: 0.42,
  p95Latency: 184,
  rateLimit: "600 req/min",
};

/* ------------------------- OpenAPI (Swagger) spec ------------------------ */

const jsonBody = (example: Record<string, unknown>) => ({
  "application/json": { example },
});

export const openApiSpec = {
  openapi: "3.1.0",
  info: {
    title: "WAFlow API",
    version: "2026-06-01",
    description:
      "Send WhatsApp messages, manage contacts, run campaigns and subscribe to events. All requests require a bearer API key.",
  },
  servers: [
    { url: "https://api.waflow.io/v1", description: "Production" },
    { url: "https://sandbox.api.waflow.io/v1", description: "Sandbox" },
  ],
  tags: [
    { name: "Messages", description: "Send and inspect WhatsApp messages." },
    { name: "Contacts", description: "Create, update and search contacts." },
    { name: "Campaigns", description: "Bulk sends with scheduling and throttling." },
    { name: "Templates", description: "Reusable message bodies with variables." },
    { name: "Webhooks", description: "Manage event subscriptions." },
    { name: "Session", description: "WhatsApp connection state and QR pairing." },
  ],
  paths: {
    "/messages": {
      post: {
        tags: ["Messages"],
        summary: "Send a message",
        description: "Sends a text or media message to a WhatsApp number using the connected session.",
        parameters: [],
        requestBody: {
          required: true,
          content: jsonBody({
            to: "+919820041288",
            type: "text",
            text: { body: "Your order #4821 has shipped." },
          }),
        },
        responses: {
          "201": {
            description: "Message queued",
            content: jsonBody({
              id: "msg_7f81c2",
              status: "pending",
              to: "+919820041288",
              created_at: "2026-08-27T07:12:41Z",
            }),
          },
          "422": { description: "Validation failed", content: jsonBody({ error: "invalid_phone" }) },
          "429": { description: "Rate limit exceeded" },
        },
      },
      get: {
        tags: ["Messages"],
        summary: "List messages",
        description: "Paginated message log, newest first.",
        parameters: [
          { name: "status", in: "query", required: false, schema: { type: "string" }, description: "pending | sent | delivered | read | failed" },
          { name: "limit", in: "query", required: false, schema: { type: "integer" }, description: "1–100, default 25" },
          { name: "cursor", in: "query", required: false, schema: { type: "string" }, description: "Pagination cursor" },
        ],
        responses: {
          "200": {
            description: "A page of messages",
            content: jsonBody({
              data: [{ id: "msg_7f81c2", to: "+919820041288", status: "delivered", body: "Your order #4821 has shipped." }],
              next_cursor: "cur_88b1",
            }),
          },
        },
      },
    },
    "/messages/{id}": {
      get: {
        tags: ["Messages"],
        summary: "Retrieve a message",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" }, description: "Message ID" }],
        responses: {
          "200": {
            description: "Message object",
            content: jsonBody({ id: "msg_7f81c2", status: "read", timeline: [{ status: "sent", at: "2026-08-27T07:12:42Z" }] }),
          },
          "404": { description: "Not found" },
        },
      },
    },
    "/contacts": {
      get: {
        tags: ["Contacts"],
        summary: "List contacts",
        parameters: [
          { name: "search", in: "query", required: false, schema: { type: "string" }, description: "Name, phone or email" },
          { name: "tag", in: "query", required: false, schema: { type: "string" }, description: "Filter by tag" },
        ],
        responses: {
          "200": {
            description: "A page of contacts",
            content: jsonBody({ data: [{ id: "cnt_54kd1", name: "Ritika Malhotra", phone: "+919004578120", tags: ["lead"] }] }),
          },
        },
      },
      post: {
        tags: ["Contacts"],
        summary: "Create a contact",
        parameters: [],
        requestBody: {
          required: true,
          content: jsonBody({ name: "Ritika Malhotra", phone: "+919004578120", tags: ["lead"], custom_fields: { city: "Pune" } }),
        },
        responses: {
          "201": { description: "Contact created", content: jsonBody({ id: "cnt_54kd1", status: "active" }) },
          "409": { description: "Phone already exists" },
        },
      },
    },
    "/campaigns": {
      post: {
        tags: ["Campaigns"],
        summary: "Create a campaign",
        description: "Creates a campaign in draft or schedules it immediately.",
        parameters: [],
        requestBody: {
          required: true,
          content: jsonBody({
            name: "Monsoon sale reminder",
            template_id: "tpl_2201",
            audience: { type: "tag", tag: "lead" },
            schedule: { at: "2026-08-28T04:30:00Z", rate_per_minute: 60 },
          }),
        },
        responses: {
          "201": { description: "Campaign created", content: jsonBody({ id: "cmp_2109", status: "scheduled", recipients: 4210 }) },
        },
      },
    },
    "/campaigns/{id}/pause": {
      post: {
        tags: ["Campaigns"],
        summary: "Pause a campaign",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" }, description: "Campaign ID" }],
        responses: { "200": { description: "Paused", content: jsonBody({ id: "cmp_2109", status: "paused" }) } },
      },
    },
    "/templates": {
      get: {
        tags: ["Templates"],
        summary: "List templates",
        parameters: [{ name: "category", in: "query", required: false, schema: { type: "string" }, description: "Marketing, Reminder, …" }],
        responses: {
          "200": {
            description: "Templates",
            content: jsonBody({ data: [{ id: "tpl_2201", name: "Order shipped", variables: ["name", "order_id"] }] }),
          },
        },
      },
    },
    "/webhooks": {
      get: {
        tags: ["Webhooks"],
        summary: "List webhook endpoints",
        parameters: [],
        responses: {
          "200": {
            description: "Endpoints",
            content: jsonBody({ data: [{ id: "wh_01hq9", url: "https://api.acme-crm.com/hooks/waflow", events: ["message.received"] }] }),
          },
        },
      },
      post: {
        tags: ["Webhooks"],
        summary: "Create a webhook endpoint",
        parameters: [],
        requestBody: {
          required: true,
          content: jsonBody({ url: "https://example.com/hooks/waflow", events: ["message.delivered", "message.failed"] }),
        },
        responses: {
          "201": { description: "Created", content: jsonBody({ id: "wh_05aa2", secret: "whsec_…", status: "active" }) },
        },
      },
    },
    "/session": {
      get: {
        tags: ["Session"],
        summary: "Get connection state",
        parameters: [],
        responses: {
          "200": {
            description: "Session state",
            content: jsonBody({ state: "CONNECTED", phone: "+918976511220", last_synced_at: "2026-08-27T07:44:02Z" }),
          },
        },
      },
    },
    "/session/qr": {
      post: {
        tags: ["Session"],
        summary: "Request a pairing QR",
        parameters: [],
        responses: {
          "200": { description: "QR payload", content: jsonBody({ qr: "2@Xk1…", expires_in: 60 }) },
        },
      },
    },
  },
} as const;

export type SpecMethod = "get" | "post" | "put" | "patch" | "delete";

export interface SpecOperation {
  path: string;
  method: SpecMethod;
  tag: string;
  summary: string;
  description?: string | undefined;
  parameters: { name: string; in: string; required?: boolean; description?: string }[];
  requestExample?: Record<string, unknown> | undefined;
  responses: { code: string; description: string; example?: Record<string, unknown> | undefined }[];
}

export function flattenSpec(): SpecOperation[] {
  const ops: SpecOperation[] = [];
  for (const [path, methods] of Object.entries(openApiSpec.paths as Record<string, Record<string, any>>)) {
    for (const [method, op] of Object.entries(methods)) {
      ops.push({
        path,
        method: method as SpecMethod,
        tag: op.tags?.[0] ?? "Other",
        summary: op.summary,
        description: op.description,
        parameters: op.parameters ?? [],
        requestExample: op.requestBody?.content?.["application/json"]?.example,
        responses: Object.entries(op.responses as Record<string, any>).map(([code, res]) => ({
          code,
          description: res.description ?? "",
          example: res.content?.["application/json"]?.example,
        })),
      });
    }
  }
  return ops;
}

export const codeSamples = (op: SpecOperation) => {
  const url = `https://api.waflow.io/v1${op.path.replace(/\{(\w+)\}/g, (_m, p) => `{${p}}`)}`;
  const body = op.requestExample ? JSON.stringify(op.requestExample, null, 2) : null;
  return {
    curl: [
      `curl -X ${op.method.toUpperCase()} "${url}" \\`,
      `  -H "Authorization: Bearer $WAFLOW_API_KEY" \\`,
      `  -H "Content-Type: application/json"${body ? " \\" : ""}`,
      ...(body ? [`  -d '${body.replace(/\n/g, "\n  ")}'`] : []),
    ].join("\n"),
    node: [
      `const res = await fetch("${url}", {`,
      `  method: "${op.method.toUpperCase()}",`,
      `  headers: {`,
      `    Authorization: \`Bearer \${process.env.WAFLOW_API_KEY}\`,`,
      `    "Content-Type": "application/json",`,
      `  },`,
      ...(body ? [`  body: JSON.stringify(${body.replace(/\n/g, "\n  ")}),`] : []),
      `});`,
      `const data = await res.json();`,
    ].join("\n"),
    python: [
      `import os, requests`,
      ``,
      `res = requests.${op.method}(`,
      `    "${url}",`,
      `    headers={"Authorization": f"Bearer {os.environ['WAFLOW_API_KEY']}"},`,
      ...(body ? [`    json=${body.replace(/\n/g, "\n    ")},`] : []),
      `)`,
      `print(res.json())`,
    ].join("\n"),
  };
};
