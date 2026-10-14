import { env } from "../../config/env.js";

function serverUrl(req) {
  const proto = req.headers["x-forwarded-proto"] || req.protocol || "http";
  const host = req.headers["x-forwarded-host"] || req.get("host");
  return `${proto}://${host}/api`;
}

const envelope = (schema) => ({
  type: "object",
  properties: {
    success: { type: "boolean", example: true },
    data: schema,
  },
});

const error = {
  type: "object",
  properties: {
    success: { type: "boolean", example: false },
    message: { type: "string", example: "Validation failed" },
    details: { type: "object", additionalProperties: true },
  },
};

const objectIdParam = (name, description) => ({
  name,
  in: "path",
  required: true,
  description,
  schema: { type: "string", pattern: "^[a-f\\d]{24}$" },
});

const jsonBody = (schema, examples) => ({
  required: true,
  content: {
    "application/json": {
      schema,
      ...(examples ? { examples } : {}),
    },
  },
});

const ok = (schema, description = "OK") => ({
  description,
  content: { "application/json": { schema: envelope(schema) } },
});

const created = (schema, description = "Created") => ({
  description,
  content: { "application/json": { schema: envelope(schema) } },
});

const noContent = { description: "Deleted successfully" };

function operation({ tags, summary, description, security = [{ apiKeyAuth: [] }], parameters, requestBody, responses }) {
  return {
    tags,
    summary,
    ...(description ? { description } : {}),
    security,
    ...(parameters ? { parameters } : {}),
    ...(requestBody ? { requestBody } : {}),
    responses: {
      ...responses,
      400: { description: "Validation or bad request", content: { "application/json": { schema: error } } },
      401: { description: "Missing or invalid API key/session token", content: { "application/json": { schema: error } } },
      403: { description: "API key scope, plan entitlement, or WhatsApp admin permission is missing", content: { "application/json": { schema: error } } },
      409: { description: "Connected WhatsApp session is not ready for this operation", content: { "application/json": { schema: error } } },
      422: { description: "WhatsApp rejected one or more supplied values", content: { "application/json": { schema: error } } },
      500: { description: "Internal server error", content: { "application/json": { schema: error } } },
    },
  };
}

