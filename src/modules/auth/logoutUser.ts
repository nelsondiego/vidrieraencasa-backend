import { Hono } from "hono";
import { createDbClient } from "../../db/client";
import { sessions } from "../../db/schema";
import { eq } from "drizzle-orm";
import { Bindings } from "../../types";

const logoutUser = new Hono<{ Bindings: Bindings }>();

logoutUser.post("/logout", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader) return c.json({ success: true }); // No session to logout
  const token = authHeader.replace("Bearer ", "");

  const db = createDbClient(c.env.DB);

  // Delete session
  await db.delete(sessions).where(eq(sessions.token, token));

  return c.json({ success: true });
});

export default logoutUser;
