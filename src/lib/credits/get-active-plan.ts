import { eq, and } from "drizzle-orm";
import { plans } from "../../db/schema";
import { DbClient } from "../../db/client";

type PlanType = "single" | "monthly_3" | "monthly_10";
type PlanStatus = "active" | "expired";

type ActivePlanInfo = {
  id: number;
  type: PlanType;
  status: PlanStatus;
  credits: number;
  creditsRemaining: number;
  startDate: Date;
  endDate: Date;
  resetDate: Date | null;
};

export async function getActivePlan(
    db: DbClient,
    userId: number
): Promise<ActivePlanInfo | null> {
    // Query for active plans
    const activePlans = await db.query.plans.findMany({
      where: and(eq(plans.userId, userId), eq(plans.status, "active")),
      orderBy: (plans, { desc }) => [desc(plans.createdAt)],
      limit: 1,
    });

    if (activePlans.length === 0) {
      return null;
    }

    const plan = activePlans[0];

    return {
        id: plan.id,
        type: plan.type as PlanType,
        status: plan.status as PlanStatus,
        credits: plan.credits,
        creditsRemaining: plan.creditsRemaining,
        startDate: plan.startDate,
        endDate: plan.endDate,
        resetDate: plan.resetDate,
    };
}
