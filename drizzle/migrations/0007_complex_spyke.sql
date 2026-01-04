PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_plans` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`type` text NOT NULL,
	`credits` integer NOT NULL,
	`credits_remaining` integer NOT NULL,
	`start_date` integer NOT NULL,
	`end_date` integer,
	`reset_date` integer,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_plans`("id", "user_id", "type", "credits", "credits_remaining", "start_date", "end_date", "reset_date", "status", "created_at") SELECT "id", "user_id", "type", "credits", "credits_remaining", "start_date", "end_date", "reset_date", "status", "created_at" FROM `plans`;--> statement-breakpoint
DROP TABLE `plans`;--> statement-breakpoint
ALTER TABLE `__new_plans` RENAME TO `plans`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `plans_user_id_idx` ON `plans` (`user_id`);--> statement-breakpoint
CREATE INDEX `plans_status_idx` ON `plans` (`status`);--> statement-breakpoint
CREATE INDEX `plans_user_id_status_idx` ON `plans` (`user_id`,`status`);