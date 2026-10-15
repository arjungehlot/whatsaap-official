import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  Check,
  CheckCircle2,
  Clock,
  Code2,
  FileText,
  Flame,
  Layers,
  Megaphone,
  MessageSquare,
  MessageSquareText,
  PlayCircle,
  QrCode,
  Radio,
  Send,
  Shield,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  Workflow,
  Zap,
} from "lucide-react";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Whatsaap — Next-Gen WhatsApp Automation & Broadcast API" },
      {
        name: "description",
        content:
          "Automate customer enquiries, broadcast high-converting campaigns, send instant PDF invoices & notes, and manage multi-agent inboxes at scale.",
      },
      { property: "og:title", content: "Whatsaap — Next-Gen WhatsApp Automation & Broadcast API" },
      {
        property: "og:description",
        content:
          "The all-in-one WhatsApp platform for fast-growing businesses, coaching institutes, and high-volume senders.",
      },
    ],
  }),
  component: LandingPage,
});

export default function LandingPage() {
  const [activeWorkflowTab, setActiveWorkflowTab] = useState<"education" | "ecommerce" | "services">("education");

  return (
    <div className="min-h-screen bg-[#07090E] text-slate-100 selection:bg-emerald-500/30 selection:text-emerald-300 font-sans antialiased overflow-x-hidden">
      {/* Dark Themed Header */}
      <MarketingHeader dark />

      {/* =========================================================================
          HERO SECTION
          ========================================================================= */}
      <section className="relative pt-12 pb-20 lg:pt-20 lg:pb-32 overflow-hidden">
        {/* Ambient Lights & Grid Background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff07_1px,transparent_1px),linear-gradient(to_bottom,#ffffff07_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_20%,#000_70%,transparent_100%)] pointer-events-none" />
        <div className="absolute top-[-15%] left-[20%] w-[600px] h-[600px] rounded-full bg-emerald-500/15 blur-[140px] pointer-events-none" />
        <div className="absolute top-[10%] right-[-5%] w-[550px] h-[550px] rounded-full bg-teal-500/15 blur-[160px] pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-indigo-500/10 blur-[150px] pointer-events-none" />

        <div className="relative mx-auto max-w-7xl px-5 lg:px-8">
          <div className="grid items-center gap-14 lg:grid-cols-12 lg:gap-10">
            {/* Left Content Column */}
            <div className="lg:col-span-7 space-y-6">
              {/* Badge */}
              <div className="inline-flex items-center gap-2.5 rounded-full border border-emerald-500/30 bg-emerald-950/40 px-4 py-1.5 backdrop-blur-md shadow-[0_0_20px_rgba(16,185,129,0.15)]">
                <span className="flex size-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-semibold tracking-wide text-emerald-300">
                  Official WhatsApp Broadcast & Automation Platform
                </span>
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300 uppercase tracking-wider">
                  Live v2.4
                </span>
              </div>

              {/* Main Headline */}
              <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl/tight">
                Turn WhatsApp into Your{" "}
                <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
                  #1 Revenue & Automation
                </span>{" "}
                Engine
              </h1>

              {/* Subtitle */}
              <p className="max-w-xl text-lg leading-relaxed text-slate-400">
                Broadcast campaigns with anti-ban protection, automate incoming student and customer enquiries, dispatch instant fee receipts/PDFs, and empower your team with a shared multi-agent inbox.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <Button
                  size="lg"
                  className="h-14 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 px-8 text-base font-bold text-slate-950 shadow-[0_0_30px_rgba(16,185,129,0.35)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_0_40px_rgba(16,185,129,0.5)] border-0"
                  asChild
                >
                  <Link to="/register">
                    Start Free Trial
                    <ArrowRight className="ml-2.5 size-5 transition-transform duration-300 group-hover:translate-x-1" />
                  </Link>
                </Button>

                <Button
                  size="lg"
                  variant="outline"
                  className="h-14 rounded-2xl border-white/10 bg-white/[0.04] hover:bg-white/[0.08] hover:text-white px-7 text-base font-semibold text-slate-300 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-white/20"
                  asChild
                >
                  <Link to="/api-docs">
                    <Code2 className="mr-2.5 size-5 text-emerald-400" />
                    Explore API & Docs
                  </Link>
                </Button>
              </div>

              {/* Micro Trust Stats */}
              <div className="pt-4 flex flex-wrap items-center gap-y-3 gap-x-6 text-xs text-slate-400 font-medium">
                <div className="flex items-center gap-2">
                  <div className="flex size-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                    <Check className="size-3" />
                  </div>
                  <span>Instant 2-Minute QR Setup</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex size-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                    <ShieldCheck className="size-3" />
                  </div>
                  <span>Anti-Ban Smart Delay Pacing</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex size-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                    <Zap className="size-3" />
                  </div>
                  <span>99.8% Verified Inbox Delivery</span>
                </div>
              </div>
            </div>

            {/* Right Column: Interactive Live WhatsApp Hub Mockup */}
            <div className="lg:col-span-5 relative">
              {/* Outer Glow */}
              <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-emerald-500/30 to-teal-500/20 blur-2xl opacity-70" />

              {/* Main Mockup Phone / Card */}
              <div className="relative rounded-3xl border border-white/10 bg-[#0B0F19]/90 p-3 shadow-2xl backdrop-blur-2xl">
                {/* Phone Header Bar */}
                <div className="flex items-center justify-between rounded-2xl bg-slate-900/90 border border-white/5 px-4 py-3 shadow-inner">
                  <div className="flex items-center gap-3">
                    <div className="relative flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-bold shadow-md">
                      NM
                      <span className="absolute bottom-0 right-0 size-2.5 rounded-full bg-emerald-400 ring-2 ring-slate-900" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-white">NearMeTeacher Bot</span>
                        <CheckCircle2 className="size-3.5 text-emerald-400 fill-emerald-400/20" />
                      </div>
                      <span className="text-[11px] text-emerald-400 font-medium">Verified WhatsApp Business • Online</span>
                    </div>
                  </div>

                  <span className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
                    Automated
                  </span>
                </div>

                {/* Chat Stream Window */}
                <div className="my-3 space-y-3.5 rounded-2xl bg-[#080B12] p-4 text-[13px] border border-white/5 min-h-[360px] flex flex-col justify-end">
                  {/* Message 1: Student enquiry */}
                  <div className="flex justify-start">
                    <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-slate-800/90 border border-white/5 p-3.5 text-slate-200 shadow-md">
                      <p className="font-semibold text-emerald-400 text-xs mb-1">Aarav Sharma (Student)</p>
                      <p>Hello! I want to enquire about demo classes for Class 10 Physics.</p>
                      <span className="mt-1 block text-right text-[10px] text-slate-400">10:42 AM</span>
                    </div>
                  </div>

                  {/* Message 2: Instant Bot Auto-Response */}
                  <div className="flex justify-end">
                    <div className="max-w-[88%] rounded-2xl rounded-tr-sm bg-emerald-950/70 border border-emerald-500/30 p-3.5 text-slate-100 shadow-lg shadow-emerald-950/50">
                      <p className="leading-relaxed">
                        Hello Aarav! 👋 Welcome to <strong className="text-emerald-300">NearMeTeacher</strong>. We have 3 top-rated Physics teachers active in your area.
                      </p>

                      {/* Interactive Buttons Preview */}
                      <div className="mt-3 space-y-1.5">
                        <div className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 py-2 px-3 text-center text-xs font-bold text-emerald-300 hover:bg-emerald-500/30 cursor-pointer transition-colors">
                          📅 Book Free Demo Class
                        </div>
                        <div className="flex items-center justify-center gap-2 rounded-xl bg-white/5 border border-white/10 py-1.5 px-3 text-center text-xs font-semibold text-slate-300">
                          📄 Download Physics Syllabus
                        </div>
                      </div>

                      <span className="mt-2 block text-right text-[10px] text-emerald-400/80">10:42 AM • Delivered ✓✓</span>
                    </div>
                  </div>

                  {/* Message 3: Automated PDF Receipt / Notes Dispatch */}
                  <div className="flex justify-end">
                    <div className="max-w-[88%] rounded-2xl rounded-tr-sm bg-slate-900 border border-white/10 p-3 text-slate-200 shadow-md">
                      <div className="flex items-center gap-2.5 rounded-xl bg-slate-950/80 p-2.5 border border-white/5">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-rose-500/20 text-rose-400 font-bold text-xs">
                          PDF
                        </div>
                        <div className="overflow-hidden">
                          <p className="truncate text-xs font-semibold text-white">Demo_Confirmation_Pass.pdf</p>
                          <p className="text-[10px] text-slate-400">1.2 MB • Auto-generated pass</p>
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-slate-300">
                        Demo scheduled with Ramesh Sir (Physics) for Tomorrow at 5:00 PM.
                      </p>
                      <span className="mt-1 block text-right text-[10px] text-emerald-400">10:43 AM • Read ✓✓</span>
                    </div>
                  </div>
                </div>

                {/* Floating Live Metric Card 1 */}
                <div className="absolute -bottom-5 -left-5 hidden sm:flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-[#090D18]/95 p-3.5 shadow-2xl backdrop-blur-xl">
                  <div className="flex size-11 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 shadow-inner">
                    <Zap className="size-5" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-medium">Broadcast Engine</p>
                    <p className="text-sm font-bold text-white">99.8% Delivery Rate</p>
                    <p className="text-[10px] text-emerald-400 font-semibold">1,450 / 1,450 messages queued</p>
                  </div>
                </div>

                {/* Floating Live Metric Card 2 */}
                <div className="absolute -top-5 -right-5 hidden sm:flex items-center gap-2.5 rounded-2xl border border-white/10 bg-[#090D18]/95 px-3.5 py-2.5 shadow-2xl backdrop-blur-xl">
                  <span className="flex size-2 rounded-full bg-emerald-400 animate-ping" />
                  <span className="text-xs font-bold text-slate-200">API Speed: 0.8s Latency</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* =========================================================================
          METRICS & IMPACT STATS
          (Replaces the previous generic client logos section)
          ========================================================================= */}
      <section className="relative border-y border-white/[0.08] bg-[#0A0D18]/60 py-12 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="grid grid-cols-2 gap-6 lg:grid-cols-4 lg:gap-8">
            {/* Stat 1 */}
            <div className="relative group rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 hover:bg-white/[0.04] hover:border-emerald-500/30 transition-all duration-300">
              <div className="flex items-center justify-between text-slate-400 mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Volume</span>
                <Send className="size-4 text-emerald-400" />
              </div>
              <p className="text-3xl font-extrabold text-white tracking-tight lg:text-4xl">25M+</p>
              <p className="mt-1 text-xs text-slate-400">Messages delivered safely across India</p>
            </div>

            {/* Stat 2 */}
            <div className="relative group rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 hover:bg-white/[0.04] hover:border-emerald-500/30 transition-all duration-300">
              <div className="flex items-center justify-between text-slate-400 mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Success Rate</span>
                <ShieldCheck className="size-4 text-teal-400" />
              </div>
              <p className="text-3xl font-extrabold text-white tracking-tight lg:text-4xl">99.9%</p>
              <p className="mt-1 text-xs text-slate-400">Verified inbox delivery and uptime</p>
            </div>

            {/* Stat 3 */}
            <div className="relative group rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 hover:bg-white/[0.04] hover:border-emerald-500/30 transition-all duration-300">
              <div className="flex items-center justify-between text-slate-400 mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Dispatch Speed</span>
                <Zap className="size-4 text-cyan-400" />
              </div>
              <p className="text-3xl font-extrabold text-white tracking-tight lg:text-4xl">&lt; 1.2s</p>
              <p className="mt-1 text-xs text-slate-400">Average webhook trigger to receipt</p>
            </div>

            {/* Stat 4 */}
            <div className="relative group rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 hover:bg-white/[0.04] hover:border-emerald-500/30 transition-all duration-300">
              <div className="flex items-center justify-between text-slate-400 mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">ROI & Conversion</span>
                <TrendingUp className="size-4 text-emerald-400" />
              </div>
              <p className="text-3xl font-extrabold text-white tracking-tight lg:text-4xl">8.4x</p>
              <p className="mt-1 text-xs text-slate-400">Higher engagement than SMS & email</p>
            </div>
          </div>
        </div>
      </section>


      {/* =========================================================================
          BENTO GRID: CORE PLATFORM CAPABILITIES
          ========================================================================= */}
      <section id="features" className="relative py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="mx-auto max-w-3xl text-center mb-16">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-bold text-emerald-400 uppercase tracking-widest">
              Core Capabilities
            </span>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl">
              Engineered for High-Scale Messaging
            </h2>
            <p className="mt-4 text-lg text-slate-400">
              From one-click QR connections to multi-thousand contact campaigns and deep REST API integrations.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* Bento Card 1: Broadcast & Campaigns */}
            <div className="group relative overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.02] p-8 hover:bg-white/[0.04] hover:border-emerald-500/40 transition-all duration-500 hover:-translate-y-1">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 text-emerald-400 mb-6 group-hover:scale-110 transition-transform">
                <Megaphone className="size-7" />
              </div>
              <h3 className="text-xl font-bold text-white">High-Speed Broadcasts</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-slate-400">
                Send personalized offers, alerts, and updates to thousands of contacts with custom delay intervals that keep your numbers safe and protected.
              </p>
              <ul className="mt-6 space-y-2.5 text-xs text-slate-300">
                <li className="flex items-center gap-2">
                  <Check className="size-3.5 text-emerald-400" /> Smart anti-ban delay algorithm
                </li>
                <li className="flex items-center gap-2">
                  <Check className="size-3.5 text-emerald-400" /> Per-recipient read and delivery tracking
                </li>
              </ul>
            </div>

            {/* Bento Card 2: Shared Team Inbox */}
            <div className="group relative overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.02] p-8 hover:bg-white/[0.04] hover:border-teal-500/40 transition-all duration-500 hover:-translate-y-1">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500/20 to-cyan-500/10 border border-teal-500/30 text-teal-400 mb-6 group-hover:scale-110 transition-transform">
                <MessageSquareText className="size-7" />
              </div>
              <h3 className="text-xl font-bold text-white">Shared Team Inbox</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-slate-400">
                A collaborative WhatsApp inbox for your entire team. Assign chats to agents, leave internal notes, and never let an enquiry slip through.
              </p>
              <ul className="mt-6 space-y-2.5 text-xs text-slate-300">
                <li className="flex items-center gap-2">
                  <Check className="size-3.5 text-teal-400" /> Multi-agent chat assignment & triage
                </li>
                <li className="flex items-center gap-2">
                  <Check className="size-3.5 text-teal-400" /> Canned templates & private notes
                </li>
              </ul>
            </div>

            {/* Bento Card 3: Visual Flow Automation */}
            <div className="group relative overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.02] p-8 hover:bg-white/[0.04] hover:border-cyan-500/40 transition-all duration-500 hover:-translate-y-1">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/10 border border-cyan-500/30 text-cyan-400 mb-6 group-hover:scale-110 transition-transform">
                <Workflow className="size-7" />
              </div>
              <h3 className="text-xl font-bold text-white">No-Code Flow Builder</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-slate-400">
                Build 24/7 intelligent automated conversations. Trigger welcome replies, wait intervals, conditional questions, and automated booking links.
              </p>
              <ul className="mt-6 space-y-2.5 text-xs text-slate-300">
                <li className="flex items-center gap-2">
                  <Check className="size-3.5 text-cyan-400" /> Keyword & new-contact triggers
                </li>
                <li className="flex items-center gap-2">
                  <Check className="size-3.5 text-cyan-400" /> Branching paths & delay nodes
                </li>
              </ul>
            </div>

            {/* Bento Card 4: REST API & Webhooks */}
            <div className="group relative overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.02] p-8 hover:bg-white/[0.04] hover:border-emerald-500/40 transition-all duration-500 hover:-translate-y-1">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/20 to-lime-500/10 border border-emerald-500/30 text-emerald-400 mb-6 group-hover:scale-110 transition-transform">
                <Code2 className="size-7" />
              </div>
              <h3 className="text-xl font-bold text-white">Developer REST API</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-slate-400">
                Integrate directly with Node.js, Python, PHP, or cURL. Fire automated notifications from your own backend (e.g. NearMeTeacher) in 5 lines of code.
              </p>
              <ul className="mt-6 space-y-2.5 text-xs text-slate-300">
                <li className="flex items-center gap-2">
                  <Check className="size-3.5 text-emerald-400" /> Idempotent message endpoints
                </li>
                <li className="flex items-center gap-2">
                  <Check className="size-3.5 text-emerald-400" /> Inbound & outbound webhook listeners
                </li>
              </ul>
            </div>

            {/* Bento Card 5: Documents & Media PDFs */}
            <div className="group relative overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.02] p-8 hover:bg-white/[0.04] hover:border-teal-500/40 transition-all duration-500 hover:-translate-y-1">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500/20 to-emerald-500/10 border border-teal-500/30 text-teal-400 mb-6 group-hover:scale-110 transition-transform">
                <FileText className="size-7" />
              </div>
              <h3 className="text-xl font-bold text-white">Media, Notes & PDF Invoices</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-slate-400">
                Send fee payment receipts, class notes, study guides, brochures, and images directly via direct URLs or public Google Drive share links.
              </p>
              <ul className="mt-6 space-y-2.5 text-xs text-slate-300">
                <li className="flex items-center gap-2">
                  <Check className="size-3.5 text-teal-400" /> Up to 50 MB document attachments
                </li>
                <li className="flex items-center gap-2">
                  <Check className="size-3.5 text-teal-400" /> Native Google Drive sharing support
                </li>
              </ul>
            </div>

            {/* Bento Card 6: Dynamic Segmentation */}
            <div className="group relative overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.02] p-8 hover:bg-white/[0.04] hover:border-cyan-500/40 transition-all duration-500 hover:-translate-y-1">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/20 to-teal-500/10 border border-cyan-500/30 text-cyan-400 mb-6 group-hover:scale-110 transition-transform">
                <Users className="size-7" />
              </div>
              <h3 className="text-xl font-bold text-white">Contact CRM & Segments</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-slate-400">
                Organize your audiences with tags, custom attributes, enrollment status, or courses. Filter and target high-converting segments in seconds.
              </p>
              <ul className="mt-6 space-y-2.5 text-xs text-slate-300">
                <li className="flex items-center gap-2">
                  <Check className="size-3.5 text-cyan-400" /> 1-Click CSV bulk import & export
                </li>
                <li className="flex items-center gap-2">
                  <Check className="size-3.5 text-cyan-400" /> Dynamic tag-based campaign filters
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>


      {/* =========================================================================
          LIVE PLAYBOOK / USE CASES SHOWCASE
          ========================================================================= */}
      <section className="relative border-y border-white/[0.08] bg-[#0A0D17]/80 py-24 lg:py-32 overflow-hidden">
        {/* Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-emerald-500/10 blur-[160px] pointer-events-none" />

        <div className="relative mx-auto max-w-7xl px-5 lg:px-8">
          <div className="mx-auto max-w-3xl text-center mb-12">
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">Automated Workflows</span>
            <h2 className="mt-3 text-3xl font-extrabold text-white sm:text-4xl">
              Built for Real-World Operations
            </h2>
            <p className="mt-3 text-base text-slate-400">
              See how modern teams automate mission-critical notifications without manual labor.
            </p>

            {/* Tab Selector */}
            <div className="mt-8 inline-flex rounded-2xl border border-white/10 bg-slate-900/90 p-1.5 shadow-lg backdrop-blur-xl">
              <button
                onClick={() => setActiveWorkflowTab("education")}
                className={`rounded-xl px-5 py-2.5 text-xs font-bold transition-all ${
                  activeWorkflowTab === "education"
                    ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-md"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                🎓 Education & NearMeTeacher
              </button>
              <button
                onClick={() => setActiveWorkflowTab("ecommerce")}
                className={`rounded-xl px-5 py-2.5 text-xs font-bold transition-all ${
                  activeWorkflowTab === "ecommerce"
                    ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-md"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                🛍️ E-Commerce & Retail
              </button>
              <button
                onClick={() => setActiveWorkflowTab("services")}
                className={`rounded-xl px-5 py-2.5 text-xs font-bold transition-all ${
                  activeWorkflowTab === "services"
                    ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-md"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                🏥 Clinic & Service Appointments
              </button>
            </div>
          </div>

          {/* Tab Content Display */}
          <div className="mt-10 rounded-3xl border border-white/10 bg-[#070A12] p-8 lg:p-12 shadow-2xl">
            {activeWorkflowTab === "education" && (
              <div className="grid items-center gap-10 lg:grid-cols-2">
                <div className="space-y-6">
                  <div className="inline-flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400">
                    Use Case: Education & EdTech
                  </div>
                  <h3 className="text-2xl font-bold text-white sm:text-3xl">
                    Automate Student Inquiries, Demo Classes & Study Notes
                  </h3>
                  <p className="text-slate-400 leading-relaxed">
                    Connect your student enquiry forms and teacher portal. When a student enquired about coaching, the teacher receives an instant WhatsApp alert with student details, while the student receives automated demo reminders and course PDFs.
                  </p>
                  <div className="space-y-3 pt-2">
                    <div className="flex items-start gap-3">
                      <div className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                        <Check className="size-3" />
                      </div>
                      <p className="text-sm text-slate-300">
                        <strong>Instant Teacher Alert:</strong> Notify teachers with student name, subject, and grade the moment an enquiry is submitted.
                      </p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                        <Check className="size-3" />
                      </div>
                      <p className="text-sm text-slate-300">
                        <strong>Demo Class Scheduling:</strong> Send automated calendar confirmations and Google Meet/Zoom links to student & parent.
                      </p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                        <Check className="size-3" />
                      </div>
                      <p className="text-sm text-slate-300">
                        <strong>Notes & Fee Receipts:</strong> Dispatch chapter study notes PDFs and payment receipts instantly via API.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Visual Workflow Steps */}
                <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 space-y-4">
                  <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-4">
                    <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400 font-bold text-xs">1</span>
                    <div>
                      <p className="text-xs font-bold text-white">Trigger: Student Enquiry Submitted</p>
                      <p className="text-[11px] text-slate-400">NearMeTeacher web form or mobile app enquiry</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-slate-950/80 p-4">
                    <span className="flex size-7 items-center justify-center rounded-lg bg-teal-500/20 text-teal-400 font-bold text-xs">2</span>
                    <div>
                      <p className="text-xs font-bold text-white">Action: Teacher WhatsApp Alert Dispatched</p>
                      <p className="text-[11px] text-slate-400">Sends details & one-tap accept button to teacher’s WhatsApp</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-slate-950/80 p-4">
                    <span className="flex size-7 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-400 font-bold text-xs">3</span>
                    <div>
                      <p className="text-xs font-bold text-white">Action: Demo Class Confirmation & Notes PDF</p>
                      <p className="text-[11px] text-slate-400">Student receives meeting link & attached sample syllabus PDF</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeWorkflowTab === "ecommerce" && (
              <div className="grid items-center gap-10 lg:grid-cols-2">
                <div className="space-y-6">
                  <div className="inline-flex items-center gap-2 rounded-lg bg-teal-500/10 px-3 py-1 text-xs font-bold text-teal-400">
                    Use Case: E-Commerce & Stores
                  </div>
                  <h3 className="text-2xl font-bold text-white sm:text-3xl">
                    Recover Abandoned Carts & Send Live Tracking
                  </h3>
                  <p className="text-slate-400 leading-relaxed">
                    Automate order confirmations, COD verification buttons, tracking updates, and recover up to 35% of abandoned carts with personalized discount coupons.
                  </p>
                  <div className="space-y-3 pt-2">
                    <div className="flex items-start gap-3">
                      <div className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-teal-500/20 text-teal-400">
                        <Check className="size-3" />
                      </div>
                      <p className="text-sm text-slate-300">
                        <strong>COD Verification:</strong> Eliminate RTO (Return to Origin) with instant one-tap confirmation buttons.
                      </p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-teal-500/20 text-teal-400">
                        <Check className="size-3" />
                      </div>
                      <p className="text-sm text-slate-300">
                        <strong>Live Shipping Tracking:</strong> Notify customers at every milestone from dispatched to out-for-delivery.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 space-y-4">
                  <div className="flex items-center gap-3 rounded-xl border border-teal-500/30 bg-teal-950/40 p-4">
                    <span className="flex size-7 items-center justify-center rounded-lg bg-teal-500/20 text-teal-400 font-bold text-xs">1</span>
                    <div>
                      <p className="text-xs font-bold text-white">Cart Abandoned (30 mins ago)</p>
                      <p className="text-[11px] text-slate-400">Shopper left without checkout</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-slate-950/80 p-4">
                    <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400 font-bold text-xs">2</span>
                    <div>
                      <p className="text-xs font-bold text-white">Auto-Reply: 10% Off Coupon + Product Photo</p>
                      <p className="text-[11px] text-slate-400">Direct WhatsApp message with instant checkout button</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeWorkflowTab === "services" && (
              <div className="grid items-center gap-10 lg:grid-cols-2">
                <div className="space-y-6">
                  <div className="inline-flex items-center gap-2 rounded-lg bg-cyan-500/10 px-3 py-1 text-xs font-bold text-cyan-400">
                    Use Case: Clinics & Service Booking
                  </div>
                  <h3 className="text-2xl font-bold text-white sm:text-3xl">
                    Reduce No-Shows with Automated Appointment Reminders
                  </h3>
                  <p className="text-slate-400 leading-relaxed">
                    Automate appointment bookings, 24-hour reminder pings, directions, and send lab reports or invoices straight to patient WhatsApp chats.
                  </p>
                  <div className="space-y-3 pt-2">
                    <div className="flex items-start gap-3">
                      <div className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-400">
                        <Check className="size-3" />
                      </div>
                      <p className="text-sm text-slate-300">
                        <strong>Interactive Reschedule / Confirm:</strong> Two-way buttons for patients to confirm attendance.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 space-y-4">
                  <div className="flex items-center gap-3 rounded-xl border border-cyan-500/30 bg-cyan-950/40 p-4">
                    <span className="flex size-7 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-400 font-bold text-xs">1</span>
                    <div>
                      <p className="text-xs font-bold text-white">Appointment Scheduled</p>
                      <p className="text-[11px] text-slate-400">Dr. Sharma Clinic - Friday 11:00 AM</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-slate-950/80 p-4">
                    <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400 font-bold text-xs">2</span>
                    <div>
                      <p className="text-xs font-bold text-white">Reminder 24 Hours Before + Location Pin</p>
                      <p className="text-[11px] text-slate-400">Automated reminder with Google Maps link</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>


      {/* =========================================================================
          HOW IT WORKS (4 EASY STEPS)
          ========================================================================= */}
      <section id="how-it-works" className="relative py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="mx-auto max-w-2xl text-center mb-16">
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">Quick Start</span>
            <h2 className="mt-3 text-3xl font-extrabold text-white sm:text-4xl">
              Live in 4 Simple Steps
            </h2>
            <p className="mt-3 text-slate-400">
              Zero coding needed to get started. Send your first broadcast campaign today.
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {/* Step 1 */}
            <div className="relative group rounded-3xl border border-white/10 bg-white/[0.02] p-7 hover:bg-white/[0.04] hover:border-emerald-500/30 transition-all duration-300">
              <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 font-bold text-slate-950 text-sm shadow-lg mb-6">
                01
              </span>
              <h3 className="text-lg font-bold text-white">Scan QR or Connect API</h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                Connect your WhatsApp number in under 60 seconds with QR scan, or bind your API key to an existing channel.
              </p>
            </div>

            {/* Step 2 */}
            <div className="relative group rounded-3xl border border-white/10 bg-white/[0.02] p-7 hover:bg-white/[0.04] hover:border-emerald-500/30 transition-all duration-300">
              <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-500 font-bold text-slate-950 text-sm shadow-lg mb-6">
                02
              </span>
              <h3 className="text-lg font-bold text-white">Import Contacts</h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                Upload your CSV files, sync contacts via webhook, or let incoming inquiries create contacts automatically.
              </p>
            </div>

            {/* Step 3 */}
            <div className="relative group rounded-3xl border border-white/10 bg-white/[0.02] p-7 hover:bg-white/[0.04] hover:border-emerald-500/30 transition-all duration-300">
              <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-emerald-500 font-bold text-slate-950 text-sm shadow-lg mb-6">
                03
              </span>
              <h3 className="text-lg font-bold text-white">Setup Flows & Messages</h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                Create templates with placeholders, attach PDF brochures or notes, and configure automated auto-replies.
              </p>
            </div>

            {/* Step 4 */}
            <div className="relative group rounded-3xl border border-white/10 bg-white/[0.02] p-7 hover:bg-white/[0.04] hover:border-emerald-500/30 transition-all duration-300">
              <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-400 font-bold text-slate-950 text-sm shadow-lg mb-6">
                04
              </span>
              <h3 className="text-lg font-bold text-white">Launch & Track Results</h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                Hit send and monitor sent, delivered, read, and reply rates in real-time right from your analytics dashboard.
              </p>
            </div>
          </div>
        </div>
      </section>


      {/* =========================================================================
          FAQ SECTION
          ========================================================================= */}
      <section id="faq" className="relative border-t border-white/[0.08] bg-[#0A0D18]/40 py-24 lg:py-32">
        <div className="mx-auto max-w-4xl px-5 lg:px-8">
          <div className="mx-auto max-w-2xl text-center mb-16">
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">Got Questions?</span>
            <h2 className="mt-3 text-3xl font-extrabold text-white sm:text-4xl">
              Frequently Asked Questions
            </h2>
            <p className="mt-3 text-slate-400">
              Everything you need to know about setup, sending limits, and integrations.
            </p>
          </div>

          <Accordion type="single" collapsible className="space-y-4">
            <AccordionItem
              value="faq-1"
              className="rounded-2xl border border-white/10 bg-slate-900/60 px-6 py-2 shadow-sm data-[state=open]:border-emerald-500/40 data-[state=open]:bg-slate-900/90"
            >
              <AccordionTrigger className="text-left text-base font-bold text-white hover:text-emerald-400 hover:no-underline py-4">
                How fast can I connect my WhatsApp number?
              </AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-slate-400 pb-4">
                You can connect your WhatsApp number in under 2 minutes by scanning a secure QR code in your dashboard, exactly like WhatsApp Web. Once connected, your messages, contacts, and automations are immediately live.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem
              value="faq-2"
              className="rounded-2xl border border-white/10 bg-slate-900/60 px-6 py-2 shadow-sm data-[state=open]:border-emerald-500/40 data-[state=open]:bg-slate-900/90"
            >
              <AccordionTrigger className="text-left text-base font-bold text-white hover:text-emerald-400 hover:no-underline py-4">
                Can I integrate this with my own custom backend (e.g. NearMeTeacher)?
              </AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-slate-400 pb-4">
                Yes! We provide full REST API endpoints with simple API Key authentication (<code className="text-emerald-400">x-api-key</code>). You can trigger messages on student enquiry, class scheduled, fee receipt generated, and notes uploaded with just a standard HTTP POST request in Node.js, Python, or PHP.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem
              value="faq-3"
              className="rounded-2xl border border-white/10 bg-slate-900/60 px-6 py-2 shadow-sm data-[state=open]:border-emerald-500/40 data-[state=open]:bg-slate-900/90"
            >
              <AccordionTrigger className="text-left text-base font-bold text-white hover:text-emerald-400 hover:no-underline py-4">
                How does the platform protect against WhatsApp bans?
              </AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-slate-400 pb-4">
                We have built-in intelligent rate-limiting and human-like delay intervals between broadcasts. This prevents sudden spikes that trigger spam filters. You can also customize hourly and daily limits per connected channel.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem
              value="faq-4"
              className="rounded-2xl border border-white/10 bg-slate-900/60 px-6 py-2 shadow-sm data-[state=open]:border-emerald-500/40 data-[state=open]:bg-slate-900/90"
            >
              <AccordionTrigger className="text-left text-base font-bold text-white hover:text-emerald-400 hover:no-underline py-4">
                Can I send PDFs, study notes, fee receipts, and images?
              </AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-slate-400 pb-4">
                Yes, our system fully supports sending PDF files, images, documents, and videos up to 50 MB per request. You can pass direct URLs or public Google Drive download links in the <code className="text-emerald-400">filePathUrl</code> parameter.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem
              value="faq-5"
              className="rounded-2xl border border-white/10 bg-slate-900/60 px-6 py-2 shadow-sm data-[state=open]:border-emerald-500/40 data-[state=open]:bg-slate-900/90"
            >
              <AccordionTrigger className="text-left text-base font-bold text-white hover:text-emerald-400 hover:no-underline py-4">
                Can multiple team members manage chats at the same time?
              </AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-slate-400 pb-4">
                Yes, our Multi-Agent Shared Inbox allows your entire team (counselors, support agents, teachers) to log in, respond to students/clients, assign chats, and add internal notes without sharing phone logins.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>


      {/* =========================================================================
          FINAL HIGH-CONVERTING CTA BANNER
          ========================================================================= */}
      <section className="relative overflow-hidden bg-[#06080F] py-24 lg:py-32">
        {/* Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] rounded-full bg-emerald-500/20 blur-[150px] pointer-events-none" />

        <div className="relative z-10 mx-auto max-w-4xl px-5 text-center lg:px-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-950/50 px-4 py-1.5 text-xs font-bold text-emerald-300 mb-6">
            🚀 Ready to scale your messaging?
          </div>

          <h2 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
            Start Automating Your WhatsApp{" "}
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
              In 2 Minutes
            </span>
          </h2>

          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400">
            Join innovative coaching centers, brands, and service businesses driving higher engagement and 10x faster response times with Whatsaap.
          </p>

          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Button
              className="h-14 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 px-9 text-base font-bold text-slate-950 shadow-[0_0_35px_rgba(16,185,129,0.35)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_0_45px_rgba(16,185,129,0.5)] border-0"
              asChild
            >
              <Link to="/register">
                Get Started Free
                <ArrowRight className="ml-2.5 size-5" />
              </Link>
            </Button>

            <Button
              variant="outline"
              className="h-14 rounded-2xl border-white/10 bg-white/[0.04] hover:bg-white/[0.08] hover:text-white px-8 text-base font-semibold text-slate-300 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-white/20"
              asChild
            >
              <Link to="/dashboard">
                Explore Dashboard
              </Link>
            </Button>
          </div>

          <p className="mt-6 text-xs text-slate-500">
            No credit card required • Instant QR connection • Cancel anytime
          </p>
        </div>
      </section>

      {/* Global Marketing Footer */}
      <MarketingFooter />
    </div>
  );
}
