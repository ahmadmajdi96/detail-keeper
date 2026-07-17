import { PublicShell } from "@/components/public/PublicShell";
import { LegalTemplateNotice } from "./TermsPage";

export default function PrivacyPage() {
  return (
    <PublicShell title="Privacy Policy">
      <LegalTemplateNotice />
      <div className="space-y-6 text-white/70">
        <p>Last updated: {new Date().toLocaleDateString()}</p>
        <h2 className="text-white text-2xl font-semibold mt-8">1. Information we collect</h2>
        <p>We collect account information (name, email), usage data, and content you upload to the Service.</p>
        <h2 className="text-white text-2xl font-semibold mt-8">2. How we use information</h2>
        <p>We use your information to operate and improve the Service, communicate with you, and secure your account.</p>
        <h2 className="text-white text-2xl font-semibold mt-8">3. Sharing</h2>
        <p>We do not sell your data. We share it only with subprocessors necessary to operate the Service (hosting, email, payments).</p>
        <h2 className="text-white text-2xl font-semibold mt-8">4. Retention</h2>
        <p>We retain your data for as long as your account is active. On deletion, data is removed within 30 days.</p>
        <h2 className="text-white text-2xl font-semibold mt-8">5. Your rights</h2>
        <p>Subject to applicable law, you may request access, correction, deletion, or export of your personal data via account settings or by contacting us.</p>
        <h2 className="text-white text-2xl font-semibold mt-8">6. Cookies</h2>
        <p>We use essential cookies to keep you signed in and analytics cookies to improve the product.</p>
        <h2 className="text-white text-2xl font-semibold mt-8">7. Contact</h2>
        <p>Privacy questions? Reach us through the in-app contact form.</p>
      </div>
    </PublicShell>
  );
}
