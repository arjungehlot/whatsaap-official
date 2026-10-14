import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Check, Loader2, Sparkles } from "lucide-react";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { faqs } from "@/mock/marketing";
import { inr } from "@/lib/format";
import { authService, billingService } from "@/services";
import type { AdminPlan } from "@/types";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — WAFlow WhatsApp Automation Plans" },
      {
        name: "description",
        content:
          "Compare WAFlow plans: free starter tier, Starter, Professional and Business. Contacts, messages, team seats and automation limits explained.",
      },
      { property: "og:title", content: "WAFlow Pricing" },
      {
        property: "og:description",
        content: "Simple monthly plans for WhatsApp campaigns, inbox and automations. Start free.",
      },
    ],
  }),
  component: PricingPage,
});

function PricingPage() {
  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [subscription, setSubscription] = useState<{
    planId?: { _id?: string; id?: string; slug?: string; name?: string };
    status?: string;
    billingCycle?: "monthly" | "yearly";
    expiryDate?: string;
    isTrial?: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [billingPhone, setBillingPhone] = useState("");
  const [billingEmail, setBillingEmail] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<AdminPlan | null>(null);
  const [checkoutQuote, setCheckoutQuote] = useState<{
    isUpgrade: boolean;
    currentPlanName: string | null;
    baseAmount: number;
    prorationCredit: number;
    taxableAmount: number;
    gstRate: number;
    gstAmount: number;
    amountDue: number;
  } | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [buyingPlanId, setBuyingPlanId] = useState<string | null>(null);
  const checkoutSubmittingRef = useRef(false);
  const navigate = useNavigate();
  useEffect(() => {
    const payment = new URLSearchParams(window.location.search).get("payment");
    if (payment === "success") toast.success("Payment received. Your plan is now active.");
    if (payment === "failed") toast.error("Payment was not completed. You can try again.");

    if (authService.isAuthenticated()) {
      const cachedUser = authService.currentUser();
      setBillingEmail(cachedUser.email || "");
      setBillingPhone(cachedUser.phone || "");
      void authService
        .me()
        .then((user) => {
          setBillingEmail(user.email || "");
          setBillingPhone(user.phone || "");
        })
        .catch(() => undefined);
    }

    billingService
      .summary()
      .then((data) => {
        setPlans(data.plans as AdminPlan[]);
        const sub = data.subscription as { status?: string; billingCycle?: "monthly" | "yearly"; planId?: { _id?: string; id?: string; slug?: string; name?: string }; expiryDate?: string; isTrial?: boolean } | null;
        setSubscription(sub);
        if (sub?.status === "active" && sub.billingCycle) {
          setBillingCycle(sub.billingCycle);
        }
      })
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : "Unable to load pricing"),
      )
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    const resetCheckoutState = () => {
      checkoutSubmittingRef.current = false;
      setBuyingPlanId(null);
      setSelectedPlan(null);
      setCheckoutQuote(null);
      setQuoteLoading(false);
    };

    // Browsers can restore this page from back-forward cache after the user leaves PayU.
    window.addEventListener("pageshow", resetCheckoutState);
    return () => window.removeEventListener("pageshow", resetCheckoutState);
  }, []);
  const hasActiveSubscription =
    subscription?.status === "active" &&
    (!subscription.expiryDate || new Date(subscription.expiryDate).getTime() > Date.now());
  const activePlanId = hasActiveSubscription
    ? String(subscription?.planId?._id || subscription?.planId?.id || "")
    : "";
  const activePlan = plans.find((plan) => plan.id === activePlanId);
  const planTierValue = (plan: AdminPlan) => plan.yearlyPrice || plan.monthlyPrice * 12;
  const displayPlans =
    activePlan && !subscription?.isTrial
      ? plans.filter(
          (plan) =>
            plan.id === activePlan.id ||
            (!plan.isTrial && planTierValue(plan) > planTierValue(activePlan)),
        )
      : plans;
  const featureKeys = [
    ...new Set(displayPlans.flatMap((plan) => plan.features.map((feature) => feature.key))),
  ];
  const featureLabel = (key: string) =>
    displayPlans.flatMap((plan) => plan.features).find((feature) => feature.key === key)?.name ||
    key;
  const featureValue = (plan: AdminPlan, key: string) =>
    plan.features.find((feature) => feature.key === key)?.value;
  const visibleFeatures = (plan: AdminPlan) =>
    plan.features.filter((feature) => feature.value !== false);
  const featureDetail = (value: AdminPlan["features"][number]["value"]) => {
    if (
      value === true ||
      value === "unlimited" ||
      value === undefined ||
      value === null ||
      value === ""
    )
      return null;
    return String(value);
  };
  const isDowngrade = (plan: AdminPlan) => {
    if (!activePlan || subscription?.isTrial) return false;
    if (plan.id === activePlan.id)
      return subscription?.billingCycle === "yearly" && billingCycle === "monthly";
    return planTierValue(plan) <= planTierValue(activePlan);
  };
  async function openCheckout(plan: AdminPlan) {
    if (!authService.isAuthenticated()) {
      void navigate({ to: "/login" });
      return;
    }
    const user = authService.currentUser();
    setBillingEmail(user.email || "");
    setBillingPhone(user.phone || "");
    setQuoteLoading(true);
    setCheckoutQuote(null);
    try {
      const quote = await billingService.checkoutPreview(plan.id, billingCycle);
      setCheckoutQuote(quote);
      setSelectedPlan(plan);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Unable to calculate your upgrade");
    } finally {
      setQuoteLoading(false);
    }
  }