export function buildOpenApiSpec(req) {
  const url = serverUrl(req);

  return {
    openapi: "3.1.0",
    info: {
      title: "WA Client API Documentation",
      version: "1.0.0",
      description:
        "Live API reference generated from this backend. Use API keys from the API Docs page to integrate WhatsApp sending into your own system. Before testing send APIs, make sure one WhatsApp number is connected.",
    },
    servers: [
      {
        url,
        description: env.nodeEnv === "production" ? "Production" : "Current environment",
      },
    ],
    tags: [
      { name: "Auth" },
      { name: "API Keys" },
      { name: "Messages" },
      { name: "WhatsApp" },
      { name: "Groups" },
      { name: "Inbox" },
      { name: "Contacts" },
      { name: "Templates" },
      { name: "Campaigns" },
      { name: "System" },
    ],
    components: {
      securitySchemes: {
        apiKeyAuth: { type: "apiKey", in: "header", name: "X-API-Key" },
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      },
      schemas: {
        Error: error,
        User: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            email: { type: "string", format: "email" },
            company: { type: "string" },
            role: { type: "string", enum: ["owner", "admin", "agent", "viewer"] },
            timezone: { type: "string" },
            plan: { type: "string", enum: ["free", "starter", "professional", "business"] },
          },
        },
        AuthResponse: {
          type: "object",
          properties: {
            user: { $ref: "#/components/schemas/User" },
            token: { type: "string" },
          },
        },
        ApiKey: {
          type: "object",
          properties: {
            id: { type: "string" },
            label: { type: "string" },
            prefix: { type: "string", example: "wf_live_abcd" },
            key: { type: "string", description: "Only returned once when the key is created." },
            defaultAccountId: { type: "string", description: "Opaque WhatsApp channel ID (ch_...) this key sends from by default." },
            defaultAccountName: { type: "string", example: "Sales WhatsApp" },
            defaultAccountPhone: { type: "string", example: "+919876543210" },
            scopes: {
              type: "array",
              items: {
                type: "string",
                enum: [
                  "messages:write",
                  "contacts:read",
                  "contacts:write",
                  "templates:read",
                  "templates:write",
                  "campaigns:read",
                  "campaigns:write",
                  "whatsapp:read",
                  "whatsapp:manage",
                ],
              },
            },
            environment: { type: "string", enum: ["test", "live"] },
            createdAt: { type: "string", format: "date-time" },
            lastUsedAt: { type: "string", format: "date-time" },
            revokedAt: { type: "string", format: "date-time" },
            requests30d: { type: "integer" },
          },
        },
        WhatsAppSendSettings: {
          type: "object",
          properties: {
            hourlyCap: { type: "integer", minimum: 1, maximum: 250, example: 120 },
            dailyCap: { type: "integer", minimum: 1, maximum: 5000, example: 1000 },
            warmupHourlyCap: { type: "integer", minimum: 1, maximum: 250, example: 60 },
            warmupDailyCap: { type: "integer", minimum: 1, maximum: 5000, example: 500 },
            minDelayMs: { type: "integer", minimum: 500, maximum: 600000, example: 3000 },
            maxDelayMs: { type: "integer", minimum: 500, maximum: 600000, example: 12000 },
            warmupMinDelayMs: { type: "integer", minimum: 500, maximum: 600000, example: 8000 },
            warmupMaxDelayMs: { type: "integer", minimum: 500, maximum: 600000, example: 25000 },
          },
        },
        WhatsAppAccount: {
          type: "object",
          properties: {
            id: { type: "string" },
            state: {
              type: "string",
              enum: ["DISCONNECTED", "CONNECTING", "QR_REQUIRED", "CONNECTED", "DISCONNECTING", "SESSION_EXPIRED", "ERROR"],
            },
            phone: { type: "string", example: "+919876543210" },
            displayName: { type: "string" },
            accountType: { type: "string", enum: ["business", "personal"] },
            messagesSentToday: { type: "integer" },
            sessionStatus: { type: "string", enum: ["active", "stale", "expired"] },
            sendSettings: { $ref: "#/components/schemas/WhatsAppSendSettings" },
          },
        },
        Contact: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string", example: "Kashif Ahmad" },
            phone: { type: "string", example: "+916387850049" },
            email: { type: "string", format: "email" },
            tags: { type: "array", items: { type: "string" } },
            source: { type: "string", enum: ["Manual", "CSV Import", "Website Form", "API", "WhatsApp"] },
            status: { type: "string", enum: ["active", "inactive", "blocked"] },
            notes: { type: "string" },
            customFields: { type: "object", additionalProperties: { type: "string" } },
          },
        },
        TemplateAttachment: {
          type: "object",
          properties: {
            kind: { type: "string", enum: ["image", "video", "document"] },
            bucket: { type: "string" },
            key: { type: "string" },
            name: { type: "string" },
            mimeType: { type: "string" },
            size: { type: "integer" },
          },
        },
        Template: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            category: { type: "string", enum: ["Marketing", "Transactional", "Reminder", "Welcome", "Follow-up", "Other"] },
            language: { type: "string" },
            status: { type: "string", enum: ["draft", "active", "inactive"] },
            body: { type: "string" },
            attachment: { $ref: "#/components/schemas/TemplateAttachment" },
            attachments: { type: "array", items: { $ref: "#/components/schemas/TemplateAttachment" } },
            usageCount: { type: "integer" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        Campaign: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            description: { type: "string" },
            status: { type: "string", enum: ["draft", "scheduled", "running", "paused", "completed", "failed"] },
            accountId: { type: "string", description: "Opaque WhatsApp channel ID (ch_...)" },
            templateId: { type: "string" },
            audienceType: { type: "string", enum: ["all", "tag", "contacts"] },
            audienceTag: { type: "string" },
            recipients: { type: "integer" },
            sent: { type: "integer" },
            delivered: { type: "integer" },
            read: { type: "integer" },
            failed: { type: "integer" },
            scheduledAt: { type: "string", format: "date-time" },
            ratePerMinute: { type: "integer", description: "Maximum campaign recipients queued per minute. The shared WhatsApp queue and account safety limits can slow delivery further." },
          },
        },
        Conversation: {
          type: "object",
          description: "Lightweight inbox row. Group member records are intentionally excluded from this list response.",
          properties: {
            id: { type: "string" },
            accountId: { type: "string", description: "Opaque WhatsApp channel ID (ch_...)" },
            accountName: { type: "string" },
            contactName: { type: "string" },
            phone: { type: "string" },
            lastMessage: { type: "string" },
            lastMessageAt: { type: "string", format: "date-time" },
            unreadCount: { type: "integer" },
            isGroup: { type: "boolean" },
            groupSubject: { type: "string" },
            groupMemberCount: { type: "integer", description: "Present for group rows. Fetch group details to retrieve member records." },
          },
        },
        InboxGroupDetails: {
          type: "object",
          description: "Selected group metadata. This endpoint is the only Inbox endpoint that returns member JIDs.",
          properties: {
            conversationId: { type: "string" },
            groupId: { type: "string", example: "120363428797010401@g.us" },
            subject: { type: "string" },
            description: { type: "string" },
            memberCount: { type: "integer" },
            metadataWarning: { type: "string", description: "Present when cached group details are returned because WhatsApp could not refresh them." },
            members: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  jid: { type: "string" },
                  phone: { type: "string" },
                  name: { type: "string" },
                  role: { type: "string", enum: ["member", "admin", "superadmin"] },
                },
              },
            },
          },
        },
        Message: {
          type: "object",
          properties: {
            id: { type: "string" },
            conversationId: { type: "string" },
            body: { type: "string" },
            direction: { type: "string", enum: ["inbound", "outbound"] },
            status: { type: "string", enum: ["pending", "sent", "delivered", "read", "failed"] },
            at: { type: "string", format: "date-time" },
          },
        },
        SendMessageRequest: {
          type: "object",
          required: ["to"],
          properties: {
            to: { type: "string", example: "+916387850049" },
            body: { type: "string", maxLength: 4000, example: "Hello from WAFlow API" },
            accountId: { type: "string", description: "Optional opaque channel ID (ch_...) from GET /v1/account/detail. Defaults to the API key's bound channel." },
            attachment: { $ref: "#/components/schemas/TemplateAttachment" },
            attachments: { type: "array", maxItems: 10, items: { $ref: "#/components/schemas/TemplateAttachment" } },
          },
        },
        PublicCreateMessageRequest: {
          type: "object",
          properties: {
            receiverMobileNo: {
              oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
              example: "9999999999, +919876543210",
              description: "One or more mobile numbers. A 10 digit number is treated as India by default.",
            },
            recipientIds: {
              oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
              example: ["919999999999@c.us", "120363428797010401@g.us"],
              description: "Direct chat IDs (@c.us or @s.whatsapp.net), WhatsApp group IDs (@g.us), or a member JID (@lid). A linked ID is sent only after it resolves to a known phone identity for the selected account.",
            },
            message: {
              type: "array",
              items: { type: "string" },
              example: ["Hello"],
              description: "One or more text messages. With randomizeItems=true, one text is picked randomly per receiver.",
            },
            filePathUrl: {
              type: "array",
              items: { type: "string", format: "uri" },
              example: ["https://example.com/invoice.pdf"],
              description: "Public HTTP/HTTPS direct-download URLs to send as attachments to numbers, member JIDs, or WhatsApp groups. Public Google Drive file-sharing URLs are supported. A link must return the actual file, not a login or browser-preview page.",
            },
            base64File: {
              type: "array",
              items: {
                type: "object",
                required: ["name", "body"],
                properties: {
                  name: { type: "string", example: "invoice.pdf" },
                  mimeType: { type: "string", example: "application/pdf" },
                  body: { type: "string", description: "Base64 encoded file body." },
                },
              },
            },
            caption: {
              type: "array",
              items: { type: "string" },
              example: ["caption for first image"],
              description: "Optional for phone numbers and member JIDs. Captions are assigned to image/video files only, skipping documents, so the first caption is applied to the first image or video even if a PDF appears first. Group sends ignore this field: with exactly one image, message is used as its caption; otherwise message is sent separately.",
            },
            randomizeItems: { type: "boolean", default: false },
            channelId: {
              type: "string",
              description:
                "Optional opaque channel ID (ch_...) from result.channels[].id in GET /v1/account/detail. Omit it when the API key is bound to a WhatsApp number; that default number is then used.",
            },
            button: {
              type: "object",
              properties: {
                title: { type: "string", maxLength: 20, example: "Button title" },
                body: { type: "string", maxLength: 1024, example: "Button main body" },
                footer: { type: "string", maxLength: 60, example: "Footer" },
                buttons: {
                  type: "array",
                  minItems: 1,
                  maxItems: 3,
                  items: {
                    type: "object",
                    required: ["text"],
                    properties: { text: { type: "string", maxLength: 20, example: "Button 1" } },
                  },
                },
              },
            },
          },
        },
        PublicCreateMessageResponse: {
          type: "object",
          properties: {
            status: { type: "integer", example: 200 },
            message: { type: "string", example: "success" },
            result: {
              type: "object",
              properties: {
                id: { type: "string" },
                groupId: { type: "string" },
                creationTime: { type: "string", format: "date-time" },
                recipients: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      number: { type: "string", example: "919999999999@c.us" },
                      retryCount: { type: "integer", example: -1 },
                      status: { type: "string", enum: ["PENDING", "SENT", "DELIVERED", "READ", "FAILED"] },
                      lastUpdateTime: { type: "string", format: "date-time" },
                    },
                  },
                },
              },
            },
          },
        },
        WhatsAppGroup: {
          type: "object",
          properties: {
            id: { type: "string", example: "120363428797010401@g.us", description: "The WhatsApp group JID. Use this same value as groupId in group endpoints." },
            groupId: { type: "string", example: "120363428797010401@g.us", description: "Copy this value into the {groupId} path field for member and detail operations." },
            subject: { type: "string", example: "Testing group" },
            description: { type: "string" },
            owner: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
            memberCount: { type: "integer", example: 3 },
            members: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  jid: { type: "string", example: "254472668336141@lid", description: "Copy this identifier for remove, promote, or demote. WAFlow resolves linked IDs when WhatsApp has synced their phone identity." },
                  phone: { type: "string", example: "WhatsApp linked ID" },
                  name: { type: "string" },
                  role: { type: "string", enum: ["member", "admin", "superadmin"] },
                },
              },
            },
          },
        },
        WhatsAppGroupListItem: {
          type: "object",
          description: "A lightweight group record returned by the group-list endpoint. Fetch one group by groupId to retrieve its members.",
          properties: {
            id: { type: "string", example: "120363428797010401@g.us", description: "The WhatsApp group JID." },
            groupId: { type: "string", example: "120363428797010401@g.us", description: "Use this value in the group detail and participant endpoints." },
            subject: { type: "string", example: "Testing group", description: "The group name." },
          },
        },
      },
    },
    paths: {
      "/health": {
        get: operation({
          tags: ["System"],
          summary: "Check API health",
          security: [],
          responses: { 200: ok({ type: "object", properties: { message: { type: "string" } } }) },
        }),
      },
      "/auth/register": {
        post: operation({
          tags: ["Auth"],
          summary: "Create an account",
          security: [],
          requestBody: jsonBody({
            type: "object",
            required: ["name", "email", "password"],
            properties: {
              name: { type: "string", minLength: 2 },
              email: { type: "string", format: "email" },
              password: { type: "string", minLength: 6 },
              company: { type: "string" },
            },
          }),
          responses: { 200: ok({ $ref: "#/components/schemas/AuthResponse" }) },
        }),
      },
      "/auth/login": {
        post: operation({
          tags: ["Auth"],
          summary: "Log in and receive a bearer token",
          security: [],
          requestBody: jsonBody({
            type: "object",
            required: ["email", "password"],
            properties: {
              email: { type: "string", format: "email" },
              password: { type: "string" },
            },
          }),
          responses: { 200: ok({ $ref: "#/components/schemas/AuthResponse" }) },
        }),
      },
      "/auth/me": {
        get: operation({
          tags: ["Auth"],
          summary: "Get current user",
          security: [{ bearerAuth: [] }],
          responses: { 200: ok({ user: { $ref: "#/components/schemas/User" } }) },
        }),
      },
      "/api-keys": {
        get: operation({
          tags: ["API Keys"],
          summary: "List API keys",
          description: "Authenticate with either X-API-Key or Authorization: Bearer <session JWT>. A valid API key returns only its own record. A valid bearer session returns every API key owned by the signed-in user.",
          security: [{ apiKeyAuth: [] }, { bearerAuth: [] }],
          responses: { 200: ok({ type: "object", properties: { keys: { type: "array", items: { $ref: "#/components/schemas/ApiKey" } } } }) },
        }),
        post: operation({
          tags: ["API Keys"],
          summary: "Create API key",
          description: "Requires Authorization: Bearer <session JWT>. API keys cannot create additional API keys.",
          security: [{ bearerAuth: [] }],
          requestBody: jsonBody({
            type: "object",
            required: ["label"],
            properties: {
              label: { type: "string", minLength: 2, maxLength: 80, example: "Production website" },
              environment: { type: "string", enum: ["test", "live"], default: "live" },
              defaultAccountId: {
                type: "string",
                description: "Bind this API key to one opaque WhatsApp channel ID (ch_...). Recommended when multiple WhatsApp numbers are connected.",
              },
              scopes: {
                type: "array",
                items: {
                  type: "string",
                  enum: [
                    "messages:write",
                    "contacts:read",
                    "contacts:write",
                    "templates:read",
                    "templates:write",
                    "campaigns:read",
                    "campaigns:write",
                    "whatsapp:read",
                    "whatsapp:manage",
                  ],
                },
              },
            },
          }),
          responses: { 201: created({ type: "object", properties: { key: { $ref: "#/components/schemas/ApiKey" } } }) },
        }),
      },
      "/api-keys/{id}": {
        patch: operation({
          tags: ["API Keys"],
          summary: "Edit API key binding",
          description: "Requires Authorization: Bearer <session JWT>. Keeps the existing API key value and permissions unchanged while rebinding it to a currently connected WhatsApp number owned by the same workspace.",
          security: [{ bearerAuth: [] }],
          parameters: [objectIdParam("id", "API key id")],
          requestBody: jsonBody({
            type: "object",
            properties: {
              label: { type: "string", minLength: 2, maxLength: 80, example: "Production website" },
              defaultAccountId: { type: "string", description: "Opaque channel ID (ch_...) for the new currently connected WhatsApp number." },
            },
          }),
          responses: { 200: ok({ type: "object", properties: { key: { $ref: "#/components/schemas/ApiKey" } } }) },
        }),
        delete: operation({
          tags: ["API Keys"],
          summary: "Revoke API key",
          description: "Requires Authorization: Bearer <session JWT>. API keys cannot revoke other API keys.",
          security: [{ bearerAuth: [] }],
          parameters: [objectIdParam("id", "API key id")],
          responses: { 204: noContent },
        }),
      },
      "/v1/message/create": {
        post: operation({
          tags: ["Messages"],
          summary: "Create a WhatsApp message",
          description:
            "Queues text and/or multiple attachments to phone numbers, member JIDs, and WhatsApp group IDs. Send an Idempotency-Key header for safe client retries; a repeated key with the same payload returns the original batch instead of sending duplicates. The response returns after work is durably queued; use /v1/message/batches/{batchId} to follow the complete recipient batch. Supports JSON body, public file URLs including public Google Drive share links, base64 files, and multipart uploadFile attachments.",
          parameters: [
            { name: "Idempotency-Key", in: "header", required: false, schema: { type: "string", maxLength: 200 }, description: "Recommended for every request. Reuse the same value only when retrying the identical request." },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PublicCreateMessageRequest" },
                examples: {
                  text: { summary: "One number and one message", value: { receiverMobileNo: "9999999999", message: ["Hello"] } },
                  group: {
                    summary: "Send one image to a WhatsApp group; message becomes its caption",
                    value: {
                      recipientIds: ["120363428797010401@g.us"],
                      message: ["Product photo"],
                      filePathUrl: ["https://example.com/group-photo.jpg"],
                    },
                  },
                  groupMultipleAttachments: {
                    summary: "Send text and multiple files to a WhatsApp group",
                    value: {
                      recipientIds: ["120363428797010401@g.us"],
                      message: ["Please check the files shared with this group."],
                      filePathUrl: [
                        "https://drive.google.com/file/d/YOUR_PUBLIC_PDF_FILE_ID/view?usp=sharing",
                        "https://example.com/group-photo.jpg",
                      ],
                    },
                  },
                  linkedMember: {
                    summary: "Send text, photo and PDF to a member JID copied from Inbox",
                    value: {
                      recipientIds: ["254472668336141@lid"],
                      message: ["Please check the files shared with you."],
                      filePathUrl: [
                        "https://example.com/member-photo.jpg",
                        "https://drive.google.com/file/d/YOUR_PUBLIC_PDF_FILE_ID/view?usp=sharing",
                      ],
                    },
                  },
                  boundKey: {
                    summary: "Recommended: send using the API key default WhatsApp number",
                    value: {
                      receiverMobileNo: "9999999999",
                      message: ["Hello from the WhatsApp number bound to this API key"],
                    },
                  },
                  multiple: {
                    summary: "Multiple numbers and files; caption automatically skips the PDF",
                    value: {
                      receiverMobileNo: "9999999999,+919876543210",
                      message: ["Please check these files"],
                      filePathUrl: ["https://example.com/photo.jpg", "https://example.com/invoice.pdf"],
                      caption: ["Product photo"],
                    },
                  },
                  channel: {
                    summary: "Send from a selected WhatsApp connection",
                    value: {
                      channelId: "ch_4qwzKUn4oqyqVAet4TdlMcNQ",
                      receiverMobileNo: "9999999999",
                      message: ["Hello from selected channel"],
                    },
                  },
                  base64: {
                    summary: "Base64 PDF",
                    value: {
                      receiverMobileNo: "+919999999999",
                      base64File: [{ name: "dummy.pdf", mimeType: "application/pdf", body: "JVBERi0xLjQK..." }],
                    },
                  },
                  button: {
                    summary: "Button message",
                    value: {
                      receiverMobileNo: "9999999999",
                      button: {
                        title: "Button title",
                        body: "Button main body",
                        footer: "Footer",
                        buttons: [{ text: "Button 1" }, { text: "Button 2" }],
                      },
                    },
                  },
                },
              },
              "multipart/form-data": {
                schema: {
                  type: "object",
                  properties: {
                    receiverMobileNo: { type: "string", example: "9999999999,+919876543210" },
                    recipientIds: { type: "array", items: { type: "string" } },
                    message: { type: "array", items: { type: "string" } },
                    filePathUrl: {
                      type: "array",
                      items: { type: "string", format: "uri" },
                      description: "Public direct-download URLs, including public Google Drive file-sharing URLs.",
                    },
                    uploadFile: { type: "array", items: { type: "string", format: "binary" } },
                    caption: {
                      type: "array",
                      items: { type: "string" },
                      description: "For groups this is ignored. Use message as the image caption only when sending exactly one image.",
                    },
                    randomizeItems: { type: "boolean" },
                    channelId: { type: "string" },
                    "button.title": { type: "string" },
                    "button.body": { type: "string" },
                    "button.footer": { type: "string" },
                    "button.buttons[0].text": { type: "string" },
                    "button.buttons[1].text": { type: "string" },
                    "button.buttons[2].text": { type: "string" },
                  },
                },
              },
            },
          },
          responses: { 200: { description: "Message successfully created", content: { "application/json": { schema: { $ref: "#/components/schemas/PublicCreateMessageResponse" } } } } },
        }),
      },
      "/v1/message/createFromTemplate": {
        post: operation({
          tags: ["Messages"],
          summary: "Create WhatsApp message from saved template",
          parameters: [
            { name: "Idempotency-Key", in: "header", required: false, schema: { type: "string", maxLength: 200 }, description: "Recommended for every request. Reuse the same value only when retrying the identical request." },
          ],
          requestBody: jsonBody({
            type: "object",
            required: ["templateId"],
            properties: {
              templateId: { type: "string" },
              receiverMobileNo: { type: "string", example: "9999999999,+919876543210" },
              recipientIds: { type: "array", items: { type: "string" } },
              placeHolders: { type: "object", additionalProperties: { type: "string" }, example: { name: "Kashif", order_id: "AB123456" } },
              channelId: { type: "string", description: "Optional. Omit to use the API key's bound WhatsApp number." },
            },
          }),
          responses: { 200: { description: "Message successfully created", content: { "application/json": { schema: { $ref: "#/components/schemas/PublicCreateMessageResponse" } } } } },
        }),
      },
      "/v1/message/status": {
        get: operation({
          tags: ["Messages"],
          summary: "Get message status",
          parameters: [
            { name: "messageId", in: "query", required: true, schema: { type: "string" } },
            { name: "api_key", in: "query", schema: { type: "string" }, description: "Optional API key query parameter. Prefer X-API-Key header." },
          ],
          responses: { 200: { description: "Message status", content: { "application/json": { schema: { $ref: "#/components/schemas/PublicCreateMessageResponse" } } } } },
        }),
      },
      "/v1/message/batches/{batchId}": {
        get: operation({
          tags: ["Messages"],
          summary: "Get complete batch delivery status",
          description: "Returns queued, sent, delivered, read, failed, and duplicate-recipient counts for one API message batch. The API key that created a batch can access only its own batches.",
          parameters: [objectIdParam("batchId", "batchId returned by POST /v1/message/create")],
          responses: { 200: ok({ type: "object", properties: { batch: { type: "object" } } }) },
        }),
      },
      "/v1/account/detail": {
        get: operation({
          tags: ["WhatsApp"],
          summary: "Get integration account detail and connected channels",
          responses: {
            200: {
              description: "Account detail",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      status: { type: "integer", example: 200 },
                      message: { type: "string", example: "success" },
                      result: { type: "object" },
                    },
                  },
                },
              },
            },
          },
        }),
      },
      "/v1/wa/groups": {
        get: operation({
          tags: ["Groups"],
          summary: "List groups available to the selected WhatsApp number",
          description: "Start here. This lightweight response returns only each group name and group ID. Copy groups[].groupId before calling the group detail, leave, or participant endpoints. Call GET /v1/wa/groups/{groupId} only when member JIDs are needed. The API key's bound WhatsApp number is used automatically.",
          parameters: [
            { name: "channelId", in: "query", schema: { type: "string" }, description: "Optional ID from result.channels[].id in GET /v1/account/detail. Omit when the API key is bound to one number." },
          ],
          responses: { 200: ok({ type: "object", properties: { channelId: { type: "string" }, groups: { type: "array", items: { $ref: "#/components/schemas/WhatsAppGroupListItem" } } } }) },
        }),
        post: operation({
          tags: ["Groups"],
          summary: "Create a WhatsApp group",
          description: "Requires an API key with whatsapp:manage. For a new group, participants must be individual WhatsApp users: use a phone number such as +919999999999 or a direct JID such as 919999999999@s.whatsapp.net. Do not send a groupId in participants. The response provides group.groupId for later operations.",
          requestBody: jsonBody({
            type: "object",
            required: ["subject", "participants"],
            properties: {
              subject: { type: "string", example: "Customer onboarding" },
              participants: { type: "array", minItems: 1, items: { type: "string" }, example: ["+919999999999", "919876543210@s.whatsapp.net"] },
              channelId: { type: "string" },
            },
          }),
          responses: { 201: created({ type: "object", properties: { channelId: { type: "string", description: "The selected WhatsApp channel ID." }, group: { $ref: "#/components/schemas/WhatsAppGroup" } } }) },
        }),
      },
      "/v1/wa/groups/{groupId}": {
        get: operation({
          tags: ["Groups"],
          summary: "Get group details and member JIDs",
          description: "Call GET /v1/wa/groups first and copy groups[].groupId into this path. This response returns group.members[].jid; copy a member JID from here when removing, promoting, or demoting that existing member. URL-encode @ when calling directly outside Swagger.",
          parameters: [
            { name: "groupId", in: "path", required: true, schema: { type: "string", example: "120363428797010401@g.us" } },
            { name: "channelId", in: "query", schema: { type: "string" } },
          ],
          responses: { 200: ok({ type: "object", properties: { channelId: { type: "string" }, group: { $ref: "#/components/schemas/WhatsAppGroup" } } }) },
        }),
      },
      "/v1/wa/groups/{groupId}/leave": {
        post: operation({
          tags: ["Groups"],
          summary: "Leave a WhatsApp group",
          description: "Requires an API key with whatsapp:manage.",
          parameters: [{ name: "groupId", in: "path", required: true, schema: { type: "string", example: "120363428797010401@g.us" } }],
          requestBody: jsonBody({ type: "object", properties: { channelId: { type: "string" } } }),
          responses: { 200: ok({ type: "object", properties: { channelId: { type: "string" }, groupId: { type: "string" }, left: { type: "boolean" } } }) },
        }),
      },
      "/v1/wa/groups/{groupId}/participants": {
        post: operation({
          tags: ["Groups"],
          summary: "Add, remove, promote, or demote group members",
          description: "Discovery flow: (1) GET /v1/wa/groups and copy groups[].groupId into the path. (2) For remove, promote, or demote, GET /v1/wa/groups/{groupId} and copy group.members[].jid. (3) For add, send an individual phone number or direct WhatsApp JID. The connected WhatsApp number must be a group admin. A 200 response can include per-participant failures; check results[].success and results[].status.",
          parameters: [{ name: "groupId", in: "path", required: true, description: "Copy groups[].groupId from GET /v1/wa/groups. It must end with @g.us.", schema: { type: "string", example: "120363428797010401@g.us" } }],
          requestBody: jsonBody({
            type: "object",
            required: ["action", "participants"],
            properties: {
              action: { type: "string", enum: ["add", "remove", "promote", "demote"], description: "add = add a new user; remove = remove an existing member; promote = make an existing member admin; demote = remove an existing member's admin role." },
              participants: { type: "array", minItems: 1, items: { type: "string", description: "For add: phone number or direct @s.whatsapp.net JID. For remove/promote/demote: copy group.members[].jid from the group detail response." } },
              channelId: { type: "string", description: "Optional. Omit when this API key is bound to the intended WhatsApp number." },
            },
          }, {
            addByPhone: { summary: "Add a new member by phone number", value: { action: "add", participants: ["+919999999999"] } },
            removeExistingMember: { summary: "Remove a member copied from group details", value: { action: "remove", participants: ["254472668336141@lid"] } },
            promoteExistingMember: { summary: "Promote an existing member", value: { action: "promote", participants: ["254472668336141@lid"] } },
            demoteExistingAdmin: { summary: "Demote an existing admin", value: { action: "demote", participants: ["254472668336141@lid"] } },
          }),
          responses: { 200: ok({ type: "object", properties: { channelId: { type: "string" }, action: { type: "string", enum: ["add", "remove", "promote", "demote"] }, groupId: { type: "string" }, allSucceeded: { type: "boolean" }, metadataWarning: { type: "string", description: "Present only when WhatsApp accepted the change but has not yet returned refreshed metadata." }, group: { $ref: "#/components/schemas/WhatsAppGroup" }, results: { type: "array", items: { type: "object", properties: { participant: { type: "string" }, status: { type: "string", example: "200" }, success: { type: "boolean" }, message: { type: "string" } } } } } }) },
        }),
      },
      "/contacts": {
        get: operation({
          tags: ["Contacts"],
          summary: "List contacts",
          parameters: [
            { name: "search", in: "query", schema: { type: "string" } },
            { name: "tag", in: "query", schema: { type: "string" } },
            { name: "status", in: "query", schema: { type: "string", enum: ["active", "inactive", "blocked", "all"] } },
            { name: "page", in: "query", schema: { type: "integer", minimum: 1 } },
            { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100 } },
          ],
          responses: { 200: ok({ type: "object", properties: { contacts: { type: "array", items: { $ref: "#/components/schemas/Contact" } }, total: { type: "integer" }, page: { type: "integer" }, limit: { type: "integer" }, pages: { type: "integer" }, tags: { type: "array", items: { type: "string" } }, stats: { type: "object" } } }) },
        }),
        post: operation({
          tags: ["Contacts"],
          summary: "Create contact",
          requestBody: jsonBody({ $ref: "#/components/schemas/Contact" }),
          responses: { 201: created({ type: "object", properties: { contact: { $ref: "#/components/schemas/Contact" } } }) },
        }),
        delete: operation({
          tags: ["Contacts"],
          summary: "Bulk delete contacts",
          requestBody: jsonBody({ type: "object", required: ["ids"], properties: { ids: { type: "array", items: { type: "string" } } } }),
          responses: { 200: ok({ type: "object", properties: { deleted: { type: "integer" } } }) },
        }),
      },
      "/contacts/import": {
        post: operation({
          tags: ["Contacts"],
          summary: "Import contacts from CSV/XLS/XLSX",
          requestBody: {
            required: true,
            content: {
              "multipart/form-data": {
                schema: {
                  type: "object",
                  required: ["file"],
                  properties: { file: { type: "string", format: "binary" } },
                },
              },
            },
          },
          responses: { 200: ok({ type: "object", properties: { total: { type: "integer" }, created: { type: "integer" }, updated: { type: "integer" }, skipped: { type: "integer" }, errors: { type: "array", items: { type: "object" } } } }) },
        }),
      },
      "/contacts/{id}": {
        get: operation({ tags: ["Contacts"], summary: "Get contact", parameters: [objectIdParam("id", "Contact id")], responses: { 200: ok({ type: "object", properties: { contact: { $ref: "#/components/schemas/Contact" } } }) } }),
        patch: operation({ tags: ["Contacts"], summary: "Update contact", parameters: [objectIdParam("id", "Contact id")], requestBody: jsonBody({ $ref: "#/components/schemas/Contact" }), responses: { 200: ok({ type: "object", properties: { contact: { $ref: "#/components/schemas/Contact" } } }) } }),
        delete: operation({ tags: ["Contacts"], summary: "Delete contact", parameters: [objectIdParam("id", "Contact id")], responses: { 204: noContent } }),
      },
      "/templates": {
        get: operation({
          tags: ["Templates"],
          summary: "List templates",
          parameters: [
            { name: "search", in: "query", schema: { type: "string" } },
            { name: "category", in: "query", schema: { type: "string" } },
            { name: "status", in: "query", schema: { type: "string", enum: ["draft", "active", "inactive", "all"] } },
          ],
          responses: { 200: ok({ type: "object", properties: { templates: { type: "array", items: { $ref: "#/components/schemas/Template" } } } }) },
        }),
        post: operation({ tags: ["Templates"], summary: "Create template", requestBody: jsonBody({ $ref: "#/components/schemas/Template" }), responses: { 201: created({ type: "object", properties: { template: { $ref: "#/components/schemas/Template" } } }) } }),
      },
      "/templates/attachments": {
        post: operation({
          tags: ["Templates"],
          summary: "Upload template attachment",
          requestBody: {
            required: true,
            content: {
              "multipart/form-data": {
                schema: { type: "object", required: ["file"], properties: { file: { type: "string", format: "binary" } } },
              },
            },
          },
          responses: { 200: ok({ type: "object", properties: { attachment: { $ref: "#/components/schemas/TemplateAttachment" } } }) },
        }),
      },
      "/templates/{id}": {
        get: operation({ tags: ["Templates"], summary: "Get template", parameters: [objectIdParam("id", "Template id")], responses: { 200: ok({ type: "object", properties: { template: { $ref: "#/components/schemas/Template" } } }) } }),
        patch: operation({ tags: ["Templates"], summary: "Update template", parameters: [objectIdParam("id", "Template id")], requestBody: jsonBody({ $ref: "#/components/schemas/Template" }), responses: { 200: ok({ type: "object", properties: { template: { $ref: "#/components/schemas/Template" } } }) } }),
        delete: operation({ tags: ["Templates"], summary: "Delete template", parameters: [objectIdParam("id", "Template id")], responses: { 204: noContent } }),
      },
      "/templates/{id}/duplicate": {
        post: operation({ tags: ["Templates"], summary: "Duplicate template", parameters: [objectIdParam("id", "Template id")], requestBody: jsonBody({ type: "object", properties: { name: { type: "string" } } }), responses: { 201: created({ type: "object", properties: { template: { $ref: "#/components/schemas/Template" } } }) } }),
      },
      "/inbox/conversations": {
        get: operation({
          tags: ["Inbox"],
          summary: "List inbox conversations for currently connected WhatsApp numbers",
          description: "Group rows return only groupMemberCount. Use GET /inbox/conversations/{id}/group-details after selecting one group to retrieve its members.",
          parameters: [
            { name: "filter", in: "query", schema: { type: "string", enum: ["all", "unread", "assigned", "starred"] } },
            { name: "view", in: "query", schema: { type: "string", enum: ["personal", "groups"] } },
            { name: "search", in: "query", schema: { type: "string" } },
            { name: "cursor", in: "query", schema: { type: "string", format: "date-time" } },
            { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 75 } },
          ],
          responses: { 200: ok({ type: "object", properties: { conversations: { type: "array", items: { $ref: "#/components/schemas/Conversation" } }, nextCursor: { type: "string", nullable: true } } }) },
        }),
      },
      "/inbox/conversations/{id}/group-details": {
        get: operation({
          tags: ["Inbox"],
          summary: "Get members for one selected group conversation",
          description: "Only call this after selecting a group from GET /inbox/conversations?view=groups. WAFlow uses cached metadata where possible and refreshes one selected group when appropriate.",
          parameters: [objectIdParam("id", "Inbox group conversation id")],
          responses: { 200: ok({ type: "object", properties: { group: { $ref: "#/components/schemas/InboxGroupDetails" } } }) },
        }),
      },
      "/inbox/conversations/{id}/messages": {
        get: operation({
          tags: ["Inbox"],
          summary: "List messages in a conversation",
          parameters: [objectIdParam("id", "Conversation id"), { name: "before", in: "query", schema: { type: "string", format: "date-time" } }, { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 75 } }],
          responses: { 200: ok({ type: "object", properties: { messages: { type: "array", items: { $ref: "#/components/schemas/Message" } }, nextCursor: { type: "string", nullable: true } } }) },
        }),
        post: operation({
          tags: ["Inbox"],
          summary: "Send text reply (uses one message credit)",
          parameters: [objectIdParam("id", "Conversation id")],
          requestBody: jsonBody({ type: "object", required: ["body"], properties: { body: { type: "string", minLength: 1, maxLength: 4000 } } }),
          responses: { 201: created({ type: "object", properties: { message: { $ref: "#/components/schemas/Message" } } }) },
        }),
      },
      "/campaigns": {
        get: operation({
          tags: ["Campaigns"],
          summary: "List campaigns",
          parameters: [{ name: "search", in: "query", schema: { type: "string" } }, { name: "status", in: "query", schema: { type: "string", enum: ["draft", "scheduled", "running", "paused", "completed", "failed", "all"] } }],
          responses: { 200: ok({ type: "object", properties: { campaigns: { type: "array", items: { $ref: "#/components/schemas/Campaign" } } } }) },
        }),
        post: operation({
          tags: ["Campaigns"],
          summary: "Create campaign",
          requestBody: jsonBody({
            type: "object",
            required: ["name", "templateId"],
            properties: {
              name: { type: "string", minLength: 3, maxLength: 140 },
              description: { type: "string" },
              accountId: { type: "string", description: "Opaque WhatsApp channel ID (ch_...)" },
              templateId: { type: "string" },
              audienceType: { type: "string", enum: ["all", "tag", "contacts"], default: "all" },
              audienceTag: { type: "string" },
              contactIds: { type: "array", items: { type: "string" } },
              scheduledAt: { type: "string", format: "date-time" },
              sendNow: { type: "boolean", default: false },
              ratePerMinute: { type: "integer", minimum: 1, maximum: 250, default: 120 },
            },
          }),
          responses: { 201: created({ type: "object", properties: { campaign: { $ref: "#/components/schemas/Campaign" } } }) },
        }),
      },
      "/campaigns/stream": {
        get: operation({ tags: ["Campaigns"], summary: "Server-sent campaign update stream", responses: { 200: { description: "SSE stream" } } }),
      },
      "/campaigns/{id}": {
        get: operation({ tags: ["Campaigns"], summary: "Get campaign", parameters: [objectIdParam("id", "Campaign id")], responses: { 200: ok({ type: "object", properties: { campaign: { $ref: "#/components/schemas/Campaign" } } }) } }),
        patch: operation({ tags: ["Campaigns"], summary: "Update campaign", parameters: [objectIdParam("id", "Campaign id")], requestBody: jsonBody({ $ref: "#/components/schemas/Campaign" }), responses: { 200: ok({ type: "object", properties: { campaign: { $ref: "#/components/schemas/Campaign" } } }) } }),
        delete: operation({ tags: ["Campaigns"], summary: "Delete campaign", parameters: [objectIdParam("id", "Campaign id")], responses: { 204: noContent } }),
      },
      "/campaigns/{id}/recipients": {
        get: operation({ tags: ["Campaigns"], summary: "List campaign recipients", parameters: [objectIdParam("id", "Campaign id")], responses: { 200: ok({ type: "object", properties: { recipients: { type: "array", items: { type: "object" } } } }) } }),
      },
      "/campaigns/{id}/rerun": {
        post: operation({ tags: ["Campaigns"], summary: "Rerun campaign", parameters: [objectIdParam("id", "Campaign id")], responses: { 200: ok({ type: "object", properties: { campaign: { $ref: "#/components/schemas/Campaign" } } }) } }),
      },
      "/campaigns/{id}/status": {
        patch: operation({
          tags: ["Campaigns"],
          summary: "Change campaign status",
          parameters: [objectIdParam("id", "Campaign id")],
          requestBody: jsonBody({ type: "object", required: ["status"], properties: { status: { type: "string", enum: ["running", "paused", "scheduled", "draft"] }, scheduledAt: { type: "string", format: "date-time" } } }),
          responses: { 200: ok({ type: "object", properties: { campaign: { $ref: "#/components/schemas/Campaign" } } }) },
        }),
      },
    },
  };
}
