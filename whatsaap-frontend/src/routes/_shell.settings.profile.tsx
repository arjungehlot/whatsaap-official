import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_shell/settings/profile")({
  component: SettingsProfilePage,
});

function SettingsProfilePage() {
  return null;
}
