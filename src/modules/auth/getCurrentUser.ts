import { Hono } from "hono";
import { createDbClient } from "../../db/client";
import { validateSession } from "../../lib/auth/session";
import { Bindings } from "../../types";

const getCurrentUser = new Hono<{ Bindings: Bindings }>();

getCurrentUser.get("/me", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader) return c.json({ error: "Unauthorized" }, 401);
  const token = authHeader.replace("Bearer ", "");

  const db = createDbClient(c.env.DB);
  const sessionData = await validateSession(db, token);

  if (!sessionData) return c.json({ error: "Unauthorized" }, 401);

  const { user } = sessionData;
  return c.json({ success: true, user });
});

export default getCurrentUser;
