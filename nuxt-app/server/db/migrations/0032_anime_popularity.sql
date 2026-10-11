ALTER TABLE `anime` ADD `popularity` integer;--> statement-breakpoint
-- Marks every anime unchecked so the Settings AniList-details backfill
-- refetches it and fills popularity, which endless party difficulty reads.
UPDATE `anime` SET `ani_list_details_checked_at` = NULL;
