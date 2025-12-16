import { Hono } from "hono";
import { Bindings } from "../../types";
import createPreference from "./createPreference";
import handleWebhook from "./handleWebhook";

const payments = new Hono<{ Bindings: Bindings }>();

payments.route("/", createPreference);
payments.route("/", handleWebhook);

export default payments;
