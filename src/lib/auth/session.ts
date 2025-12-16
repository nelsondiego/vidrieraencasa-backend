import { eq } from "drizzle-orm";
import { sessions, users } from "../../db/schema";
import { DbClient } from "../../db/client";

const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

export function generateSessionToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function calculateSessionExpiration(now: Date = new Date()): Date {
  return new Date(now.getTime() + SESSION_DURATION_MS);
}

export async function createSession(db: DbClient, userId: number) {
  const token = generateSessionToken();
  const expiresAt = calculateSessionExpiration();
  const now = new Date();

  await db.insert(sessions).values({
    userId,
    token,
    expiresAt,
    createdAt: now,
  });

  return { token, expiresAt };
}

export async function validateSession(db: DbClient, token: string) {
  const result = await db
    .select({
      user: users,
      session: sessions
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.token, token))
    .get();

  if (!result) return null;

  const { session, user } = result;

  if (new Date() > session.expiresAt) {
    await db.delete(sessions).where(eq(sessions.id, session.id));
    return null;
  }

  return { session, user };
}
