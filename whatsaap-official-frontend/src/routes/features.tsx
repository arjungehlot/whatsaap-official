import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  CheckCircle,
  Megaphone,
  MessageSquareText,
  ScrollText,
  Smartphone,
  Sparkles,
  Users,
  UsersRound,
  Workflow,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { Button } from "@/components/ui/button";
import { featureCards } from "@/mock/marketing";

export const Route = createFileRoute("/features")({
  head: () => ({
    meta: [
      { title: "Features — WAFlow WhatsApp Automation Platform" },
      {
        name: "description",
        content:
          "Explore WAFlow features: WhatsApp connection, team inbox, contacts, campaigns, templates, visual automations, analytics and message logs.",
      },
      { property: "og:title", content: "WAFlow Features" },
      {
        property: "og:description",
        content:
          "Everything WAFlow gives your team: campaigns, shared inbox, automations, templates and delivery analytics.",
      },
    ],
  }),
  component: FeaturesPage,
});

const iconMap: Record<string, LucideIcon> = {
  smartphone: Smartphone,
  megaphone: Megaphone,
  users: Users,
  message: MessageSquareText,
  workflow: Workflow,
  chart: BarChart3,
  logs: ScrollText,
  team: UsersRound,
};

const detail: Record<string, string[]> = {
  "WhatsApp Connection": [
    "QR pairing with live session status",
    "Automatic reconnect prompts",
    "Uptime and last-sync monitoring",
  ],
  "Campaign Management": [
    "Audience from segments, tags or CSV",
    "Scheduling and delivery rate control",
    "Per-recipient delivery breakdown",
  ],
  "Contact Management": [
    "Tags, segments and custom fields",
    "CSV import with column mapping",
    "Opt-out and blocked handling",
  ],
  "Message Templates": [
    "Variables with sample values",
    "Category and language organisation",
    "Live WhatsApp bubble preview",
  ],
  Automations: [
    "Drag-and-drop workflow canvas",
    "Triggers, waits, conditions, actions",
    "Enable/disable without deleting",
  ],
  Analytics: [
    "Delivery, read and reply trends",
    "Campaign and template comparisons",
    "Exportable date-range reports",
  ],
  "Message History": [
    "Search by contact, status or campaign",
    "Full status timeline per message",
    "Clear failure reasons",
  ],
  "Team Management": [
    "Invite members with roles",
    "Assign conversations to agents",
    "Activity visibility for admins",
  ],
};

function FeaturesPage() {
  return (
    <div className="min-h-screen bg-background selection:bg-primary/20">
      <MarketingHeader />

      <section className="relative overflow-hidden border-b border-border bg-background pb-12 pt-16 lg:pb-16 lg:pt-24">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,var(--color-primary-soft)_0%,transparent_70%)] opacity-50" />
        <div className="absolute -top-40 -right-40 size-96 rounded-full bg-primary/10 blur-[100px]" />
        <div className="absolute -top-40 -left-40 size-96 rounded-full bg-primary/10 blur-[100px]" />
        
        <div className="relative mx-auto max-w-4xl px-5 text-center lg:px-8">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary shadow-sm backdrop-blur-md transition-colors hover:bg-primary/10">
            <Sparkles className="size-3.5" />
            <span>Discover WAFlow Features</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight lg:text-5xl">
            One platform for every <span className="text-gradient-brand">WhatsApp workflow</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground lg:text-lg">
            WAFlow replaces the spreadsheet, the personal phone and the guesswork with a single
            dashboard your whole team can use.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button size="default" className="group rounded-full px-6 text-sm shadow-md shadow-primary/25 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/30" asChild>
              <Link to="/register">
                Get Started Free <ArrowRight className="ml-2 size-3.5 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
            <Button size="default" variant="outline" className="rounded-full px-6 text-sm backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:bg-surface-muted" asChild>
              <Link to="/pricing">See pricing</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="relative mx-auto max-w-7xl px-5 py-12 lg:px-8 lg:py-16">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
          {featureCards.map((f) => {
            const Icon = iconMap[f.icon]!;
            return (
              <article 
                key={f.title} 
                className="group relative overflow-hidden rounded-2xl border border-border bg-surface p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/10 flex flex-col"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                <div className="relative flex-1 flex flex-col">
                  <div className="mb-4 flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary ring-1 ring-primary/20 transition-all duration-300 group-hover:scale-110 group-hover:bg-primary group-hover:text-primary-foreground group-hover:ring-primary/50 group-hover:shadow-md group-hover:shadow-primary/30">
                    <Icon className="size-5" />
                  </div>
                  <h2 className="text-lg font-semibold tracking-tight text-foreground">{f.title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
                  <ul className="mt-auto pt-5 space-y-2 border-t border-border/50">
                    {(detail[f.title] ?? []).map((d) => (
                      <li key={d} className="flex items-start gap-2.5 text-xs font-medium text-muted-foreground transition-colors group-hover:text-foreground/90">
                        <CheckCircle className="mt-0.5 size-3.5 shrink-0 text-primary/70 transition-colors group-hover:text-primary" /> 
                        <span className="leading-snug">{d}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="relative overflow-hidden border-t border-border bg-surface py-16 text-center lg:py-20">
        <div className="absolute inset-0 bg-grid-faint opacity-50" />
        <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
        <div className="relative mx-auto max-w-4xl px-5 lg:px-8">
          <h2 className="text-3xl font-bold tracking-tight text-foreground lg:text-4xl">Ready to see it live?</h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground">
            Explore the full dashboard with realistic sample data — no setup needed.
          </p>
          <Button size="default" className="group mt-6 rounded-full px-8 text-sm shadow-md shadow-primary/20 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/30" asChild>
            <Link to="/dashboard">
              Open the demo dashboard <ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </Button>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
