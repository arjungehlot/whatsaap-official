import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_shell/settings/team")({
  component: SettingsTeamPage,
});

function SettingsTeamPage() {
  return null;
}
