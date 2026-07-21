import { PublicShell } from "@/components/public/PublicShell";

export default function PrivacyPage() {
  return (
    <PublicShell title="Privacy Notice">
      <div className="space-y-6 text-white/70">
        <p>Last updated: {new Date().toLocaleDateString()}</p>

        <h2 className="text-white text-2xl font-semibold mt-8">1. Who we are</h2>
        <p>
          This Privacy Notice explains how <strong>Cortanex AI</strong> ("Cortanex AI", "we", "us")
          processes personal data in connection with the Qualixa service ("Service"). Cortanex AI
          is the <strong>data controller</strong> for personal data collected through the Service,
          except for payment data collected by our Merchant of Record (see Section 5).
        </p>

        <h2 className="text-white text-2xl font-semibold mt-8">2. Personal data we collect</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Account data:</strong> name, email address, hashed password, avatar.</li>
          <li><strong>Organization data:</strong> workspace, project and role membership.</li>
          <li><strong>Content:</strong> documents, requirements, test plans, cases and executions you upload or generate.</li>
          <li><strong>Usage and telemetry:</strong> feature usage, AI job counts, runner minutes, timestamps.</li>
          <li><strong>Device and log data:</strong> IP address, browser and device identifiers, error logs.</li>
          <li><strong>Support data:</strong> messages you send us and any attachments.</li>
        </ul>

        <h2 className="text-white text-2xl font-semibold mt-8">3. Purposes and legal bases</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Provide the Service</strong> (account creation, hosting your content, running AI jobs) — <em>performance of a contract</em>.</li>
          <li><strong>Security, fraud prevention and abuse detection</strong> — <em>legitimate interests</em> in keeping the Service safe.</li>
          <li><strong>Product improvement and analytics</strong> — <em>legitimate interests</em> in improving the Service.</li>
          <li><strong>Customer support</strong> — <em>performance of a contract</em>.</li>
          <li><strong>Service and billing communications</strong> — <em>performance of a contract</em>.</li>
          <li><strong>Marketing emails</strong> — <em>consent</em>, which you can withdraw at any time.</li>
          <li><strong>Legal and tax obligations</strong> — <em>compliance with a legal obligation</em>.</li>
        </ul>

        <h2 className="text-white text-2xl font-semibold mt-8">4. AI processing</h2>
        <p>
          Content you submit to AI features is processed by our sub-processors solely to generate
          outputs for you. We do not use Customer Content to train third-party public foundation
          models.
        </p>

        <h2 className="text-white text-2xl font-semibold mt-8">5. How we share personal data</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong>Merchant of Record — Paddle.</strong> Payments, subscription management,
            billing, tax compliance, invoicing and refunds are handled by
            {" "}
            <a href="https://www.paddle.com" target="_blank" rel="noopener noreferrer" className="underline">Paddle.com</a>,
            our reseller and Merchant of Record. Paddle collects and processes payment data
            directly under its own
            {" "}
            <a href="https://www.paddle.com/legal/privacy" target="_blank" rel="noopener noreferrer" className="underline">privacy policy</a>.
          </li>
          <li>
            <strong>Sub-processors.</strong> Cloud hosting and database (Supabase / AWS), email
            delivery (Resend), and AI model providers we use to power AI features. These providers
            process personal data on our behalf under written data-processing terms.
          </li>
          <li>
            <strong>Optional integrations you enable</strong> (e.g. Slack, GitHub) receive only the
            data required for the integration.
          </li>
          <li>
            <strong>Professional advisers</strong> (legal, accounting) where necessary.
          </li>
          <li>
            <strong>Authorities</strong> where required by law or to protect our rights.
          </li>
        </ul>
        <p>We do not sell personal data.</p>

        <h2 className="text-white text-2xl font-semibold mt-8">6. International transfers</h2>
        <p>
          Personal data may be transferred to and processed in countries outside your own. Where
          required, we rely on appropriate safeguards such as the European Commission's Standard
          Contractual Clauses and equivalent UK transfer mechanisms.
        </p>

        <h2 className="text-white text-2xl font-semibold mt-8">7. Retention</h2>
        <p>
          We retain personal data for as long as your account is active and as needed to provide
          the Service. When you delete your account, we delete or anonymise personal data within
          30 days, except where longer retention is required by law (for example, tax and
          accounting records held by our Merchant of Record).
        </p>

        <h2 className="text-white text-2xl font-semibold mt-8">8. Your rights</h2>
        <p>
          Subject to applicable law, you may request access, rectification, erasure, restriction,
          portability, or object to processing of your personal data, and withdraw consent where
          processing is based on consent. Where GDPR or UK GDPR applies you also have the right to
          lodge a complaint with your supervisory authority. We respond to verified requests within
          one month. Exercise your rights from account settings or by contacting us through the
          in-app support form.
        </p>

        <h2 className="text-white text-2xl font-semibold mt-8">9. Security</h2>
        <p>
          We implement appropriate technical and organisational measures to protect personal data,
          including encryption in transit (TLS), encryption at rest for our managed database,
          hashed credentials, role-based access controls, row-level security, audit logging and
          least-privilege access for staff.
        </p>

        <h2 className="text-white text-2xl font-semibold mt-8">10. Cookies</h2>
        <p>
          We use strictly necessary cookies to keep you signed in and to remember your
          preferences, and limited analytics cookies to understand product usage. You can manage
          cookies through your browser settings.
        </p>

        <h2 className="text-white text-2xl font-semibold mt-8">11. Contact</h2>
        <p>
          Privacy questions or requests? Contact Cortanex AI through the in-app support form. For
          questions about payment data handled by our Merchant of Record, contact Paddle at{" "}
          <a href="https://www.paddle.net" target="_blank" rel="noopener noreferrer" className="underline">paddle.net</a>.
        </p>
      </div>
    </PublicShell>
  );
}
