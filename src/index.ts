import "./polyfills";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import auth from "./modules/auth";
import storage from "./routes/storage";
import payments from "./modules/payments";
import credits from "./routes/credits";
import analysis from "./routes/analysis";
import { Bindings } from "./types";

const app = new Hono<{ Bindings: Bindings }>();

app.use(logger());

app.use(
  "/*",
  cors({
    origin: (origin) => {
      // Allow requests with no origin (e.g. server-to-server webhooks, curl, mobile apps)
      if (!origin) return "*";

      // Local development
      if (origin.startsWith("http://localhost:")) return origin;

      // Production and subdomains
      if (
        origin &&
        (origin.endsWith(".vidrieraencasa.com") ||
          origin.endsWith(".vidrieraencasa.test") ||
          origin.endsWith(".ngrok-free.app") ||
          origin === "https://vidrieraencasa.com" ||
          origin === "https://vidrieraencasa.test")
      ) {
        return origin;
      }

      // Strict mode: if it doesn't match allowed origins, return null to block it.
      return null;
    },
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "x-signature",
      "x-request-id",
      "ngrok-skip-browser-warning",
    ],
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
