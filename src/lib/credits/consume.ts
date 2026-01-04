import { eq, and, gt, gte, or, isNull } from "drizzle-orm";
import { plans, addons, creditTransactions } from "../../db/schema";
import { DbClient } from "../../db/client";

export type ConsumeUserCreditResult =
  | {
      success: true;
      remainingCredits: number;
      sourceType: "plan" | "addon";
      sourceId: number;
      isFreeTier: boolean;
    }
  | { success: false; error: string };

/**
 * Consume one credit from user's account
 * Priority: consume from plan first, then add-on
 * Creates audit log in credit_transactions
 * @param db - Database client
 * @param userId - User ID
 * @param analysisId - Optional analysis ID for audit trail
 * @returns Success with remaining credits or error
 */
export async function consumeUserCredit(
  db: DbClient,
  userId: number,
  analysisId?: number
): Promise<ConsumeUserCreditResult> {
  const now = new Date();

  // Try to consume from plan first (priority)
  const activePlans = await db.query.plans.findMany({
    where: and(
      eq(plans.userId, userId),
      eq(plans.status, "active"),
      gt(plans.creditsRemaining, 0),
      or(isNull(plans.endDate), gte(plans.endDate, now))
    ),
    orderBy: (plans, { asc }) => [asc(plans.createdAt)],
    limit: 1,
  });

  if (activePlans.length > 0) {
    const plan = activePlans[0];

    // Update plan credits
    await db
      .update(plans)
      .set({
        creditsRemaining: plan.creditsRemaining - 1,
      })
      .where(eq(plans.id, plan.id));

    // Create audit log
    await db.insert(creditTransactions).values({
      userId: userId,
      type: "consume",
      amount: -1,
      sourceType: "plan",
      sourceId: plan.id,
      analysisId: analysisId ?? null,
      createdAt: now,
    });

    return {
      success: true,
      remainingCredits: plan.creditsRemaining - 1,
      sourceType: "plan",
      sourceId: plan.id,
      isFreeTier: plan.type === "freetier",
    };
  }

  // If no plan credits, try add-on
  const activeAddons = await db.query.addons.findMany({
    where: and(
      eq(addons.userId, userId),
      eq(addons.status, "active"),
      gt(addons.creditsRemaining, 0),
      gte(addons.expirationDate, now) // Filter by expiration date in query
    ),
    orderBy: (addons, { asc }) => [asc(addons.purchaseDate)],
    limit: 1,
  });

  if (activeAddons.length > 0) {
    const addon = activeAddons[0];

    // Update add-on credits
    await db
      .update(addons)
      .set({
        creditsRemaining: addon.creditsRemaining - 1,
      })
      .where(eq(addons.id, addon.id));

    // Create audit log
    await db.insert(creditTransactions).values({
      userId: userId,
      type: "consume",
      amount: -1,
      sourceType: "addon",
      sourceId: addon.id,
      analysisId: analysisId ?? null,
      createdAt: now,
    });

    return {
      success: true,
      remainingCredits: addon.creditsRemaining - 1,
      sourceType: "addon",
      sourceId: addon.id,
      isFreeTier: false,
    };
  }

  // No credits available
  return {
    success: false,
    error: "No tienes créditos suficientes para realizar este análisis",
  };
}
