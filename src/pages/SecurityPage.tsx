import { PublicShell } from "@/components/public/PublicShell";
import { LegalTemplateNotice } from "./TermsPage";
import { ShieldCheck, Lock, KeyRound, Database, Users, AlertCircle } from "lucide-react";

const ITEMS = [
  { icon: Lock, title: "Encryption in transit", body: "All traffic is served over TLS 1.2+ with modern cipher suites." },
  { icon: Database, title: "Encryption at rest", body: "Customer data is encrypted at rest in our managed database and object storage." },
  { icon: KeyRound, title: "Authentication", body: "Password + Google OAuth. Enterprise plans support SSO/SAML and SCIM." },
  { icon: Users, title: "Role-based access", body: "Fine-grained roles at the organization, workspace, project, and test-plan levels." },
  { icon: ShieldCheck, title: "Row-level security", body: "Every tenant table is protected by database-level Row-Level Security policies." },
  { icon: AlertCircle, title: "Incident response", body: "We follow a documented incident response plan and notify affected customers promptly." },
];

export default function SecurityPage() {
  return (
    <PublicShell title="Security">
      <LegalTemplateNotice />
      <p className="text-white/70 mb-10">
        We take the security of your data seriously. Below is a high-level overview of our security posture.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {ITEMS.map((it) => (
          <div key={it.title} className="rounded-2xl p-6 border border-white/10 bg-[hsl(222,47%,8%)]">
            <it.icon className="h-5 w-5 text-[hsl(187,92%,50%)] mb-3" />
            <div className="font-semibold mb-1">{it.title}</div>
            <p className="text-sm text-white/60">{it.body}</p>
          </div>
        ))}
      </div>
      <div className="mt-10 p-6 rounded-2xl border border-white/10 bg-[hsl(222,47%,8%)]">
        <h2 className="text-lg font-semibold mb-2">Report a vulnerability</h2>
        <p className="text-sm text-white/60">
          If you believe you have found a security vulnerability, please contact us through the in-app support channel with details and reproduction steps. We appreciate responsible disclosure.
        </p>
      </div>
    </PublicShell>
  );
}
