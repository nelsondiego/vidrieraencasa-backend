import { eq, and, desc } from "drizzle-orm";
import { plans, addons, creditTransactions } from "../../db/schema";
import { DbClient } from "../../db/client";

export type RefundUserCreditResult =
  | { success: true; refundedTo: "plan" | "addon"; sourceId: number }
  | { success: false; error: string };

/**
 * Refund one credit to user's account
 * Restores credit to original source (plan or add-on)
 * Creates audit log in credit_transactions
 * @param db - Database client
 * @param userId - User ID
 * @param analysisId - Analysis ID to find original consumption transaction
 * @returns Success with refund details or error
 */
export async function refundUserCredit(
  db: DbClient,
  userId: number,
  analysisId: number
): Promise<RefundUserCreditResult> {
  const now = new Date();

  // Find the original consumption transaction for this analysis
  const consumeTransaction = await db.query.creditTransactions.findFirst({
    where: and(
      eq(creditTransactions.userId, userId),
      eq(creditTransactions.analysisId, analysisId),
      eq(creditTransactions.type, "consume")
    ),
    orderBy: [desc(creditTransactions.createdAt)],
  });

  if (!consumeTransaction) {
    return {
      success: false,
      error: "No se encontró la transacción de consumo original",
    };
  }

  if (!consumeTransaction.sourceType || !consumeTransaction.sourceId) {
    return {
      success: false,
      error: "La transacción de consumo no tiene información de origen",
    };
  }

  // Refund to original source
  if (consumeTransaction.sourceType === "plan") {
    const plan = await db.query.plans.findFirst({
      where: eq(plans.id, consumeTransaction.sourceId),
    });

    if (!plan) {
      return {
        success: false,
        error: "No se encontró el plan original",
      };
    }

    // Restore credit to plan
    await db
      .update(plans)
      .set({
        creditsRemaining: plan.creditsRemaining + 1,
      })
      .where(eq(plans.id, plan.id));

    // Create refund audit log
    await db.insert(creditTransactions).values({
      userId: userId,
      type: "refund",
      amount: 1,
      sourceType: "plan",
      sourceId: plan.id,
      analysisId,
      createdAt: now,
    });

    return {
      success: true,
      refundedTo: "plan",
      sourceId: plan.id,
    };
  } else {
    // Refund to add-on
    const addon = await db.query.addons.findFirst({
      where: eq(addons.id, consumeTransaction.sourceId),
    });

    if (!addon) {
      return {
        success: false,
        error: "No se encontró el add-on original",
      };
    }

    // Restore credit to add-on
    await db
      .update(addons)
      .set({
        creditsRemaining: addon.creditsRemaining + 1,
      })
      .where(eq(addons.id, addon.id));

    // Create refund audit log
    await db.insert(creditTransactions).values({
      userId: userId,
      type: "refund",
      amount: 1,
      sourceType: "addon",
      sourceId: addon.id,
      analysisId,
      createdAt: now,
    });

    return {
      success: true,
      refundedTo: "addon",
      sourceId: addon.id,
    };
  }
}
