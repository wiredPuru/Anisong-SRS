CREATE TABLE `card_track` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`card_id` integer NOT NULL,
	`criterion` text NOT NULL,
	`box` integer DEFAULT 1 NOT NULL,
	`streak` integer DEFAULT 0 NOT NULL,
	`next_review_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`card_id`) REFERENCES `card`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `card_track_unique` ON `card_track` (`card_id`,`criterion`);--> statement-breakpoint
ALTER TABLE `deck` ADD `grading_criterion` text DEFAULT 'title' NOT NULL;--> statement-breakpoint
ALTER TABLE `review_log` ADD `criterion` text DEFAULT 'title' NOT NULL;