import { PublicShell } from "@/components/public/PublicShell";

export default function RefundsPage() {
  return (
    <PublicShell title="Refund Policy">
      <div className="space-y-6 text-white/70">
        <p>Last updated: {new Date().toLocaleDateString()}</p>

        <h2 className="text-white text-2xl font-semibold mt-8">30-day money-back guarantee</h2>
        <p>
          <strong>Cortanex AI</strong> offers a <strong>30-day money-back guarantee</strong> on
          Qualixa subscriptions. If you are not satisfied with your purchase, you may request a
          full refund within <strong>30 days</strong> of the original order date. Refunds are
          issued back to the original payment method.
        </p>

        <h2 className="text-white text-2xl font-semibold mt-8">How to request a refund</h2>
        <p>
          Payments and refunds are processed by our Merchant of Record,{" "}
          <a href="https://www.paddle.com" target="_blank" rel="noopener noreferrer" className="underline">Paddle</a>.
          To request a refund:
        </p>
        <ol className="list-decimal pl-6 space-y-2">
          <li>
            Go to{" "}
            <a href="https://www.paddle.net" target="_blank" rel="noopener noreferrer" className="underline">paddle.net</a>{" "}
            and look up your order using the email you used at checkout, or use the receipt link
            Paddle emailed you.
          </li>
          <li>Request a refund for the transaction directly through Paddle.</li>
          <li>
            Alternatively, contact Cortanex AI support through the in-app support form and we will
            help coordinate the refund with Paddle on your behalf.
          </li>
        </ol>

        <h2 className="text-white text-2xl font-semibold mt-8">Renewals and cancellations</h2>
        <p>
          Paid subscriptions renew automatically at the end of each billing period. You can cancel
          renewal at any time from the billing portal; cancellation stops future charges. Refunds
          for renewal charges are available within the 30-day window on the same terms as above.
        </p>

        <h2 className="text-white text-2xl font-semibold mt-8">Additional information</h2>
        <p>
          This policy is offered in addition to any statutory rights you have under applicable
          consumer law and does not limit them. It sits alongside{" "}
          <a href="https://www.paddle.com/legal/refund-policy" target="_blank" rel="noopener noreferrer" className="underline">
            Paddle's Refund Policy
          </a>{" "}
          as our Merchant of Record.
        </p>
      </div>
    </PublicShell>
  );
}
