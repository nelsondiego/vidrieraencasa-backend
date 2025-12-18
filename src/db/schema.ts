import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

// Users table
export const users = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    email: text("email").notNull().unique(),
    fullName: text("full_name").notNull(),
    passwordHash: text("password_hash").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
    dni: text("dni"),
  },
  (table) => ({
    emailIdx: index("users_email_idx").on(table.email),
  })
);

// Sessions table
export const sessions = sqliteTable(
  "sessions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    token: text("token").notNull().unique(),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => ({
    userIdIdx: index("sessions_user_id_idx").on(table.userId),
    tokenIdx: index("sessions_token_idx").on(table.token),
    expiresAtIdx: index("sessions_expires_at_idx").on(table.expiresAt),
  })
);

// Plans table
export const plans = sqliteTable(
  "plans",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    type: text("type", {
      enum: ["single", "monthly_3", "monthly_10"],
    }).notNull(),
    credits: integer("credits").notNull(),
    creditsRemaining: integer("credits_remaining").notNull(),
    startDate: integer("start_date", { mode: "timestamp" }).notNull(),
    endDate: integer("end_date", { mode: "timestamp" }).notNull(),
    resetDate: integer("reset_date", { mode: "timestamp" }),
    status: text("status", { enum: ["active", "expired"] }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => ({
    userIdIdx: index("plans_user_id_idx").on(table.userId),
    statusIdx: index("plans_status_idx").on(table.status),
    userIdStatusIdx: index("plans_user_id_status_idx").on(
      table.userId,
      table.status
    ),
  })
);

// Add-ons table
export const addons = sqliteTable(
  "addons",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    credits: integer("credits").notNull(),
    creditsRemaining: integer("credits_remaining").notNull(),
    purchaseDate: integer("purchase_date", { mode: "timestamp" }).notNull(),
    expirationDate: integer("expiration_date", { mode: "timestamp" }).notNull(),
    status: text("status", { enum: ["active", "expired"] }).notNull(),
  },
  (table) => ({
    userIdIdx: index("addons_user_id_idx").on(table.userId),
    statusIdx: index("addons_status_idx").on(table.status),
    expirationDateIdx: index("addons_expiration_date_idx").on(
      table.expirationDate
    ),
  })
);

// Images table
export const images = sqliteTable(
  "images",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    filename: text("filename").notNull(),
    r2Key: text("r2_key").notNull().unique(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    uploadedAt: integer("uploaded_at", { mode: "timestamp" }).notNull(),
  },
  (table) => ({
    userIdIdx: index("images_user_id_idx").on(table.userId),
    r2KeyIdx: index("images_r2_key_idx").on(table.r2Key),
  })
);

// Analyses table
export const analyses = sqliteTable(
  "analyses",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    imageId: integer("image_id")
      .notNull()
      .references(() => images.id),
    status: text("status", {
      enum: ["pending", "processing", "completed", "failed"],
    }).notNull(),
    diagnosis: text("diagnosis"),
    pdfR2Key: text("pdf_r2_key"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    completedAt: integer("completed_at", { mode: "timestamp" }),
  },
  (table) => ({
    userIdIdx: index("analyses_user_id_idx").on(table.userId),
    statusIdx: index("analyses_status_idx").on(table.status),
    userIdCreatedAtIdx: index("analyses_user_id_created_at_idx").on(
      table.userId,
      table.createdAt
    ),
  })
);

// Payments table
export const payments = sqliteTable(
  "payments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    mercadoPagoId: text("mercado_pago_id").notNull().unique(),
    amount: integer("amount").notNull(),
    currency: text("currency").notNull(),
    status: text("status", {
      enum: ["pending", "approved", "rejected", "refunded"],
    }).notNull(),
    planType: text("plan_type").notNull(),
    metadata: text("metadata"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => ({
    userIdIdx: index("payments_user_id_idx").on(table.userId),
    mercadoPagoIdIdx: index("payments_mercado_pago_id_idx").on(
      table.mercadoPagoId
    ),
    statusIdx: index("payments_status_idx").on(table.status),
  })
);

// Credit transactions table (audit log)
export const creditTransactions = sqliteTable(
  "credit_transactions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    type: text("type", {
      enum: ["consume", "refund", "allocate", "reset", "expire"],
    }).notNull(),
    amount: integer("amount").notNull(),
    sourceType: text("source_type", { enum: ["plan", "addon"] }),
    sourceId: integer("source_id"),
    analysisId: integer("analysis_id").references(() => analyses.id),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => ({
    userIdIdx: index("credit_transactions_user_id_idx").on(table.userId),
    typeIdx: index("credit_transactions_type_idx").on(table.type),
    createdAtIdx: index("credit_transactions_created_at_idx").on(
      table.createdAt
    ),
  })
);

// Relations

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  plans: many(plans),
  addons: many(addons),
  images: many(images),
  analyses: many(analyses),
  payments: many(payments),
  creditTransactions: many(creditTransactions),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const plansRelations = relations(plans, ({ one }) => ({
  user: one(users, {
    fields: [plans.userId],
    references: [users.id],
  }),
}));

export const addonsRelations = relations(addons, ({ one }) => ({
  user: one(users, {
    fields: [addons.userId],
    references: [users.id],
  }),
}));

export const imagesRelations = relations(images, ({ one, many }) => ({
  user: one(users, {
    fields: [images.userId],
    references: [users.id],
  }),
  analyses: many(analyses),
}));

export const analysesRelations = relations(analyses, ({ one, many }) => ({
  user: one(users, {
    fields: [analyses.userId],
    references: [users.id],
  }),
  image: one(images, {
    fields: [analyses.imageId],
    references: [images.id],
  }),
  creditTransactions: many(creditTransactions),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  user: one(users, {
    fields: [payments.userId],
    references: [users.id],
  }),
}));

export const creditTransactionsRelations = relations(
  creditTransactions,
  ({ one }) => ({
    user: one(users, {
      fields: [creditTransactions.userId],
      references: [users.id],
    }),
    analysis: one(analyses, {
      fields: [creditTransactions.analysisId],
      references: [analyses.id],
    }),
  })
);
