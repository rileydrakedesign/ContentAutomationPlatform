import { Suspense } from "react";
import { InsightsPage } from "@/components/insights";

function InsightsLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-8 skeleton w-48"></div>
        <div className="h-4 skeleton w-72"></div>
      </div>
      <div className="h-12 skeleton w-64"></div>
      <div className="h-96 skeleton"></div>
    </div>
  );
}

export default function Insights() {
  return (
    <Suspense fallback={<InsightsLoading />}>
      <InsightsPage />
    </Suspense>
  );
}
