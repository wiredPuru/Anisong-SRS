CREATE TABLE `kanji_card` (
	`char` text PRIMARY KEY NOT NULL,
	`box` integer DEFAULT 1 NOT NULL,
	`streak` integer DEFAULT 0 NOT NULL,
	`next_review_at` integer DEFAULT (unixepoch()) NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
