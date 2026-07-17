import { PublicShell } from "@/components/public/PublicShell";

export function LegalTemplateNotice() {
  return (
    <div className="mb-8 p-4 rounded-lg border border-amber-500/30 bg-amber-500/5 text-amber-200 text-sm">
      <strong>Template notice:</strong> This document is a starter template provided for illustration.
      It has not been reviewed by counsel and should be replaced with legal copy appropriate to your
      jurisdiction and business before going to production.
    </div>
  );
}

export default function TermsPage() {
  return (
    <PublicShell title="Terms of Service">
      <LegalTemplateNotice />
      <div className="prose prose-invert max-w-none space-y-6 text-white/70">
        <p>Last updated: {new Date().toLocaleDateString()}</p>
        <h2 className="text-white text-2xl font-semibold mt-8">1. Acceptance of terms</h2>
        <p>By accessing or using Qualixa ("the Service"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.</p>
        <h2 className="text-white text-2xl font-semibold mt-8">2. Accounts</h2>
        <p>You are responsible for maintaining the confidentiality of your account and for all activities that occur under your account. You must provide accurate registration information.</p>
        <h2 className="text-white text-2xl font-semibold mt-8">3. Acceptable use</h2>
        <p>You agree not to misuse the Service, including by attempting to reverse engineer, resell, or exceed your subscription's usage entitlements.</p>
        <h2 className="text-white text-2xl font-semibold mt-8">4. Subscriptions & billing</h2>
        <p>Paid plans renew automatically at the end of each billing period. You may cancel at any time through the billing portal; access continues until the end of the current period.</p>
        <h2 className="text-white text-2xl font-semibold mt-8">5. Data ownership</h2>
        <p>You retain all rights to the data you upload. We process it solely to provide the Service.</p>
        <h2 className="text-white text-2xl font-semibold mt-8">6. Termination</h2>
        <p>We may suspend or terminate accounts that violate these terms. You may terminate your account at any time from the settings page.</p>
        <h2 className="text-white text-2xl font-semibold mt-8">7. Disclaimer</h2>
        <p>The Service is provided "as is" without warranties of any kind, express or implied.</p>
        <h2 className="text-white text-2xl font-semibold mt-8">8. Contact</h2>
        <p>Questions about these terms? Reach us through the in-app contact form.</p>
      </div>
    </PublicShell>
  );
}
