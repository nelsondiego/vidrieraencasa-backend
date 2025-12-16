import "./polyfills";
import { Hono } from "hono";
import { cors } from "hono/cors";
import auth from "./modules/auth";
import storage from "./routes/storage";
import payments from "./modules/payments";
import credits from "./routes/credits";
import analysis from "./routes/analysis";
import { Bindings } from "./types";

const app = new Hono<{ Bindings: Bindings }>();

app.use(
  "/*",
  cors({
    origin: (origin) => {
      if (!origin) return null;

      const allowedExactOrigins = new Set([
        "http://localhost:5173",
        "https://vidrieraencasa.com",
        "https://www.vidrieraencasa.com",
      ]);

      if (allowedExactOrigins.has(origin)) return origin;

      try {
        const url = new URL(origin);
        if (url.protocol !== "https:") return null;

        if (url.hostname === "vidrieraencasa.com") return origin;
        if (url.hostname.endsWith(".vidrieraencasa.com")) return origin;

        return null;
      } catch {
        return null;
      }
    },
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
    credentials: true,
  })
);

app.route("/auth", auth);
app.route("/storage", storage);
app.route("/payments", payments);
app.route("/credits", credits);
app.route("/analysis", analysis);

app.get("/", (c) => {
  return c.json({ status: "ok", service: "Vidriera En Casa API" });
});

app.get("/cdn-cgi/image/:key{.+$}", async (c) => {
  const key = c.req.param("key");
  const object = await c.env.STORAGE.get(key);

  if (!object) {
    return c.text("Image not found", 404);
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);

  return new Response(object.body, {
    headers,
  });
});

export default app;
