ALTER TABLE `anime` ADD `season` text;--> statement-breakpoint
-- Feature 78: every anime is marked unchecked so the Settings AniList-details
-- backfill refetches it and fills the new season column.
UPDATE `anime` SET `ani_list_details_checked_at` = NULL;
