PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_media_library_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`library_paths` text DEFAULT '[]' NOT NULL,
	`default_download_folder` text,
	`daily_new_card_limit` integer,
	`box_one_streak_required` integer DEFAULT 2 NOT NULL,
	`stream_cache_max_bytes` integer DEFAULT 1073741824 NOT NULL,
	`playback_mode` text DEFAULT 'auto' NOT NULL,
	`auto_download` integer DEFAULT false NOT NULL,
	`themes_only` integer DEFAULT false NOT NULL,
	`include_insert_songs` integer DEFAULT false NOT NULL,
	`clip_source` text DEFAULT 'anisongdb' NOT NULL,
	`party_auto_download` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_media_library_settings`("id", "library_paths", "default_download_folder", "daily_new_card_limit", "box_one_streak_required", "stream_cache_max_bytes", "playback_mode", "auto_download", "themes_only", "include_insert_songs", "clip_source", "party_auto_download") SELECT "id", "library_paths", "default_download_folder", "daily_new_card_limit", "box_one_streak_required", "stream_cache_max_bytes", "playback_mode", "auto_download", "themes_only", "include_insert_songs", "clip_source", "party_auto_download" FROM `media_library_settings`;--> statement-breakpoint
DROP TABLE `media_library_settings`;--> statement-breakpoint
ALTER TABLE `__new_media_library_settings` RENAME TO `media_library_settings`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
UPDATE `media_library_settings` SET `box_one_streak_required` = 2 WHERE `box_one_streak_required` = 3;
