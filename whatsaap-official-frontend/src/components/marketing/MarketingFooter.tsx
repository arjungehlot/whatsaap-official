import { Link } from "@tanstack/react-router"; 
import LogoDark from "@/Assets/LogoDark.png";

export function MarketingFooter() {
  return (
    <footer className="bg-slate-950 pt-16">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 pb-16 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8 lg:px-8">
        <div className="space-y-6">
          <Link to="/" className="flex items-center gap-3">
            <img src={LogoDark} alt="WAFlow Logo" className="h-14 w-auto" />
          </Link>
          <p className="max-w-xs text-[14.5px] leading-relaxed text-slate-400">
            WhatsApp automation, campaigns and shared inbox for growing businesses. Build the future of messaging.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-8 lg:col-span-2">
          <FooterCol
            title="Product"
            links={[
              { label: "Features", to: "/features" },
              { label: "Dashboard", to: "/dashboard" },
              { label: "Automations", to: "/automations" },
            ]}
          />
          <FooterCol
            title="Company"
            links={[
              { label: "Log in", to: "/login" },
              { label: "Create account", to: "/register" },
              { label: "Analytics", to: "/analytics" },
              // { label: "Billing", to: "/billing" },
            ]}
          />
        </div>
        <div className="space-y-6">
          <p className="text-sm font-bold uppercase tracking-wider text-slate-300">Stay in the loop</p>
          <p className="text-[14.5px] leading-relaxed text-slate-400">
            Product updates, delivery benchmarks and automation playbooks — once a month.
          </p>
          <p className="rounded-lg border border-slate-800 bg-slate-900/50 p-4 text-[13px] leading-relaxed text-slate-500">
            WAFlow is an independent product and is not affiliated with WhatsApp or Meta.
          </p>
        </div>
      </div>
      <div className="border-t border-slate-800/60 bg-slate-950 px-5 py-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-[13px] text-slate-500">
            © 2026 Smart ItBox. All rights reserved.
          </p>
          <div className="flex gap-6 text-[13px] text-slate-500">
            <Link to="/" className="transition-colors hover:text-[#00d084]">Privacy Policy</Link>
            <Link to="/" className="transition-colors hover:text-[#00d084]">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: { label: string; to: string }[];
}) {
  return (
    <div className="space-y-6">
      <p className="text-sm font-bold uppercase tracking-wider text-slate-300">{title}</p>
      <ul className="space-y-3.5">
        {links.map((l) => (
          <li key={l.label}>
            <Link
              to={l.to}
              className="inline-flex text-[14.5px] font-medium text-slate-400 transition-all duration-300 hover:translate-x-1 hover:text-[#00d084]"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
