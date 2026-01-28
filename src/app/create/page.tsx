import { Suspense } from "react";
import { CreatePage } from "@/components/create";

export default function Create() {
  return (
    <Suspense fallback={<div className="text-slate-500">Loading...</div>}>
      <CreatePage />
    </Suspense>
  );
}
