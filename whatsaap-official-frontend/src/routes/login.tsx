import { useEffect, useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, Mail, Lock, Eye, EyeOff, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authService } from "@/services";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Log in to WAFlow — WhatsApp Automation Dashboard" },
      {
        name: "description",
        content:
          "Sign in to WAFlow to manage your WhatsApp campaigns, contacts, automations and message analytics.",
      },
      { property: "og:title", content: "Log in to WAFlow" },
      { property: "og:description", content: "Access your WhatsApp automation dashboard." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const reason = new URLSearchParams(window.location.search).get("reason");
    if (reason === "session_expired") {
      window.history.replaceState(null, "", window.location.pathname);
      const message = "Your session expired. Please log in again.";
      setErrorMessage(message);
      toast.info(message);
    }

    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const token = hash.get("google_token");
    const googleError = hash.get("google_error");
    if (authService.isAuthenticated() && !token && !googleError && reason !== "session_expired") {
      void navigate({ to: "/dashboard" });
      return;
    }
    if (!token && !googleError) return;

    window.history.replaceState(null, "", window.location.pathname);
    if (googleError) {
      setErrorMessage(googleError);
      toast.error(googleError);
      return;
    }

    if (!token) return;

    setLoading(true);
    void authService
      .completeGoogleLogin(token)
      .then((user) => {
        toast.success(`Welcome back, ${user.name}`);
        void navigate({ to: "/dashboard" });
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : "Unable to sign in with Google";
        setErrorMessage(message);
        toast.error(message);
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMessage("");
    try {
      const user = await authService.login(email, password);
      toast.success(`Welcome back, ${user.name}`);
      void navigate({ to: "/dashboard" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to log in";
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to your account"
      footer={
        <p>
          Don't have an account?{" "}
          <Link to="/register" className="font-semibold text-[#00df81] hover:underline">
            Create account
          </Link>
        </p>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email" className="font-semibold text-xs">Work email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="pl-10 h-10 text-base"
            />
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="font-semibold text-xs">Password</Label>
            <Link
              to="/forgot-password"
              className="text-xs font-semibold text-[#00a861] hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              aria-invalid={Boolean(errorMessage)}
              aria-describedby={errorMessage ? "login-error" : undefined}
              className="pl-10 pr-10 h-10 text-base"
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>
        {errorMessage && (
          <p id="login-error" className="rounded-md border border-destructive/25 bg-destructive-soft px-3 py-2 text-sm text-destructive">
            {errorMessage}
          </p>
        )}
        <div className="flex items-center gap-2 pt-1 pb-1">
          <Checkbox id="remember" defaultChecked className="data-[state=checked]:bg-[#00a861] data-[state=checked]:border-[#00a861]" />
          <Label htmlFor="remember" className="text-sm font-normal text-muted-foreground">
            Remember me for 30 days
          </Label>
        </div>
        <Button 
          type="submit" 
          className="w-full h-10 bg-[#059669] hover:bg-[#047857] text-white text-base font-medium rounded-lg" 
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin mr-2" />
          ) : null}
          {loading ? "Logging in…" : "Log in"}
          {!loading && <ArrowRight className="ml-2 size-4" />}
        </Button>

        <div className="relative py-2 text-center">
          <span className="relative z-10 bg-white px-4 text-xs text-muted-foreground">
            or
          </span>
          <span className="absolute left-0 top-1/2 h-px w-full bg-slate-100" />
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full h-10 text-base font-medium rounded-lg border-slate-200"
          onClick={() => authService.startGoogleLogin()}
          disabled={loading}
        >
          <GoogleMark /> Continue with Google
        </Button>
      </form>
    </AuthShell>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.4a5.5 5.5 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.6-5.2 3.6-8.8Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3a7.2 7.2 0 0 1-10.7-3.8H1.3v3.1A12 12 0 0 0 12 24Z"
      />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8l4-3.1Z" />
      <path
        fill="#EA4335"
        d="M12 4.8c1.8 0 3.4.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1A7.2 7.2 0 0 1 12 4.8Z"
      />
    </svg>
  );
}
