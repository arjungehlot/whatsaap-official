import { Link, createFileRoute } from "@tanstack/react-router"; 
import {
  ArrowRight,
  BarChart3,
  Check,
  Megaphone,
  MessageSquareText,
  ScrollText,
  Smartphone,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
  UsersRound,
  Workflow,
  PlayCircle,
  CheckCircle2,
} from "lucide-react";
import homeImg from "@/Assets/Home.png";
import type { LucideIcon } from "lucide-react";

// Eagerly import all 43 client logos via Vite glob
const clientLogos = Object.values(
  import.meta.glob("@/Assets/clients/*.png", { eager: true, import: "default" }) as Record<string, string>
).sort();

import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { DashboardPreview } from "@/components/marketing/DashboardPreview";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { faqs, featureCards, socialProof, steps } from "@/mock/marketing";
import { plans } from "@/mock/data";
import { inr } from "@/lib/format";

const allLogos = Object.values(import.meta.glob('@/Assets/clients/*.{png,jpg,jpeg,svg}', { eager: true, import: 'default' })) as string[];
const half = Math.ceil(allLogos.length / 2);
const clientLogosRow1 = allLogos.slice(0, half);
const clientLogosRow2 = allLogos.slice(half);

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "WAFlow — WhatsApp Automation & Campaigns for Business" },
      {
        name: "description",
        content:
          "Connect WhatsApp, manage contacts, launch campaigns, automate conversations and track every message from one powerful dashboard.",
      },
      { property: "og:title", content: "WAFlow — WhatsApp Automation for Business" },
      {
        property: "og:description",
        content:
          "Campaigns, shared inbox, automations and delivery analytics for your WhatsApp number.",
      },
    ],
  }),
  component: LandingPage,
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

