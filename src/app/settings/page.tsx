import { Suspense } from "react";
import { SettingsPage } from "@/components/settings";

export default function Settings() {
  return (
    <Suspense fallback={<div className="text-[var(--color-text-muted)]">Loading settings...</div>}>
      <SettingsPage />
    </Suspense>
  );
}
