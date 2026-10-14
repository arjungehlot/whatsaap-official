import { useMemo } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { LockKeyhole, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspaceSnapshot } from "@/hooks/use-workspace-snapshot";

const protectedRoutes = [
  { path: "/send-message", feature: "send-message", label: "Send message" }, 
  { path: "/campaigns", feature: "campaign-message", label: "Campaigns" },
  { path: "/templates", feature: "template", label: "Templates" },
  { path: "/automations", feature: "scheduler", label: "Schedulers" },
  { path: "/inbox", feature: "inbox", label: "Inbox" },
  { path: "/webhooks", feature: "webhook", label: "Webhooks" },
  { path: "/api-docs", feature: "api-keys", label: "API keys and documentation" },
];

export function FeatureGate({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const route = useMemo(
    () =>
      protectedRoutes.find(
        (item) => pathname === item.path || pathname.startsWith(`${item.path}/`),
      ),
    [pathname],
  );
  const workspace = useWorkspaceSnapshot();
  if (!route) return <>{children}</>;
  if (workspace.isLoading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }
  if (workspace.data?.features[route.feature]) return <>{children}</>;

  return (
    <div className="flex min-h-[420px] items-center justify-center">
      <div className="card-surface max-w-lg px-8 py-10 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-lg bg-primary-soft text-primary">
          <LockKeyhole className="size-5" />
        </span>
        <h1 className="mt-5 text-xl font-semibold">{route.label} is locked</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your current plan does not include this feature. Choose a plan that includes{" "}
          {route.label.toLowerCase()} to unlock it.
        </p>
        <Button className="mt-6" asChild>
          <Link to="/pricing">Upgrade plan</Link>
        </Button>
      </div>
    </div>
  );
}
