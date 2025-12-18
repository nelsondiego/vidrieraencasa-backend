import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { createDbClient } from "../../db/client";
import { users } from "../../db/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "../../lib/auth/hash-password";
import { createSession } from "../../lib/auth/session";
import { Bindings } from "../../types";

const registerUser = new Hono<{ Bindings: Bindings }>();

const registerSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(2),
  dni: z.string().optional(),
  password: z.string().min(8),
});

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
  }
);

export default registerUser;
