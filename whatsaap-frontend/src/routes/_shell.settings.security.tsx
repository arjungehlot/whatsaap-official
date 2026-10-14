import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_shell/settings/security")({
  component: SettingsSecurityPage,
});

function SettingsSecurityPage() {
  return null;
}
