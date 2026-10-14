ALTER TABLE `anime` ADD `studios` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
-- Every anime is marked unchecked so the Settings AniList-details backfill
-- refetches it and fills the new studios column.
UPDATE `anime` SET `ani_list_details_checked_at` = NULL;
