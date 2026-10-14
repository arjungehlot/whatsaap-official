import { createContext, useContext, type ReactNode } from "react";
import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { authService, billingService, type WorkspaceSnapshot } from "@/services";
import type { MessageCreditSummary } from "@/types";

type WorkspaceSnapshotQuery = UseQueryResult<WorkspaceSnapshot, Error>;

const WorkspaceSnapshotContext = createContext<WorkspaceSnapshotQuery | null>(null);

function useWorkspaceSnapshotQuery() {
  const authenticated = authService.isAuthenticated();
  const sessionRevision = authService.workspaceQueryKey();

  return useQuery({
    queryKey: ["workspace-snapshot", sessionRevision],
    queryFn: () => authService.workspace(),
    enabled: authenticated,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
  });
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const workspace = useWorkspaceSnapshotQuery();
  return (
    <WorkspaceSnapshotContext.Provider value={workspace}>
      {children}
    </WorkspaceSnapshotContext.Provider>
  );
}

/** Account, plan, and permissions are loaded once by WorkspaceProvider. */
export function useWorkspaceSnapshot() {
  const workspace = useContext(WorkspaceSnapshotContext);
  if (!workspace) throw new Error("useWorkspaceSnapshot must be used inside WorkspaceProvider");
  return workspace;
}

function messageCreditsQueryKey() {
  return ["message-credits", authService.workspaceQueryKey()] as const;
}

/**
 * Credit balance is intentionally separate because sends can change it while
 * the user remains signed in.
 */
export function useMessageCredits() {
  const authenticated = authService.isAuthenticated();

  return useQuery<MessageCreditSummary, Error>({
    queryKey: messageCreditsQueryKey(),
    queryFn: billingService.credits,
    enabled: authenticated,
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    retry: 1,
  });
}

/** Refresh immediately after a successful send or retry. */
export function useRefreshMessageCredits() {
  const queryClient = useQueryClient();

  return () => queryClient.invalidateQueries({ queryKey: messageCreditsQueryKey() });
}
