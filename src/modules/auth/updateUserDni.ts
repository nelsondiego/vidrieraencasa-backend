import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { createDbClient } from "../../db/client";
import { validateSession } from "../../lib/auth/session";
import { users } from "../../db/schema";
import { eq } from "drizzle-orm";
import { Bindings } from "../../types";

const updateUserDni = new Hono<{ Bindings: Bindings }>();

const updateDniSchema = z.object({
  dni: z.string().min(1, "El DNI es requerido"),
});

updateUserDni.put(
  "/me/dni",
  zValidator("json", updateDniSchema),
  async (c) => {
    const authHeader = c.req.header("Authorization");
    if (!authHeader) return c.json({ error: "Unauthorized" }, 401);
    const token = authHeader.replace("Bearer ", "");

    const db = createDbClient(c.env.DB);
    const sessionData = await validateSession(db, token);

    if (!sessionData) return c.json({ error: "Unauthorized" }, 401);

    const { user } = sessionData;
    const { dni } = c.req.valid("json");

    const [updatedUser] = await db
      .update(users)
      .set({ dni, updatedAt: new Date() })
      .where(eq(users.id, user.id))
      .returning();

    return c.json({
      success: true,
      user: updatedUser,
    });
  }
);

export default updateUserDni;
