import { redirect } from "next/navigation";

// Bare /drafts has no page of its own — drafts live in the Create page's
// Drafts tab. Redirect so deep links and manual URLs don't 404.
export default function DraftsIndexPage() {
  redirect("/create?tab=drafts");
}
