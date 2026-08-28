CREATE TABLE `anime` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ani_list_id` integer NOT NULL,
	`animethemes_id` integer,
	`title_english` text NOT NULL,
	`title_romaji` text NOT NULL,
	`title_native` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `anime_ani_list_id_unique` ON `anime` (`ani_list_id`);--> statement-breakpoint
CREATE TABLE `artist` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `card` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`song_id` integer NOT NULL,
	`local_video_path` text,
	`local_audio_path` text,
	`animethemes_video_url` text,
	`animethemes_audio_url` text,
	`box` integer DEFAULT 1 NOT NULL,
	`next_review_at` integer DEFAULT (unixepoch()) NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`song_id`) REFERENCES `song`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `review_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`card_id` integer NOT NULL,
	`reviewed_at` integer DEFAULT (unixepoch()) NOT NULL,
	`result` text NOT NULL,
	`box_before` integer NOT NULL,
	`box_after` integer NOT NULL,
	FOREIGN KEY (`card_id`) REFERENCES `card`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `song` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`anime_id` integer NOT NULL,
	`artist_id` integer NOT NULL,
	`title` text NOT NULL,
	`theme_slot` text NOT NULL,
	`animethemes_theme_id` integer,
	FOREIGN KEY (`anime_id`) REFERENCES `anime`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`artist_id`) REFERENCES `artist`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `song_anime_theme_slot_unique` ON `song` (`anime_id`,`theme_slot`);