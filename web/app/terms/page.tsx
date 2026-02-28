import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service - ZeroToShip",
  description:
    "Terms and conditions for using the ZeroToShip platform.",
};

export default function TermsOfServicePage() {
  return (
    <article className="min-h-screen bg-white dark:bg-gray-900 pt-24 pb-16 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto">
        <header>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 dark:text-white">
            Terms of Service
          </h1>
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
            Last updated: February 28, 2026
          </p>
        </header>

        <div className="mt-10 prose prose-gray dark:prose-invert prose-headings:font-semibold prose-headings:tracking-tight max-w-none">
          <p>
            These Terms of Service (&quot;Terms&quot;) govern your use of the
            ZeroToShip platform operated at{" "}
            <a href="https://zerotoship.dev">zerotoship.dev</a>{" "}
            (&quot;Service&quot;). By creating an account or using the Service,
            you agree to these Terms.
          </p>

          <h2>1. Service Description</h2>
          <p>
            ZeroToShip is a platform that scrapes publicly available posts from
            Reddit, Hacker News, and GitHub to identify emerging problems and
            startup opportunities. Using AI, we cluster related signals, score
            them by opportunity, and generate agent-ready business briefs. The
            Service is provided on a subscription basis with Free, Pro ($19/month),
            and Enterprise ($99/month) tiers.
          </p>

          <h2>2. Account Responsibilities</h2>
          <ul>
            <li>
              You must provide accurate information when creating your account.
            </li>
            <li>
              You are responsible for maintaining the security of your account
              credentials and API keys.
            </li>
            <li>
              You must be at least 18 years old to use the Service.
            </li>
            <li>
              You are responsible for all activity that occurs under your
              account.
            </li>
          </ul>

          <h2>3. Acceptable Use</h2>
          <p>You agree not to:</p>
          <ul>
            <li>
              Use the Service for any unlawful purpose or in violation of any
              applicable laws.
            </li>
            <li>
              Attempt to gain unauthorized access to the Service, other
              accounts, or related systems.
            </li>
            <li>
              Scrape, crawl, or otherwise extract data from the Service beyond
              what your plan allows (e.g., API rate limits).
            </li>
            <li>
              Resell, redistribute, or sublicense the Service or its output
              without prior written consent.
            </li>
            <li>
              Interfere with or disrupt the integrity or performance of the
              Service.
            </li>
          </ul>

          <h2>4. Payment Terms</h2>
          <ul>
            <li>
              Paid subscriptions (Pro and Enterprise) are billed monthly or
              annually through Stripe. By subscribing, you authorize recurring
              charges to your payment method.
            </li>
            <li>
              You may cancel your subscription at any time. Cancellation takes
              effect at the end of your current billing period. You will retain
              access to paid features until that date.
            </li>
            <li>
              We do not offer refunds for partial billing periods. If you
              cancel mid-cycle, your subscription remains active until the
              period ends.
            </li>
            <li>
              We reserve the right to change pricing with 30 days notice.
              Existing subscribers will be notified by email before any price
              change takes effect.
            </li>
          </ul>

          <h2>5. Intellectual Property</h2>
          <h3>Your Content</h3>
          <p>
            Business briefs and specs generated for you through the Service
            belong to you. You may use them for any purpose, including building
            products based on them.
          </p>

          <h3>Scraped Data</h3>
          <p>
            The posts we scrape from Reddit, Hacker News, and GitHub are
            publicly available content authored by their respective creators.
            ZeroToShip does not claim ownership of that source material. Our
            analysis, clustering, scoring, and generated briefs are derivative
            works created by our platform.
          </p>

          <h3>Our Service</h3>
          <p>
            The ZeroToShip platform, including its design, algorithms, code, and
            branding, is owned by ZeroToShip. These Terms do not grant you any
            rights to our trademarks, logos, or other intellectual property
            beyond what is necessary to use the Service.
          </p>

          <h2>6. Limitation of Liability</h2>
          <p>
            The Service is provided &quot;as is&quot; and &quot;as
            available.&quot; We make no warranties, express or implied,
            regarding the accuracy, completeness, or reliability of the ideas,
            scores, or briefs generated by the Service.
          </p>
          <p>
            To the maximum extent permitted by law, ZeroToShip shall not be
            liable for any indirect, incidental, special, consequential, or
            punitive damages, or any loss of profits or revenue, whether
            incurred directly or indirectly, arising from your use of the
            Service.
          </p>
          <p>
            Our total liability for any claim arising from or related to the
            Service shall not exceed the amount you paid us in the 12 months
            preceding the claim.
          </p>

          <h2>7. Disclaimer</h2>
          <p>
            ZeroToShip provides data analysis and AI-generated content for
            informational purposes. The ideas, scores, and briefs generated by
            the Service are not business advice, financial advice, or guarantees
            of market viability. You are solely responsible for evaluating and
            acting on any information provided by the Service.
          </p>

          <h2>8. Termination</h2>
          <ul>
            <li>
              You may close your account at any time by contacting us at{" "}
              <a href="mailto:hello@zerotoship.dev">hello@zerotoship.dev</a>.
            </li>
            <li>
              We may suspend or terminate your account if you violate these
              Terms, with or without notice depending on the severity of the
              violation.
            </li>
            <li>
              Upon termination, your right to use the Service ceases
              immediately. We will delete your personal data in accordance with
              our{" "}
              <a href="/privacy">Privacy Policy</a>.
            </li>
          </ul>

          <h2>9. Changes to These Terms</h2>
          <p>
            We may update these Terms from time to time. If we make material
            changes, we will notify you by email or by posting a notice on the
            site at least 30 days before the changes take effect. Your continued
            use of the Service after the updated Terms take effect constitutes
            acceptance.
          </p>

          <h2>10. Governing Law</h2>
          <p>
            These Terms shall be governed by and construed in accordance with
            the laws of the United States. Any disputes arising from these Terms
            or the Service shall be resolved through good-faith negotiation
            before pursuing formal proceedings.
          </p>

          <h2>11. Contact</h2>
          <p>
            If you have questions about these Terms, please contact us at{" "}
            <a href="mailto:hello@zerotoship.dev">hello@zerotoship.dev</a>.
          </p>
        </div>
      </div>
    </article>
  );
}
