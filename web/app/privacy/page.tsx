import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy - ZeroToShip",
  description:
    "Learn how ZeroToShip collects, uses, and protects your personal information.",
};

export default function PrivacyPolicyPage() {
  return (
    <article className="min-h-screen bg-white dark:bg-gray-900 pt-24 pb-16 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto">
        <header>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 dark:text-white">
            Privacy Policy
          </h1>
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
            Last updated: February 28, 2026
          </p>
        </header>

        <div className="mt-10 prose prose-gray dark:prose-invert prose-headings:font-semibold prose-headings:tracking-tight max-w-none">
          <p>
            ZeroToShip (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;)
            operates the website at{" "}
            <a href="https://zerotoship.dev">zerotoship.dev</a>. This Privacy
            Policy explains what information we collect, how we use it, and what
            choices you have.
          </p>

          <h2>1. Information We Collect</h2>

          <h3>Account Information</h3>
          <p>
            When you create an account, we collect your name and email address.
            Authentication is handled through Google OAuth via Supabase. We do
            not store your Google password.
          </p>

          <h3>Payment Information</h3>
          <p>
            If you subscribe to a paid plan (Pro at $19/month or Enterprise at
            $99/month), payment processing is handled entirely by{" "}
            <a
              href="https://stripe.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
            >
              Stripe
            </a>
            . We do not store your credit card number or full payment details on
            our servers. We receive only a reference to your Stripe customer
            record, subscription status, and billing cycle dates.
          </p>

          <h3>Usage Data</h3>
          <p>
            We collect information about how you interact with the service,
            including which ideas you view, save, or archive, your email digest
            preferences, and general usage patterns. This helps us improve the
            product and deliver relevant content.
          </p>

          <h3>Scraped Public Data</h3>
          <p>
            ZeroToShip scrapes publicly available posts from Reddit, Hacker
            News, and GitHub to identify emerging problems and startup ideas.
            This data is publicly posted content and is not linked to your
            personal account.
          </p>

          <h2>2. How We Use Your Information</h2>
          <ul>
            <li>
              <strong>Service delivery</strong> — to operate the platform,
              generate idea briefs, and provide features tied to your
              subscription tier.
            </li>
            <li>
              <strong>Email notifications</strong> — to send daily or weekly
              digest emails based on your preferences. You can change your
              frequency or unsubscribe at any time from your{" "}
              <Link href="/settings">Settings</Link> page.
            </li>
            <li>
              <strong>Analytics</strong> — to understand usage trends and
              improve the product. We use minimal, privacy-respecting analytics.
            </li>
            <li>
              <strong>Support</strong> — to respond to your questions or
              requests.
            </li>
          </ul>

          <h2>3. Third-Party Services</h2>
          <p>We rely on the following third-party services to operate:</p>
          <ul>
            <li>
              <strong>Stripe</strong> — payment processing. Stripe&apos;s
              privacy policy applies to all payment data.
            </li>
            <li>
              <strong>Supabase</strong> — authentication and user management.
            </li>
            <li>
              <strong>Resend</strong> — transactional and digest email delivery.
            </li>
          </ul>
          <p>
            We do not sell your personal information to third parties. We share
            data with these providers only as necessary to operate the service.
          </p>

          <h2>4. Cookies and Local Storage</h2>
          <p>
            We use minimal cookies and local storage, limited to authentication
            tokens required to keep you logged in. We do not use advertising
            cookies or third-party tracking cookies.
          </p>

          <h2>5. Data Retention</h2>
          <p>
            We retain your account information for as long as your account is
            active. Usage data is retained for up to 12 months to support
            analytics and product improvements. If you delete your account, we
            will remove your personal data within 30 days, except where we are
            required by law to retain it.
          </p>

          <h2>6. Your Rights</h2>
          <ul>
            <li>
              <strong>Access and export</strong> — you can view your account
              data from your dashboard at any time.
            </li>
            <li>
              <strong>Deletion</strong> — you can request account deletion by
              contacting us. We will delete your personal data within 30 days.
            </li>
            <li>
              <strong>Email opt-out</strong> — you can unsubscribe from digest
              emails at any time through your{" "}
              <Link href="/settings">Settings</Link> page or the unsubscribe
              link in any email.
            </li>
          </ul>

          <h2>7. Security</h2>
          <p>
            We use industry-standard security measures to protect your data,
            including encrypted connections (HTTPS), secure authentication
            flows, and access controls on our infrastructure. However, no method
            of transmission over the internet is 100% secure.
          </p>

          <h2>8. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. If we make
            material changes, we will notify you by email or by posting a notice
            on the site. Your continued use of the service after changes take
            effect constitutes acceptance of the updated policy.
          </p>

          <h2>9. Contact</h2>
          <p>
            If you have questions about this Privacy Policy or your data, please
            contact us at{" "}
            <a href="mailto:hello@zerotoship.dev">hello@zerotoship.dev</a>.
          </p>
        </div>
      </div>
    </article>
  );
}
