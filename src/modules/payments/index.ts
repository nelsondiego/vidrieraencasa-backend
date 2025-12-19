import { Hono } from "hono";
import { Bindings } from "../../types";
import createPreference from "./createPreference";
import handleWebhook from "./handleWebhook";
import processPayment from "./processPayment";

const payments = new Hono<{ Bindings: Bindings }>();

payments.route("/", createPreference);
payments.route("/", handleWebhook);
payments.route("/", processPayment);

export default payments;
