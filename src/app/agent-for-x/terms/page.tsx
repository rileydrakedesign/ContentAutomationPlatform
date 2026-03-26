import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 text-[var(--color-text-secondary)]">
      <Link
        href="/agent-for-x"
        className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
      >
        &larr; back
      </Link>

      <h1 className="text-heading text-2xl font-semibold text-[var(--color-text-primary)] mt-6">
        Terms of Service
      </h1>
      <p className="mt-1 text-xs text-[var(--color-text-muted)]">
        Last updated: March 25, 2026
      </p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed">
        <section>
          <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-2">1. Acceptance of Terms</h2>
          <p>
            By accessing or using Agents for X (&quot;the Service&quot;), operated by Agents for X (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;),
            you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-2">2. Description of Service</h2>
          <p>
            Agents for X is a content automation platform for X (formerly Twitter). The Service includes a web application
            and Chrome browser extension that help you save posts, generate AI-powered replies and drafts, analyze content
            performance, and schedule publishing to X.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-2">3. Account Registration</h2>
          <p>
            You must create an account to use the Service. You are responsible for maintaining the security of your account
            credentials and for all activity under your account. You must be at least 18 years old to use the Service.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-2">4. Acceptable Use</h2>
          <p>You agree not to:</p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>Violate any applicable law or X&apos;s Terms of Service</li>
            <li>Use the Service to generate spam, misleading content, or harassment</li>
            <li>Attempt to reverse-engineer, decompile, or access non-public areas of the Service</li>
            <li>Share your account credentials or API keys with third parties</li>
            <li>Use automated means to abuse rate limits or overload the Service</li>
            <li>Impersonate others or misrepresent your affiliation with any person or entity</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-2">5. X Account Connection</h2>
          <p>
            When you connect your X account, you authorize us to access your account via OAuth to perform actions you
            request (posting, scheduling, reading your timeline). We do not store your X password. You can disconnect
            your X account at any time from Settings.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-2">6. AI-Generated Content</h2>
          <p>
            The Service uses AI models to generate content suggestions, replies, and drafts. You are solely responsible
            for reviewing and approving any AI-generated content before publishing. We do not guarantee the accuracy,
            appropriateness, or originality of AI-generated content.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-2">7. Intellectual Property</h2>
          <p>
            You retain ownership of all content you create or upload. Content you save from other X users remains the
            property of those users. We claim no ownership over your data. The Service itself (code, design, brand)
            is our intellectual property.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-2">8. Payment and Billing</h2>
          <p>
            Certain features of the Service may require a paid subscription. Pricing, billing cycles, and payment terms
            will be presented at the time of purchase. Subscriptions renew automatically unless cancelled. You may cancel
            at any time from your account settings.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-2">9. Limitation of Liability</h2>
          <p>
            The Service is provided &quot;as is&quot; without warranty of any kind. To the maximum extent permitted by law,
            we shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including
            loss of data, revenue, or reputation, arising from your use of the Service.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-2">10. Service Availability</h2>
          <p>
            We strive to maintain uptime but do not guarantee uninterrupted availability. We may modify, suspend, or
            discontinue any part of the Service at any time with reasonable notice. We are not liable for any downtime
            or service disruptions.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-2">11. Termination</h2>
          <p>
            We may suspend or terminate your account if you violate these Terms. You may delete your account at any
            time. Upon termination, your right to use the Service ceases and we may delete your data after a reasonable
            retention period.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-2">12. Changes to Terms</h2>
          <p>
            We may update these Terms from time to time. We will notify you of material changes via email or in-app
            notification. Continued use of the Service after changes constitutes acceptance.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-2">13. Contact</h2>
          <p>
            For questions about these Terms, contact us at support@agentsforx.com.
          </p>
        </section>
      </div>
    </main>
  );
}
