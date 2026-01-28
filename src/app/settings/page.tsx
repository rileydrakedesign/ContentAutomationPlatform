import { Suspense } from "react";
import { SettingsPage } from "@/components/settings";

export default function Settings() {
  return (
    <Suspense fallback={<div className="text-slate-500">Loading settings...</div>}>
      <SettingsPage />
    </Suspense>
  );
}
