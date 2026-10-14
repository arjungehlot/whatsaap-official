import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_shell/settings/api")({
  component: SettingsApiPage,
});

function SettingsApiPage() {
  return null;
}
