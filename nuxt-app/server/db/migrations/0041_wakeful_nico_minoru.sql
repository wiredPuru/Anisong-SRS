CREATE TABLE `kanji_story` (
	`char` text PRIMARY KEY NOT NULL,
	`text` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
