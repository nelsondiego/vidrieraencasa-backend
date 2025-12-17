import { Hono } from "hono";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { Bindings } from "../../types";
import { createDbClient } from "../../db/client";
import { payments, plans, addons, creditTransactions } from "../../db/schema";
import { eq } from "drizzle-orm";
import { PLAN_PRICING } from "./constants";

const handleWebhook = new Hono<{ Bindings: Bindings }>();

handleWebhook.post("/webhook", async (c) => {
  const db = createDbClient(c.env.DB);
  const signature = c.req.header("x-signature");
  const requestId = c.req.header("x-request-id");

  // Basic logging
  console.log("Webhook received", {
    signature,
    requestId,
    query: c.req.query(),
  });

  let body;
  try {
    body = await c.req.json();
    console.log("Webhook body", body);
  } catch (e) {
    console.error("Failed to parse webhook body", e);
    return c.json({ error: "Invalid body" }, 400);
  }

  // MercadoPago sends validation notification or payment notification
  // Structure: { action: 'payment.created', api_version: 'v1', data: { id: '...' }, date_created: '...', id: ..., live_mode: true, type: 'payment', user_id: ... }
  // Sometimes MP sends 'topic' query param instead of body structure for certain events, but modern webhooks use body.

  if (body.type === "payment" || body.topic === "payment") {
    const paymentId = body.id || body.data?.id || body.resource; // data.id is standard for v1, resource is for topic

    if (!paymentId) {
      console.error("Missing payment ID in webhook");
      return c.json({ error: "Missing payment ID" }, 400);
    }

    const client = new MercadoPagoConfig({
      accessToken: c.env.MERCADOPAGO_ACCESS_TOKEN,
    });
    const paymentClient = new Payment(client);

    try {
      const payment = await paymentClient.get({ id: paymentId });
      console.log("Payment status:", payment.status);

      if (payment.status === "approved") {
        const existingPayment = await db.query.payments.findFirst({
          where: eq(payments.mercadoPagoId, payment.id!.toString()),
        });

        if (existingPayment) {
          console.log("Payment already processed", payment.id);
          return c.json({ status: "ok" });
        }

        const metadata = payment.metadata;
        if (!metadata) {
          console.error("No metadata found in payment", payment.id);
          return c.json({ error: "No metadata" }, 400);
        }

        const userId = Number(metadata.user_id);
        const planType = metadata.plan_type as keyof typeof PLAN_PRICING;

        if (!userId || !planType) {
          console.error("Invalid metadata", metadata);
          return c.json({ error: "Invalid metadata" }, 400);
        }

        const planDetails = PLAN_PRICING[planType];
        if (!planDetails) {
          console.error("Invalid plan type", planType);
          return c.json({ error: "Invalid plan type" }, 400);
        }

        const now = new Date();

        // 1. Record Payment
        await db.insert(payments).values({
          userId,
          mercadoPagoId: payment.id!.toString(),
          amount: payment.transaction_amount!,
          currency: payment.currency_id!,
          status: "approved",
          planType,
          metadata: JSON.stringify(metadata),
          createdAt: now,
          updatedAt: now,
        });

        // 2. Allocate Credits
        if (planType === "addon") {
          // Add-on logic
          // Expires at end of current month
          const expirationDate = new Date(
            now.getFullYear(),
            now.getMonth() + 1,
            0,
            23,
            59,
            59
          );

          const [addon] = await db
            .insert(addons)
            .values({
              userId,
              credits: planDetails.credits,
              creditsRemaining: planDetails.credits,
              purchaseDate: now,
              expirationDate,
              status: "active",
            })
            .returning();

          await db.insert(creditTransactions).values({
            userId,
            type: "allocate",
            amount: planDetails.credits,
            sourceType: "addon",
            sourceId: addon.id,
            createdAt: now,
          });
        } else {
          // Plan logic (single, monthly_3, monthly_10)
          // Expires/Resets in 1 month
          const endDate = new Date(now);
          endDate.setMonth(endDate.getMonth() + 1);

          // Reset date is same as end date for now (renewal point)
          const resetDate = new Date(endDate);

          const [plan] = await db
            .insert(plans)
            .values({
              userId,
              type: planType,
              credits: planDetails.credits,
              creditsRemaining: planDetails.credits,
              startDate: now,
              endDate: endDate,
              resetDate: resetDate,
              status: "active",
              createdAt: now,
            })
            .returning();

          await db.insert(creditTransactions).values({
            userId,
            type: "allocate",
            amount: planDetails.credits,
            sourceType: "plan",
            sourceId: plan.id,
            createdAt: now,
          });
        }

        console.log(
          `Payment ${paymentId} processed successfully for user ${userId}`
        );
        return c.json({ status: "ok" });
      } else {
        console.log(`Payment ${paymentId} is not approved: ${payment.status}`);
        // We can optionally record other statuses like rejected if we want, but logic mainly cares about approved
        // For now, just return ok to acknowledge webhook
        return c.json({ status: "ok" });
      }
    } catch (error) {
      console.error("Error processing payment", error);
      // Returning 500 will make MP retry later
      return c.json({ error: "Internal server error" }, 500);
    }
  }

  return c.json({ status: "ok" });
});

export default handleWebhook;
