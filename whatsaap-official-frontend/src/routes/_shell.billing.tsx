import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_shell/billing")({
  component: BillingPage,
});

function BillingPage() {
  return null;
}
