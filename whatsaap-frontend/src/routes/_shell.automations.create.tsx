import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_shell/automations/create")({
  component: AutomationBuilderPage,
});

function AutomationBuilderPage() {
  return null;
}
