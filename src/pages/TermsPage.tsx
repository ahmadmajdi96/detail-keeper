import { PublicShell } from "@/components/public/PublicShell";

// Kept for backwards compatibility with other imports; renders nothing.
export function LegalTemplateNotice() {
  return null;
}

export default function TermsPage() {
  return (
    <PublicShell title="Terms of Service">
      <div className="prose prose-invert max-w-none space-y-6 text-white/70">
        <p>Last updated: {new Date().toLocaleDateString()}</p>

        <h2 className="text-white text-2xl font-semibold mt-8">1. Who you are contracting with</h2>
        <p>
          The Qualixa service ("Service") is operated by <strong>Cortanex AI</strong>
          ("Cortanex AI", "we", "us"). By accessing or using the Service you enter into a binding
          agreement with Cortanex AI on these Terms of Service ("Terms").
        </p>

        <h2 className="text-white text-2xl font-semibold mt-8">2. Acceptance and authority</h2>
        <p>
          By creating an account or continuing to use the Service you agree to these Terms. If you
          use the Service on behalf of an organization, you represent that you have authority to
          bind that organization. Individuals must be of legal age to form a binding contract.
        </p>

        <h2 className="text-white text-2xl font-semibold mt-8">3. The Service</h2>
        <p>
          Qualixa is an AI-assisted quality intelligence platform for planning, generating,
          executing and analyzing software tests. Access is licensed on a limited, non-exclusive,
          non-transferable basis for use within your selected subscription plan.
        </p>

        <h2 className="text-white text-2xl font-semibold mt-8">4. Accounts and security</h2>
        <p>
          You are responsible for maintaining the confidentiality of your credentials and for all
          activity under your account. You must provide accurate registration information and keep
          it up to date.
        </p>

        <h2 className="text-white text-2xl font-semibold mt-8">5. Acceptable use</h2>
        <p>
          You must not misuse the Service. In particular you must not: (a) use it unlawfully or
          fraudulently; (b) infringe intellectual property or privacy rights; (c) upload malware,
          probe, scan, or otherwise interfere with the security or integrity of the Service;
          (d) scrape or resell the Service; or (e) attempt to reverse engineer, decompile or
          circumvent technical limits.
        </p>

        <h2 className="text-white text-2xl font-semibold mt-8">6. Intellectual property</h2>
        <p>
          Cortanex AI and its licensors retain all right, title and interest in and to the Service,
          including all software, documentation, branding and models. You retain ownership of the
          content you upload ("Customer Content") and grant Cortanex AI a limited licence to host
          and process it solely to provide and improve the Service for you.
        </p>

        <h2 className="text-white text-2xl font-semibold mt-8">7. Payments, subscriptions and Merchant of Record</h2>
        <p>
          Our order process is conducted by our online reseller <strong>Paddle.com</strong>.
          Paddle.com is the Merchant of Record for all our orders. Paddle provides all customer
          service inquiries and handles returns. Payment, billing, tax collection, invoicing,
          cancellations and refunds are governed by
          {" "}
          <a href="https://www.paddle.com/legal/checkout-buyer-terms" target="_blank" rel="noopener noreferrer" className="underline">
            Paddle's Buyer Terms
          </a>
          {" "}and Paddle's
          {" "}
          <a href="https://www.paddle.com/legal/refund-policy" target="_blank" rel="noopener noreferrer" className="underline">
            Refund Policy
          </a>
          , together with our own <a href="/refunds" className="underline">Refund Policy</a>.
          Paid plans renew automatically at the end of each billing period until cancelled.
        </p>

        <h2 className="text-white text-2xl font-semibold mt-8">8. AI features and outputs</h2>
        <p>
          The Service uses generative AI to produce test plans, cases, code and related artefacts.
          You are responsible for your prompts, the inputs you supply, and how you use the outputs,
          including verifying accuracy and ensuring you have the rights to any input content. You
          must not use the Service to generate illegal content, deepfakes, hate speech, malware, or
          to attempt to jailbreak or circumvent safety controls. We may filter, restrict or remove
          content and suspend accounts that repeatedly infringe third-party rights or violate these
          Terms. AI outputs may be inaccurate and are not a substitute for professional advice.
        </p>

        <h2 className="text-white text-2xl font-semibold mt-8">9. Suspension and termination</h2>
        <p>
          We may suspend or terminate access for material breach, non-payment, security or fraud
          risk, or repeated or serious violations of these Terms. You may terminate your account at
          any time from the settings page. On termination you may export your data within a
          reasonable window, after which it will be deleted in line with our Privacy Notice.
        </p>

        <h2 className="text-white text-2xl font-semibold mt-8">10. Warranties and liability</h2>
        <p>
          The Service is provided "as is" and, to the fullest extent permitted by law, Cortanex AI
          disclaims all implied warranties including merchantability and fitness for a particular
          purpose. We do not guarantee that the Service will be uninterrupted or error-free. To the
          maximum extent permitted by law, our aggregate liability arising out of or in connection
          with the Service is limited to the fees you paid for the Service in the twelve (12)
          months preceding the claim. We are not liable for indirect, consequential or special
          damages, including loss of profits, data or goodwill. Nothing in these Terms limits
          liability for fraud, death or personal injury caused by negligence, or any other
          liability that cannot be limited by law.
        </p>

        <h2 className="text-white text-2xl font-semibold mt-8">11. Indemnity</h2>
        <p>
          You will indemnify Cortanex AI against claims arising from your Customer Content, your
          unlawful use of the Service, or your breach of these Terms.
        </p>

        <h2 className="text-white text-2xl font-semibold mt-8">12. Changes</h2>
        <p>
          We may update these Terms from time to time. Material changes will be notified in-app or
          by email. Continued use of the Service after changes take effect constitutes acceptance.
        </p>

        <h2 className="text-white text-2xl font-semibold mt-8">13. Governing law</h2>
        <p>
          These Terms are governed by the laws applicable at Cortanex AI's principal place of
          business, without regard to conflict of laws principles. Disputes will be resolved in the
          competent courts of that jurisdiction.
        </p>

        <h2 className="text-white text-2xl font-semibold mt-8">14. Contact</h2>
        <p>
          Questions about these Terms? Contact Cortanex AI through the in-app support form. For
          billing, refund or invoice questions handled by our Merchant of Record, contact Paddle at{" "}
          <a href="https://www.paddle.net" target="_blank" rel="noopener noreferrer" className="underline">paddle.net</a>.
        </p>
      </div>
    </PublicShell>
  );
}
