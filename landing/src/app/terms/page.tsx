export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-heading text-2xl font-semibold">terms</h1>
      <p className="mt-4 text-[var(--color-text-secondary)]">
        placeholder terms for the waitlist. this is not legal advice.
      </p>
      <ul className="mt-6 list-disc space-y-2 pl-6 text-sm text-[var(--color-text-secondary)]">
        <li>waitlist access is invite-only and may change over time.</li>
        <li>no guarantees on timing, features, or availability.</li>
      </ul>
    </main>
  );
}
