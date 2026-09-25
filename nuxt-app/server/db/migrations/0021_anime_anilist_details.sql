ALTER TABLE `anime` ADD `year` integer;--> statement-breakpoint
ALTER TABLE `anime` ADD `format` text;--> statement-breakpoint
ALTER TABLE `anime` ADD `average_score` integer;--> statement-breakpoint
ALTER TABLE `anime` ADD `genres` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `anime` ADD `tags` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `anime` ADD `ani_list_details_checked_at` integer;