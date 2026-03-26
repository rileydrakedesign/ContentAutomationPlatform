import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 text-[var(--color-text-secondary)]">
      <Link
        href="/agent-for-x"
        className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
      >
        &larr; back
      </Link>

      <h1 className="text-heading text-2xl font-semibold text-[var(--color-text-primary)] mt-6">
        Privacy Policy
      </h1>
      <p className="mt-1 text-xs text-[var(--color-text-muted)]">
        Last updated: March 25, 2026
      </p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed">
        <section>
          <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-2">1. Overview</h2>
          <p>
            Agents for X (&quot;the Service&quot;) is operated by Agents for X (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;).
            This policy describes what data we collect, how we use it, and your rights.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-2">2. Data We Collect</h2>

          <h3 className="text-sm font-medium text-[var(--color-text-primary)] mt-3 mb-1">Account data</h3>
          <p>Email address and password (hashed) for authentication. Optional: name, profile information.</p>

          <h3 className="text-sm font-medium text-[var(--color-text-primary)] mt-3 mb-1">X account data</h3>
          <p>
            When you connect your X account, we store OAuth tokens (encrypted) to act on your behalf.
            We may access your public profile, timeline, and post metrics as needed to provide the Service.
          </p>

          <h3 className="text-sm font-medium text-[var(--color-text-primary)] mt-3 mb-1">Content you provide</h3>
          <ul className="mt-1 list-disc space-y-1 pl-6">
            <li>Posts you save via the Chrome extension</li>
            <li>Voice examples and settings you configure</li>
            <li>Drafts you create or generate</li>
            <li>Analytics CSV files you upload</li>
          </ul>

          <h3 className="text-sm font-medium text-[var(--color-text-primary)] mt-3 mb-1">Usage data</h3>
          <p>
            We collect basic usage data (pages visited, features used, errors encountered) to improve the Service.
            We do not use third-party analytics trackers.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-2">3. How We Use Your Data</h2>
          <ul className="list-disc space-y-1 pl-6">
            <li>To provide and improve the Service</li>
            <li>To personalize AI-generated content using your voice settings and examples</li>
            <li>To publish content to X on your behalf when you request it</li>
            <li>To analyze your content performance when you upload analytics data</li>
            <li>To send transactional emails (account verification, billing)</li>
            <li>To respond to support requests</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-2">4. AI Processing</h2>
          <p>
            To generate replies and drafts, we send your voice settings, examples, and relevant context to third-party
            AI providers (OpenAI, Anthropic). This data is sent only to generate content for you and is subject to
            each provider&apos;s data processing terms. We do not use your content to train AI models.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-2">5. Data Sharing</h2>
          <p>We do not sell your data. We share data only with:</p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li><strong>AI providers</strong> (OpenAI, Anthropic) — to generate content, subject to their privacy policies</li>
            <li><strong>X (Twitter)</strong> — to publish content and read your timeline, per your authorization</li>
            <li><strong>Infrastructure providers</strong> (Supabase, Vercel, Upstash) — to host and operate the Service</li>
            <li><strong>Payment processor</strong> (Stripe) — to process payments, if applicable</li>
          </ul>
          <p className="mt-2">
            We may disclose data if required by law or to protect our rights, safety, or the safety of others.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-2">6. Chrome Extension</h2>
          <p>
            The Chrome extension operates on x.com and twitter.com. It reads post content visible on the page to
            enable saving and reply generation. It communicates only with our servers (app.agentsforx.com) and does
            not send data to any other third party. The extension stores authentication tokens locally in your browser.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-2">7. Data Security</h2>
          <p>
            We use industry-standard measures to protect your data including encrypted connections (TLS), row-level
            database security, hashed passwords, and encrypted OAuth tokens. No system is 100% secure, and we cannot
            guarantee absolute data security.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-2">8. Data Retention</h2>
          <p>
            We retain your data for as long as your account is active. When you delete your account, we will delete
            your personal data within 30 days, except where retention is required by law. Anonymized, aggregated data
            may be retained indefinitely.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-2">9. Your Rights</h2>
          <p>You have the right to:</p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li><strong>Access</strong> — request a copy of the data we hold about you</li>
            <li><strong>Correct</strong> — update inaccurate information</li>
            <li><strong>Delete</strong> — request deletion of your account and data</li>
            <li><strong>Disconnect</strong> — revoke X account access at any time from Settings</li>
            <li><strong>Export</strong> — request a machine-readable export of your data</li>
          </ul>
          <p className="mt-2">To exercise any of these rights, contact us at support@agentsforx.com.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-2">10. Cookies</h2>
          <p>
            We use essential cookies for authentication and session management. We do not use advertising or
            tracking cookies.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-2">11. Changes to This Policy</h2>
          <p>
            We may update this policy from time to time. We will notify you of material changes via email or in-app
            notification. Continued use of the Service after changes constitutes acceptance.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-2">12. Contact</h2>
          <p>
            For questions about this Privacy Policy, contact us at support@agentsforx.com.
          </p>
        </section>
      </div>
    </main>
  );
}
