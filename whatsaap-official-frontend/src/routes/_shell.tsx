import { Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { FeatureGate } from "@/components/billing/FeatureGate";
import { WorkspaceProvider } from "@/hooks/use-workspace-snapshot";

export const Route = createFileRoute("/_shell")({
  // Auth is stored in browser localStorage, so protected loaders must not run during SSR.
  ssr: false,
  component: ShellLayout,
});

function ShellLayout() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <WorkspaceProvider>
      <AppLayout>
        <FeatureGate key={pathname}>
          <Outlet />
        </FeatureGate>
      </AppLayout>
    </WorkspaceProvider>
  );
}
