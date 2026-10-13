import { useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authService } from "@/services";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Create your WAFlow account — Free WhatsApp Automation" },
      {
        name: "description",
        content:
          "Start free with WAFlow. Connect WhatsApp, import contacts and launch your first automated campaign in minutes.",
      },
      { property: "og:title", content: "Create your WAFlow account" },
      { property: "og:description", content: "Start automating WhatsApp for your business, free." },
    ],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirm: "",
  });
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);

  const mismatch = form.confirm.length > 0 && form.confirm !== form.password;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mismatch) {
      toast.error("Passwords do not match");
      return;
    }
    if (!accepted) {
      toast.error("Please accept the terms to continue");
      return;
    }
    setLoading(true);
    try {
      await authService.register(form.name, form.email, form.password);
      toast.success("Account created — let's connect your WhatsApp");
      void navigate({ to: "/dashboard" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create account");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Free for 500 contacts. No credit card required."
      footer={
        <p>
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Log in
          </Link>
        </p>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Full name</Label>
          <Input
            id="name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Kashif Ahmad"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Work email</Label>
          <Input
            id="email"
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="you@company.com"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirm password</Label>
            <Input
              id="confirm"
              type="password"
              required
              value={form.confirm}
              onChange={(e) => setForm({ ...form, confirm: e.target.value })}
              aria-invalid={mismatch}
            />
          </div>
        </div>
        {mismatch && <p className="text-xs text-destructive">Passwords do not match.</p>}
        <div className="flex items-start gap-2">
          <Checkbox
            id="terms"
            checked={accepted}
            onCheckedChange={(v) => setAccepted(v === true)}
            className="mt-0.5"
          />
          <Label htmlFor="terms" className="text-sm font-normal leading-snug text-muted-foreground">
            I agree to the Terms of Service and Privacy Policy.
          </Label>
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading && <Loader2 className="size-4 animate-spin" />}
          {loading ? "Creating account…" : "Create account"}
        </Button>

        <div className="relative py-1 text-center">
          <span className="relative z-10 bg-background px-3 text-xs text-muted-foreground">
            or continue with
          </span>
          <span className="absolute left-0 top-1/2 h-px w-full bg-border" />
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => {
            if (!accepted) {
              toast.error("Please accept the terms to continue");
              return;
            }
            authService.startGoogleLogin();
          }}
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
