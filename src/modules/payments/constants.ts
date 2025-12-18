export const PLAN_PRICING = {
  single: { price: 6000, credits: 1, title: "Análisis único" },
  monthly_3: { price: 9000, credits: 3, title: "Plan Mensual 3 Créditos" },
  monthly_10: { price: 15000, credits: 10, title: "Plan Mensual 10 Créditos" },
  addon_1: { price: 2000, credits: 1, title: "Pack 1 Análisis Extra" },
  addon_3: { price: 5000, credits: 3, title: "Pack 3 Análisis Extra" },
  addon_5: { price: 7000, credits: 5, title: "Pack 5 Análisis Extra" },
} as const;
