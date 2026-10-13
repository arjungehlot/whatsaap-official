import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Loader2, MailCheck } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authService } from "@/services";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset your WAFlow password" },
      {
        name: "description",
        content: "Request a secure password reset link for your WAFlow workspace account.",
      },
      { property: "og:title", content: "Reset your WAFlow password" },
      { property: "og:description", content: "Get back into your WhatsApp automation dashboard." },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await authService.requestPasswordReset(email);
    setLoading(false);
    setSent(true);
  }

  return (
    <AuthShell
      title={sent ? "Check your inbox" : "Reset your password"}
      subtitle={
        sent
          ? `We sent a password reset link to ${email}. The link expires in 30 minutes.`
          : "Enter the email linked to your workspace and we'll send a reset link."
      }
      footer={
        <p>
          <Link to="/login" className="font-medium text-primary hover:underline">
            Back to log in
          </Link>
        </p>
      }
    >
      {sent ? (
        <div className="card-surface flex items-start gap-3 p-5">
          <MailCheck className="mt-0.5 size-5 shrink-0 text-primary" />
          <div>
            <p className="text-sm font-medium">Reset link sent</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Didn&apos;t receive it? Check spam, or{" "}
              <button
                onClick={() => setSent(false)}
                className="font-medium text-primary hover:underline"
              >
                try another email
              </button>
              .
            </p>
          </div>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Work email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="size-4 animate-spin" />}
            {loading ? "Sending link…" : "Send reset link"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
