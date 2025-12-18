import { Hono } from "hono";
import { Bindings } from "../../types";
import registerUser from "./registerUser";
import loginUser from "./loginUser";
import logoutUser from "./logoutUser";
import getCurrentUser from "./getCurrentUser";
import updateUserDni from "./updateUserDni";

const auth = new Hono<{ Bindings: Bindings }>();

auth.route("/", registerUser);
auth.route("/", loginUser);
auth.route("/", logoutUser);
auth.route("/", getCurrentUser);
auth.route("/", updateUserDni);

export default auth;
