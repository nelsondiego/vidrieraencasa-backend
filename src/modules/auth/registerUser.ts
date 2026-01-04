import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { createDbClient } from "../../db/client";
import { users, plans, creditTransactions } from "../../db/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "../../lib/auth/hash-password";
import { createSession } from "../../lib/auth/session";
import { Bindings } from "../../types";
import { PLAN_PRICING } from "../payments/constants";

const registerUser = new Hono<{ Bindings: Bindings }>();

const registerSchema = z.object({
  email: z.email(),
  fullName: z.string().min(2),
  dni: z.string().optional(),
  password: z.string().min(8),
});

/**
 * Registers a new user and assigns a 1-credit freetier plan.
 * @param c Hono context
 */
registerUser.post(
  "/register",
  zValidator("json", registerSchema),
  async (c) => {
    const { email, fullName, dni, password } = c.req.valid("json");
    const db = createDbClient(c.env.DB);

    // Check if user exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (existingUser) {
      return c.json(
        { error: "Ya existe una cuenta con este correo electrónico" },
        409
      );
    }

    const passwordHash = await hashPassword(password);
    const now = new Date();

    try {
      // Create the user
      const [newUser] = await db
        .insert(users)
        .values({
          email,
          fullName,
          dni,
          passwordHash,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      // Allocate 1 freetier credit
      const freetierDetails = PLAN_PRICING.freetier;

      const [plan] = await db
        .insert(plans)
        .values({
          userId: newUser.id,
          type: "freetier",
          credits: freetierDetails.credits,
          creditsRemaining: freetierDetails.credits,
          startDate: now,
          endDate: null, // No expiration for freetier
          resetDate: null,
          status: "active",
          createdAt: now,
        })
        .returning();

      // Record the allocation transaction
      await db.insert(creditTransactions).values({
        userId: newUser.id,
        type: "allocate",
        amount: freetierDetails.credits,
        sourceType: "plan",
        sourceId: plan.id,
        createdAt: now,
      });

      const session = await createSession(db, newUser.id);

      return c.json({
        success: true,
        user: {
          id: newUser.id,
          email: newUser.email,
          fullName: newUser.fullName,
          dni: newUser.dni,
        },
        session,
      });
    } catch (error) {
      console.error("Error during registration process:", error);
      return c.json({ error: "Error interno durante el registro" }, 500);
    }
  }
);

export default registerUser;
