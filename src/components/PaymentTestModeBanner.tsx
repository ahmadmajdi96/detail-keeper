import { getPaddleEnvironment } from "@/lib/paddle";

export function PaymentTestModeBanner() {
  if (getPaddleEnvironment() !== "sandbox") return null;
  return (
    <div className="w-full bg-amber-500/10 border-b border-amber-500/30 px-4 py-2 text-center text-xs text-amber-500">
      Payments are in <strong>test mode</strong>. Use Paddle test cards — no real charges.{" "}
      <a
        href="https://developer.paddle.com/concepts/payment-methods/credit-debit-card#test-payment-method"
        target="_blank"
        rel="noopener noreferrer"
        className="underline font-medium"
      >
        Test cards
      </a>
    </div>
  );
}
