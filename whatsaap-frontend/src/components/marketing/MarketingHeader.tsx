import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authService } from "@/services";
import LogoLight from "@/Assets/LogoLight1.png";
import LogoDark from "@/Assets/LogoDark.png";

const links = [
  { label: "Features", to: "/features" as const },
  { label: "How it Works", to: "/" as const, hash: "how-it-works" },
  { label: "FAQ", to: "/" as const, hash: "faq" },
];

export function MarketingHeader({ dark = false }: { dark?: boolean } = {}) {
  const [open, setOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    setIsAuthenticated(authService.isAuthenticated());
  }, []);

  return (
    <header
      className={
        dark
          ? "sticky top-0 z-40 border-b border-white/[0.08] bg-[#070A12]/80 backdrop-blur-xl text-white"
          : "sticky bg-white top-0 z-40 border-b border-border bg-surface/85 backdrop-blur-md"
      }
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-5 lg:px-8">
        <Link to="/" className="flex items-center gap-2.5">
          <div className={`h-13 w-15 flex items-center pt-4 justify-center overflow-hidden shrink-0 ${dark ? "" : "mix-blend-multiply"}`}>
            <video src="/LogoIcon.mp4" autoPlay loop muted playsInline className="scale-[.9] min-w-[200px]" />
          </div>
          {dark ? (
            <img src={LogoDark} alt="Whatsaap Logo" className="h-14 w-auto" />
          ) : (
            <>
              <img src={LogoLight} alt="Whatsaap Logo" className="h-14 w-auto dark:hidden" />
              <img src={LogoDark} alt="Whatsaap Logo" className="hidden h-14 w-auto dark:block" />
            </>
          )}
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link
              key={l.label}
              to={l.to}
              {...(l.hash ? { hash: l.hash } : {})}
              className={
                dark
                  ? "rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
                  : "rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              }
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-2 md:flex">
          {isAuthenticated ? (
            <Button
              className={dark ? "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold shadow-[0_0_20px_rgba(16,185,129,0.3)] border-0" : ""}
              asChild
            >
              <Link to="/dashboard">Dashboard</Link>
            </Button>
          ) : (
            <>
              <Button
                variant="ghost"
                className={dark ? "text-slate-300 hover:text-white hover:bg-white/10" : ""}
                asChild
              >
                <Link to="/login">Login</Link>
              </Button>
              <Button
                className={dark ? "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold shadow-[0_0_20px_rgba(16,185,129,0.3)] border-0" : ""}
                asChild
              >
                <Link to="/register">Get Started</Link>
              </Button>
            </>
          )}
        </div>

        <button
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
          className={
            dark
              ? "ml-auto rounded-md p-2 text-slate-300 hover:bg-white/10 md:hidden"
              : "ml-auto rounded-md p-2 text-muted-foreground hover:bg-secondary md:hidden"
          }
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {open && (
        <div className={dark ? "border-t border-white/10 bg-[#070A12] px-5 py-4 md:hidden" : "border-t border-border bg-surface px-5 py-4 md:hidden"}>
          <nav className="flex flex-col gap-1">
            {links.map((l) => (
              <Link
                key={l.label}
                to={l.to}
                {...(l.hash ? { hash: l.hash } : {})}
                onClick={() => setOpen(false)}
                className={
                  dark
                    ? "rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/10"
                    : "rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary"
                }
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="mt-3 flex gap-2">
            {isAuthenticated ? (
              <Button className={`flex-1 ${dark ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold" : ""}`} asChild>
                <Link to="/dashboard" onClick={() => setOpen(false)}>Dashboard</Link>
              </Button>
            ) : (
              <>
                <Button variant={dark ? "ghost" : "outline"} className={`flex-1 ${dark ? "text-slate-300 hover:text-white hover:bg-white/10 border border-white/10" : ""}`} asChild>
                  <Link to="/login">Login</Link>
                </Button>
                <Button className={`flex-1 ${dark ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold" : ""}`} asChild>
                  <Link to="/register">Get Started</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
