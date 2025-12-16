import { eq, and, gte } from "drizzle-orm";
import { plans, addons } from "../../db/schema";
import { DbClient } from "../../db/client";

export type AvailableCredits = {
  planCredits: number;
  addonCredits: number;
  total: number;
};

/**
 * Calculate total available credits for a user
 * Sums remaining credits from active plans and add-ons
 * Filters by active status and expiration dates
 * @param db - Database client
 * @param userId - User ID to calculate credits for
 * @returns Breakdown of available credits
 */
export async function calculateAvailableCredits(
  db: DbClient,
  userId: number
): Promise<AvailableCredits> {
  const now = new Date();

  // Query active plans
  const activePlans = await db.query.plans.findMany({
    where: and(eq(plans.userId, userId), eq(plans.status, "active")),
  });

  // Query active add-ons that haven't expired
  // using gte for expirationDate >= now directly in query for efficiency
  const activeAddons = await db.query.addons.findMany({
    where: and(
      eq(addons.userId, userId), 
      eq(addons.status, "active"),
      gte(addons.expirationDate, now)
    ),
  });

  // Sum plan credits
  const planCredits = activePlans.reduce(
    (sum, plan) => sum + plan.creditsRemaining,
    0
  );

  // Sum add-on credits
  const addonCredits = activeAddons.reduce(
    (sum, addon) => sum + addon.creditsRemaining,
    0
  );

  return {
    planCredits,
    addonCredits,
    total: planCredits + addonCredits,
  };
}
