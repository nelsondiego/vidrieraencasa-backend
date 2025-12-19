import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { createDbClient } from "../../db/client";
import { plans, addons } from "../../db/schema";
import { validateSession } from "../../lib/auth/session";
import { Bindings } from "../../types";

const processPayment = new Hono<{ Bindings: Bindings }>();

// Schema definition based on BACKEND_SPEC.md
const paymentSchema = z.object({
  formData: z.object({
    transaction_amount: z.number(),
    token: z.string(),
    description: z.string().optional(),
    installments: z.number(),
    payment_method_id: z.string(),
    issuer_id: z.coerce.number(),
    payer: z.object({
      email: z.email(),
      identification: z.object({
        type: z.string(),
        number: z.string(),
      }),
    }),
  }),
  planType: z.string(),
});

processPayment.post(
  "/process",
  zValidator("json", paymentSchema),
  async (c) => {
    // 1. Auth Check
    const authHeader = c.req.header("Authorization");
    if (!authHeader) return c.json({ error: "Unauthorized" }, 401);
    const token = authHeader.replace("Bearer ", "");

    const db = createDbClient(c.env.DB);
    const sessionData = await validateSession(db, token);

    if (!sessionData) return c.json({ error: "Unauthorized" }, 401);
    const userId = sessionData.user.id;

    const { formData, planType } = c.req.valid("json");

    try {
      // 2. Initialize Mercado Pago
      const client = new MercadoPagoConfig({
        accessToken: c.env.MERCADOPAGO_ACCESS_TOKEN,
      });
      const payment = new Payment(client);

      // 3. Create Payment
      const paymentData = {
        transaction_amount: formData.transaction_amount,
        token: formData.token,
        description: formData.description,
        installments: formData.installments,
        payment_method_id: formData.payment_method_id,
        issuer_id: formData.issuer_id,
        payer: {
          email: formData.payer.email,
          identification: {
            type: formData.payer.identification.type,
            number: formData.payer.identification.number,
          },
        },
      };

      // Use Idempotency Key from headers or generate one
      // It is highly recommended that the frontend sends this key to ensure idempotency on retries
      const idempotencyKey =
        c.req.header("X-Idempotency-Key") || crypto.randomUUID();

      const requestOptions = {
        idempotencyKey,
      };

      const result = await payment.create({
        body: paymentData,
        requestOptions,
      });

      // 4. Verify Payment Status
      if (result.status === "approved") {
        const now = new Date();
        const startDate = now;
        const endDate = new Date(now);
        endDate.setDate(endDate.getDate() + 30); // Default 30 days validity

        // 5. Activate Plan/Addon in DB
        if (["single", "monthly_3", "monthly_10"].includes(planType)) {
          let credits = 0;
          if (planType === "single") credits = 1;
          else if (planType === "monthly_3") credits = 3;
          else if (planType === "monthly_10") credits = 10;

          await db.insert(plans).values({
            userId,
            type: planType as any,
            credits,
            creditsRemaining: credits,
            startDate,
            endDate,
            status: "active",
            createdAt: now,
          });
        } else if (planType.startsWith("addon_")) {
          // format: addon_5 (5 credits)
          const parts = planType.split("_");
          const credits = parseInt(parts[1], 10) || 1;

          await db.insert(addons).values({
            userId,
            credits,
            creditsRemaining: credits,
            purchaseDate: now,
            expirationDate: endDate,
            status: "active",
          });
        }

        return c.json({
          success: true,
          data: result,
        });
      } else {
        return c.json(
          {
            success: false,
            error: "El pago no fue aprobado",
            status: result.status,
            status_detail: result.status_detail,
          },
          400
        );
      }
    } catch (error: any) {
      console.error("Payment processing error:", error);
      const status = error.status || 500;
      return c.json(
        {
          success: false,
          error: error.message || "Error interno al procesar el pago",
          cause: error.cause,
        },
        status as any
      );
    }
  }
);

export default processPayment;
