import { Hono } from "hono";
import { Bindings } from "../types";
import { images } from "../db/schema";
import { createDbClient } from "../db/client";
import { validateSession } from "../lib/auth/session";

const app = new Hono<{ Bindings: Bindings }>();

app.post("/upload", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader) return c.json({ error: "Unauthorized" }, 401);
  const token = authHeader.replace("Bearer ", "");

  const db = createDbClient(c.env.DB);
  const sessionData = await validateSession(db, token);
  if (!sessionData) return c.json({ error: "Unauthorized" }, 401);
  const { user } = sessionData;

  const body = await c.req.parseBody();
  const file = body["file"];

  if (!file || !(file instanceof File)) {
    return c.json({ error: "No file uploaded" }, 400);
  }

  if (file.type !== "image/webp") {
    return c.json({ error: "Only WebP images are supported" }, 415);
  }

  let arrayBuffer = await file.arrayBuffer();
  const mimeType = file.type;
  const filename = file.name.endsWith(".webp")
    ? file.name
    : `${file.name.replace(/\.[^/.]+$/, "")}.webp`;

  const key = `${user.id}/${Date.now()}-${filename}`;

  await c.env.STORAGE.put(key, arrayBuffer, {
    httpMetadata: { contentType: mimeType },
  });

  const [image] = await db
    .insert(images)
    .values({
      userId: user.id,
      filename: filename,
      r2Key: key,
      mimeType: mimeType,
      sizeBytes: arrayBuffer.byteLength,
      uploadedAt: new Date(),
    })
    .returning();

  // const CDN_URL = "https://cdn.vidrieraencasa.com";

  return c.json({
    success: true,
    image: {
      ...image,
      url: `${c.env.CDN_URL}/${image.r2Key}`,
    },
  });
});

export default app;
