export const PLAN_PRICING = {
  single: { price: 6000, credits: 1, title: "Análisis único" },
  monthly_3: { price: 9000, credits: 3, title: "Plan Mensual 3 Créditos" },
  monthly_10: { price: 15000, credits: 10, title: "Plan Mensual 10 Créditos" },
  addon: { price: 3000, credits: 1, title: "Crédito adicional" },
} as const;
