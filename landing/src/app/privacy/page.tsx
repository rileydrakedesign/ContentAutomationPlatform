export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-heading text-2xl font-semibold">Privacy Policy</h1>
      <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
        Last updated: March 18, 2026
      </p>

      <div className="mt-8 space-y-8 text-sm leading-relaxed text-[var(--color-text-secondary)]">
        <section>
          <h2 className="mb-3 text-lg font-medium text-[var(--color-text-primary)]">
            1. What We Collect
          </h2>
          <p className="mb-2">
            The Agents For X browser extension and web dashboard collect the
            following data to provide their core functionality:
          </p>
          <ul className="list-disc space-y-1.5 pl-6">
            <li>
              <strong>Account credentials</strong> — your email address and an
              encrypted password, used solely for authentication.
            </li>
            <li>
              <strong>Authentication tokens</strong> — session tokens stored
              locally in your browser (via <code>chrome.storage.local</code>) to
              keep you signed in.
            </li>
            <li>
              <strong>Saved post data</strong> — when you save an X post as
              inspiration, we store the post URL, author handle, text content,
              and engagement metrics on our servers.
            </li>
            <li>
              <strong>Opportunity scores</strong> — computed client-side within
              the extension. Raw scores are not transmitted to our servers.
            </li>
            <li>
              <strong>AI reply generation context</strong> — when you generate
              an AI reply, the parent post text and author handle are sent to
              our server to produce reply suggestions.
            </li>
            <li>
              <strong>Feedback signals</strong> — optional thumbs-up/down
              feedback on generated replies, used to improve quality.
            </li>
            <li>
              <strong>Extension settings</strong> — your opportunity-scoring
              thresholds, dashboard URL preference, and feature toggles, stored
              locally in your browser.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-medium text-[var(--color-text-primary)]">
            2. How We Use Your Data
          </h2>
          <ul className="list-disc space-y-1.5 pl-6">
            <li>Authenticate you and maintain your session.</li>
            <li>
              Store and display posts you explicitly choose to save as
              inspiration or pattern references.
            </li>
            <li>
              Generate AI-powered reply suggestions based on post content you
              submit.
            </li>
            <li>
              Improve AI reply quality using aggregated, anonymised feedback
              signals.
            </li>
            <li>
              Sync your analytics and content data between the extension and
              the dashboard.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-medium text-[var(--color-text-primary)]">
            3. Data Stored Locally
          </h2>
          <p>
            The extension stores the following in{" "}
            <code>chrome.storage.local</code> on your device only:
          </p>
          <ul className="mt-2 list-disc space-y-1.5 pl-6">
            <li>Authentication tokens (access token, refresh token)</li>
            <li>Dashboard URL preference</li>
            <li>Opportunity scoring settings and thresholds</li>
            <li>IDs of posts you have saved (for UI state)</li>
          </ul>
          <p className="mt-2">
            This data never leaves your browser unless you explicitly trigger
            an action (e.g., saving a post or generating a reply).
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-medium text-[var(--color-text-primary)]">
            4. Third-Party Sharing
          </h2>
          <p>
            We do <strong>not</strong> sell, rent, or share your personal data
            with third parties. Your data is used exclusively to power the
            Agents For X product. AI reply generation is processed on our own
            infrastructure.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-medium text-[var(--color-text-primary)]">
            5. Data Retention &amp; Deletion
          </h2>
          <p>
            Your saved posts and account data are retained for as long as your
            account is active. You may delete individual saved posts from the
            dashboard at any time. To delete your entire account and all
            associated data, contact us at the address below.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-medium text-[var(--color-text-primary)]">
            6. Security
          </h2>
          <p>
            We use industry-standard encryption (HTTPS/TLS) for all data in
            transit. Authentication tokens are stored securely in the
            browser&apos;s extension storage. Server-side data is hosted on
            Supabase with row-level security policies.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-medium text-[var(--color-text-primary)]">
            7. Contact
          </h2>
          <p>
            For privacy-related questions or data deletion requests, email us
            at{" "}
            <a
              href="mailto:support@agentsforx.com"
              className="text-[var(--color-text-primary)] underline"
            >
              support@agentsforx.com
            </a>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
