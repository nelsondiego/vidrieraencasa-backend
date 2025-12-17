import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { createDbClient } from "../../db/client";
import { users } from "../../db/schema";
import { eq } from "drizzle-orm";
import { verifyPassword } from "../../lib/auth/verify-password";
import { createSession } from "../../lib/auth/session";
import { Bindings } from "../../types";

const loginUser = new Hono<{ Bindings: Bindings }>();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

loginUser.post("/login", zValidator("json", loginSchema), async (c) => {
  const { email, password } = c.req.valid("json");
  const db = createDbClient(c.env.DB);

  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (!user) {
    return c.json(
      {
        error:
          "No pudimos iniciar sesión. Revisá tu correo y contraseña e intentá de nuevo.",
      },
      401
    );
  }

  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    return c.json(
      {
        error:
          "No pudimos iniciar sesión. Revisá tu correo y contraseña e intentá de nuevo.",
      },
      401
    );
  }

  const session = await createSession(db, user.id);

  return c.json({
    success: true,
    message: `¡Bienvenido/a, ${user.fullName}! Tu sesión se inició correctamente.`,
    user: { id: user.id, email: user.email, fullName: user.fullName },
    session,
  });
});

export default loginUser;
