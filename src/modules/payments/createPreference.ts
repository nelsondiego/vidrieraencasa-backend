import { Hono } from "hono";
import { MercadoPagoConfig, Preference } from "mercadopago";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { Bindings } from "../../types";
import { createDbClient } from "../../db/client";
import { validateSession } from "../../lib/auth/session";
import { checkActivePlan } from "../../lib/credits/check-active-plan";
import { PLAN_PRICING } from "./constants";

const createPreference = new Hono<{ Bindings: Bindings }>();

const createPreferenceSchema = z.object({
  planType: z.enum([
    "single",
    "monthly_3",
    "monthly_10",
    "addon_1",
    "addon_3",
    "addon_5",
  ]),
});

createPreference.post(
  "/preference",
  zValidator("json", createPreferenceSchema),
  async (c) => {
    console.log("APP_URL", c.env.APP_URL);
    console.log("valid", c.req.valid("json"));
    const authHeader = c.req.header("Authorization");
    if (!authHeader) return c.json({ error: "Unauthorized" }, 401);
    const token = authHeader.replace("Bearer ", "");

    const db = createDbClient(c.env.DB);
    const sessionData = await validateSession(db, token);
    if (!sessionData) return c.json({ error: "Unauthorized" }, 401);
    const { user } = sessionData;
    const { planType } = c.req.valid("json");
    const planInfo = PLAN_PRICING[planType];

    // Check if user is trying to purchase a monthly plan
    const isMonthlyPlan =
      planType === "monthly_3" ||
      planType === "monthly_10" ||
      planType === "single";

    if (isMonthlyPlan) {
      // Check if user already has an active monthly plan
      const hasActivePlan = await checkActivePlan(db, user.id);

      if (hasActivePlan) {
        return c.json(
          {
            error:
              "Ya tienes un plan mensual activo. No puedes tener más de un plan mensual al mismo tiempo",
          },
          400
        );
      }
    }

    const client = new MercadoPagoConfig({
      accessToken: c.env.MERCADOPAGO_ACCESS_TOKEN,
    });
    const preference = new Preference(client);

    const origin = new URL(c.req.url).origin;
    // In production, ensure this is the public URL
    const notificationUrl = `${c.env.MERCADOPAGO_WEBHOOK_URL}/payments/webhook`;
    console.log("notificationUrl", notificationUrl);
    // Ensure APP_URL is clean
    const appUrl = c.env.APP_URL.trim();
    const isLocalhost =
      appUrl.includes("localhost") || appUrl.includes("127.0.0.1");

    const backUrls = {
      success: `${appUrl}/pago/exito`,
      failure: `${appUrl}/pago/error`,
      pending: `${appUrl}/pago/pendiente`,
    };

    const [firstName, ...lastNameParts] = user.fullName.split(" ");
    const lastName = lastNameParts.join(" ") || " ";

    try {
      const preferenceBody: any = {
        items: [
          {
            id: planType,
            title: planInfo.title,
            quantity: 1,
            unit_price: planInfo.price,
            currency_id: "ARS",
            description: planInfo.title, // Recommended action: Item description
            category_id: "services", // Recommended action: Item category
          },
        ],
        payer: {
          email: user.email,
          name: firstName,
          surname: lastName,
          identification: {
            type: "dni",
            number: user.dni || "",
          },
        },
        back_urls: backUrls,
        notification_url: notificationUrl,
        metadata: {
          user_id: user.id.toString(),
          plan_type: planType,
        },
        external_reference: user.id.toString(), // Mandatory action: External reference
        statement_descriptor: "VIDRIERA EN CASA", // Good practice: Clear name on bank statement
      };

      // Only enable auto_return in production to avoid "invalid_auto_return" errors with localhost
      preferenceBody.auto_return = "approved";
      if (!isLocalhost) {
      }

      const result = await preference.create({
        body: preferenceBody,
      });

      console.log("Preference created successfully", result.id);
      return c.json({ id: result.id });
    } catch (error) {
      console.error("Error creating preference:", error);
      // Log more details if it's a Mercado Pago error
      if (typeof error === "object" && error !== null && "cause" in error) {
        console.error(
          "MP Error Cause:",
          JSON.stringify((error as any).cause, null, 2)
        );
      }
      return c.json({ error: "Failed to create preference" }, 500);
    }
  }
);

export default createPreference;
