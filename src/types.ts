import { D1Database, R2Bucket } from "@cloudflare/workers-types";

export type Bindings = {
  DB: D1Database;
  STORAGE: R2Bucket;
  APP_URL: string;
  MERCADOPAGO_ACCESS_TOKEN: string;
  MERCADOPAGO_WEBHOOK_SECRET: string;
  MERCADOPAGO_WEBHOOK_URL: string;
  GEMINI_API_KEY: string;
  CDN_URL: string;
};