function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window !== "undefined" && (window as unknown as { Razorpay?: unknown }).Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

  async function buyPlan() {
    if (checkoutSubmittingRef.current) return;
    const plan = selectedPlan;
    if (!plan) return;
    const phone = billingPhone.replace(/[\s()-]/g, "");
    if (!billingEmail.trim()) {
      toast.error("Your account needs an email address before checkout");
      return;
    }
    if (!/^\+?[1-9]\d{7,14}$/.test(phone)) {
      toast.error("Enter a valid billing mobile number before checkout");
      return;
    }
    checkoutSubmittingRef.current = true;
    setBuyingPlanId(plan.id);
    try {
      const checkout = await billingService.checkout(plan.id, billingCycle, phone);
      if (checkout.completed) {
        toast.success("Your plan has been upgraded.");
        window.location.assign("/pricing?payment=success");
        return;
      }

      if (checkout.gateway === "razorpay" || checkout.orderId) {
        const loaded = await loadRazorpayScript();
        if (!loaded) {
          throw new Error("Unable to load Razorpay payment SDK. Please check your internet connection.");
        }

        const options = {
          key: checkout.keyId,
          amount: checkout.amount,
          currency: checkout.currency || "INR",
          name: checkout.name || "WAFlow",
          description: checkout.description || `${plan.name} (${billingCycle})`,
          order_id: checkout.orderId,
          prefill: checkout.prefill || {
            name: authService.currentUser()?.name || "Customer",
            email: billingEmail,
            contact: phone,
          },
          theme: checkout.theme || {
            color: "#25D366",
          },
          handler: async (response: {
            razorpay_order_id: string;
            razorpay_payment_id: string;
            razorpay_signature: string;
          }) => {
            try {
              toast.loading("Verifying payment...", { id: "razorpay-verify" });
              await billingService.verifyRazorpayPayment({
                paymentId: checkout.paymentId,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              });
              toast.success("Payment successful! Your plan is activated.", { id: "razorpay-verify" });
              window.location.assign("/pricing?payment=success");
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Payment verification failed", { id: "razorpay-verify" });
              checkoutSubmittingRef.current = false;
              setBuyingPlanId(null);
            }
          },
          modal: {
            ondismiss: () => {
              checkoutSubmittingRef.current = false;
              setBuyingPlanId(null);
            },
          },
        };

        const RazorpayCtor = (window as unknown as { Razorpay: new (opts: unknown) => { open: () => void; on: (evt: string, cb: unknown) => void } }).Razorpay;
        const rzp = new RazorpayCtor(options);
        rzp.on("payment.failed", (res: { error?: { description?: string } }) => {
          toast.error(res?.error?.description || "Payment failed");
          checkoutSubmittingRef.current = false;
          setBuyingPlanId(null);
        });
        rzp.open();
        return;
      }

      if (!checkout.action || !checkout.fields) throw new Error("Unable to start secure checkout");
      const form = document.createElement("form");
      form.method = "POST";
      form.action = checkout.action;
      Object.entries(checkout.fields).forEach(([name, value]) => {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = value;
        form.appendChild(input);
      });
      document.body.appendChild(form);
      form.submit();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Unable to start checkout");
      checkoutSubmittingRef.current = false;
      setBuyingPlanId(null);
    }
  }
  return (
    <div className="min-h-screen bg-background selection:bg-primary/20">
      <MarketingHeader />

      <section className="relative overflow-hidden border-b border-border bg-background pb-12 pt-16 lg:pb-16 lg:pt-24">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,var(--color-primary-soft)_0%,transparent_70%)] opacity-50" />
        <div className="absolute -top-40 -right-40 size-96 rounded-full bg-primary/10 blur-[100px]" />
        <div className="absolute -top-40 -left-40 size-96 rounded-full bg-primary/10 blur-[100px]" />
        
        <div className="relative mx-auto max-w-3xl px-5 text-center lg:px-8">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary shadow-sm backdrop-blur-md transition-colors hover:bg-primary/10">
            <Sparkles className="size-3.5" />
            <span>Pricing & Plans</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight lg:text-5xl">
            Pay for the volume you <span className="text-gradient-brand">actually send</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground lg:text-lg">
            Choose the messaging capacity and tools that fit your workflow. Upgrade whenever your
            sending volume or automation needs grow.
          </p>
        </div>
      </section>

      <section className="relative mx-auto max-w-7xl px-5 py-12 lg:px-8 lg:py-16">
        <div className="mb-8 flex justify-center">
          <div className="inline-flex items-center rounded-full border border-primary/20 bg-surface/50 p-1 shadow-sm backdrop-blur-sm">
            <Button
              size="sm"
              variant={billingCycle === "monthly" ? "default" : "ghost"}
              onClick={() => setBillingCycle("monthly")}
              className={`rounded-full px-5 text-xs transition-all ${billingCycle === "monthly" ? "shadow-md shadow-primary/20" : "hover:bg-primary/10"}`}
            >
              Monthly
            </Button>
            <Button
              size="sm"
              variant={billingCycle === "yearly" ? "default" : "ghost"}
              onClick={() => setBillingCycle("yearly")}
              className={`rounded-full px-5 text-xs transition-all ${billingCycle === "yearly" ? "shadow-md shadow-primary/20" : "hover:bg-primary/10"}`}
            >
              Yearly <span className="ml-1.5 rounded-full bg-success/20 px-1.5 py-0.5 text-[9px] font-bold text-success-foreground uppercase tracking-wider">Save 20%</span>
            </Button>
          </div>
        </div>
        <div
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5"
        >
          {loading ? (
            <div className="flex min-h-48 items-center justify-center lg:col-span-4">
              <Loader2 className="size-6 animate-spin text-primary" />
            </div>
          ) : error ? (
            <p className="text-sm text-destructive lg:col-span-4 text-center">{error}</p>
          ) : (
            displayPlans.map((p) => (
              <article
                key={p.id}
                className={`group relative overflow-hidden flex flex-col rounded-2xl border border-border bg-surface p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/10 ${
                  activePlanId === p.id ? "ring-2 ring-primary shadow-lg shadow-primary/20" : ""
                }`}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                <div className="relative flex-1 flex flex-col">
                  {p.popular && (
                    <span className="mb-3 w-fit rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground shadow-sm shadow-primary/20">
                      Most popular
                    </span>
                  )}
                  {activePlanId === p.id && (
                    <span className="mb-3 w-fit rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                      Current plan
                    </span>
                  )}
                  <h2 className="text-lg font-bold text-foreground">{p.name}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {p.description || "Flexible WhatsApp messaging for your team."}
                  </p>
                  <p className="mt-4 text-3xl font-bold tracking-tight">
                    {p.isTrial
                      ? `${p.trialDays || 3} days free`
                      : billingCycle === "monthly"
                        ? inr(p.monthlyPrice)
                        : inr(p.yearlyPrice)}
                    {!p.isTrial && (
                      <span className="text-sm font-medium text-muted-foreground">
                        /{billingCycle === "monthly" ? "mo" : "yr"}
                      </span>
                    )}
                  </p>
                  {activePlanId === p.id && subscription?.expiryDate && (
                    <p className="mt-1.5 text-[10px] font-medium text-muted-foreground">
                      {subscription.isTrial
                        ? "Trial ends"
                        : `Current billing: ${subscription.billingCycle || "monthly"}`}{" "}
                      ·{" "}
                      {new Date(subscription.expiryDate).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  )}
                  {!p.isTrial && (
                    <p className="mt-1 text-[10px] font-medium text-muted-foreground">+ 18% GST at checkout</p>
                  )}
                  <p className="mt-3 text-xs font-semibold text-primary">
                    {p.messageCreditsUnlimited !== false
                      ? "Unlimited message credits"
                      : [
                          p.isTrial && p.trialMessageCredits
                            ? `${p.trialMessageCredits} credits for ${p.trialDays || 3}-day trial`
                            : !p.isTrial && p.monthlyMessageCredits
                              ? `${p.monthlyMessageCredits} credits/mo`
                              : "",
                          p.dailyMessageCredits ? `${p.dailyMessageCredits} credits/day` : "",
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                  </p>
                  <ul className="mt-5 flex-1 space-y-2 border-t border-border/50 pt-5">
                    {visibleFeatures(p).map((f) => {
                      const detail = featureDetail(f.value);
                      return (
                        <li key={f.key} className="flex items-start gap-2.5 text-xs text-foreground transition-colors group-hover:text-foreground/90">
                          <Check className="mt-0.5 size-3.5 shrink-0 text-primary/70 transition-colors group-hover:text-primary" />
                          <span>
                            <span className="font-medium">{f.name}</span>
                            {detail && <span className="text-muted-foreground"> · {detail}</span>}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  {p.isTrial ? (
                    <Button className="mt-6 w-full text-xs" variant="outline" disabled>
                      Included automatically
                    </Button>
                  ) : activePlanId === p.id && subscription?.billingCycle === billingCycle ? (
                    <Button className="mt-6 w-full text-xs" disabled>
                      Current plan
                    </Button>
                  ) : authService.isAuthenticated() ? (
                    <Button
                      className="mt-6 w-full text-xs transition-all hover:shadow-md hover:shadow-primary/20"
                      variant={p.popular ? "default" : "outline"}
                      disabled={buyingPlanId !== null || quoteLoading || isDowngrade(p)}
                      onClick={() => void openCheckout(p)}
                    >
                      {isDowngrade(p)
                        ? "Downgrade unavailable"
                        : activePlanId === p.id
                          ? "Switch to yearly"
                          : activePlanId
                            ? `Upgrade to ${p.name}`
                            : `Choose ${p.name}`}
                    </Button>
                  ) : (
                    <Button className="mt-6 w-full text-xs transition-all hover:shadow-md hover:shadow-primary/20" variant={p.popular ? "default" : "outline"} asChild>
                      <Link to="/register">Create account</Link>
                    </Button>
                  )}
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <Dialog
        open={Boolean(selectedPlan)}
        onOpenChange={(open) => {
          if (!open && !buyingPlanId) {
            setSelectedPlan(null);
            setCheckoutQuote(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm your plan</DialogTitle>
            <DialogDescription>
              {selectedPlan
                ? `${selectedPlan.name} - ${billingCycle === "monthly" ? `${inr(selectedPlan.monthlyPrice)}/month` : `${inr(selectedPlan.yearlyPrice)}/year`}`
                : "Review your billing details before secure checkout."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-1">
            <div className="grid gap-2">
              <Label htmlFor="billing-email">Billing email</Label>
              <Input
                id="billing-email"
                type="email"
                value={billingEmail}
                readOnly
                required
                placeholder="No email found for this account"
              />
              <p className="text-xs text-muted-foreground">
                This is the verified email on your WAFlow account.
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="billing-phone">Billing mobile number</Label>
              <Input
                id="billing-phone"
                value={billingPhone}
                onChange={(event) => setBillingPhone(event.target.value)}
                inputMode="tel"
                autoComplete="tel"
                required
                placeholder="Enter mobile number"
              />
            </div>
            {checkoutQuote && (
              <div className="space-y-2 rounded-md border border-border bg-surface-muted p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    {checkoutQuote.isUpgrade ? "New plan price" : "Plan price"}
                  </span>
                  <span>{inr(checkoutQuote.baseAmount)}</span>
                </div>
                {checkoutQuote.prorationCredit > 0 && (
                  <div className="flex items-center justify-between text-primary">
                    <span>Unused time credit</span>
                    <span>-{inr(checkoutQuote.prorationCredit)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-border pt-2">
                  <span className="text-muted-foreground">Taxable amount</span>
                  <span>{inr(checkoutQuote.taxableAmount)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">GST ({checkoutQuote.gstRate}%)</span>
                  <span>{inr(checkoutQuote.gstAmount)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-border pt-2 font-semibold">
                  <span>Pay today</span>
                  <span>{inr(checkoutQuote.amountDue)}</span>
                </div>
                {checkoutQuote.isUpgrade && (
                  <p className="text-xs text-muted-foreground">
                    Your remaining paid time is credited before secure checkout.
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSelectedPlan(null);
                setCheckoutQuote(null);
              }}
              disabled={buyingPlanId !== null}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void buyPlan()}
              disabled={buyingPlanId !== null || !checkoutQuote}
            >
              {buyingPlanId ? <Loader2 className="size-4 animate-spin" /> : "Continue to payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <section className="relative overflow-hidden border-y border-border bg-surface py-12 lg:py-16">
        <div className="absolute inset-0 bg-grid-faint opacity-50" />
        <div className="relative mx-auto max-w-7xl px-5 lg:px-8">
          <h2 className="text-2xl font-bold tracking-tight text-foreground text-center mb-8">Compare plans</h2>
          <div className="card-surface overflow-x-auto rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-300">
            <table className="w-full min-w-3xl text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted/50">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Feature
                  </th>
                  {displayPlans.map((p) => (
                    <th key={p.id} className="px-5 py-3 text-left text-sm font-bold text-foreground">
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {featureKeys.map((key) => (
                  <tr key={key} className="group/row transition-colors hover:bg-muted/30">
                    <td className="px-5 py-3 text-xs font-medium text-muted-foreground transition-colors group-hover/row:text-foreground/90">{featureLabel(key)}</td>
                    {displayPlans.map((plan) => {
                      const v = featureValue(plan, key);
                      return (
                        <td key={plan.id} className="px-5 py-3 text-xs">
                          {typeof v === "boolean" ? (
                            v ? (
                              <Check className="size-3.5 text-primary" />
                            ) : (
                              <span className="text-muted-foreground/30">-</span>
                            )
                          ) : (
                            <span className="font-semibold tabular-nums text-foreground/80">{v ?? "-"}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-12 lg:py-16">
        <h2 className="text-2xl font-bold tracking-tight text-center">Billing questions</h2>
        <Accordion type="single" collapsible className="mt-8 space-y-3">
          {faqs.map((f) => (
            <AccordionItem key={f.q} value={f.q} className="rounded-xl border border-border bg-surface px-5 py-1 shadow-sm transition-all hover:border-primary/20 hover:shadow-md">
              <AccordionTrigger className="text-left text-sm font-semibold hover:no-underline">{f.q}</AccordionTrigger>
              <AccordionContent className="text-xs leading-relaxed text-muted-foreground pb-4">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
        <div className="mt-12 text-center">
          {authService.isAuthenticated() ? (
            <Button size="default" className="group rounded-full px-8 shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/30" asChild>
              <Link to="/dashboard">
                Go to dashboard <ArrowRight className="ml-2 size-3.5 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
          ) : (
            <Button size="default" className="group rounded-full px-8 shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/30" asChild>
              <Link to="/register">
                Create your account <ArrowRight className="ml-2 size-3.5 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
          )}
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
