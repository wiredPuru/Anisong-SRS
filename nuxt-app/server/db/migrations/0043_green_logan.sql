CREATE TABLE `kanji_default_story` (
	`char` text PRIMARY KEY NOT NULL,
	`text` text,
	`author` text,
	`fetched_at` integer DEFAULT (unixepoch()) NOT NULL
);