function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border bg-slate-50/50">
        {/* Ambient Grid & Glows */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-60" />
        <div className="absolute top-0 right-0 w-[50%] h-[70%] rounded-full bg-emerald-400/10 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[50%] rounded-full bg-teal-400/10 blur-[120px] pointer-events-none" />

        <div className="relative mx-auto grid max-w-[1500px] items-center gap-10 px-5 pt-8 pb-10 lg:grid-cols-2 lg:gap-14 lg:px-10 lg:pt-10 lg:pb-16 xl:px-16">
          <div className="z-10 lg:pl-10 xl:pl-16">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-50/80 backdrop-blur-sm px-3.5 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm">
              <Sparkles className="size-3.5 text-emerald-500" /> Built for WhatsApp-first businesses
            </span>
            <h1 className="mt-5 text-[36px] font-bold leading-[1.1]  sm:text-5xl lg:text-[3rem] xl:text-[3.4rem]">
              <span className="whitespace-nowrap text-slate-900">Powerful WhatsApp</span>
              <br />
              <span className="whitespace-nowrap text-slate-900">automation,</span>
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00b875] to-teal-400 whitespace-nowrap drop-shadow-sm">built for your business</span>
            </h1>
            <p className="mt-5 max-w-xl text-[17px] leading-[1.65] text-slate-500">
              Connect your WhatsApp, manage contacts, create campaigns, automate conversations, and
              track every message from one powerful dashboard.
            </p>

            {/* Feature Icons Row */}
            <div className="mt-8 flex items-center justify-between max-w-[460px]">
              <div className="group flex flex-col items-center gap-2 cursor-default">
                <div className="flex size-12 items-center justify-center rounded-[14px] bg-white border border-slate-100 shadow-sm transition-all duration-300 ease-out group-hover:-translate-y-1 group-hover:shadow-md group-hover:bg-[#00d084] group-hover:border-[#00d084]">
                  <Users className="size-5 text-[#00b875] transition-colors duration-300 group-hover:text-white" />
                </div>
                <span className="text-[13px] font-semibold text-slate-500 text-center leading-tight transition-colors duration-300 group-hover:text-slate-900">Manage<br />Contacts</span>
              </div>
              <div className="group flex flex-col items-center gap-2 cursor-default">
                <div className="flex size-12 items-center justify-center rounded-[14px] bg-white border border-slate-100 shadow-sm transition-all duration-300 ease-out group-hover:-translate-y-1 group-hover:shadow-md group-hover:bg-[#00d084] group-hover:border-[#00d084]">
                  <Megaphone className="size-5 text-[#00b875] transition-colors duration-300 group-hover:text-white" />
                </div>
                <span className="text-[13px] font-semibold text-slate-500 text-center leading-tight transition-colors duration-300 group-hover:text-slate-900">Create<br />Campaigns</span>
              </div>
              <div className="group flex flex-col items-center gap-2 cursor-default">
                <div className="flex size-12 items-center justify-center rounded-[14px] bg-white border border-slate-100 shadow-sm transition-all duration-300 ease-out group-hover:-translate-y-1 group-hover:shadow-md group-hover:bg-[#00d084] group-hover:border-[#00d084]">
                  <Workflow className="size-5 text-[#00b875] transition-colors duration-300 group-hover:text-white" />
                </div>
                <span className="text-[13px] font-semibold text-slate-500 text-center leading-tight transition-colors duration-300 group-hover:text-slate-900">Automate<br />Conversations</span>
              </div>
              <div className="group flex flex-col items-center gap-2 cursor-default">
                <div className="flex size-12 items-center justify-center rounded-[14px] bg-white border border-slate-100 shadow-sm transition-all duration-300 ease-out group-hover:-translate-y-1 group-hover:shadow-md group-hover:bg-[#00d084] group-hover:border-[#00d084]">
                  <BarChart3 className="size-5 text-[#00b875] transition-colors duration-300 group-hover:text-white" />
                </div>
                <span className="text-[13px] font-semibold text-slate-500 text-center leading-tight transition-colors duration-300 group-hover:text-slate-900">Track<br />Performance</span>
              </div>
            </div>

            <div className="mt-9 flex flex-row w-full sm:w-auto gap-3 sm:gap-4">
              <Button size="lg" className="group relative overflow-hidden bg-gradient-to-b from-[#00d084] to-[#00b875] hover:from-[#00b875] hover:to-[#00a368] text-white flex-1 sm:flex-none px-2 sm:px-9 h-[52px] rounded-xl text-[13px] sm:text-[16px] font-bold shadow-[0_8px_20px_rgba(0,208,132,0.25)] hover:shadow-[0_12px_25px_rgba(0,208,132,0.35)] transition-all duration-300 hover:-translate-y-1 border border-[#00d084]/50" asChild>
                <Link to="/register">
                  <span className="relative z-10 flex items-center justify-center w-full h-full">
                    Get Started <ArrowRight className="ml-1.5 sm:ml-2.5 size-4 transition-transform duration-300 group-hover:translate-x-1.5 shrink-0" />
                  </span>
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="group flex-1 sm:flex-none px-2 sm:px-9 h-[52px] rounded-xl text-[13px] sm:text-[16px] font-bold border-slate-200/80 text-slate-700 bg-white/80 backdrop-blur-md shadow-sm hover:bg-white hover:text-slate-900 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-slate-300" asChild>
                <Link to="/dashboard">
                  <span className="flex items-center justify-center w-full h-full">
                    <PlayCircle className="mr-1.5 sm:mr-2.5 size-4 sm:size-5 text-[#00d084] transition-transform duration-300 group-hover:scale-110 shrink-0" /> Watch Demo
                  </span>
                </Link>
              </Button>
            </div>

          </div>

          <div className="relative mt-12 lg:mt-0 hidden lg:flex items-center justify-center w-full z-10">
            <img
              src={homeImg}
              alt="WAFlow Dashboard Hero"
              className="w-[110%] lg:w-[115%] xl:w-[125%] max-w-none h-auto object-contain drop-shadow-[0_20px_50px_rgba(0,0,0,0.12)] pointer-events-none animate-in fade-in slide-in-from-right-8 duration-1000 ease-out mt-5 lg:-ml-8 xl:-ml-12"
            />
          </div>
        </div>
      </section>




      {/* Client Logo Grid */}
      <section className="border-y border-slate-100 bg-white py-12">
        <div className="mx-auto max-w-6xl px-8 lg:px-16">
          {/* Header */}
          <div className="mb-10 text-center">
            <span className="inline-flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              <span className="h-px w-10 bg-slate-200" />
              Trusted across industries
              <span className="h-px w-10 bg-slate-200" />
            </span>
            <h2 className="mt-3 text-2xl font-bold text-slate-800">Businesses already running on WAFlow</h2>
            <p className="mt-2 text-sm text-slate-500">From manufacturing to retail — teams like yours automate their operations with us.</p>
          </div>

          {/* Card wrapper */}
          <div className="rounded-2xl border border-slate-100 bg-slate-50/40 px-6 py-8 shadow-sm">
            <div className="mb-1 flex items-center justify-between px-1 pb-4 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              <span>A growing network of smarter businesses</span>
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
                400+ businesses trust WAFlow
              </span>
            </div>

            {/* Row 1 — logos 0–9 (first 10) */}
            <div className="grid grid-cols-5 gap-4">
              {clientLogos.slice(0, 10).map((src, idx) => (
                <div
                  key={idx}
                  className="flex h-20 items-center justify-center rounded-xl border border-slate-100 bg-white px-5 py-3 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:border-slate-200"
                >
                  <img
                    src={src}
                    alt={`Client logo ${idx + 1}`}
                    className="max-h-12 max-w-full object-contain"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>

            {/* Row 2 — logos 10–19 (next 10) */}
            <div className="mt-4 grid grid-cols-5 gap-4">
              {clientLogos.slice(10, 20).map((src, idx) => (
                <div
                  key={idx}
                  className="flex h-20 items-center justify-center rounded-xl border border-slate-100 bg-white px-5 py-3 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:border-slate-200"
                >
                  <img
                    src={src}
                    alt={`Client logo ${idx + 11}`}
                    className="max-h-12 max-w-full object-contain"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-24">
        <SectionIntro
          eyebrow="Platform"
          title="Everything you need to run WhatsApp at scale"
          body="From the first QR scan to the last delivery report — WAFlow covers the full messaging workflow."
        />
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {featureCards.map((f, i) => {
            const Icon = iconMap[f.icon]!;
            return (
              <div
                key={f.title}
                className="group relative overflow-hidden rounded-2xl bg-white p-6 lg:p-7 border border-slate-200/80 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-xl hover:shadow-[#00d084]/10 hover:border-[#00d084]/30"
              >
                <span className="absolute inset-x-0 top-0 h-1 origin-left scale-x-0 bg-gradient-to-r from-[#00d084] to-[#00b875] transition-transform duration-300 ease-out group-hover:scale-x-100" />
                <div className="flex items-start justify-between">
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-[#e6f7ec] shadow-sm transition-all duration-300 group-hover:scale-110 group-hover:bg-[#00d084] group-hover:shadow-md">
                    <Icon className="size-6 text-[#00b875] transition-colors duration-300 group-hover:text-white" />
                  </div>
                  <span className="text-[13px] font-semibold text-slate-300 tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="mt-6 text-[17px] font-semibold text-slate-800 transition-colors duration-200 group-hover:text-slate-900">{f.title}</h3>
                <p className="mt-2.5 text-[14px] leading-relaxed text-slate-500">{f.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="relative border-y border-slate-200/60 bg-slate-50/40 overflow-hidden">
        {/* Decorative background gradients */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[30%] h-[50%] rounded-full bg-emerald-400/5 blur-[100px] pointer-events-none" />
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[30%] h-[50%] rounded-full bg-teal-400/5 blur-[100px] pointer-events-none" />

        <div className="relative z-10 mx-auto max-w-7xl px-5 py-24 lg:px-8 lg:py-32">
          <SectionIntro
            eyebrow="How it works"
            title="Live in four steps, not four weeks"
            body="Most teams send their first campaign the same day they sign up."
          />
          <div className="relative mt-20">
            {/* Connecting line between cards */}
            <div className="absolute top-[calc(50%+12px)] left-[8%] right-[8%] hidden h-[2px] bg-slate-200/50 lg:block z-0" />
            <div className="absolute top-[calc(50%+12px)] left-[8%] right-[8%] hidden h-[2px] overflow-hidden lg:block z-0 opacity-50">
              <div className="h-full w-full bg-[linear-gradient(to_right,#00d084_50%,transparent_50%)] bg-[length:24px_100%] animate-marquee-reverse" />
            </div>

            <ol className="relative z-10 grid gap-10 lg:grid-cols-4 lg:gap-8 pt-6">
              {steps.map((s, i) => (
                <li key={s.title} className="group relative">
                  {/* Step number badge (Floating above) */}
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#00d084] to-[#00b875] text-white shadow-lg shadow-[#00d084]/30 ring-[6px] ring-slate-50 transition-all duration-500 ease-out group-hover:scale-110 group-hover:-translate-y-1.5 group-hover:shadow-xl group-hover:shadow-[#00d084]/40 z-20">
                    <span className="text-[19px] font-bold">
                      {i + 1}
                    </span>
                  </div>
                  
                  {/* Card Body */}
                  <div className="relative flex h-full flex-col rounded-[24px] bg-white p-8 pt-12 text-center border border-slate-200/80 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] transition-all duration-500 ease-out hover:-translate-y-1 hover:border-[#00d084]/40 hover:shadow-2xl hover:shadow-[#00d084]/15">
                     <div className="absolute inset-0 rounded-[24px] bg-gradient-to-b from-[#00d084]/[0.03] to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                     <div className="relative z-10 flex-1 flex flex-col">
                        <h3 className="text-[19px] font-bold text-slate-800 transition-colors duration-300 group-hover:text-slate-900">{s.title}</h3>
                        <p className="mt-4 text-[15px] leading-relaxed text-slate-500">{s.body}</p>
                     </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* Capability split sections */}
      <section className="mx-auto max-w-7xl space-y-20 px-5 py-20 lg:px-8 lg:py-28">
        <Capability
          eyebrow="Automation"
          title="Conversations that continue without you"
          body="Trigger a welcome message the moment a contact arrives, wait a day, then branch based on whether they replied. Build it visually and switch it on."
          bullets={[
            "Triggers for new contacts, keywords, tags and campaign completion",
            "Waits, conditions and branching paths",
            "Per-automation run history and success rate",
          ]}
          to="/automations"
          panel={<AutomationPanel />}
        />
        <Capability
          reverse
          eyebrow="Campaigns"
          title="Bulk sending with delivery you can trust"
          body="Pick a segment, choose a template, set a sending pace and schedule it. Watch sent, delivered, read and failed counts update per recipient."
          bullets={[
            "Audience from all contacts, segments, tags or CSV",
            "Rate limiting so numbers stay healthy",
            "Per-recipient status and retry visibility",
          ]}
          to="/campaigns"
          panel={<CampaignPanel />}
        />
        <Capability
          eyebrow="Contacts & Analytics"
          title="Know who you're messaging and what worked"
          body="A contact record for every number, plus delivery and reply analytics that make it obvious which templates and segments perform."
          bullets={[
            "Tags, segments, custom fields and notes",
            "Delivery, read and reply rate trends",
            "Top campaigns and most engaged contacts",
          ]}
          to="/analytics"
          panel={<AnalyticsPanel />}
        />
      </section>

      {/* Pricing */}
      {/* <section id="pricing" className="border-y border-border bg-surface">
        <div className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-24">
          <SectionIntro
            eyebrow="Pricing"
            title="Simple plans that scale with your volume"
            body="Start free. Upgrade when your campaigns outgrow the limits."
          />
          <div className="mt-12 grid gap-4 lg:grid-cols-4">
            {plans.map((p) => (
              <div
                key={p.id}
                className={`card-surface relative flex flex-col overflow-hidden p-6 transition-transform duration-200 ${
                  p.id === "professional"
                    ? "ring-2 ring-primary hover:-translate-y-1"
                    : "hover:-translate-y-0.5"
                }`}
              >
                {p.id === "professional" && (
                  <span className="absolute -right-9 top-4 w-32 rotate-45 bg-primary py-1 text-center text-[11px] font-semibold text-primary-foreground">
                    Popular
                  </span>
                )}
                <h3 className="text-base font-semibold">{p.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{p.tagline}</p>
                <p className="mt-5 text-3xl font-semibold tracking-tight">
                  {p.price === 0 ? "Free" : inr(p.price)}
                  {p.price > 0 && (
                    <span className="text-sm font-normal text-muted-foreground">/month</span>
                  )}
                </p>
                <ul className="mt-5 flex-1 space-y-2.5">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" /> {f}
                    </li>
                  ))}
                </ul>
                <Button
                  className="mt-6"
                  variant={p.id === "professional" ? "default" : "outline"}
                  asChild
                >
                  <Link to="/register">{p.price === 0 ? "Start free" : `Choose ${p.name}`}</Link>
                </Button>
              </div>
            ))}
          </div>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Need higher volume or on-premise hosting?{" "}
            <Link to="/pricing" className="font-medium text-primary hover:underline">
              Compare plans in detail
            </Link>
          </p>
        </div>
      </section> */}

      {/* FAQ */}
      <section id="faq" className="bg-slate-50/50 py-24 lg:py-32">
        <div className="mx-auto max-w-3xl px-5 lg:px-8">
          <div className="mx-auto max-w-2xl text-center mb-12">
            <p className="text-[13px] font-bold uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-[#00d084] to-teal-400">FAQ</p>
            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl text-slate-900">Questions, answered</h2>
          </div>
          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((f) => (
              <AccordionItem key={f.q} value={f.q} className="rounded-2xl border border-slate-200/80 bg-white px-6 py-2 shadow-sm transition-all duration-300 hover:shadow-md hover:border-slate-300 data-[state=open]:shadow-md data-[state=open]:border-[#00d084]/30 data-[state=open]:ring-1 data-[state=open]:ring-[#00d084]/20">
                <AccordionTrigger className="text-left text-[16px] font-bold text-slate-800 transition-colors hover:text-[#00d084] hover:no-underline py-4">
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="text-[15px] leading-relaxed text-slate-500 pb-5">
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative overflow-hidden bg-slate-900 py-24 lg:py-32">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-emerald-500/20 blur-[120px] pointer-events-none" />
        <div className="absolute -bottom-[20%] -right-[10%] w-[50%] h-[50%] rounded-full bg-teal-500/20 blur-[120px] pointer-events-none" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]" />

        <div className="relative z-10 mx-auto max-w-4xl px-5 text-center lg:px-8">
          <h2 className="text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
            Send your first automated <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00d084] to-teal-400">campaign today</span>
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400">
            Connect WhatsApp in a minute, import your contacts, and let WAFlow handle the rest. Join the innovative teams building the future of messaging.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Button className="h-14 rounded-xl bg-[#00d084] px-8 text-[16px] font-bold text-white shadow-[0_4px_14px_rgba(0,208,132,0.39)] transition-all duration-300 hover:bg-[#00b875] hover:shadow-[0_6px_20px_rgba(0,208,132,0.23)] hover:-translate-y-1" asChild>
              <Link to="/register">
                Get Started Free <ArrowRight className="ml-2 size-5" />
              </Link>
            </Button>
            <Button className="h-14 rounded-xl border border-slate-700 bg-slate-800/50 px-8 text-[16px] font-bold text-white backdrop-blur-sm transition-all duration-300 hover:bg-slate-700 hover:-translate-y-1" asChild>
              <Link to="/features">Explore features</Link>
            </Button>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="size-1.5 animate-bounce rounded-full bg-muted-foreground/50"
      style={{ animationDelay: delay, animationDuration: "900ms" }}
    />
  );
}

function SectionIntro({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-sm font-semibold uppercase tracking-wider text-primary">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight">{title}</h2>
      {body && <p className="mt-4 text-muted-foreground">{body}</p>}
    </div>
  );
}

function Capability({
  eyebrow,
  title,
  body,
  bullets,
  panel,
  to,
  reverse,
}: {
  eyebrow: string;
  title: string;
  body: string;
  bullets: string[];
  panel: React.ReactNode;
  to: string;
  reverse?: boolean;
}) {
  return (
    <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
      <div className={reverse ? "lg:order-2" : ""}>
        <p className="text-[13px] font-bold uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-[#00d084] to-teal-400">
          {eyebrow}
        </p>
        <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl text-slate-900">
          {title}
        </h2>
        <p className="mt-5 text-[17px] leading-relaxed text-slate-500">
          {body}
        </p>
        <ul className="mt-8 space-y-4">
          {bullets.map((b) => (
            <li key={b} className="group flex items-start gap-3 text-[15.5px]">
              <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 transition-all duration-300 group-hover:bg-[#00d084] group-hover:scale-110 group-hover:shadow-md group-hover:shadow-[#00d084]/20">
                <Check className="size-3 text-emerald-600 transition-colors duration-300 group-hover:text-white" />
              </div>
              <span className="text-slate-600 transition-colors duration-300 group-hover:text-slate-900">{b}</span>
            </li>
          ))}
        </ul>
        <Button className="mt-10 h-12 rounded-xl bg-[#00d084] px-6 text-white shadow-[0_4px_14px_rgba(0,208,132,0.39)] transition-all duration-300 hover:bg-[#00b875] hover:shadow-[0_6px_20px_rgba(0,208,132,0.23)] hover:-translate-y-0.5" asChild>
          <Link to={to}>
            See it in action <ArrowRight className="ml-2 size-4" />
          </Link>
        </Button>
      </div>
      <div className={reverse ? "lg:order-1" : ""}>
        <div className="relative group">
          <div className="absolute -inset-4 rounded-3xl bg-gradient-to-tr from-[#00d084]/20 to-teal-400/20 opacity-0 blur-xl transition-opacity duration-500 group-hover:opacity-100" />
          <div className="relative rounded-3xl border border-slate-200/80 bg-white p-2 shadow-2xl shadow-slate-200/50 transition-transform duration-500 group-hover:-translate-y-2">
             <div className="overflow-hidden rounded-2xl bg-slate-50/50 border border-slate-100">
                {panel}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AutomationPanel() {
  const nodes = [
    { kind: "Trigger", label: "New contact added", tone: "bg-emerald-100/80 text-emerald-700 border-emerald-200", live: true },
    { kind: "Action", label: "Send template: Welcome", tone: "bg-blue-100/80 text-blue-700 border-blue-200", live: false },
    { kind: "Wait", label: "1 day", tone: "bg-amber-100/80 text-amber-700 border-amber-200", live: false },
    { kind: "Condition", label: "Customer replied?", tone: "bg-slate-100 text-slate-700 border-slate-200", live: false },
  ];
  return (
    <div className="space-y-3 p-6 sm:p-8">
      {nodes.map((n, i) => (
        <div key={n.label} className="group/node">
          <div className="flex items-center gap-3.5 rounded-2xl border border-slate-200/60 bg-white px-5 py-4 shadow-sm transition-all duration-300 hover:shadow-md hover:border-slate-300">
            <span className={`relative rounded-lg border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${n.tone}`}>
              {n.live && (
                <span className="absolute -left-1.5 -top-1.5 size-2.5 animate-pulse rounded-full bg-[#00d084] ring-4 ring-white" />
              )}
              {n.kind}
            </span>
            <span className="text-[14.5px] font-semibold text-slate-700 group-hover/node:text-slate-900">{n.label}</span>
          </div>
          {i < nodes.length - 1 && <div className="mx-auto h-5 w-[2px] bg-slate-200" />}
        </div>
      ))}
      <div className="grid grid-cols-2 gap-3 pt-3">
        <div className="rounded-xl border border-emerald-200/60 bg-emerald-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-emerald-600 shadow-sm text-center">
          Yes → follow-up
        </div>
        <div className="rounded-xl border border-amber-200/60 bg-amber-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-amber-600 shadow-sm text-center">
          No → reminder
        </div>
      </div>
    </div>
  );
}

function CampaignPanel() {
  const rows = [
    { name: "Summer Sale", status: "Running", progress: 74, tone: "bg-emerald-100/80 text-emerald-700 border-emerald-200" },
    { name: "Product Launch", status: "Completed", progress: 100, tone: "bg-slate-100 text-slate-600 border-slate-200" },
    { name: "Festival Offer", status: "Scheduled", progress: 0, tone: "bg-blue-100/80 text-blue-700 border-blue-200" },
    { name: "Cart Recovery", status: "Paused", progress: 48, tone: "bg-amber-100/80 text-amber-700 border-amber-200" },
  ];
  return (
    <div className="space-y-4 p-6 sm:p-8">
      {rows.map((r) => (
        <div key={r.name} className="group/row rounded-2xl border border-slate-200/60 bg-white p-4 shadow-sm transition-all duration-300 hover:shadow-md hover:border-slate-300">
          <div className="flex items-center justify-between">
            <span className="text-[14.5px] font-bold text-slate-700 group-hover/row:text-slate-900">{r.name}</span>
            <span className={`rounded-lg border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${r.tone}`}>
              {r.status}
            </span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-gradient-to-r from-[#00d084] to-teal-400 transition-all duration-1000 ease-out" style={{ width: `${r.progress}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function AnalyticsPanel() {
  const metrics = [
    { label: "Delivery rate", value: "98.4%", delta: "+1.2%", up: true },
    { label: "Read rate", value: "72.1%", delta: "+3.6%", up: true },
    { label: "Reply rate", value: "24.6%", delta: "+0.8%", up: true },
    { label: "Failed", value: "1.6%", delta: null, up: false },
  ];
  return (
    <div className="grid grid-cols-2 gap-4 p-6 sm:p-8">
      {metrics.map((m) => (
        <div key={m.label} className="group/metric rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:border-slate-300">
          <p className="text-[13px] font-semibold text-slate-500">{m.label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{m.value}</p>
          {m.delta && (
            <div
              className={`mt-2 flex w-max items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${
                m.up ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
              }`}
            >
              {m.up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
              {m.delta}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
