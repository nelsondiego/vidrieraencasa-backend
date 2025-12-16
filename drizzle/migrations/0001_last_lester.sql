PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_addons` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`credits` integer NOT NULL,
	`credits_remaining` integer NOT NULL,
	`purchase_date` integer NOT NULL,
	`expiration_date` integer NOT NULL,
	`status` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_addons`("id", "user_id", "credits", "credits_remaining", "purchase_date", "expiration_date", "status") SELECT "id", "user_id", "credits", "credits_remaining", "purchase_date", "expiration_date", "status" FROM `addons`;--> statement-breakpoint
DROP TABLE `addons`;--> statement-breakpoint
ALTER TABLE `__new_addons` RENAME TO `addons`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `addons_user_id_idx` ON `addons` (`user_id`);--> statement-breakpoint
CREATE INDEX `addons_status_idx` ON `addons` (`status`);--> statement-breakpoint
CREATE INDEX `addons_expiration_date_idx` ON `addons` (`expiration_date`);--> statement-breakpoint
CREATE TABLE `__new_analyses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`image_id` integer NOT NULL,
	`status` text NOT NULL,
	`diagnosis` text,
	`pdf_r2_key` text,
	`created_at` integer NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`image_id`) REFERENCES `images`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_analyses`("id", "user_id", "image_id", "status", "diagnosis", "pdf_r2_key", "created_at", "completed_at") SELECT "id", "user_id", "image_id", "status", "diagnosis", "pdf_r2_key", "created_at", "completed_at" FROM `analyses`;--> statement-breakpoint
DROP TABLE `analyses`;--> statement-breakpoint
ALTER TABLE `__new_analyses` RENAME TO `analyses`;--> statement-breakpoint
CREATE INDEX `analyses_user_id_idx` ON `analyses` (`user_id`);--> statement-breakpoint
CREATE INDEX `analyses_status_idx` ON `analyses` (`status`);--> statement-breakpoint
CREATE INDEX `analyses_user_id_created_at_idx` ON `analyses` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `__new_credit_transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`type` text NOT NULL,
	`amount` integer NOT NULL,
	`source_type` text,
	`source_id` integer,
	`analysis_id` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`analysis_id`) REFERENCES `analyses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_credit_transactions`("id", "user_id", "type", "amount", "source_type", "source_id", "analysis_id", "created_at") SELECT "id", "user_id", "type", "amount", "source_type", "source_id", "analysis_id", "created_at" FROM `credit_transactions`;--> statement-breakpoint
DROP TABLE `credit_transactions`;--> statement-breakpoint
ALTER TABLE `__new_credit_transactions` RENAME TO `credit_transactions`;--> statement-breakpoint
CREATE INDEX `credit_transactions_user_id_idx` ON `credit_transactions` (`user_id`);--> statement-breakpoint
CREATE INDEX `credit_transactions_type_idx` ON `credit_transactions` (`type`);--> statement-breakpoint
CREATE INDEX `credit_transactions_created_at_idx` ON `credit_transactions` (`created_at`);--> statement-breakpoint
CREATE TABLE `__new_images` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`filename` text NOT NULL,
	`r2_key` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`uploaded_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_images`("id", "user_id", "filename", "r2_key", "mime_type", "size_bytes", "uploaded_at") SELECT "id", "user_id", "filename", "r2_key", "mime_type", "size_bytes", "uploaded_at" FROM `images`;--> statement-breakpoint
DROP TABLE `images`;--> statement-breakpoint
ALTER TABLE `__new_images` RENAME TO `images`;--> statement-breakpoint
CREATE UNIQUE INDEX `images_r2_key_unique` ON `images` (`r2_key`);--> statement-breakpoint
CREATE INDEX `images_user_id_idx` ON `images` (`user_id`);--> statement-breakpoint
CREATE INDEX `images_r2_key_idx` ON `images` (`r2_key`);--> statement-breakpoint
CREATE TABLE `__new_payments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`mercado_pago_id` text NOT NULL,
	`amount` integer NOT NULL,
	`currency` text NOT NULL,
	`status` text NOT NULL,
	`plan_type` text NOT NULL,
	`metadata` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_payments`("id", "user_id", "mercado_pago_id", "amount", "currency", "status", "plan_type", "metadata", "created_at", "updated_at") SELECT "id", "user_id", "mercado_pago_id", "amount", "currency", "status", "plan_type", "metadata", "created_at", "updated_at" FROM `payments`;--> statement-breakpoint
DROP TABLE `payments`;--> statement-breakpoint
ALTER TABLE `__new_payments` RENAME TO `payments`;--> statement-breakpoint
CREATE UNIQUE INDEX `payments_mercado_pago_id_unique` ON `payments` (`mercado_pago_id`);--> statement-breakpoint
CREATE INDEX `payments_user_id_idx` ON `payments` (`user_id`);--> statement-breakpoint
CREATE INDEX `payments_mercado_pago_id_idx` ON `payments` (`mercado_pago_id`);--> statement-breakpoint
CREATE INDEX `payments_status_idx` ON `payments` (`status`);--> statement-breakpoint
CREATE TABLE `__new_plans` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`type` text NOT NULL,
	`credits` integer NOT NULL,
	`credits_remaining` integer NOT NULL,
	`start_date` integer NOT NULL,
	`end_date` integer NOT NULL,
	`reset_date` integer,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_plans`("id", "user_id", "type", "credits", "credits_remaining", "start_date", "end_date", "reset_date", "status", "created_at") SELECT "id", "user_id", "type", "credits", "credits_remaining", "start_date", "end_date", "reset_date", "status", "created_at" FROM `plans`;--> statement-breakpoint
DROP TABLE `plans`;--> statement-breakpoint
ALTER TABLE `__new_plans` RENAME TO `plans`;--> statement-breakpoint
CREATE INDEX `plans_user_id_idx` ON `plans` (`user_id`);--> statement-breakpoint
CREATE INDEX `plans_status_idx` ON `plans` (`status`);--> statement-breakpoint
CREATE INDEX `plans_user_id_status_idx` ON `plans` (`user_id`,`status`);--> statement-breakpoint
CREATE TABLE `__new_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_sessions`("id", "user_id", "token", "expires_at", "created_at") SELECT "id", "user_id", "token", "expires_at", "created_at" FROM `sessions`;--> statement-breakpoint
DROP TABLE `sessions`;--> statement-breakpoint
ALTER TABLE `__new_sessions` RENAME TO `sessions`;--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_unique` ON `sessions` (`token`);--> statement-breakpoint
CREATE INDEX `sessions_user_id_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `sessions_token_idx` ON `sessions` (`token`);--> statement-breakpoint
CREATE INDEX `sessions_expires_at_idx` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `__new_users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_users`("id", "email", "password_hash", "created_at", "updated_at") SELECT "id", "email", "password_hash", "created_at", "updated_at" FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `users_email_idx` ON `users` (`email`);