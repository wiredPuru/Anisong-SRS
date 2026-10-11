CREATE TABLE `party_censor` (
	`card_id` integer PRIMARY KEY NOT NULL,
	`track` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
