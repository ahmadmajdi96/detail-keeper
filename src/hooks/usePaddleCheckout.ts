import { useState } from "react";
import { initializePaddle, getPaddlePriceId } from "@/lib/paddle";
import { toast } from "sonner";

interface OpenCheckoutOptions {
  priceId: string;
  customerEmail?: string;
  userId: string;
  successUrl?: string;
}

export function usePaddleCheckout() {
  const [loading, setLoading] = useState(false);

  const openCheckout = async (options: OpenCheckoutOptions) => {
    setLoading(true);
    try {
      await initializePaddle();
      const paddlePriceId = await getPaddlePriceId(options.priceId);
      window.Paddle.Checkout.open({
        items: [{ priceId: paddlePriceId, quantity: 1 }],
        customer: options.customerEmail ? { email: options.customerEmail } : undefined,
        customData: { userId: options.userId },
        settings: {
          displayMode: "overlay",
          successUrl: options.successUrl || `${window.location.origin}/billing?success=1`,
          allowLogout: false,
          variant: "one-page",
        },
      });
    } catch (e) {
      console.error("[usePaddleCheckout] error", e);
      toast.error((e as Error).message || "Could not open checkout");
    } finally {
      setLoading(false);
    }
  };

  return { openCheckout, loading };
}
