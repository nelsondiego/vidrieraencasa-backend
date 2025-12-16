import { Hono } from "hono";
import { z } from "zod";
import { createDbClient } from "../db/client";
import { users, sessions } from "../db/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "../lib/auth/hash-password";
import { verifyPassword } from "../lib/auth/verify-password";
import { createSession, validateSession } from "../lib/auth/session";
import { Bindings } from "../types";

const app = new Hono<{ Bindings: Bindings }>();

const registerSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(2),
  password: z.string().min(8),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

app.post("/register", async (c) => {
  const body = await c.req.json();
  const validation = registerSchema.safeParse(body);

  if (!validation.success) {
    return c.json({ error: validation.error.issues[0].message }, 400);
  }

  const { email, fullName, password } = validation.data;
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
      passwordHash,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  const session = await createSession(db, newUser.id);

  return c.json({
    success: true,
    user: { id: newUser.id, email: newUser.email, fullName: newUser.fullName },
    session,
  });
});

app.post("/login", async (c) => {
  const body = await c.req.json();
  const validation = loginSchema.safeParse(body);

  if (!validation.success) {
    return c.json({ error: validation.error.issues[0].message }, 400);
  }

  const { email, password } = validation.data;
  const db = createDbClient(c.env.DB);

  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (!user) {
    return c.json({ error: "Credenciales inválidas" }, 401);
  }

  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    return c.json({ error: "Credenciales inválidas" }, 401);
  }

  const session = await createSession(db, user.id);

  return c.json({
    success: true,
    user: { id: user.id, email: user.email, fullName: user.fullName },
    session,
  });
});

app.post("/logout", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader) return c.json({ success: true }); // No session to logout
  const token = authHeader.replace("Bearer ", "");

  const db = createDbClient(c.env.DB);

  // Delete session
  await db.delete(sessions).where(eq(sessions.token, token));

  return c.json({ success: true });
});

app.get("/me", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader) return c.json({ error: "Unauthorized" }, 401);
  const token = authHeader.replace("Bearer ", "");

  const db = createDbClient(c.env.DB);
  const sessionData = await validateSession(db, token);

  if (!sessionData) return c.json({ error: "Unauthorized" }, 401);

  const { user } = sessionData;
  return c.json({ success: true, user });
});

export default app;
