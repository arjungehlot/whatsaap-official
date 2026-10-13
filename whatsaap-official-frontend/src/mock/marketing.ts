export const featureCards = [
  {
    icon: "smartphone",
    title: "WhatsApp Connection",
    body: "Link your number with a secure QR scan and monitor session health, uptime and sync status in real time.",
  },
  {
    icon: "megaphone",
    title: "Campaign Management",
    body: "Build audiences, schedule sends, throttle delivery speed and watch results land message by message.",
  },
  {
    icon: "users",
    title: "Contact Management",
    body: "Tags, segments, custom fields, imports and a full conversation history for every contact.",
  },
  {
    icon: "message",
    title: "Message Templates",
    body: "Reusable templates with variables, multi-language support and a live WhatsApp preview.",
  },
  {
    icon: "workflow",
    title: "Automations",
    body: "Visual workflows with triggers, conditions, waits and actions — no engineering required.",
  },
  {
    icon: "chart",
    title: "Analytics",
    body: "Delivery, read and reply rates broken down by campaign, template, segment and time window.",
  },
  {
    icon: "logs",
    title: "Message History",
    body: "A searchable log of every message with per-status timelines and clear failure reasons.",
  },
  {
    icon: "team",
    title: "Team Management",
    body: "Invite teammates, assign conversations and control access with roles and permissions.",
  },
] as const;

export const steps = [
  {
    title: "Connect WhatsApp",
    body: "Scan a QR code once. WAFlow keeps the session alive and alerts you if it ever drops.",
  },
  {
    title: "Bring in your contacts",
    body: "Import a CSV or sync from your forms, then organise everyone with tags and segments.",
  },
  {
    title: "Create templates & campaigns",
    body: "Write once with variables, preview exactly what customers see, then schedule the send.",
  },
  {
    title: "Automate and measure",
    body: "Trigger follow-ups automatically and track delivery, reads and replies in one dashboard.",
  },
];

export const faqs = [
  {
    q: "Do I need the WhatsApp Business API to use WAFlow?",
    a: "No. You link your existing WhatsApp number from the dashboard using a QR code, the same way WhatsApp Web works. Business API support is on the roadmap for high-volume senders.",
  },
  {
    q: "How many messages can I send per day?",
    a: "Sending limits depend on your plan and your number's own reputation. WAFlow lets you set a delivery rate so campaigns go out at a safe, natural pace.",
  },
  {
    q: "Can my team share one inbox?",
    a: "Yes. Professional and Business plans include a shared inbox with conversation assignment, internal notes and role-based access.",
  },
  {
    q: "What happens if my WhatsApp session disconnects?",
    a: "You get an instant notification, campaigns pause automatically, and the connection page walks you through reconnecting without losing queued messages.",
  },
  {
    q: "Is my data secure?",
    a: "Sessions and API keys are stored encrypted and never exposed in the dashboard. Destructive actions always require explicit confirmation.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes, plans are monthly with no lock-in. You keep access to exports of your contacts and message history.",
  },
];

export const socialProof = [
  { value: "18M+", label: "Messages delivered" },
  { value: "4,200+", label: "Businesses onboarded" },
  { value: "98.4%", label: "Average delivery rate" },
  { value: "< 2 min", label: "Time to first campaign" },
];
