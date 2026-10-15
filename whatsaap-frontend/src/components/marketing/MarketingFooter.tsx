import { Link } from "@tanstack/react-router";
import LogoDark from "@/Assets/LogoDark.png";
import { CheckCircle2, ShieldCheck, Zap, ArrowUpRight } from "lucide-react";

export function MarketingFooter() {
  return (
    <footer className="relative border-t border-white/10 bg-[#06080F] text-slate-300 pt-16 pb-12 overflow-hidden">
      {/* Background ambient glow */}
      <div className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[250px] bg-emerald-500/5 blur-[120px] rounded-full" />

      <div className="relative mx-auto max-w-7xl px-5 lg:px-8">
        {/* Main Footer Grid */}
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-8 pb-14 border-b border-white/10">
          
          {/* Brand & Value Proposition Column */}
          <div className="space-y-6 lg:col-span-4">
            <Link to="/" className="inline-block transition-opacity hover:opacity-90">
              <img src={LogoDark} alt="Whatsaap Logo" className="h-12 w-auto object-contain" />
            </Link>

            <p className="max-w-sm text-[14.5px] leading-relaxed text-slate-400">
              Enterprise-grade WhatsApp marketing, broadcast campaigns, automated customer engagement workflows, and multi-agent shared inbox for scaling teams.
            </p>

            {/* Live Status Badge */}
            <div className="inline-flex items-center gap-2.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-medium text-emerald-400">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
              </span>
              <span>All Systems Operational (99.9% Uptime)</span>
            </div>

            {/* Trust Badges */}
            <div className="flex flex-wrap items-center gap-3 pt-2 text-xs text-slate-500">
              <div className="inline-flex items-center gap-1.5">
                <ShieldCheck className="size-4 text-emerald-400" />
                <span>End-to-End Secure</span>
              </div>
              <span>•</span>
              <div className="inline-flex items-center gap-1.5">
                <Zap className="size-4 text-amber-400" />
                <span>Multi-Device Protocol</span>
              </div>
            </div>
          </div>

          {/* Nav Links Grid */}
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:col-span-8">
            {/* Column 1: Product */}
            <div className="space-y-4">
              <p className="text-xs font-bold uppercase tracking-wider text-white">Product</p>
              <ul className="space-y-3">
                <FooterNavLink to="/features" label="Features & Tools" />
                <FooterNavLink to="/pricing" label="Pricing Plans" />
                <FooterNavLink to="/dashboard" label="Live Dashboard" />
                <FooterNavLink to="/inbox" label="Shared Inbox" />
                <FooterNavLink to="/campaigns" label="Broadcast Campaigns" />
                <FooterNavLink to="/whatsapp" label="WhatsApp Sessions" />
              </ul>
            </div>

            {/* Column 2: Developers */}
            <div className="space-y-4">
              <p className="text-xs font-bold uppercase tracking-wider text-white">Developers & API</p>
              <ul className="space-y-3">
                <FooterNavLink to="/api-docs" label="API Documentation" />
                <FooterNavLink to="/webhooks" label="Webhooks & Events" />
                <FooterNavLink to="/templates" label="Message Templates" />
                <FooterNavLink to="/contacts" label="Contact Management" />
                <FooterNavLink to="/analytics" label="Analytics & Metrics" />
              </ul>
            </div>

            {/* Column 3: Account & Access */}
            <div className="space-y-4">
              <p className="text-xs font-bold uppercase tracking-wider text-white">Get Started</p>
              <ul className="space-y-3">
                <FooterNavLink to="/login" label="Sign In to Whatsaap" />
                <FooterNavLink to="/register" label="Create Free Account" isHighlight />
                <FooterNavLink to="/forgot-password" label="Reset Password" />
                <FooterNavLink to="/features" label="Why Whatsaap" />
              </ul>
            </div>
          </div>
        </div>

        {/* Disclaimer Box */}
        <div className="mt-8 rounded-xl border border-white/5 bg-white/[0.02] p-4 text-xs leading-relaxed text-slate-500">
          <p>
            <strong className="text-slate-400">Disclaimer:</strong> Whatsaap is an independent software platform and is not affiliated, associated, authorized, endorsed by, or in any way officially connected with WhatsApp LLC, Meta Platforms, Inc., or any of their subsidiaries or affiliates. The official WhatsApp website can be found at <a href="https://whatsapp.com" target="_blank" rel="noreferrer" className="underline hover:text-slate-300">whatsapp.com</a>.
          </p>
        </div>

        {/* Bottom Bar */}
        <div className="mt-8 flex flex-col items-center justify-between gap-4 pt-4 text-xs text-slate-500 sm:flex-row">
          <p>© {new Date().getFullYear()} Whatsaap. All rights reserved.</p>

          <div className="flex flex-wrap items-center gap-6">
            <Link to="/features" className="transition-colors hover:text-emerald-400">
              Platform Features
            </Link>
            <Link to="/pricing" className="transition-colors hover:text-emerald-400">
              Pricing
            </Link>
            <Link to="/api-docs" className="transition-colors hover:text-emerald-400">
              Developer Docs
            </Link>
            <Link to="/login" className="transition-colors hover:text-emerald-400">
              Login
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterNavLink({
  to,
  label,
  isHighlight = false,
}: {
  to: string;
  label: string;
  isHighlight?: boolean;
}) {
  return (
    <li>
      <Link
        to={to}
        className={`inline-flex items-center gap-1 text-[13.5px] transition-all duration-200 hover:translate-x-1 ${
          isHighlight
            ? "font-semibold text-emerald-400 hover:text-emerald-300"
            : "text-slate-400 hover:text-white"
        }`}
      >
        <span>{label}</span>
        {isHighlight && <ArrowUpRight className="size-3.5" />}
      </Link>
    </li>
  );
}
