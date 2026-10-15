import { NextResponse } from "next/server";
import {
  constructWebhookEvent,
  isEventProcessed,
  markEventProcessed,
  updateBillingAccount,
} from "@/lib/stripe/client";
import { recipeStore } from "@/lib/recipes/store";
import type Stripe from "stripe";

export async function POST(req: Request) {
  let event: Stripe.Event;

  try {
    const rawBody = await req.text();
    const signature = req.headers.get("stripe-signature");

    event = constructWebhookEvent(rawBody, signature);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err);
    return NextResponse.json(
      { error: "Webhook signature verification failed" },
      { status: 400 }
    );
  }

  // Idempotency check: if event already processed, acknowledge with 200 OK
  const alreadyProcessed = await isEventProcessed(event.id);
  if (alreadyProcessed) {
    return NextResponse.json({ received: true, deduplicated: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data?.object as Stripe.Checkout.Session | undefined;
        const userId = session?.metadata?.userId || (session?.client_reference_id as string | undefined);
        const customerId = session?.customer as string | undefined;
        const subscriptionId = session?.subscription as string | undefined;

        if (userId) {
          await updateBillingAccount(userId, {
            stripeCustomerId: customerId || null,
            stripeSubscriptionId: subscriptionId || null,
            plan: "pro",
            status: "active",
            graceEndsAt: null,
          });
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data?.object as Stripe.Subscription | undefined;
        const userId = subscription?.metadata?.userId;
        const status = subscription?.status;
        const rawPeriodEnd = (subscription as unknown as { current_period_end?: number })?.current_period_end;
        const periodEnd = rawPeriodEnd
          ? new Date(rawPeriodEnd * 1000).toISOString()
          : null;

        if (userId) {
          if (status === "active") {
            await updateBillingAccount(userId, {
              stripeSubscriptionId: subscription.id,
              plan: "pro",
              status: "active",
              currentPeriodEnd: periodEnd,
              graceEndsAt: null,
            });
          } else if (status === "past_due") {
            // Initiate 14-day grace period
            const graceEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
            await updateBillingAccount(userId, {
              status: "past_due",
              graceEndsAt,
            });
          } else if (status === "canceled" || status === "unpaid") {
            // Revert to Free plan. Excess recipes remain paused indefinitely (never deleted).
            await updateBillingAccount(userId, {
              plan: "free",
              status: status === "unpaid" ? "unpaid" : "canceled",
              graceEndsAt: null,
            });

            // Pause recipes beyond Free limit (2 max active)
            const userRecipes = await recipeStore.listRecipes(userId);
            const activeRecipes = userRecipes.filter((r) => r.status === "active" || r.status === "deploying");
            if (activeRecipes.length > 2) {
              const excess = activeRecipes.slice(2);
              for (const r of excess) {
                await recipeStore.updateRecipe(userId, r.id, { status: "inactive" });
              }
            }
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data?.object as Stripe.Subscription | undefined;
        const userId = subscription?.metadata?.userId;

        if (userId) {
          await updateBillingAccount(userId, {
            plan: "free",
            status: "canceled",
            graceEndsAt: null,
          });

          // Pause excess recipes beyond Free limit (max 2)
          const userRecipes = await recipeStore.listRecipes(userId);
          const activeRecipes = userRecipes.filter((r) => r.status === "active" || r.status === "deploying");
          if (activeRecipes.length > 2) {
            const excess = activeRecipes.slice(2);
            for (const r of excess) {
              await recipeStore.updateRecipe(userId, r.id, { status: "inactive" });
            }
          }
        }
        break;
      }

      default:
        // Ignore unhandled event types gracefully
        break;
    }

    await markEventProcessed(
      event.id,
      event.type,
      event as unknown as Record<string, unknown>
    );
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error(`Error processing Stripe webhook ${event.type}:`, error);
    return NextResponse.json(
      { error: "Internal error processing webhook" },
      { status: 500 }
    );
  }
}
