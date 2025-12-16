import { eq, and } from "drizzle-orm";
import { plans } from "../../db/schema";
import { DbClient } from "../../db/client";

/**
 * Check if user has an active monthly plan
 * Used to prevent duplicate monthly plan subscriptions
 * @param db - Database client
 * @param userId - User ID to check
 * @returns True if user has an active monthly plan (monthly_3 or monthly_10)
 */
export async function checkActivePlan(
  db: DbClient,
  userId: number
): Promise<boolean> {
  try {
    // Query for active monthly plans (not single)
    const activePlans = await db.query.plans.findMany({
      where: and(eq(plans.userId, userId), eq(plans.status, "active")),
    });

    // Filter for monthly plans only (exclude single)
    const monthlyPlans = activePlans.filter(
      (plan) => plan.type === "monthly_3" || plan.type === "monthly_10"
    );

    return monthlyPlans.length > 0;
  } catch (error) {
    console.error("Failed to check active plan", { userId, error });
    // Return false on error to allow purchase attempt (fail open)
    return false;
  }
}
